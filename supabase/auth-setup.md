# Grevya Supabase Auth Setup

Use this checklist in the Supabase dashboard before deployment.

## Authentication

- Enable Email provider.
- Set Site URL:
  - Localhost: `http://localhost:8080`
  - Production: your deployed domain.
- Add Redirect URLs:
  - `http://localhost:8080/account`
  - `http://localhost:8080/reset-password`
  - `http://localhost:8080/auth`
  - `http://localhost:8080/login`
  - Production equivalents for each route.
- Enable Google OAuth and Apple OAuth only after adding their client IDs/secrets in Supabase.
- Use the same callback URL Supabase shows for each OAuth provider.

## Phone Readiness

The frontend validates Indian mobile numbers and stores phone data in `profiles`.
If you enable Supabase phone OTP later, configure an SMS provider in Supabase first.

## Environment

Frontend-safe variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_SITE_URL=http://localhost:8080
VITE_RAZORPAY_KEY_ID=
```

Never expose Supabase service role keys or Razorpay key secrets in Vite variables.

## Razorpay Production Verification

The current browser checkout opens Razorpay and stores the payment response.
Before production launch, create a Supabase Edge Function that:

1. Creates a Razorpay order server-side.
2. Verifies `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`.
3. Updates `orders.payment_status` only after signature verification.

This keeps the app Supabase-only while avoiding a standalone backend server.
