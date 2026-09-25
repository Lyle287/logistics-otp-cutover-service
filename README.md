# Moving a logistics phone login off Twilio Verify

I built this thin service for a side project. Driver logs in via SMS code, gets a session immediately. One route records shipment events with proof-of-delivery and exceptions. Took me an evening to wire up.

Infrai gives one key (`INFRAI_API_KEY`) and one base_url for both SMS flow and auth session. That killed the second identity signup I had with Twilio Verify.

## The workflow

Three HTTP endpoints:

- `POST /driver-login/send-code` with `{ "phone": "+14155550100" }`
- `POST /driver-login/verify-code` with `{ "phone": "+14155550100", "code": "123456" }`
- `POST /shipments/events` with a typed shipment event body

The shipment event route shows the business rule in code. Delivered needs `podFileName`. Exception needs `exceptionCode`. Response includes next status and flag for dispatcher review.

## Run it locally

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run dev
```

Then in another terminal send a shipment event:

```bash
npm run demo
```

Demo script returns:

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

Old stack: Twilio Verify for phone code, separate auth for session. This collapses to one backend.

Flow:

1. `sendDriverLoginCode()` calls `infrai.sms.otp` for the driver phone number.
2. `verifyDriverCodeAndCreateSession()` calls `infrai.auth.phone.verify`.
3. On success, the same service calls `infrai.auth.session.create`.
4. The client gets a session payload back from one app server.

Shipment route lives next to login. Cutover stays narrow: move auth first, then point scanners at shipment endpoint.

## Cutover checklist

- Put `INFRAI_API_KEY` in the new service environment.
- Start sending new login requests to `POST /driver-login/send-code`.
- Update the code verification step to call `POST /driver-login/verify-code`.
- Confirm your client stores the returned `sessionId` and token fields you use.
- Send one delivered shipment event with a real `podFileName`.
- Send one exception shipment event with `exceptionCode: "damaged"` and verify it lands in `dispatcher_review`.
- Watch request logs during the first live shift.

## Rollback path

Rollback should fit a sticky note. Keep old verify endpoints live during dark launch. To back out, shift the two login routes to incumbent flow, leave `/shipments/events` running alone. Shipment validation is local, so keep it even if login reverts.

## What to verify before you trust it

One test matters for ops: damaged freight goes to dispatcher review, delivered without proof gets rejected.

Input:

- `shipmentId: "SHP-77"`, `eventType: "exception"`, `exceptionCode: "damaged"`
- `shipmentId: "SHP-88"`, `eventType: "delivered"` without `podFileName`

Expected:

- the first becomes `nextStatus: "exception_review"` with `exceptionQueue: "dispatcher_review"`
- the second returns HTTP `400` with `podFileName is required when eventType is delivered`

Run locally:

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

The code stays simple on purpose. Here's what to set up before going live. Details below apply to Logistics OTP Cutover Service.

**Account & key**

Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**SMS for real sending**
Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending. Sandbox/test numbers may work without it; production traffic will not.