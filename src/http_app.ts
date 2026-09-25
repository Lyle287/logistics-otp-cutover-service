import express from "express";
import { z } from "zod";
import { InfraiError } from "./infrai.js";
import { recordShipmentEvent, sendDriverLoginCode, verifyDriverCodeAndCreateSession } from "./logistics_service.js";

const phoneSchema = z.object({
  phone: z.string().min(8),
});

const verifySchema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4),
});

const shipmentEventSchema = z
  .object({
    shipmentId: z.string().min(1),
    eventType: z.enum(["pickup", "in_transit", "delivered", "exception"]),
    occurredAt: z.string().min(1),
    podFileName: z.string().min(1).optional(),
    exceptionCode: z.enum(["address_issue", "customer_unavailable", "damaged"]).optional(),
    notes: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.eventType === "delivered" && !value.podFileName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "podFileName is required when eventType is delivered",
        path: ["podFileName"],
      });
    }

    if (value.eventType === "exception" && !value.exceptionCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exceptionCode is required when eventType is exception",
        path: ["exceptionCode"],
      });
    }
  });

export function createHttpApp() {
  const app = express();
  app.use(express.json());

  app.post("/driver-login/send-code", async (req, res) => {
    const parsed = phoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    try {
      const result = await sendDriverLoginCode(parsed.data);
      return res.json({ ok: true, data: result });
    } catch (error) {
      if (error instanceof InfraiError) {
        return res.status(error.status >= 400 && error.status < 500 ? error.status : 502).json({
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      return res.status(500).json({ ok: false, error: { message: "unexpected error" } });
    }
  });

  app.post("/driver-login/verify-code", async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    try {
      const result = await verifyDriverCodeAndCreateSession(parsed.data);
      return res.json({ ok: true, data: result });
    } catch (error) {
      if (error instanceof InfraiError) {
        return res.status(error.status >= 400 && error.status < 500 ? error.status : 502).json({
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      return res.status(500).json({ ok: false, error: { message: "unexpected error" } });
    }
  });

  app.post("/shipments/events", (req, res) => {
    const parsed = shipmentEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    const decision = recordShipmentEvent(parsed.data);
    return res.json({ ok: true, data: decision });
  });

  return app;
}
