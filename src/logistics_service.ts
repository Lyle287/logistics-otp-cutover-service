import { randomUUID } from "node:crypto";
import { infrai } from "./infrai.js";
import { decideShipmentUpdate, type ShipmentDecision, type ShipmentEventInput } from "./shipment_flow.js";

export type PhoneLoginRequest = {
  phone: string;
};

export type PhoneVerifyRequest = {
  phone: string;
  code: string;
};

export async function sendDriverLoginCode(input: PhoneLoginRequest) {
  const idempotencyKey = `otp-${input.phone}-${new Date().toISOString().slice(0, 10)}`;
  const result = await infrai.sms.otp(
    {
      to: input.phone,
    },
    {
      "Idempotency-Key": idempotencyKey,
    },
  );

  return {
    deliveryId: result.data.id,
    metadata: result.metadata ?? {},
    nextStep: "verify_code",
  };
}

export async function verifyDriverCodeAndCreateSession(input: PhoneVerifyRequest) {
  const verification = await infrai.auth.phone.verify(
    {
      phone: input.phone,
      code: input.code,
      login: true,
    },
    {
      "Idempotency-Key": `verify-${input.phone}-${input.code}`,
    },
  );

  const userId = verification.data.user_id;
  if (!userId) {
    throw new Error("Verified phone response did not include user_id");
  }

  const session = await infrai.auth.session.create(
    {
      user_id: userId,
      method: "phone",
    },
    {
      "Idempotency-Key": `session-${userId}-${randomUUID()}`,
    },
  );

  return {
    sessionId: session.data.session_id,
    accessToken: session.data.access_token ?? null,
    refreshToken: session.data.refresh_token ?? null,
    userId,
    verificationMetadata: verification.metadata ?? {},
    sessionMetadata: session.metadata ?? {},
  };
}

export function recordShipmentEvent(input: ShipmentEventInput): ShipmentDecision {
  return decideShipmentUpdate(input);
}
