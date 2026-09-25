export type ShipmentEventInput = {
  shipmentId: string;
  eventType: "pickup" | "in_transit" | "delivered" | "exception";
  occurredAt: string;
  podFileName?: string;
  exceptionCode?: "address_issue" | "customer_unavailable" | "damaged";
  notes?: string;
};

export type ShipmentStatus = "awaiting_pickup" | "moving" | "delivered" | "exception_review";

export type ShipmentDecision = {
  shipmentId: string;
  nextStatus: ShipmentStatus;
  podStored: boolean;
  exceptionQueue: "none" | "dispatcher_review";
  timelineMessage: string;
};

export function decideShipmentUpdate(input: ShipmentEventInput): ShipmentDecision {
  if (input.eventType === "delivered") {
    const podStored = Boolean(input.podFileName);
    return {
      shipmentId: input.shipmentId,
      nextStatus: "delivered",
      podStored,
      exceptionQueue: "none",
      timelineMessage: podStored
        ? `Shipment ${input.shipmentId} marked delivered with POD ${input.podFileName}`
        : `Shipment ${input.shipmentId} marked delivered`,
    };
  }

  if (input.eventType === "exception") {
    return {
      shipmentId: input.shipmentId,
      nextStatus: "exception_review",
      podStored: false,
      exceptionQueue: "dispatcher_review",
      timelineMessage: `Shipment ${input.shipmentId} moved to exception review for ${input.exceptionCode}`,
    };
  }

  if (input.eventType === "pickup") {
    return {
      shipmentId: input.shipmentId,
      nextStatus: "moving",
      podStored: false,
      exceptionQueue: "none",
      timelineMessage: `Shipment ${input.shipmentId} picked up`,
    };
  }

  return {
    shipmentId: input.shipmentId,
    nextStatus: "moving",
    podStored: false,
    exceptionQueue: "none",
    timelineMessage: `Shipment ${input.shipmentId} is in transit`,
  };
}
