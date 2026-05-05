const MISSING_STOCK_SKU = 'missing-stock';
const INSUFFICIENT_STOCK_REASON = 'insufficient stock';

export const handlers = {
  reserveStock: async (ctx, input) => {
    const eventStore = ctx.eventStore;
    if (eventStore === undefined || typeof eventStore.appendEvents !== 'function') {
      return {
        ok: false,
        error: {
          code: 'COMMAND_HANDLER_ERROR',
          message: 'reserveStock requires runtime eventStore access',
        },
      };
    }

    const orderId = requiredString(input.orderId, 'orderId');
    const sku = requiredString(input.sku, 'sku');
    const quantity = requiredInteger(input.quantity, 'quantity');
    const reservationId = `reservation-${orderId}`;
    const subject = `StockReservation-${reservationId}`;
    const existing = eventStore.readStream(subject).at(-1);
    if (existing !== undefined) {
      return commandResultFromExisting(ctx, existing);
    }

    const rejected = sku === MISSING_STOCK_SKU;
    const after = rejected
      ? {
          id: reservationId,
          orderId,
          sku,
          quantity,
          reason: INSUFFICIENT_STOCK_REASON,
          status: 'rejected',
        }
      : {
          id: reservationId,
          orderId,
          sku,
          quantity,
          reason: null,
          status: 'reserved',
        };

    const eventType = rejected ? 'StockReservationRejected' : 'StockReservationReserve';
    const append = eventStore.appendEvents([
      {
        subject,
        expectedVersion: 0,
        events: [
          {
            id: ctx.nextId(),
            eventType,
            rntAggregateType: 'StockReservation',
            rntAggregateId: reservationId,
            time: ctx.now(),
            actor: ctx.actor ?? null,
            data: { before: null, after },
            rntSchemaVersion: 1,
            correlationId: ctx.correlation.correlationId,
            causationId: ctx.correlation.commandId,
            commandId: ctx.correlation.commandId,
            traceparent: ctx.correlation.traceparent,
          },
        ],
      },
    ])[0];

    return {
      ok: true,
      value: {
        aggregateId: reservationId,
        version: append.lastVersion,
        eventIds: append.appendedEvents.map((event) => event.id),
        commandId: ctx.correlation.commandId,
        correlationId: ctx.correlation.correlationId,
        result: resultFromAfter(after),
      },
    };
  },
};

function commandResultFromExisting(ctx, event) {
  return {
    ok: true,
    value: {
      aggregateId: event.rntAggregateId,
      version: event.rntVersion,
      eventIds: [],
      commandId: ctx.correlation.commandId,
      correlationId: ctx.correlation.correlationId,
      result: resultFromAfter(event.data.after),
    },
  };
}

function resultFromAfter(after) {
  if (after.status === 'rejected') {
    return { reserved: false, reason: after.reason ?? INSUFFICIENT_STOCK_REASON };
  }
  return { reserved: true, reservationId: after.id };
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function requiredInteger(value, name) {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
  return value;
}
