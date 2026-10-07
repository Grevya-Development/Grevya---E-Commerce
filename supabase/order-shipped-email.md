# Order Confirmed & Shipped Email

The customer email is sent only after an order transitions from a non-shipped
status to `shipped`. The database captures the transition and an immutable
snapshot of the order, items, and available delivery information. Admin and
seller status-update paths dispatch the server-side Supabase Edge Function after
the database update succeeds.

## One-time setup

1. Run [`order_shipped_email.sql`](./order_shipped_email.sql) in the Supabase
   SQL Editor.
2. Verify a sender domain in Resend and configure the Edge Function secrets:

   ```sh
   supabase secrets set RESEND_API_KEY=re_... ORDER_CONFIRMATION_FROM="Grevya Naturals <orders@your-verified-domain>" APP_BASE_URL=https://your-deployed-store.example
   ```

   Keep these values server-side; do not add them to Vite variables or commit
   them. Supabase provides its URL, anon key, and service-role key to Edge
   Functions.
3. Deploy the Edge Function with JWT verification enabled:

   ```sh
   supabase functions deploy order-confirmation
   ```

## Behavior

- Order creation, page loads, status reads, and repeated `shipped` updates do
  not create another email event.
- One database event is recorded for the first non-shipped-to-shipped
  transition per order. Its unique order key and atomic claim prevent duplicate
  sends on concurrent calls or retries.
- The function gets the recipient from the customer's Supabase Auth account and
  only accepts dispatch from the authenticated user who performed the shipped
  transition.
- The email links to the existing `/orders/:id` customer order-details route.
- Resend failures are logged and recorded without changing the order status.
- Email subject and sender settings use the existing Resend secrets:
  `RESEND_API_KEY` and `ORDER_CONFIRMATION_FROM`; `APP_BASE_URL` is the
  customer-facing site origin used to construct the order link.
