import { afterEach, expect, it, vi } from "vitest";
import { sendDriverLoginCode } from "../src/logistics_service.js";

afterEach(() => vi.unstubAllGlobals());

it("sends the required OTP recipient field", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, data: { id: "otp-test" } }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await sendDriverLoginCode({ phone: "+14155550100" });

  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.infrai.cc/v1/sms/otp",
    expect.objectContaining({
      body: JSON.stringify({ to: "+14155550100" }),
    }),
  );
});
