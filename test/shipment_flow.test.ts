import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHttpApp } from "../src/http_app.js";
import { decideShipmentUpdate } from "../src/shipment_flow.js";

describe("shipment exception routing", () => {
  it("moves a damaged shipment into dispatcher review", () => {
    const result = decideShipmentUpdate({
      shipmentId: "SHP-77",
      eventType: "exception",
      occurredAt: "2026-09-13T09:00:00Z",
      exceptionCode: "damaged",
      notes: "carton torn",
    });

    expect(result).toEqual({
      shipmentId: "SHP-77",
      nextStatus: "exception_review",
      podStored: false,
      exceptionQueue: "dispatcher_review",
      timelineMessage: "Shipment SHP-77 moved to exception review for damaged",
    });
  });

  it("rejects delivered events without a POD file name", async () => {
    const app = createHttpApp();

    const response = await request(app)
      .post("/shipments/events")
      .send({
        shipmentId: "SHP-88",
        eventType: "delivered",
        occurredAt: "2026-09-13T09:15:00Z",
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.fieldErrors.podFileName).toEqual([
      "podFileName is required when eventType is delivered",
    ]);
  });
});
