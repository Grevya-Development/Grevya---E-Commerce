/**
 * Order Management Service
 * Handles all order-related operations through Supabase
 */

import { supabase } from "./supabaseClient";
import {
  OrderStatus,
  PaymentStatus,
  OrderStatusHistoryEntry,
} from "./orderStateMachine";

export interface OrderUpdateResult {
  success: boolean;
  message: string;
  order_id: string;
  new_order_status?: string;
  new_payment_status?: string;
  error?: string;
}

export interface OrderWithHistory {
  id: string;
  user_id?: string | null;
  total_amount?: number | null;
  order_status?: string | null;
  payment_status?: string | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
  created_at?: string | null;
  shipping_address?: any;
  payment_method?: string | null;
  history?: OrderStatusHistoryEntry[];
}

/**
 * Update order status with backend validation
 * This calls the RPC function which enforces all business rules
 */
export async function updateOrderStatus(
  orderId: string,
  params: {
    newOrderStatus?: OrderStatus;
    newPaymentStatus?: PaymentStatus;
    trackingNumber?: string;
    estimatedDelivery?: string;
    reason?: string;
  },
): Promise<OrderUpdateResult> {
  try {
    const { data, error } = await supabase.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_order_status: params.newOrderStatus || null,
      p_new_payment_status: params.newPaymentStatus || null,
      p_tracking_number: params.trackingNumber || null,
      p_estimated_delivery: params.estimatedDelivery
        ? new Date(params.estimatedDelivery).toISOString()
        : null,
      p_reason: params.reason || null,
    });

    if (error) {
      console.error("RPC error:", error);
      return {
        success: false,
        message: error.message || "Failed to update order status",
        order_id: orderId,
        error: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: "No response from server",
        order_id: orderId,
      };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
      order_id: result.order_id,
      new_order_status: result.new_order_status,
      new_payment_status: result.new_payment_status,
    };
  } catch (err: any) {
    console.error("Error updating order status:", err);
    return {
      success: false,
      message: err.message || "An error occurred",
      order_id: orderId,
      error: err.message,
    };
  }
}

/**
 * Get order with its full status history
 */
export async function getOrderWithHistory(
  orderId: string,
): Promise<OrderWithHistory | null> {
  try {
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `id,created_at,user_id,total_amount,payment_status,status,estimated_delivery,
         tracking_number,shipping_address,payment_method,updated_at`,
      )
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error("Error fetching order:", orderError);
      return null;
    }

    // Get status history
    const { data: history, error: historyError } = await supabase
      .from("order_status_history")
      .select("id,order_id,status,notes,changed_by,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (historyError) {
      console.error("Error fetching status history:", historyError);
    }

    // Map the response
    const mappedOrder: OrderWithHistory = {
      ...order,
      order_status: order.status,
      history: (history || []).map((entry: any) => ({
        id: entry.id,
        order_id: entry.order_id,
        status: entry.status,
        notes: entry.notes,
        changed_by: entry.changed_by,
        changed_by_name: "Unknown",
        created_at: entry.created_at,
      })),
    };

    return mappedOrder;
  } catch (err: any) {
    console.error("Error in getOrderWithHistory:", err);
    return null;
  }
}

/**
 * Get valid next statuses for an order (from backend)
 * This could also use the frontend state machine for client-side calculation
 */
export async function getValidNextStatuses(
  currentOrderStatus: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc(
      "get_valid_order_status_transitions",
      {
        current_status: currentOrderStatus,
      },
    );

    if (error) {
      console.error("Error getting valid statuses:", error);
      return [];
    }

    return (data || []).map(
      (entry: { valid_status: string }) => entry.valid_status,
    );
  } catch (err: any) {
    console.error("Error in getValidNextStatuses:", err);
    return [];
  }
}

/**
 * Get valid next payment statuses (from backend)
 */
export async function getValidNextPaymentStatuses(
  currentPaymentStatus: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc(
      "get_valid_payment_status_transitions",
      {
        current_status: currentPaymentStatus,
      },
    );

    if (error) {
      console.error("Error getting valid payment statuses:", error);
      return [];
    }

    return (data || []).map(
      (entry: { valid_status: string }) => entry.valid_status,
    );
  } catch (err: any) {
    console.error("Error in getValidNextPaymentStatuses:", err);
    return [];
  }
}

/**
 * Bulk get orders for admin dashboard with their statuses
 */
export async function getOrdersForAdmin(limit = 100, offset = 0) {
  try {
    const { data, error, count } = await supabase
      .from("orders")
      .select(
        `id,created_at,user_id,total_amount,payment_status,status,estimated_delivery,
         tracking_number,shipping_address,payment_method,updated_at`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching orders:", error);
      return { orders: [], total: 0, error: error.message };
    }

    const mapped = (data || []).map((r: any) => ({
      ...r,
      order_status: r.status,
    }));

    return {
      orders: mapped,
      total: count || 0,
      error: null,
    };
  } catch (err: any) {
    console.error("Error in getOrdersForAdmin:", err);
    return { orders: [], total: 0, error: err.message };
  }
}
