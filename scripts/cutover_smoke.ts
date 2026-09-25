const baseUrl = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  const shipmentResponse = await fetch(`${baseUrl}/shipments/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shipmentId: "SHP-2048",
      eventType: "delivered",
      occurredAt: "2026-09-13T10:00:00Z",
      podFileName: "pod-SHP-2048.jpg",
      notes: "left with consignee",
    }),
  });

  const shipmentJson = await shipmentResponse.json();
  console.log(JSON.stringify(shipmentJson, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
