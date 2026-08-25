/**
 * Order Status State Machine
 * Defines all valid order statuses and transitions
 */

// Order fulfillment statuses
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

// Payment statuses (separate from order status)
export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refund_processing"
  | "refunded";

/**
 * Order State Machine Configuration
 * Defines valid transitions for each status
 */
export const ORDER_STATUS_MACHINE: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["in_transit"],
  in_transit: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

/**
 * Payment State Machine Configuration
 * Defines valid transitions for each payment status
 */
export const PAYMENT_STATUS_MACHINE: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["paid", "failed"],
  paid: ["refund_processing"],
  failed: [],
  refund_processing: ["refunded"],
  refunded: [],
};

/**
 * Get valid next statuses for an order
 */
export function getValidOrderStatuses(
  currentStatus: OrderStatus | string,
): OrderStatus[] {
  return ORDER_STATUS_MACHINE[currentStatus as OrderStatus] || [];
}

/**
 * Get valid next payment statuses
 */
export function getValidPaymentStatuses(
  currentStatus: PaymentStatus | string,
  paymentMethod?: string | null,
  orderStatus?: OrderStatus | string,
): PaymentStatus[] {
  if (paymentMethod?.toLowerCase() === "cod" && orderStatus === "delivered") {
    return [];
  }

  const validStatuses =
    PAYMENT_STATUS_MACHINE[currentStatus as PaymentStatus] || [];

  // A COD payment remains non-refundable until collection is confirmed as paid.
  if (
    paymentMethod?.toLowerCase() === "cod" &&
    (currentStatus === "pending" || currentStatus === "failed")
  ) {
    return validStatuses.filter((status) => status !== "refund_processing");
  }

  return validStatuses;
}

/**
 * Check if a status transition is valid
 */
export function isValidOrderTransition(
  currentStatus: OrderStatus | string,
  nextStatus: OrderStatus | string,
): boolean {
  if (currentStatus === nextStatus) return true;
  return getValidOrderStatuses(currentStatus).includes(
    nextStatus as OrderStatus,
  );
}

/**
 * Check if a payment status transition is valid
 */
export function isValidPaymentTransition(
  currentStatus: PaymentStatus | string,
  nextStatus: PaymentStatus | string,
  paymentMethod?: string | null,
  orderStatus?: OrderStatus | string,
): boolean {
  if (currentStatus === nextStatus) return true;
  return getValidPaymentStatuses(
    currentStatus,
    paymentMethod,
    orderStatus,
  ).includes(nextStatus as PaymentStatus);
}

/**
 * Status Labels for Display
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refund_processing: "Refund Processing",
  refunded: "Refunded",
};

/**
 * Check if an order can be cancelled from current status
 */
export function canCancelOrder(status: OrderStatus | string): boolean {
  const cancellableStatuses: OrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
  ];
  return cancellableStatuses.includes(status as OrderStatus);
}

/**
 * Check if tracking number is required for this status
 */
export function isTrackingNumberRequired(
  status: OrderStatus | string,
): boolean {
  const shippingStatuses: OrderStatus[] = [
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
  ];
  return shippingStatuses.includes(status as OrderStatus);
}

/**
 * Get user-friendly description of order status
 */
export function getOrderStatusDescription(
  status: OrderStatus | string,
): string {
  const descriptions: Record<string, string> = {
    pending: "Order received, awaiting confirmation",
    confirmed: "Order confirmed, preparing for shipment",
    processing: "Order is being packed and prepared",
    shipped: "Order has been shipped",
    in_transit: "Order is in transit to delivery location",
    out_for_delivery: "Order is out for delivery today",
    delivered: "Order delivered successfully",
    cancelled: "Order has been cancelled",
    returned: "Order has been returned",
  };
  return descriptions[status] || "Unknown status";
}

/**
 * Type for order status history entry
 */
export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  status: OrderStatus;
  payment_status?: PaymentStatus | null;
  notes?: string | null;
  changed_by: string;
  changed_by_name?: string;
  created_at: string;
}

/**
 * Type for order with all status information
 */
export interface OrderWithStatusInfo {
  id: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
