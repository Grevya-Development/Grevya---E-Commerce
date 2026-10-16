type EmailOrderItem = {
  product_name?: string | null;
  quantity?: number | null;
  price?: number | null;
  discount?: number | null;
};

type EmailOrder = Record<string, unknown> & {
  id: string;
  order_number?: string | null;
  created_at?: string | null;
  shipping_address?: unknown;
  payment_method?: string | null;
  payment_status?: string | null;
  subtotal?: number | null;
  shipping?: number | null;
  shipping_cost?: number | null;
  discount?: number | null;
  total_amount?: number | null;
  tracking_number?: string | null;
  estimated_delivery?: string | null;
};

type EmailDelivery = {
  tracking_number?: string | null;
  tracking_url?: string | null;
  estimated_delivery_at?: string | null;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatPrice = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
};

const formatAddress = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Address not available";
  }

  const address = value as Record<string, unknown>;
  const street =
    (typeof address.address === "string" && address.address) ||
    [
      address.addressLine1 ?? address.address_line1 ?? address.address_line_1,
      address.addressLine2 ?? address.address_line2 ?? address.address_line_2,
      address.landmark,
    ]
      .filter((part) => typeof part === "string" && part.trim())
      .join(", ");
  const parts = [
    address.fullName ?? address.full_name,
    address.phone,
    street,
    address.city,
    address.state,
    address.pincode ?? address.postal_code,
    address.country,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => String(part).trim());

  return parts.length
    ? [...new Set(parts)].join(", ")
    : "Address not available";
};

export const renderOrderConfirmedShippedEmail = (input: {
  customerName: string;
  order: EmailOrder;
  items: EmailOrderItem[];
  delivery: EmailDelivery | null;
  shippedAt: string;
  orderUrl: string;
}) => {
  const { customerName, order, items, delivery, shippedAt, orderUrl } = input;
  const orderNumber = order.order_number || order.id;
  const subtotal =
    Number(order.subtotal) ||
    items.reduce(
      (sum, item) =>
        sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0,
    );
  const shipping = Number(order.shipping ?? order.shipping_cost) || 0;
  const discount = Number(order.discount) || 0;
  const total = Number(order.total_amount) || subtotal + shipping - discount;
  const orderDetailsUrl = new URL(
    `/orders/${encodeURIComponent(order.id)}`,
    orderUrl,
  ).toString();
  const trackingNumber =
    delivery?.tracking_number || order.tracking_number || "Not available";
  const trackingUrl =
    typeof delivery?.tracking_url === "string" &&
    /^https?:\/\//i.test(delivery.tracking_url)
      ? delivery.tracking_url
      : null;
  const expectedDelivery =
    delivery?.estimated_delivery_at || order.estimated_delivery;
  const itemRows = items
    .map((item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      return `
        <tr>
          <td style="padding:12px 8px;border-bottom:1px solid #eee8de;color:#33381c">${escapeHtml(item.product_name || "Product")}</td>
          <td style="padding:12px 8px;border-bottom:1px solid #eee8de;text-align:center;color:#5c5c54">${escapeHtml(quantity)}</td>
          <td style="padding:12px 8px;border-bottom:1px solid #eee8de;text-align:right;color:#33381c">${formatPrice(price)}</td>
        </tr>`;
    })
    .join("");
  const textItems = items
    .map(
      (item) =>
        `- ${item.product_name || "Product"} × ${Number(item.quantity) || 0} | ${formatPrice(item.price)} each`,
    )
    .join("\n");
  const subject = `Order Confirmed & Shipped - #${orderNumber}`;
  const text = [
    "GREVYA NATURALS",
    "",
    "Order Confirmed & Shipped",
    "",
    `Hi ${customerName},`,
    "",
    `Your order #${orderNumber} has been confirmed and shipped.`,
    `Order date: ${formatDate(order.created_at)}`,
    `Shipped date: ${formatDate(shippedAt)}`,
    "",
    "Order Details",
    textItems,
    `Subtotal: ${formatPrice(subtotal)}`,
    `Shipping: ${formatPrice(shipping)}`,
    ...(discount > 0 ? [`Discount: -${formatPrice(discount)}`] : []),
    `Total: ${formatPrice(total)}`,
    "",
    `Payment method: ${order.payment_method || "Not specified"}`,
    `Payment status: ${order.payment_status || "Not specified"}`,
    `Shipping to: ${formatAddress(order.shipping_address)}`,
    `Tracking number: ${trackingNumber}`,
    `Expected delivery: ${formatDate(expectedDelivery)}`,
    ...(trackingUrl ? [`Carrier tracking: ${trackingUrl}`] : []),
    "",
    `Track Your Order: ${orderDetailsUrl}`,
    "",
    "Thank you for shopping with Grevya Naturals.",
  ].join("\n");
  const html = `
    <div style="margin:0;background:#f7eee4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
      <main style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
        <header style="padding:28px 24px;background:#33381c;color:#f7eee4;text-align:center">
          <p style="margin:0;font-size:12px;letter-spacing:4px">GREVYA</p>
          <p style="margin:5px 0 0;font-size:10px;letter-spacing:3px">NATURALS</p>
        </header>
        <div style="padding:28px 24px">
          <h1 style="margin:0 0 16px;color:#33381c;font-size:26px">Order Confirmed &amp; Shipped</h1>
          <p style="color:#5c5c54;line-height:1.6">Hi ${escapeHtml(customerName)},</p>
          <p style="color:#5c5c54;line-height:1.6">Your order <strong>#${escapeHtml(orderNumber)}</strong> has been confirmed and shipped.</p>
          <p style="color:#777;font-size:13px;line-height:1.7">Order date: ${escapeHtml(formatDate(order.created_at))}<br>Shipped date: ${escapeHtml(formatDate(shippedAt))}</p>
          <h2 style="margin:24px 0 8px;color:#33381c;font-size:18px">Order Details</h2>
          <div style="width:100%;overflow-x:auto">
            <table role="presentation" style="width:100%;border-collapse:collapse">
              <thead><tr>
                <th style="padding:8px;text-align:left;border-bottom:1px solid #ddd5c8">Product</th>
                <th style="padding:8px;text-align:center;border-bottom:1px solid #ddd5c8">Qty</th>
                <th style="padding:8px;text-align:right;border-bottom:1px solid #ddd5c8">Price</th>
              </tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
          </div>
          <table role="presentation" style="width:100%;margin-top:12px;border-collapse:collapse;color:#5c5c54;font-size:14px">
            <tr><td style="padding:4px 0">Subtotal</td><td style="padding:4px 0;text-align:right">${formatPrice(subtotal)}</td></tr>
            <tr><td style="padding:4px 0">Shipping</td><td style="padding:4px 0;text-align:right">${formatPrice(shipping)}</td></tr>
            ${discount > 0 ? `<tr><td style="padding:4px 0">Discount</td><td style="padding:4px 0;text-align:right">-${formatPrice(discount)}</td></tr>` : ""}
            <tr><td style="padding:10px 0;border-top:1px solid #ddd5c8;color:#33381c;font-weight:bold">Total</td><td style="padding:10px 0;border-top:1px solid #ddd5c8;text-align:right;color:#33381c;font-weight:bold">${formatPrice(total)}</td></tr>
          </table>
          <p style="margin:14px 0 0;color:#5c5c54;font-size:13px;line-height:1.7">Payment method: ${escapeHtml(order.payment_method || "Not specified")}<br>Payment status: ${escapeHtml(order.payment_status || "Not specified")}</p>
          <p style="margin:14px 0 0;color:#5c5c54;font-size:13px;line-height:1.7"><strong style="color:#33381c">Shipping To:</strong><br>${escapeHtml(formatAddress(order.shipping_address))}</p>
          <p style="margin:14px 0 0;color:#5c5c54;font-size:13px;line-height:1.7"><strong style="color:#33381c">Shipping Details:</strong><br>Tracking number: ${escapeHtml(trackingNumber)}<br>Expected delivery: ${escapeHtml(formatDate(expectedDelivery))}${trackingUrl ? `<br><a href="${escapeHtml(trackingUrl)}" style="color:#33381c">Carrier tracking details</a>` : ""}</p>
          <p style="margin:24px 0;text-align:center"><a href="${escapeHtml(orderDetailsUrl)}" style="display:inline-block;padding:14px 24px;border-radius:8px;background:#687442;color:#fff;text-decoration:none;font-weight:bold">Track Your Order</a></p>
          <p style="color:#5c5c54;line-height:1.6">Thank you for shopping with Grevya Naturals.</p>
        </div>
      </main>
    </div>`;

  return { subject, html, text };
};
