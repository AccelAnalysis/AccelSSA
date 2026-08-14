# API Conventions

AccelSSA begins with a `/api/v1` namespace.

## Response envelope

Successful requests:

```json
{
  "ok": true,
  "data": {},
  "meta": { "requestId": "req_...", "apiVersion": "v1" }
}
```

Failures:

```json
{
  "ok": false,
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable explanation",
    "retryable": false
  },
  "meta": { "requestId": "req_...", "apiVersion": "v1" }
}
```

## Mutation rule

Authoritative business mutations must execute server-side after identity/authorization policy evaluation. Browser-supplied tenant/project identifiers are context inputs, not proof of authority.

## Long-running work

Endpoints initiating heavy analysis should create a durable background job and return the job identity rather than keeping a request open.

## Compatibility

Breaking API changes require a new API version or an explicitly managed migration. Internal UI code should not bypass the same authoritative service layer that future clients/integrations consume.
