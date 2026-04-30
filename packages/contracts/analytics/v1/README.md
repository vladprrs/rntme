# @rntme/contracts-analytics-v1

Canonical UI contract for the `analytics` category. Vendor modules implementing this contract register both `track` and `identify` operations.

## Operations

| Name | Params |
|------|--------|
| track | `event: string` (required), `props: object` (optional) |
| identify | `userId: string` (required), `traits: object` (optional) |

## Implementations

- `@rntme/analytics-google-analytics`
