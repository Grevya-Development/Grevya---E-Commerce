export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refund_processing"
  | "refunded";

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Payment failed",
  refund_processing: "Refund in progress",
  refunded: "Refunded",
};

/*
  This mirrors the database state machine for UI guidance only.
  The database RPC remains the actual security enforcement point.
*/
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["in_transit", "returned"],
  in_transit: ["out_for_delivery", "returned"],
  out_for_delivery: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export const VALID_PAYMENT_TRANSITIONS: Record<
  PaymentStatus,
  PaymentStatus[]
> = {
  pending: ["paid", "failed"],
  paid: ["refund_processing"],
  failed: ["pending"],
  refund_processing: ["refunded"],
  refunded: [],
};

export const sellerAllowedStatuses: OrderStatus[] = [
  "confirmed",
  "processing",
  "shipped",
  "cancelled",
];

export const allOrderStatusOptions: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
];

export const allPaymentStatusOptions: PaymentStatus[] = [
  "pending",
  "paid",
  "failed",
  "refund_processing",
  "refunded",
];

export function normalizeOrderStatus(
  status: string | null | undefined,
): OrderStatus {
  const normalized = (status || "pending")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  return (
    allOrderStatusOptions.includes(normalized as OrderStatus)
      ? normalized
      : "pending"
  ) as OrderStatus;
}

export function normalizePaymentStatus(
  status: string | null | undefined,
): PaymentStatus {
  const normalized = (status || "pending")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  return (
    allPaymentStatusOptions.includes(normalized as PaymentStatus)
      ? normalized
      : "pending"
  ) as PaymentStatus;
}

export function getAllowedNextStatuses(
  currentStatus: string | null | undefined,
): OrderStatus[] {
  return VALID_ORDER_TRANSITIONS[normalizeOrderStatus(currentStatus)] || [];
}

export function getSellerNextStatuses(
  currentStatus: string | null | undefined,
): OrderStatus[] {
  return getAllowedNextStatuses(currentStatus).filter((status) =>
    sellerAllowedStatuses.includes(status),
  );
}

export function getAllowedNextPaymentStatuses(
  currentStatus: string | null | undefined,
): PaymentStatus[] {
  return (
    VALID_PAYMENT_TRANSITIONS[normalizePaymentStatus(currentStatus)] || []
  );
}

export function formatOrderStatus(status: string | null | undefined): string {
  return orderStatusLabels[normalizeOrderStatus(status)];
}

export function formatPaymentStatus(
  status: string | null | undefined,
): string {
  return paymentStatusLabels[normalizePaymentStatus(status)];
}


export function getAdminNextStatuses(
  currentStatus: string | null | undefined,
): OrderStatus[] {
  return getAllowedNextStatuses(currentStatus);
}