# Binding Examples

These examples are compact current binding patterns. Copy from the demo files
for full context.

## Read List

Source example: `demo/notes-blueprint/services/app/bindings/bindings.json`.

```json
{
  "listNotes": {
    "graph": "listNotes",
    "target": {
      "engine": "sqlite",
      "dialect": "sqlite"
    },
    "http": {
      "method": "GET",
      "path": "/notes",
      "parameters": [
        {
          "name": "limit",
          "in": "query",
          "bindTo": "limit",
          "required": false
        }
      ]
    },
    "exposure": "read",
    "inputFrom": {
      "authorization": {
        "from": "header",
        "name": "authorization",
        "required": true
      }
    }
  }
}
```

## Action With Body Parameters

Source example: `demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json`.

```json
{
  "placeOrder": {
    "graph": "placeOrder",
    "target": {
      "engine": "sqlite",
      "dialect": "sqlite"
    },
    "http": {
      "method": "POST",
      "path": "/orders",
      "parameters": [
        {
          "name": "sku",
          "in": "body",
          "bindTo": "sku",
          "required": true
        },
        {
          "name": "quantity",
          "in": "body",
          "bindTo": "quantity",
          "required": true
        }
      ]
    },
    "exposure": "action"
  }
}
```

## Action With Path And Body Parameters

Source example: `demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json`.

```json
{
  "confirmOrder": {
    "graph": "confirmOrder",
    "target": {
      "engine": "sqlite",
      "dialect": "sqlite"
    },
    "http": {
      "method": "POST",
      "path": "/orders/{orderId}/confirm",
      "parameters": [
        {
          "name": "orderId",
          "in": "path",
          "bindTo": "orderId",
          "required": true
        },
        {
          "name": "reservationId",
          "in": "body",
          "bindTo": "reservationId",
          "required": true
        }
      ]
    },
    "exposure": "action"
  }
}
```

## Module-Backed Action

Source example: `demo/cv-extract-blueprint/services/app/bindings/bindings.json`.

```json
{
  "prepareResumeFileUpload": {
    "graph": "prepareResumeFileUpload",
    "target": {
      "engine": "sqlite",
      "dialect": "sqlite"
    },
    "http": {
      "method": "POST",
      "path": "/files/prepare-upload",
      "parameters": [
        {
          "name": "filename",
          "in": "body",
          "bindTo": "filename",
          "required": true
        },
        {
          "name": "contentType",
          "in": "body",
          "bindTo": "contentType",
          "required": true
        },
        {
          "name": "declaredSize",
          "in": "body",
          "bindTo": "declaredSize",
          "required": true
        }
      ]
    },
    "exposure": "action"
  }
}
```

## Redirect Callback Shape

Use this shape only for action callbacks that must return a redirect:

```json
{
  "connectCallback": {
    "graph": "connectCallback",
    "target": {
      "engine": "sqlite",
      "dialect": "sqlite"
    },
    "http": {
      "method": "GET",
      "path": "/callback",
      "parameters": []
    },
    "exposure": "action",
    "inputFrom": {
      "code": {
        "from": "query",
        "name": "code",
        "required": true
      }
    },
    "response": {
      "onOk": { "redirect": "/settings?connected=1", "status": 302 },
      "onErr": { "redirect": "/settings?connected=0", "status": 302 }
    }
  }
}
```
