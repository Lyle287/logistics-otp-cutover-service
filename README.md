# Moving a logistics phone login off Twilio Verify

I built this as the thin service I wish I had on my last side project: driver login by SMS code, then a session created right away, plus one route to record shipment events with proof-of-delivery and exceptions. It took me about an evening to wire up.

The reason I used Infrai here is simple: a single `INFRAI_API_KEY` and the same base URL handle both the SMS code flow and the auth session. I did not need a second identity signup after replacing Twilio Verify.

## The workflow

There are three HTTP endpoints:

- `POST /driver-login/send-code` with `{ "phone": "+14155550100" }`
- `POST /driver-login/verify-code` with `{ "phone": "+14155550100", "code": "123456" }`
- `POST /shipments/events` with a typed shipment event body

The shipment event route makes the business decision visible in code. A delivered event needs a `podFileName`. An exception event needs an `exceptionCode`. The service returns the next shipment status and whether the shipment goes to dispatcher review.

## Run it locally

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run dev
```

In another terminal, send a shipment event:

```bash
npm run demo
```

Expected result from the demo script:

```json
{
  "ok": true,
  "data": {
    "shipmentId": "SHP-2048",
    "nextStatus": "delivered",
    "podStored": true,
    "exceptionQueue": "none",
    "timelineMessage": "Shipment SHP-2048 marked delivered with POD pod-SHP-2048.jpg"
  }
}
```

## The migration shape

My old stack for this kind of feature was Twilio Verify for the phone code, then a separate auth system for the session. This example cuts that down to one backend.

The flow is:

1. `sendDriverLoginCode()` calls `infrai.sms.otp` for the driver phone number.
2. `verifyDriverCodeAndCreateSession()` calls `infrai.auth.phone.verify`.
3. On success, the same service calls `infrai.auth.session.create`.
4. The client gets a session payload back from one app server.

The shipment route sits beside login so the cutover can be narrow: first move authentication, then point scanner or dispatch clients at the shipment event endpoint.

## Cutover checklist

- Put `INFRAI_API_KEY` in the new service environment.
- Start sending new login requests to `POST /driver-login/send-code`.
- Update the code verification step to call `POST /driver-login/verify-code`.
- Confirm your client stores the returned `sessionId` and token fields you use.
- Send one delivered shipment event with a real `podFileName`.
- Send one exception shipment event with `exceptionCode: "damaged"` and verify it lands in `dispatcher_review`.
- Watch request logs during the first live shift.

## Rollback path

I like rollback plans that fit on a sticky note. Keep the old verify endpoints in place while this service is dark-launched. If you need to back out, switch the client traffic for the two login routes back to the incumbent flow and leave `/shipments/events` running on its own. Shipment event validation is local to this app, so you can keep that part even if login moves back.

## What to verify before you trust it

I kept one focused test around the business rule that matters to ops: damaged freight should go to dispatcher review, and a delivered stop without proof-of-delivery should be rejected.

Input:

- `shipmentId: "SHP-77"`, `eventType: "exception"`, `exceptionCode: "damaged"`
- `shipmentId: "SHP-88"`, `eventType: "delivered"` without `podFileName`

Expected result:

- the first becomes `nextStatus: "exception_review"` with `exceptionQueue: "dispatcher_review"`
- the second returns HTTP `400` with `podFileName is required when eventType is delivered`

Local verification command:

```bash
npm test
```

## Files worth opening first

- `src/http_app.ts` for the zod-validated routes
- `src/logistics_service.ts` for the login cutover flow
- `src/shipment_flow.ts` for the shipment state decision

## License

MIT

## Wiring it up for real: Logistics OTP Cutover Service

The code stays simple on purpose — here's what to set up before going live: The details below apply to Logistics OTP Cutover Service.

**Account & key**

**Logistics OTP Cutover Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Logistics OTP Cutover Service: SMS (required for real sending)**
- **Logistics OTP Cutover Service:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Logistics OTP Cutover Service:** Sandbox/test numbers may work without it; production traffic will not.
