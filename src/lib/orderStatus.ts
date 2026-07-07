export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const nextStatusMap: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function getAllowedNextStatuses(
  currentStatus: string | null | undefined,
): OrderStatus[] {
  const normalized = (currentStatus || "pending")
    .toLowerCase()
    .replace(/\s+/g, "_") as OrderStatus;

  return nextStatusMap[normalized] || [];
}

export function formatOrderStatus(status: string | null | undefined) {
  const normalized = (status || "pending")
    .toLowerCase()
    .replace(/\s+/g, "_") as OrderStatus;

  return orderStatusLabels[normalized] || status || "Pending";
}