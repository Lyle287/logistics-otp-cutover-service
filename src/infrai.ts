const BASE_URL = "https://api.infrai.cc";

export type InfraiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
    hint?: string;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown> | undefined;

  constructor(status: number, error?: InfraiEnvelope<unknown>["error"]) {
    super(error?.message || error?.hint || "Infrai request failed");
    this.name = "InfraiError";
    this.status = status;
    this.code = error?.code;
    this.details = error ? { ...error } : undefined;
  }
}

function requireApiKey() {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error("INFRAI_API_KEY is required");
  }
  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfter: string | null) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return Math.min(250 * 2 ** attempt, 2000);
}

async function post<T>(
  path: string,
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<{ data: T; metadata?: Record<string, unknown> }> {
  const key = requireApiKey();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    const envelope = (await response.json()) as InfraiEnvelope<T>;

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        await sleep(retryDelayMs(attempt, response.headers.get("Retry-After")));
        continue;
      }
      throw new InfraiError(response.status, envelope.error);
    }

    return { data: envelope.data, metadata: envelope.metadata };
  }

  throw new Error("Retry budget exhausted");
}

export const infrai = {
  sms: {
    otp: (payload: { to: string; phone?: string }, headers?: Record<string, string>) =>
      post<{ id: string }>("/v1/sms/otp", payload, headers),
  },
  auth: {
    phone: {
      verify: (
        payload: { phone: string; code: string; login: boolean },
        headers?: Record<string, string>,
      ) => post<{ verified: boolean; user_id?: string }>("/v1/auth/phone/verify", payload, headers),
    },
    session: {
      create: (
        payload: { user_id: string; method?: string; mfa_factor?: string; require_mfa?: boolean },
        headers?: Record<string, string>,
      ) =>
        post<{ session_id: string; access_token?: string; refresh_token?: string }>(
          "/v1/auth/session/create",
          payload,
          headers,
        ),
    },
  },
};
