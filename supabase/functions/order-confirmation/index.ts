import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { renderOrderConfirmedShippedEmail } from "./emailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const safeProviderMessage = (value: unknown) =>
  String(value ?? "No provider detail")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .slice(0, 300);

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ sent: false, reason: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("ORDER_CONFIRMATION_FROM");
  const appBaseUrl = Deno.env.get("APP_BASE_URL");
  console.info("[ORDER EMAIL] Checking server configuration.", {
    supabaseUrlConfigured: Boolean(supabaseUrl),
    anonKeyConfigured: Boolean(anonKey),
    serviceRoleKeyConfigured: Boolean(serviceRoleKey),
    resendApiKeyConfigured: Boolean(resendApiKey),
    senderConfigured: Boolean(sender),
    appBaseUrlConfigured: Boolean(appBaseUrl),
  });
  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !resendApiKey ||
    !sender ||
    !appBaseUrl
  ) {
    console.error("Order shipped email configuration is incomplete.");
    return jsonResponse(
      { sent: false, reason: "email_service_unavailable" },
      503,
    );
  }

  let stage = "authenticating_request";
  let orderId = "unknown";
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      console.warn("[ORDER EMAIL] Authorization header missing.");
      return jsonResponse({ sent: false, reason: "unauthorized" }, 401);
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await callerClient.auth.getUser();
    if (authError || !user?.id) {
      console.warn("[ORDER EMAIL] Caller authentication failed.", {
        errorName: authError?.name,
      });
      return jsonResponse({ sent: false, reason: "unauthorized" }, 401);
    }
    console.info("[ORDER EMAIL] Caller authenticated.");

    stage = "validating_request";
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ sent: false, reason: "invalid_request" }, 400);
    }
    const requestedOrderId =
      body && typeof body === "object" && "orderId" in body
        ? body.orderId
        : undefined;
    if (!isUuid(requestedOrderId)) {
      return jsonResponse({ sent: false, reason: "invalid_order_id" }, 400);
    }
    orderId = requestedOrderId;
    console.info("[ORDER EMAIL] Processing shipped event.", { orderId });

    stage = "loading_transition_event";
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: event, error: eventError } = await adminClient
      .from("order_shipped_email_deliveries")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) {
      console.warn("[ORDER EMAIL] Shipped transition event was not found.", {
        orderId,
      });
      return jsonResponse({
        sent: false,
        reason: "transition_event_not_found",
      });
    }
    if (event.changed_by !== user.id) {
      console.warn("[ORDER EMAIL] Transition actor does not match caller.", {
        orderId,
        transitionActorAvailable: Boolean(event.changed_by),
      });
      return jsonResponse({ sent: false, reason: "transition_actor_mismatch" });
    }
    if (event.delivery_status !== "pending") {
      console.info("[ORDER EMAIL] Delivery event is not pending.", {
        orderId,
        deliveryStatus: event.delivery_status,
      });
      return jsonResponse({
        sent: false,
        reason: `delivery_${event.delivery_status}`,
      });
    }
    console.info("[ORDER EMAIL] Pending transition event loaded.", { orderId });

    stage = "loading_customer";
    const [
      { data: authUserData, error: userError },
      { data: profile, error: profileError },
    ] = await Promise.all([
      adminClient.auth.admin.getUserById(event.user_id),
      adminClient
        .from("profiles")
        .select("full_name")
        .eq("id", event.user_id)
        .maybeSingle(),
    ]);
    if (userError) throw userError;
    if (profileError) throw profileError;

    const recipient = authUserData.user?.email;
    if (!recipient) {
      console.error("[ORDER EMAIL] Registered customer email is unavailable.", {
        orderId,
      });
      return jsonResponse(
        { sent: false, reason: "customer_email_unavailable" },
        422,
      );
    }
    console.info("[ORDER EMAIL] Registered customer email retrieved.", {
      orderId,
      recipientAvailable: true,
    });

    stage = "validating_order_snapshot";
    const order =
      event.order_snapshot &&
      typeof event.order_snapshot === "object" &&
      !Array.isArray(event.order_snapshot)
        ? event.order_snapshot
        : null;
    const items = Array.isArray(event.order_items_snapshot)
      ? event.order_items_snapshot
      : [];
    if (!order || items.length === 0) {
      console.error("[ORDER EMAIL] Order snapshot is incomplete.", {
        orderId,
        orderAvailable: Boolean(order),
        itemCount: items.length,
      });
      return jsonResponse(
        { sent: false, reason: "order_details_unavailable" },
        422,
      );
    }
    console.info("[ORDER EMAIL] Order snapshot loaded.", {
      orderId,
      itemCount: items.length,
      deliveryDetailsAvailable: Boolean(event.delivery_snapshot),
    });

    stage = "rendering_email";
    const delivery =
      event.delivery_snapshot &&
      typeof event.delivery_snapshot === "object" &&
      !Array.isArray(event.delivery_snapshot)
        ? event.delivery_snapshot
        : null;
    const orderUrl = new URL(appBaseUrl).origin;
    const email = renderOrderConfirmedShippedEmail({
      customerName:
        profile?.full_name ||
        authUserData.user?.user_metadata?.full_name ||
        authUserData.user?.user_metadata?.name ||
        "there",
      order,
      items,
      delivery,
      shippedAt: event.shipped_at,
      orderUrl,
    });
    console.info("[ORDER EMAIL] Email template rendered.", {
      orderId,
      subject: email.subject,
    });

    stage = "claiming_delivery";
    const { data: claimed, error: claimError } = await adminClient.rpc(
      "claim_order_shipped_email",
      { p_order_id: orderId, p_changed_by: user.id },
    );
    if (claimError) throw claimError;
    if (claimed !== true) {
      console.warn("[ORDER EMAIL] Atomic delivery claim was not granted.", {
        orderId,
      });
      return jsonResponse({
        sent: false,
        reason: "delivery_claim_not_granted",
      });
    }
    console.info("[ORDER EMAIL] Delivery claim granted.", { orderId });

    try {
      stage = "calling_resend";
      console.info("[ORDER EMAIL] Calling Resend.", { orderId });
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `order-confirmed-shipped-${orderId}`,
        },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      const resendBody = await resendResponse.json().catch(() => ({}));
      if (!resendResponse.ok) {
        console.error("[ORDER EMAIL] Resend rejected the email.", {
          orderId,
          httpStatus: resendResponse.status,
          providerErrorName:
            typeof resendBody?.name === "string" ? resendBody.name : undefined,
          providerErrorMessage: safeProviderMessage(resendBody?.message),
        });
        throw new Error(
          `Resend returned HTTP ${resendResponse.status}: ${safeProviderMessage(resendBody?.message)}`,
        );
      }
      console.info("[ORDER EMAIL] Resend accepted the email.", {
        orderId,
        httpStatus: resendResponse.status,
        resendIdAvailable: typeof resendBody?.id === "string",
      });

      stage = "recording_delivery_result";
      const { error: updateError } = await adminClient
        .from("order_shipped_email_deliveries")
        .update({
          delivery_status: "sent",
          resend_id: typeof resendBody?.id === "string" ? resendBody.id : null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId);
      if (updateError) {
        console.error(
          "[ORDER EMAIL] Resend accepted email but delivery result could not be saved.",
          { orderId, error: updateError },
        );
      }
      console.info("[ORDER EMAIL] Email sent successfully.", { orderId });
      return jsonResponse({ sent: true });
    } catch (emailError) {
      const errorMessage =
        emailError instanceof Error ? emailError.message : String(emailError);
      console.error("[ORDER EMAIL] Email send failed.", {
        orderId,
        stage,
        error: errorMessage,
      });

      stage = "recording_delivery_failure";
      const { error: updateError } = await adminClient
        .from("order_shipped_email_deliveries")
        .update({
          delivery_status: "failed",
          error_message: errorMessage.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId);
      if (updateError) {
        console.error(
          "[ORDER EMAIL] Failed email outcome could not be saved.",
          {
            orderId,
            error: updateError,
          },
        );
      }
      return jsonResponse({ sent: false, reason: "email_send_failed" }, 502);
    }
  } catch (error) {
    console.error(
      "[ORDER EMAIL] Function stopped before successful delivery.",
      {
        orderId,
        stage,
        error:
          error instanceof Error ? error.message : safeProviderMessage(error),
      },
    );
    return jsonResponse(
      { sent: false, reason: `email_service_error:${stage}` },
      500,
    );
  }
});
