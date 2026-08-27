import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Package,
  RefreshCw,
  UserRound,
  AlertCircle,
  MapPin,
  Phone,
  CreditCard,
  Truck,
  History,
  ArrowRight,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";

import SellerLayout from "@/layouts/SellerLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { formatOrderDate } from "@/lib/dateFormat";


/* =========================================================
   TYPES
========================================================= */

interface Order {
  id: string;
  user_id?: string | null;
  total_amount?: number | null;
  status?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
  created_at?: string | null;
  shipping_address?: any;
  payment_method?: string | null;
  payment_reference?: string | null;
}

interface OrderItem {
  id: string;
  order_id?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  product_image?: string | null;
  quantity?: number | null;
  price?: number | null;
  created_at?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
}

interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface StatusHistoryItem {
  id: number;
  order_id: string;
  status: string;
  created_at: string;
}


/* =========================================================
   STATUS CONFIGURATION
========================================================= */

const fulfillmentStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

type FulfillmentStatus = (typeof fulfillmentStatuses)[number];


/*
 * Normal fulfillment flow:
 *
 * pending
 *   ↓
 * confirmed
 *   ↓
 * processing
 *   ↓
 * shipped
 *   ↓
 * in_transit
 *   ↓
 * out_for_delivery
 *   ↓
 * delivered
 */

const nextStatusMap: Record<string, string | null> = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "in_transit",
  in_transit: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,

  cancelled: null,
  refunded: null,
  returned: null,
};


const allStatusOptions = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
  "returned",
];


/* =========================================================
   STATUS HELPERS
========================================================= */

const normalizeStatus = (status?: string | null) => {
  return (status || "pending")
    .toLowerCase()
    .trim()
    .replace(/ /g, "_");
};


const formatStatus = (status?: string | null) => {
  const normalized = normalizeStatus(status);

  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};


const getNextStatus = (status?: string | null) => {
  const normalized = normalizeStatus(status);

  return nextStatusMap[normalized] || null;
};


const formatCurrency = (value?: number | null) =>
  `₹${Number(value || 0).toFixed(2)}`;


const getOrderStatusBadgeClass = (value?: string | null) => {
  const status = normalizeStatus(value);

  if (status === "delivered") {
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  }

  if (
    [
      "shipped",
      "out_for_delivery",
      "in_transit",
      "processing",
    ].includes(status)
  ) {
    return "bg-sky-100 text-sky-700 hover:bg-sky-100";
  }

  if (
    ["cancelled", "refunded", "returned"].includes(status)
  ) {
    return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  }

  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
};


const getPaymentStatusBadgeClass = (value?: string | null) => {
  const status = normalizeStatus(value);

  if (status === "paid") {
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  }

  if (
    ["failed", "refunded"].includes(status)
  ) {
    return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  }

  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
};


const getShortOrderId = (id?: string | null) => {
  if (!id) return "—";

  return `${id.slice(0, 8)}…`;
};


const formatHistoryDate = (date?: string | null) => {
  if (!date) return "—";

  try {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return date;
  }
};


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function SellerOrders() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [profilesById, setProfilesById] =
    useState<Record<string, Profile>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  const [selectedOrderItems, setSelectedOrderItems] =
    useState<OrderItem[]>([]);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [detailsError, setDetailsError] =
    useState<string | null>(null);


  /* =======================================================
     DELIVERY INPUTS
  ======================================================= */

  const [deliveryInputs, setDeliveryInputs] =
    useState<
      Record<
        string,
        {
          estimated_delivery?: string | null;
          tracking_number?: string | null;
          order_status?: string | null;
          payment_status?: string | null;
        }
      >
    >({});


  const [savingDetails, setSavingDetails] =
    useState(false);


  /* =======================================================
     STATUS HISTORY
  ======================================================= */

  const [statusHistory, setStatusHistory] =
    useState<StatusHistoryItem[]>([]);

  const [statusHistoryLoading, setStatusHistoryLoading] =
    useState(false);

  const [statusHistoryOpen, setStatusHistoryOpen] =
    useState(false);

  const [statusHistoryError, setStatusHistoryError] =
    useState<string | null>(null);


  /* =======================================================
     FETCH ORDERS
  ======================================================= */

  const fetchOrders = async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data: any = null;
      let ordersError: any = null;

      try {
        const res = await supabase.rpc(
          "get_seller_order_items_v2",
        );

        data = res.data;
        ordersError = res.error;

        if (ordersError) {
          const res2 = await supabase.rpc(
            "get_seller_order_items",
          );

          data = res2.data;
          ordersError = res2.error;
        }
      } catch {
        const res2 = await supabase.rpc(
          "get_seller_order_items",
        );

        data = res2.data;
        ordersError = res2.error;
      }

      if (ordersError) {
        const msg =
          ordersError.message?.includes(
            "get_seller_order_items",
          )
            ? "Seller order function is missing in Supabase. Run your seller order SQL function."
            : ordersError.message;

        setError(msg);
        setOrders([]);
        setOrderItems([]);
        return;
      }

      const items = (data as OrderItem[]) || [];

      setOrderItems(items);


      /* -----------------------------------------------------
         BUILD UNIQUE ORDERS
      ----------------------------------------------------- */

      const orderMap = new Map<string, Order>();

      items.forEach((item) => {
        if (
          item.order_id &&
          !orderMap.has(item.order_id)
        ) {
          orderMap.set(item.order_id, {
            id: item.order_id,
            order_status:
              item.order_status || null,
            payment_status:
              item.payment_status || null,
            tracking_number:
              item.tracking_number || null,
            estimated_delivery:
              item.estimated_delivery || null,
            created_at:
              item.created_at || null,
          });
        }
      });


      const uniqueOrders =
        Array.from(orderMap.values());

      setOrders(uniqueOrders);


      /* -----------------------------------------------------
         FETCH COMPLETE ORDER INFORMATION
      ----------------------------------------------------- */

      const orderIds = Array.from(
        new Set(
          items
            .map((item) => item.order_id)
            .filter(Boolean),
        ),
      ) as string[];


      if (orderIds.length > 0) {
        const { data: orderData } =
          await supabase
            .from("orders")
            .select(
              `
                id,
                user_id,
                shipping_address,
                payment_status,
                status,
                total_amount,
                payment_method,
                payment_reference,
                tracking_number,
                estimated_delivery,
                created_at
              `,
            )
            .in("id", orderIds);


        const orderLookup = new Map(
          ((orderData as any[]) || []).map(
            (o) => [o.id, o],
          ),
        );


        const enrichedOrders =
          uniqueOrders.map((o) => {
            const fullOrder =
              orderLookup.get(o.id);

            return {
              ...o,

              user_id:
                fullOrder?.user_id,

              shipping_address:
                fullOrder?.shipping_address,

              payment_status:
                fullOrder?.payment_status ||
                o.payment_status,

              total_amount:
                fullOrder?.total_amount,

              payment_method:
                fullOrder?.payment_method,

              payment_reference:
                fullOrder?.payment_reference,

              tracking_number:
                fullOrder?.tracking_number ||
                o.tracking_number,

              estimated_delivery:
                fullOrder?.estimated_delivery ||
                o.estimated_delivery,

              created_at:
                fullOrder?.created_at ||
                o.created_at,

              status:
                fullOrder?.status ||
                o.order_status ||
                "pending",

              order_status:
                fullOrder?.status ||
                o.order_status ||
                "pending",
            };
          });


        setOrders(enrichedOrders as Order[]);


        /* ---------------------------------------------------
           FETCH CUSTOMER PROFILES
        --------------------------------------------------- */

        const userIdsToFetch =
          Array.from(
            new Set(
              enrichedOrders
                .map((o) => o.user_id)
                .filter(Boolean),
            ),
          ) as string[];


        if (userIdsToFetch.length > 0) {
          const { data: profileRows } =
            await supabase
              .from("profiles")
              .select(
                "id,username,full_name,email,phone",
              )
              .in("id", userIdsToFetch);


          setProfilesById(
            ((profileRows as Profile[]) || [])
              .reduce<
                Record<string, Profile>
              >((acc, profile) => {
                acc[profile.id] = profile;

                return acc;
              }, {}),
          );
        }
      }
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to fetch orders",
      );
    } finally {
      setLoading(false);
    }
  };


  /* =======================================================
     CUSTOMER
  ======================================================= */

  const getCustomer = (order: Order) =>
    order.user_id
      ? profilesById[order.user_id]
      : undefined;


  const getCustomerName = (order: Order) => {
    const profile = getCustomer(order);

    return (
      profile?.full_name ||
      profile?.username ||
      profile?.email?.split("@")[0] ||
      "Guest customer"
    );
  };


  /* =======================================================
     SHIPPING PARSER
  ======================================================= */

  const parseShipping = (s: any) => {
    if (!s) return null;

    const full_name =
      s.full_name ||
      s.name ||
      s.firstName ||
      s.first_name ||
      null;

    const phone =
      s.phone ||
      s.mobile ||
      null;

    const line1 =
      s.address_line1 ||
      s.address_line_1 ||
      s.line1 ||
      s.address ||
      s.address_line ||
      null;

    const line2 =
      s.address_line2 ||
      s.address_line_2 ||
      s.line2 ||
      s.address_extra ||
      null;

    const city =
      s.city || null;

    const state =
      s.state || null;

    const pincode =
      s.pincode ||
      s.postal_code ||
      s.postcode ||
      s.pin ||
      null;

    const country =
      s.country || null;

    return {
      full_name,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      country,
    };
  };


  /* =======================================================
     GET ORDER ITEMS
  ======================================================= */

  const getOrderItemsForOrder = (
    orderId: string,
  ) =>
    orderItems.filter(
      (item) => item.order_id === orderId,
    );


  /* =======================================================
     OPEN ORDER DETAILS
  ======================================================= */

  const openOrderDetails = async (
    order: Order,
  ) => {
    setSelectedOrder(order);
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const {
        data: fullOrder,
        error: orderError,
      } = await supabase
        .from("orders")
        .select(
          `
            id,
            user_id,
            status,
            payment_status,
            total_amount,
            payment_method,
            payment_reference,
            estimated_delivery,
            tracking_number,
            shipping_address,
            created_at
          `,
        )
        .eq("id", order.id)
        .maybeSingle();


      if (orderError && !fullOrder) {
        throw orderError;
      }


      const enriched: Order = {
        ...order,

        ...((fullOrder as any) || {}),

        order_status:
          (fullOrder as any)?.status ||
          order.order_status ||
          order.status,

        status:
          (fullOrder as any)?.status ||
          order.status,

        payment_status:
          (fullOrder as any)?.payment_status ||
          order.payment_status,

        total_amount:
          (fullOrder as any)?.total_amount ||
          order.total_amount,

        payment_method:
          (fullOrder as any)?.payment_method ||
          order.payment_method,

        payment_reference:
          (fullOrder as any)?.payment_reference ||
          order.payment_reference,

        created_at:
          (fullOrder as any)?.created_at ||
          order.created_at,

        tracking_number:
          (fullOrder as any)?.tracking_number ||
          order.tracking_number,

        estimated_delivery:
          (fullOrder as any)?.estimated_delivery ||
          order.estimated_delivery,

        shipping_address:
          (fullOrder as any)?.shipping_address ||
          order.shipping_address,
      };


      setSelectedOrder(enriched);


      /* -----------------------------------------------------
         FALLBACK ADDRESS
      ----------------------------------------------------- */

      if (
        !enriched.shipping_address &&
        enriched.user_id
      ) {
        try {
          const {
            data: addrRows,
            error: addrErr,
          } = await supabase
            .from("addresses")
            .select(
              `
                id,
                full_name,
                phone,
                address_line1,
                address_line_1,
                address_line2,
                address_line_2,
                landmark,
                city,
                state,
                pincode,
                postal_code,
                country,
                is_default,
                created_at
              `,
            )
            .eq(
              "user_id",
              enriched.user_id,
            )
            .order("is_default", {
              ascending: false,
            })
            .order("created_at", {
              ascending: false,
            })
            .limit(1);


          if (
            !addrErr &&
            Array.isArray(addrRows) &&
            addrRows.length > 0
          ) {
            const a: any =
              addrRows[0];

            const shippingFromAddr = {
              full_name:
                a.full_name || null,

              phone:
                a.phone || null,

              line1:
                a.address_line1 ||
                a.address_line_1 ||
                null,

              line2:
                a.address_line2 ||
                a.address_line_2 ||
                null,

              city:
                a.city || null,

              state:
                a.state || null,

              pincode:
                a.pincode ||
                a.postal_code ||
                null,

              country:
                a.country || null,
            };


            setSelectedOrder(
              (prev) =>
                prev
                  ? {
                      ...prev,
                      shipping_address:
                        shippingFromAddr,
                    }
                  : prev,
            );
          }
        } catch (err) {
          console.warn(
            "SellerOrders: fallback address lookup failed",
            err,
          );
        }
      }


      /* -----------------------------------------------------
         ORDER ITEMS
      ----------------------------------------------------- */

      const items =
        orderItems.filter(
          (item) =>
            item.order_id === order.id,
        );

      setSelectedOrderItems(items);


      /* -----------------------------------------------------
         INITIALIZE INPUTS
      ----------------------------------------------------- */

      setDeliveryInputs((s) => ({
        ...s,

        [order.id]: {
          estimated_delivery:
            enriched.estimated_delivery
              ? String(
                  enriched.estimated_delivery,
                ).slice(0, 10)
              : null,

          tracking_number:
            enriched.tracking_number ||
            null,

          order_status:
            normalizeStatus(
              enriched.status ||
                enriched.order_status ||
                "pending",
            ),

          payment_status:
            normalizeStatus(
              enriched.payment_status ||
                "pending",
            ),
        },
      }));
    } catch (err: any) {
      setDetailsError(
        err.message ||
          "Failed to load order details",
      );
    } finally {
      setDetailsLoading(false);
    }
  };


  /* =======================================================
     FETCH STATUS HISTORY
  ======================================================= */

  const fetchStatusHistory = async (
    orderId: string,
  ) => {
    setStatusHistoryLoading(true);
    setStatusHistoryError(null);

    try {
      const {
        data,
        error: historyError,
      } = await supabase
        .from("order_status_history")
        .select(
          "id,order_id,status,created_at",
        )
        .eq("order_id", orderId)
        .order("created_at", {
          ascending: true,
        });


      if (historyError) {
        throw historyError;
      }


      setStatusHistory(
        (data as StatusHistoryItem[]) ||
          [],
      );

      setStatusHistoryOpen(true);
    } catch (err: any) {
      setStatusHistory([]);
      setStatusHistoryError(
        err.message ||
          "Failed to load status history",
      );

      setStatusHistoryOpen(true);
    } finally {
      setStatusHistoryLoading(false);
    }
  };


  /* =======================================================
     SAVE ORDER DETAILS
  ======================================================= */

  const saveOrderDetails = async () => {
    if (!selectedOrder) return;

    setSavingDetails(true);
    setDetailsError(null);

    try {
      const inputs =
        deliveryInputs[
          selectedOrder.id
        ] || {};

      const updatePayload: any = {};


      /* -----------------------------------------------------
         ESTIMATED DELIVERY
      ----------------------------------------------------- */

      const currentStatus =
        normalizeStatus(
          inputs.order_status ||
            selectedOrder.status ||
            "pending",
        );


      /*
       * Delivered orders should not have an estimated
       * delivery date.
       */

      if (currentStatus === "delivered") {
        updatePayload.estimated_delivery =
          null;
      } else if (
        inputs.estimated_delivery
      ) {
        const d = new Date(
          inputs.estimated_delivery as string,
        );

        if (!isNaN(d.getTime())) {
          updatePayload.estimated_delivery =
            d.toISOString();
        }
      } else {
        updatePayload.estimated_delivery =
          null;
      }


      /* -----------------------------------------------------
         TRACKING NUMBER
      ----------------------------------------------------- */

      updatePayload.tracking_number =
        inputs.tracking_number?.trim() ||
        null;


      /* -----------------------------------------------------
         ORDER STATUS
      ----------------------------------------------------- */

      if (inputs.order_status) {
        updatePayload.status =
          normalizeStatus(
            inputs.order_status,
          );
      }


      /* -----------------------------------------------------
         PAYMENT STATUS
      ----------------------------------------------------- */

      if (inputs.payment_status) {
        updatePayload.payment_status =
          normalizeStatus(
            inputs.payment_status,
          );
      }


      /* -----------------------------------------------------
         UPDATE DATABASE
      ----------------------------------------------------- */

      const {
        error: updateError,
      } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq(
          "id",
          selectedOrder.id,
        );


      if (updateError) {
        throw updateError;
      }


      /* -----------------------------------------------------
         UPDATE LOCAL STATE
      ----------------------------------------------------- */

      setOrders((current) =>
        current.map((o) =>
          o.id === selectedOrder.id
            ? {
                ...o,

                status:
                  updatePayload.status ||
                  o.status,

                order_status:
                  updatePayload.status ||
                  o.order_status,

                payment_status:
                  updatePayload.payment_status ||
                  o.payment_status,

                estimated_delivery:
                  updatePayload.estimated_delivery,

                tracking_number:
                  updatePayload.tracking_number,
              }
            : o,
        ),
      );


      setSelectedOrder(
        (current) =>
          current
            ? {
                ...current,

                status:
                  updatePayload.status ||
                  current.status,

                order_status:
                  updatePayload.status ||
                  current.order_status,

                payment_status:
                  updatePayload.payment_status ||
                  current.payment_status,

                estimated_delivery:
                  updatePayload.estimated_delivery,

                tracking_number:
                  updatePayload.tracking_number,
              }
            : current,
      );


      /*
       * Refresh everything so the status history and
       * order table immediately reflect the database.
       */

      await fetchOrders();


      /*
       * Re-open / refresh history if needed.
       */

      if (
        updatePayload.status
      ) {
        await fetchStatusHistory(
          selectedOrder.id,
        );
      }
    } catch (err: any) {
      setDetailsError(
        err.message ||
          "Failed to save order details",
      );
    } finally {
      setSavingDetails(false);
    }
  };


  /* =======================================================
     QUICK STATUS CHANGE
  ======================================================= */

  const changeOrderStatus = async (
    newStatus: string,
  ) => {
    if (!selectedOrder) return;

    setSavingDetails(true);
    setDetailsError(null);

    try {
      const normalized =
        normalizeStatus(newStatus);


      const updatePayload: any = {
        status: normalized,
      };


      /*
       * Delivered orders no longer need an estimated
       * delivery date.
       */

      if (normalized === "delivered") {
        updatePayload.estimated_delivery =
          null;
      }


      const {
        error: updateError,
      } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq(
          "id",
          selectedOrder.id,
        );


      if (updateError) {
        throw updateError;
      }


      /* -----------------------------------------------------
         UPDATE INPUT STATE
      ----------------------------------------------------- */

      setDeliveryInputs((current) => ({
        ...current,

        [selectedOrder.id]: {
          ...(current[
            selectedOrder.id
          ] || {}),

          order_status:
            normalized,

          estimated_delivery:
            normalized === "delivered"
              ? null
              : current[
                  selectedOrder.id
                ]?.estimated_delivery,
        },
      }));


      /* -----------------------------------------------------
         UPDATE SELECTED ORDER
      ----------------------------------------------------- */

      setSelectedOrder((current) =>
        current
          ? {
              ...current,

              status: normalized,

              order_status:
                normalized,

              estimated_delivery:
                normalized === "delivered"
                  ? null
                  : current.estimated_delivery,
            }
          : current,
      );


      /* -----------------------------------------------------
         UPDATE TABLE STATE
      ----------------------------------------------------- */

      setOrders((current) =>
        current.map((o) =>
          o.id === selectedOrder.id
            ? {
                ...o,

                status: normalized,

                order_status:
                  normalized,

                estimated_delivery:
                  normalized ===
                  "delivered"
                    ? null
                    : o.estimated_delivery,
              }
            : o,
        ),
      );


      /*
       * The database trigger automatically inserts the new
       * status into order_status_history.
       */

      await fetchOrders();

      await fetchStatusHistory(
        selectedOrder.id,
      );
    } catch (err: any) {
      setDetailsError(
        err.message ||
          "Failed to update order status",
      );
    } finally {
      setSavingDetails(false);
    }
  };


  /* =======================================================
     PAYMENT STATUS CHANGE
  ======================================================= */

  const changePaymentStatus = async (
    newStatus: string,
  ) => {
    if (!selectedOrder) return;

    setSavingDetails(true);
    setDetailsError(null);

    try {
      const normalized =
        normalizeStatus(newStatus);


      const {
        error: updateError,
      } = await supabase
        .from("orders")
        .update({
          payment_status:
            normalized,
        })
        .eq(
          "id",
          selectedOrder.id,
        );


      if (updateError) {
        throw updateError;
      }


      setSelectedOrder(
        (current) =>
          current
            ? {
                ...current,
                payment_status:
                  normalized,
              }
            : current,
      );


      setOrders((current) =>
        current.map((o) =>
          o.id === selectedOrder.id
            ? {
                ...o,
                payment_status:
                  normalized,
              }
            : o,
        ),
      );


      setDeliveryInputs(
        (current) => ({
          ...current,

          [selectedOrder.id]: {
            ...(current[
              selectedOrder.id
            ] || {}),

            payment_status:
              normalized,
          },
        }),
      );
    } catch (err: any) {
      setDetailsError(
        err.message ||
          "Failed to update payment status",
      );
    } finally {
      setSavingDetails(false);
    }
  };


  /* =======================================================
     EFFECT
  ======================================================= */

  useEffect(() => {
    fetchOrders();
  }, [user]);


  /* =======================================================
     FILTERED ORDERS
  ======================================================= */

  const filteredOrders = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return orders.filter((order) => {
      const searchMatch =
        !term ||
        [
          order.id,
          getCustomerName(order),
          getCustomer(order)?.phone ||
            "",
          getOrderItemsForOrder(
            order.id,
          )
            .map(
              (item) =>
                item.product_name,
            )
            .join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);


      const statusMatch =
        !statusFilter ||
        normalizeStatus(
          order.status ||
            order.order_status ||
            "pending",
        ).includes(
          normalizeStatus(
            statusFilter,
          ),
        );


      return (
        searchMatch &&
        statusMatch
      );
    });
  }, [
    orders,
    search,
    statusFilter,
    orderItems,
    profilesById,
  ]);


  /* =======================================================
     TOTAL REVENUE
  ======================================================= */

  const totalRevenue = useMemo(
    () =>
      orderItems.reduce(
        (sum, item) =>
          sum +
          Number(item.price || 0) *
            Number(
              item.quantity || 0,
            ),
        0,
      ),
    [orderItems],
  );


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <SellerLayout>
      <div className="space-y-8 p-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900">
              Orders
            </h1>

            <p className="mt-2 text-gray-600">
              Manage orders for your products,
              fulfillment status, and shipping
            </p>
          </div>

          <Button
            type="button"
            onClick={fetchOrders}
            className="rounded-full bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>


        {/* =================================================
            STATS
        ================================================= */}

        <div className="grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total Orders
            </p>

            <p className="mt-3 text-3xl font-semibold text-green-900">
              {orders.length}
            </p>
          </div>


          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Revenue
            </p>

            <p className="mt-3 text-3xl font-semibold text-green-700">
              {formatCurrency(
                totalRevenue,
              )}
            </p>
          </div>


          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Shown
            </p>

            <p className="mt-3 text-3xl font-semibold text-blue-600">
              {filteredOrders.length}
            </p>
          </div>

        </div>


        {/* =================================================
            FILTERS
        ================================================= */}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value,
              )
            }
            placeholder="Search by Order ID, customer, phone, or product..."
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />


          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value,
              )
            }
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">
              All statuses
            </option>

            {allStatusOptions.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(
                    status,
                  )}
                </option>
              ),
            )}
          </select>

        </div>


        {/* =================================================
            ORDERS TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <table className="min-w-full divide-y divide-slate-200">

            <thead className="bg-slate-50">
              <tr>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Order
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Product
                </th>

                <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qty
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unit Price
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Line Total
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Details
                </th>

              </tr>
            </thead>


            <tbody className="divide-y divide-slate-100">

              {loading ? (

                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading orders...
                  </td>
                </tr>

              ) : error ? (

                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-red-600"
                  >
                    {error}
                  </td>
                </tr>

              ) : filteredOrders.length === 0 ? (

                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    No orders found.
                  </td>
                </tr>

              ) : (

                filteredOrders.map(
                  (order) =>
                    getOrderItemsForOrder(
                      order.id,
                    ).map(
                      (
                        item,
                        idx,
                      ) => (

                        <tr
                          key={`${order.id}-${idx}`}
                          className="hover:bg-slate-50"
                        >

                          {/* ORDER */}

                          {idx === 0 && (
                            <td
                              rowSpan={
                                getOrderItemsForOrder(
                                  order.id,
                                ).length
                              }
                              className="px-5 py-4 text-sm font-medium text-slate-900"
                            >
                              <div className="flex flex-col gap-1">

                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  #
                                  {getShortOrderId(
                                    order.id,
                                  )}
                                </p>

                                <p className="text-xs text-slate-500">
                                  {formatOrderDate(
                                    order.created_at,
                                  )}
                                </p>

                              </div>
                            </td>
                          )}


                          {/* CUSTOMER */}

                          {idx === 0 && (
                            <td
                              rowSpan={
                                getOrderItemsForOrder(
                                  order.id,
                                ).length
                              }
                              className="px-5 py-4 text-sm text-slate-700"
                            >
                              <p className="font-medium text-slate-900">
                                {getCustomerName(
                                  order,
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {getCustomer(
                                  order,
                                )?.phone ||
                                  "—"}
                              </p>
                            </td>
                          )}


                          {/* PRODUCT */}

                          <td className="px-5 py-4 text-sm text-slate-700">

                            <div className="flex items-center gap-3">

                              {item.product_image ? (
                                <img
                                  src={
                                    item.product_image
                                  }
                                  alt={
                                    item.product_name ||
                                    "Product"
                                  }
                                  className="h-10 w-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}

                              <p className="font-medium text-slate-900">
                                {item.product_name ||
                                  "Unknown product"}
                              </p>

                            </div>

                          </td>


                          {/* QTY */}

                          <td className="px-5 py-4 text-center text-sm text-slate-700">
                            {item.quantity}
                          </td>


                          {/* UNIT PRICE */}

                          <td className="px-5 py-4 text-right text-sm text-slate-700">
                            {formatCurrency(
                              item.price,
                            )}
                          </td>


                          {/* LINE TOTAL */}

                          <td className="px-5 py-4 text-right text-sm font-semibold text-green-700">
                            {formatCurrency(
                              Number(
                                item.price ||
                                  0,
                              ) *
                                Number(
                                  item.quantity ||
                                    0,
                                ),
                            )}
                          </td>


                          {/* PAYMENT */}

                          {idx === 0 && (
                            <td
                              rowSpan={
                                getOrderItemsForOrder(
                                  order.id,
                                ).length
                              }
                              className="px-5 py-4 text-right text-sm"
                            >
                              <Badge
                                variant="outline"
                                className={`capitalize ${getPaymentStatusBadgeClass(
                                  order.payment_status,
                                )}`}
                              >
                                {formatStatus(
                                  order.payment_status,
                                )}
                              </Badge>
                            </td>
                          )}


                          {/* STATUS */}

                          {idx === 0 && (
                            <td
                              rowSpan={
                                getOrderItemsForOrder(
                                  order.id,
                                ).length
                              }
                              className="px-5 py-4 text-right text-sm"
                            >
                              <Badge
                                className={`capitalize ${getOrderStatusBadgeClass(
                                  order.status ||
                                    order.order_status,
                                )}`}
                              >
                                {formatStatus(
                                  order.status ||
                                    order.order_status,
                                )}
                              </Badge>
                            </td>
                          )}


                          {/* DATE */}

                          {idx === 0 && (
                            <td
                              rowSpan={
                                getOrderItemsForOrder(
                                  order.id,
                                ).length
                              }
                              className="px-5 py-4 text-right text-sm text-slate-600"
                            >
                              {formatOrderDate(
                                order.created_at,
                              )}
                            </td>
                          )}


                          {/* DETAILS */}

                          {idx === 0 && (
                            <td
                              rowSpan={
                                getOrderItemsForOrder(
                                  order.id,
                                ).length
                              }
                              className="px-5 py-4 text-right"
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  openOrderDetails(
                                    order,
                                  )
                                }
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            </td>
                          )}

                        </tr>
                      ),
                    ),
                )

              )}

            </tbody>
          </table>
        </div>
      </div>


      {/* =====================================================
          ORDER DETAILS DIALOG
      ===================================================== */}

      <Dialog
        open={Boolean(
          selectedOrder,
        )}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(
              null,
            );

            setSelectedOrderItems(
              [],
            );

            setDetailsError(
              null,
            );

            setStatusHistoryOpen(
              false,
            );
          }
        }}
      >

        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-[#fbfaf6]">

          {selectedOrder && (
            <>

              {/* =================================================
                  HEADER
              ================================================= */}

              <DialogHeader className="border-b border-slate-200 pb-5">

                <div className="flex items-start justify-between gap-4">

                  <div>

                    <DialogTitle className="text-3xl font-semibold text-slate-900">
                      Order details
                    </DialogTitle>

                    <DialogDescription className="mt-1">
                      Review the customer, payment,
                      and fulfillment record.
                    </DialogDescription>

                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">

                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      # Order Reference
                    </p>

                    <p className="mt-1 max-w-[260px] truncate text-xs font-medium text-slate-600">
                      {selectedOrder.id}
                    </p>

                  </div>

                </div>

              </DialogHeader>


              {detailsLoading ? (

                <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">

                  <RefreshCw className="h-5 w-5 animate-spin" />

                  Loading order details...

                </div>

              ) : detailsError ? (

                <div className="space-y-3 p-8 text-center text-sm text-red-600">

                  <div className="flex items-center justify-center gap-2">

                    <AlertCircle className="h-4 w-4" />

                    <span>
                      {detailsError}
                    </span>

                  </div>

                </div>

              ) : (

                <div className="space-y-6">

                  {/* =================================================
                      THREE COLUMN INFORMATION
                  ================================================= */}

                  <div className="grid gap-4 lg:grid-cols-3">

                    {/* =================================================
                        CUSTOMER
                    ================================================= */}

                    <div className="min-h-[330px] rounded-2xl border border-slate-200 bg-white p-5">

                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Customer
                      </p>

                      <div className="mt-5 flex items-start gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef1e6]">
                          <UserRound className="h-5 w-5 text-slate-600" />
                        </div>

                        <div className="min-w-0">

                          <p className="font-semibold text-slate-900">
                            {getCustomerName(
                              selectedOrder,
                            )}
                          </p>

                          {getCustomer(
                            selectedOrder,
                          )?.email && (
                            <p className="mt-1 break-all text-sm text-slate-500">
                              {
                                getCustomer(
                                  selectedOrder,
                                )?.email
                              }
                            </p>
                          )}

                          {getCustomer(
                            selectedOrder,
                          )?.phone && (
                            <p className="mt-1 text-sm text-slate-600">
                              {
                                getCustomer(
                                  selectedOrder,
                                )?.phone
                              }
                            </p>
                          )}

                        </div>

                      </div>


                      {selectedOrder.shipping_address &&
                        (() => {
                          const s =
                            parseShipping(
                              selectedOrder.shipping_address,
                            );

                          if (!s)
                            return null;

                          return (
                            <div className="mt-6 flex items-start gap-3">

                              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />

                              <div className="text-sm">

                                {s.full_name && (
                                  <p className="font-semibold text-slate-900">
                                    {
                                      s.full_name
                                    }
                                  </p>
                                )}

                                {s.line1 && (
                                  <p className="mt-1 text-slate-700">
                                    {
                                      s.line1
                                    }
                                  </p>
                                )}

                                {s.line2 && (
                                  <p className="text-slate-700">
                                    {
                                      s.line2
                                    }
                                  </p>
                                )}

                                <p className="mt-1 text-slate-500">
                                  {[
                                    s.city,
                                    s.state,
                                    s.pincode,
                                  ]
                                    .filter(
                                      Boolean,
                                    )
                                    .join(
                                      ", ",
                                    )}
                                </p>

                                {s.country && (
                                  <p className="mt-1 text-slate-500">
                                    {
                                      s.country
                                    }
                                  </p>
                                )}

                                {s.phone && (
                                  <p className="mt-2 flex items-center gap-2 text-slate-600">
                                    <Phone className="h-4 w-4" />
                                    {
                                      s.phone
                                    }
                                  </p>
                                )}

                              </div>

                            </div>
                          );
                        })()}

                    </div>


                    {/* =================================================
                        PAYMENT
                    ================================================= */}

                    <div className="min-h-[330px] rounded-2xl border border-slate-200 bg-white p-5">

                      <div className="flex items-center gap-2">

                        <CreditCard className="h-4 w-4 text-slate-500" />

                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Payment
                        </p>

                      </div>


                      <p className="mt-6 text-3xl font-bold text-[#2d351a]">
                        {formatCurrency(
                          selectedOrder.total_amount ||
                            selectedOrderItems.reduce(
                              (
                                sum,
                                item,
                              ) =>
                                sum +
                                Number(
                                  item.price ||
                                    0,
                                ) *
                                  Number(
                                    item.quantity ||
                                      0,
                                  ),
                                0,
                              ),
                        )}
                      </p>


                      {selectedOrder.payment_method && (
                        <p className="mt-2 text-sm text-slate-500">
                          {
                            selectedOrder.payment_method
                          }
                        </p>
                      )}


                      <div className="mt-7">

                        <p className="text-xs font-medium text-slate-500">
                          Current Payment Status
                        </p>

                        <Badge
                          variant="outline"
                          className={`mt-2 capitalize ${getPaymentStatusBadgeClass(
                            selectedOrder.payment_status,
                          )}`}
                        >
                          {formatStatus(
                            selectedOrder.payment_status,
                          )}
                        </Badge>

                      </div>


                      {/* PAYMENT ACTIONS */}

                      <div className="mt-7 border-t border-slate-200 pt-5">

                        <p className="text-xs font-medium text-slate-500">
                          Change Payment Status
                        </p>


                        <div className="mt-3 flex flex-wrap gap-2">

                          {normalizeStatus(
                            selectedOrder.payment_status,
                          ) !==
                            "paid" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                savingDetails
                              }
                              onClick={() =>
                                changePaymentStatus(
                                  "paid",
                                )
                              }
                              className="gap-2"
                            >
                              <ArrowRight className="h-4 w-4" />
                              Paid
                            </Button>
                          )}


                          {normalizeStatus(
                            selectedOrder.payment_status,
                          ) !==
                            "failed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                savingDetails
                              }
                              onClick={() =>
                                changePaymentStatus(
                                  "failed",
                                )
                              }
                              className="gap-2"
                            >
                              <ArrowRight className="h-4 w-4" />
                              Failed
                            </Button>
                          )}

                        </div>

                      </div>

                    </div>


                    {/* =================================================
                        FULFILLMENT
                    ================================================= */}

                    <div className="min-h-[330px] rounded-2xl border border-slate-200 bg-white p-5">

                      <div className="flex items-center gap-2">

                        <Truck className="h-4 w-4 text-slate-500" />

                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Fulfillment & Shipping
                        </p>

                      </div>


                      {/* CURRENT STATUS */}

                      <div className="mt-6">

                        <p className="text-xs font-medium text-slate-500">
                          Current Order Status
                        </p>

                        <Badge
                          className={`mt-2 capitalize ${getOrderStatusBadgeClass(
                            selectedOrder.status ||
                              selectedOrder.order_status,
                          )}`}
                        >
                          {formatStatus(
                            selectedOrder.status ||
                              selectedOrder.order_status,
                          )}
                        </Badge>

                        <p className="mt-2 text-xs text-slate-500">
                          {normalizeStatus(
                            selectedOrder.status ||
                              selectedOrder.order_status,
                          ) ===
                          "delivered"
                            ? "Order has been delivered."
                            : normalizeStatus(
                                  selectedOrder.status ||
                                    selectedOrder.order_status,
                                ) ===
                                "pending"
                              ? "Order received, awaiting confirmation."
                              : `Order is currently ${formatStatus(
                                  selectedOrder.status ||
                                    selectedOrder.order_status,
                                ).toLowerCase()}.`}
                        </p>

                      </div>


                      {/* NEXT STATUS ONLY */}

                      {getNextStatus(
                        selectedOrder.status ||
                          selectedOrder.order_status,
                      ) && (
                        <div className="mt-5 border-t border-slate-200 pt-5">

                          <p className="text-xs font-medium text-slate-500">
                            Next Status
                          </p>

                          <Button
                            variant="outline"
                            disabled={
                              savingDetails
                            }
                            onClick={() =>
                              changeOrderStatus(
                                getNextStatus(
                                  selectedOrder.status ||
                                    selectedOrder.order_status,
                                )!,
                              )
                            }
                            className="mt-3 w-full justify-between border-slate-200 bg-white"
                          >

                            <span className="flex items-center gap-2">

                              <ArrowRight className="h-4 w-4" />

                              {formatStatus(
                                getNextStatus(
                                  selectedOrder.status ||
                                    selectedOrder.order_status,
                                ),
                              )}

                            </span>

                            <span className="text-xs text-slate-400">
                              Update
                            </span>

                          </Button>

                        </div>
                      )}


                      {/* STATUS HISTORY */}

                      <Button
                        variant="outline"
                        disabled={
                          statusHistoryLoading
                        }
                        onClick={() =>
                          fetchStatusHistory(
                            selectedOrder.id,
                          )
                        }
                        className="mt-4 w-full justify-start gap-2"
                      >

                        <History className="h-4 w-4" />

                        {statusHistoryLoading
                          ? "Loading history..."
                          : "Status History"}

                      </Button>


                      {/* TRACKING */}

                      <div className="mt-5">

                        <label className="text-xs font-medium text-slate-500">
                          Tracking Number
                        </label>

                        <input
                          type="text"
                          placeholder="Enter tracking number"
                          value={
                            deliveryInputs[
                              selectedOrder.id
                            ]
                              ?.tracking_number ||
                            ""
                          }
                          onChange={(e) =>
                            setDeliveryInputs(
                              (s) => ({
                                ...s,

                                [selectedOrder.id]:
                                  {
                                    ...(s[
                                      selectedOrder.id
                                    ] ||
                                      {}),

                                    tracking_number:
                                      e.target
                                        .value,
                                  },
                              }),
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                        />

                      </div>


                      {/* ESTIMATED DELIVERY
                          HIDDEN WHEN DELIVERED */}

                      {normalizeStatus(
                        selectedOrder.status ||
                          selectedOrder.order_status,
                      ) !==
                        "delivered" && (
                        <div className="mt-4">

                          <label className="text-xs font-medium text-slate-500">
                            Estimated Delivery
                          </label>

                          <input
                            type="date"
                            value={
                              deliveryInputs[
                                selectedOrder.id
                              ]
                                ?.estimated_delivery ||
                              ""
                            }
                            onChange={(e) =>
                              setDeliveryInputs(
                                (s) => ({
                                  ...s,

                                  [selectedOrder.id]:
                                    {
                                      ...(s[
                                        selectedOrder.id
                                      ] ||
                                        {}),

                                      estimated_delivery:
                                        e
                                          .target
                                          .value,
                                    },
                                }),
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                          />

                        </div>
                      )}


                      {/* SAVE */}

                      <div className="mt-5 flex gap-2">

                        <Button
                          onClick={
                            saveOrderDetails
                          }
                          disabled={
                            savingDetails
                          }
                          className="flex-1 bg-[#39421f] hover:bg-[#2d3518]"
                        >
                          {savingDetails
                            ? "Saving..."
                            : "Save Changes"}
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() =>
                            setSelectedOrder(
                              null,
                            )
                          }
                          disabled={
                            savingDetails
                          }
                        >
                          Cancel
                        </Button>

                      </div>

                    </div>

                  </div>


                  {/* =================================================
                      PRODUCTS
                  ================================================= */}

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

                    <div className="border-b border-slate-200 px-5 py-4">

                      <div className="flex items-center gap-2">

                        <Package className="h-5 w-5 text-slate-500" />

                        <div>

                          <p className="font-semibold text-slate-900">
                            Products
                          </p>

                          <p className="text-xs text-slate-500">
                            {
                              selectedOrderItems.length
                            }{" "}
                            line item
                            {selectedOrderItems.length !==
                            1
                              ? "s"
                              : ""}
                          </p>

                        </div>

                      </div>

                    </div>


                    <div className="divide-y divide-slate-100">

                      {selectedOrderItems.map(
                        (item) => (

                          <div
                            key={
                              item.id
                            }
                            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                          >

                            <div className="flex items-center gap-4">

                              {item.product_image ? (
                                <img
                                  src={
                                    item.product_image
                                  }
                                  alt={
                                    item.product_name ||
                                    "Product"
                                  }
                                  className="h-14 w-14 rounded-xl object-cover"
                                />
                              ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                  <Package className="h-6 w-6" />
                                </div>
                              )}

                              <div>

                                <p className="font-semibold text-slate-900">
                                  {item.product_name ||
                                    "Product"}
                                </p>

                                <p className="mt-1 text-sm text-slate-500">
                                  Qty{" "}
                                  {
                                    item.quantity
                                  }
                                </p>

                              </div>

                            </div>


                            <div className="text-left sm:text-right">

                              <p className="font-semibold text-[#39421f]">
                                {formatCurrency(
                                  Number(
                                    item.price ||
                                      0,
                                  ) *
                                    Number(
                                      item.quantity ||
                                        0,
                                    ),
                                )}
                              </p>

                              <p className="text-xs text-slate-500">
                                {formatCurrency(
                                  item.price,
                                )}{" "}
                                ×{" "}
                                {
                                  item.quantity
                                }
                              </p>

                            </div>

                          </div>

                        ),
                      )}

                    </div>

                  </div>

                </div>

              )}

            </>
          )}

        </DialogContent>
      </Dialog>


      {/* =====================================================
          STATUS HISTORY DIALOG
      ===================================================== */}

      <Dialog
        open={
          statusHistoryOpen
        }
        onOpenChange={
          setStatusHistoryOpen
        }
      >

        <DialogContent className="max-w-xl bg-[#fbfaf6]">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2 text-xl">

              <History className="h-5 w-5 text-slate-600" />

              Status History

            </DialogTitle>

            <DialogDescription>
              Complete fulfillment status history
              for this order.
            </DialogDescription>

          </DialogHeader>


          {statusHistoryLoading ? (

            <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500">

              <RefreshCw className="h-5 w-5 animate-spin" />

              Loading status history...

            </div>

          ) : statusHistoryError ? (

            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">

              <div className="flex items-center gap-2">

                <AlertCircle className="h-4 w-4" />

                {statusHistoryError}

              </div>

              <p className="mt-2 text-xs">
                Make sure the
                order_status_history
                table and its RLS policy
                have been created in
                Supabase.
              </p>

            </div>

          ) : statusHistory.length === 0 ? (

            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">

              <History className="mx-auto h-8 w-8 text-slate-400" />

              <p className="mt-3 text-sm font-medium text-slate-700">
                No status history found
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Status changes will appear
                here as the order progresses.
              </p>

            </div>

          ) : (

            <div className="max-h-[55vh] overflow-y-auto pr-2">

              <div className="relative space-y-0">

                {statusHistory.map(
                  (
                    history,
                    index,
                  ) => {

                    const isLast =
                      index ===
                      statusHistory.length -
                        1;

                    const isCurrent =
                      isLast;


                    return (
                      <div
                        key={
                          history.id
                        }
                        className="relative flex gap-4"
                      >

                        {/* TIMELINE */}

                        <div className="relative flex w-7 shrink-0 justify-center">

                          {!isLast && (
                            <div className="absolute left-1/2 top-7 h-full w-px -translate-x-1/2 bg-slate-200" />
                          )}

                          <div
                            className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border ${
                              isCurrent
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-slate-200 bg-white text-slate-400"
                            }`}
                          >
                            {isCurrent ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>

                        </div>


                        {/* HISTORY CARD */}

                        <div className="mb-4 flex-1 rounded-xl border border-slate-200 bg-white p-4">

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                            <div>

                              <p className="font-semibold text-slate-900">
                                {formatStatus(
                                  history.status,
                                )}
                              </p>

                              {isCurrent && (
                                <Badge className="mt-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  Current
                                </Badge>
                              )}

                            </div>

                            <p className="text-xs text-slate-400">
                              {formatHistoryDate(
                                history.created_at,
                              )}
                            </p>

                          </div>

                        </div>

                      </div>
                    );
                  },
                )}

              </div>

            </div>

          )}

        </DialogContent>
      </Dialog>

    </SellerLayout>
  );
}