# Clerk Webhook Synchronization Setup

To keep user profiles (`public.profiles`) synchronized in Supabase when users are created, updated, or deleted in Clerk, you should configure a Clerk Webhook to trigger a Supabase Edge Function or a server-side endpoint.

---

## 1. Mapped Webhook Events

Create a Webhook endpoint in the **Clerk Dashboard -> Webhooks** matching the URL of your deployed handler. Subscribe to the following events:
- `user.created`
- `user.updated`
- `user.deleted`

---

## 2. Supabase Edge Function Handler

Create a new Supabase Edge Function named `clerk-webhook`. Below is the TypeScript code for the handler (`supabase/functions/clerk-webhook/index.ts`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";
import { Webhook } from "https://esm.sh/@clerk/backend@0.14.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("CLERK_WEBHOOK_SECRET")!; // Configure in Supabase Dashboard

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // 1. Verify signatures using Clerk SDK Webhook utility
  const svix_id = req.headers.get("svix-id")!;
  const svix_timestamp = req.headers.get("svix-timestamp")!;
  const svix_signature = req.headers.get("svix-signature")!;
  
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing signature headers", { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(webhookSecret);
  
  let evt: any;
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    return new Response("Verification failed", { status: 400 });
  }

  const { data, type } = evt;

  // 2. Synchronize based on event type
  if (type === "user.created" || type === "user.updated") {
    const email = data.email_addresses?.[0]?.email_address || null;
    const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
    const avatarUrl = data.image_url || null;
    const phone = data.phone_numbers?.[0]?.phone_number || null;

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          clerk_user_id: data.id,
          email: email,
          full_name: fullName || null,
          phone: phone || null,
          avatar_url: avatarUrl,
          status: "active",
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clerk_user_id" }
      );

    if (error) {
      console.error("Upsert failed:", error);
      return new Response("Database error", { status: 500 });
    }
  }

  if (evt.type === "user.deleted") {
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("clerk_user_id", data.id);

    if (error) {
      console.error("Delete failed:", error);
      return new Response("Database error", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
```

---

## 3. Deploying the Function

Deploy the function using the Supabase CLI:

```bash
supabase functions deploy clerk-webhook
supabase secrets set CLERK_WEBHOOK_SECRET=whsec_your_secret_from_clerk_dashboard
```
