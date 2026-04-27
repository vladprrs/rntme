/**
 * MCP-shape tool definitions. input_schema is JSON Schema as a Struct.
 */

export const getWeatherTool = {
  name: 'get_weather',
  description: 'Get the current weather in a city.',
  input_schema: {
    fields: {
      type: { stringValue: 'object' },
      properties: {
        structValue: {
          fields: {
            city: {
              structValue: {
                fields: {
                  type: { stringValue: 'string' },
                  description: { stringValue: 'City name' },
                },
              },
            },
          },
        },
      },
      required: { listValue: { values: [{ stringValue: 'city' }] } },
    },
  },
  strict: true,
};

export const lookupUserTool = {
  name: 'lookup_user',
  description: 'Fetch user details by canonical id.',
  input_schema: {
    fields: {
      type: { stringValue: 'object' },
      properties: {
        structValue: {
          fields: {
            user_id: {
              structValue: {
                fields: {
                  type: { stringValue: 'string' },
                },
              },
            },
          },
        },
      },
      required: { listValue: { values: [{ stringValue: 'user_id' }] } },
    },
  },
  strict: true,
};
