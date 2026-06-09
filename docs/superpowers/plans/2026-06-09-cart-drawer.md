# Slide-out Cart Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slide-out cart drawer that opens on Add-to-Cart and on the navbar cart icon, keeping shoppers in the buying flow.

**Architecture:** A `useCartDrawer` zustand store holds open-state only; a `CartDrawer` component (built on the existing shadcn `Sheet`) reads cart data from the existing `useCartStore` and is mounted once at the app root. `ProductCard` and `Navbar` call `open()`.

**Tech Stack:** React + TypeScript, Vite, zustand, shadcn `Sheet` (Radix Dialog), Tailwind, Supabase (for recommendations).

> **Repo notes:** (1) NOT a git repository — replace every commit step with a **Checkpoint** (run build/type-check). Do not run git. (2) No unit-test runner is configured; "verification" = `tsc` + `npm run build` + `npm run lint` + screenshots + the two-stage review. (3) Spec: `docs/superpowers/specs/2026-06-09-cart-drawer-design.md`.

---

### Task 1: Cart-drawer open-state store

**Files:**
- Create: `src/store/useCartDrawer.ts`

- [ ] **Step 1: Create the store**

```ts
import { create } from 'zustand';

interface CartDrawerStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useCartDrawer = create<CartDrawerStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0.

- [ ] **Step 3: Checkpoint** — `npm run build` succeeds.

---

### Task 2: CartDrawer component

**Files:**
- Create: `src/components/CartDrawer.tsx`

Depends on Task 1 (`useCartDrawer`), the existing `useCartStore` (`items`, `addItem`, `removeItem`, `updateQuantity`, `getSubtotal`, `getTotalItems`), the existing `Sheet`/`SheetContent`/`SheetTitle` exports in `src/components/ui/sheet.tsx`, and `supabase` from `src/lib/supabaseClient`. The Supabase `products` row uses `image_url` (normalize to `image`), like `FeaturedProducts.tsx`.

- [ ] **Step 1: Create the component with full content**

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ShieldCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';
import { useCartDrawer } from '@/store/useCartDrawer';
import { supabase } from '@/lib/supabaseClient';
import type { ProductProps } from '@/components/ProductCard';

const CartDrawer = () => {
  const navigate = useNavigate();
  const isOpen = useCartDrawer((s) => s.isOpen);
  const close = useCartDrawer((s) => s.close);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const addItem = useCartStore((s) => s.addItem);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotalItems = useCartStore((s) => s.getTotalItems);

  const [recs, setRecs] = useState<ProductProps[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('products').select('*').limit(6);
        if (error) throw error;
        const formatted: ProductProps[] = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          rating: item.rating || 4,
          image: item.image_url || '/placeholder.svg',
          category: item.category,
          slug: item.slug,
        }));
        if (active) setRecs(formatted);
      } catch (err) {
        console.error('CartDrawer recommendations failed:', err);
        if (active) setRecs([]);
      }
    })();
    return () => { active = false; };
  }, []);

  const itemCount = getTotalItems();
  const subtotal = getSubtotal();
  const cartIds = new Set(items.map((i) => i.id));
  const recommendations = recs.filter((r) => !cartIds.has(r.id)).slice(0, 4);

  const goToCheckout = () => { close(); navigate('/checkout'); };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] p-0 flex flex-col bg-cream">
        <SheetTitle className="sr-only">Shopping cart</SheetTitle>

        <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-white">
          <ShoppingBag className="h-5 w-5 text-green-800" />
          <span className="font-semibold tracking-wide text-ink">MY CART ({itemCount})</span>
        </div>

        <div className="flex items-center justify-center gap-2 bg-green-100 text-green-900 text-xs font-semibold py-2 px-4 text-center">
          <ShieldCheck className="h-4 w-4 shrink-0" /> 100% Natural · Cruelty-Free · Secure Checkout
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center px-6 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <ShoppingBag className="h-7 w-7 text-green-800" />
            </div>
            <h3 className="font-serif text-2xl font-semibold text-ink mb-2">Your Bag is Empty</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">Explore our collection of natural, eco-friendly essentials.</p>
            <Button onClick={() => { close(); navigate('/products'); }} className="rounded-full bg-green-800 hover:bg-green-900 text-white px-6">Shop Our Collection</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl bg-white p-3 shadow-sm border border-border">
                  <img src={item.image || '/placeholder.svg'} alt={item.name} className="h-16 w-16 rounded-lg object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <Link to={`/products/${item.category}/${item.slug}`} onClick={close} className="block text-sm font-medium text-ink line-clamp-2 hover:underline">{item.name}</Link>
                    <div className="mt-1 text-sm font-semibold text-green-800">Rs {(item.price * item.quantity).toFixed(2)}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-border">
                        <button type="button" aria-label="Decrease quantity" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} className="px-2.5 py-1 text-ink disabled:opacity-30">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2 text-sm font-medium">{item.quantity}</span>
                        <button type="button" aria-label="Increase quantity" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2.5 py-1 text-ink">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button type="button" aria-label="Remove item" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {recommendations.length > 0 && (
                <div className="pt-2">
                  <h4 className="font-serif text-lg font-semibold text-ink mb-3">You may also like</h4>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {recommendations.map((p) => (
                      <div key={p.id} className="w-36 shrink-0 rounded-xl bg-white p-2 shadow-sm border border-border">
                        <img src={p.image || '/placeholder.svg'} alt={p.name} className="h-20 w-full rounded-lg object-cover bg-muted" />
                        <div className="mt-1 text-xs font-medium text-ink line-clamp-2 h-8">{p.name}</div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs font-semibold text-green-800">Rs {Number(p.price).toFixed(0)}</span>
                          <button type="button" onClick={() => addItem(p, 1)} className="rounded-full border border-green-800 text-green-800 text-xs px-2 py-0.5 hover:bg-green-800 hover:text-white transition-colors">+ Add</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-white px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Estimated Total</span>
                <span className="text-lg font-semibold text-ink">Rs {subtotal.toFixed(2)}</span>
              </div>
              <Button onClick={goToCheckout} className="w-full h-12 rounded-xl bg-green-800 hover:bg-green-900 text-white text-base font-bold">Proceed to Checkout</Button>
              <button type="button" onClick={() => { close(); navigate('/cart'); }} className="mt-2 w-full text-center text-xs text-muted-foreground hover:underline">View full cart</button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
```

- [ ] **Step 2: Type-check** — `npx tsc -p tsconfig.app.json --noEmit` → exit 0.
- [ ] **Step 3: Checkpoint** — `npm run build` succeeds (the component is not yet mounted, so it only needs to compile).

---

### Task 3: Mount CartDrawer at app root

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import CartDrawer (non-lazy) near the top, after the existing imports**

Add this import line below `import ProtectedRoute from "@/components/ProtectedRoute";`:
```tsx
import CartDrawer from "@/components/CartDrawer";
```

- [ ] **Step 2: Render it inside BrowserRouter, before the Suspense block**

Find:
```tsx
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800"><div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" /></div>}>
```
Replace with:
```tsx
    <BrowserRouter>
      <CartDrawer />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-cream/30 text-green-800"><div className="h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-800" /></div>}>
```

- [ ] **Step 3: Checkpoint** — `npx tsc -p tsconfig.app.json --noEmit` exit 0 and `npm run build` succeeds.

---

### Task 4: Open drawer from ProductCard "Add to Cart"

**Files:**
- Modify: `src/components/ProductCard.tsx`

- [ ] **Step 1: Replace the toast import with the drawer store import**

Find:
```tsx
import { toast } from '@/components/ui/use-toast';
```
Replace with:
```tsx
import { useCartDrawer } from '@/store/useCartDrawer';
```

- [ ] **Step 2: Read `open` and update the handler**

Find:
```tsx
  const addItem = useCartStore((state) => state.addItem);

  const addToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(props, 1);
    toast({
      title: "Added to cart",
      description: `${name} added to your cart`,
    });
  };
```
Replace with:
```tsx
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartDrawer((state) => state.open);

  const addToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(props, 1);
    openCart();
  };
```

- [ ] **Step 3: Verify no other `toast(` call remains in the file**

Run: `grep -n "toast(" src/components/ProductCard.tsx`
Expected: no output (so the removed import leaves nothing dangling).

- [ ] **Step 4: Checkpoint** — `npx tsc -p tsconfig.app.json --noEmit` exit 0 and `npm run build` succeeds.

---

### Task 5: Navbar cart icon opens the drawer

**Files:**
- Modify: `src/components/Navbar.tsx`

The navbar has two cart triggers wrapped in `<Link to="/cart" className="relative">` (desktop ~line 114, mobile ~line 129), each containing a `ShoppingCart` icon and the count badge.

- [ ] **Step 1: Import the drawer store**

Add below the existing `useCartStore` import:
```tsx
import { useCartDrawer } from '@/store/useCartDrawer';
```

- [ ] **Step 2: Read `open` inside the component**

Just after the existing line `const getTotalItems = useCartStore((state) => state.getTotalItems);` add:
```tsx
  const openCart = useCartDrawer((state) => state.open);
```

- [ ] **Step 3: Convert both cart `Link`s to buttons that open the drawer**

For EACH of the two occurrences of a cart link, replace the wrapping element. Find (there are two; handle both — desktop and mobile):
```tsx
            <Link to="/cart" className="relative">
```
Replace each with:
```tsx
            <button type="button" onClick={openCart} className="relative">
```
And replace each corresponding closing `</Link>` that wraps the cart icon/badge with `</button>`. (Read the file to confirm exactly which `</Link>` closes each cart trigger — match the one immediately wrapping the `ShoppingCart` icon + badge, NOT the logo or nav links.)

- [ ] **Step 4: Verify no cart-path link remains**

Run: `grep -n 'to="/cart"' src/components/Navbar.tsx`
Expected: no output.

- [ ] **Step 5: Checkpoint** — `npx tsc -p tsconfig.app.json --noEmit` exit 0 and `npm run build` succeeds.

---

### Task 6: Verification (build, lint, types, visual)

**Files:** none (verification only).

- [ ] **Step 1: Full static checks**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run build && npm run lint 2>&1 | tail -3`
Expected: tsc exit 0; build succeeds; lint shows no NEW errors beyond the known pre-existing baseline.

- [ ] **Step 2: Visual check — open the drawer and screenshot**

Build + preview, then drive the drawer open. Preferred: chrome-devtools MCP (`new_page` → `http://localhost:4204/` → `click` the first "Add to Cart" → `take_screenshot`). If the MCP browser is unavailable, use headless Chrome with an init script that opens the drawer after load:

```bash
pkill -f "vite preview" 2>/dev/null; sleep 1
npx vite preview --port 4204 >/tmp/cd.log 2>&1 & sleep 3
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Empty-state drawer: open via localStorage flag is not available, so click flow is required.
# Fallback static check — capture home to confirm no regression:
"$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=4000 --window-size=1440,1200 --user-data-dir=/tmp/cr-cd --screenshot=/tmp/cd-home.png "http://localhost:4204/" >/dev/null 2>&1
ls -la /tmp/cd-home.png
```
View the screenshot. The authoritative interactive check (drawer opens on Add to Cart, qty +/− updates subtotal, remove works, Proceed to Checkout → /checkout) is performed by the controller via the chrome-devtools MCP click flow, or noted as a manual step for the user if the browser is locked.

- [ ] **Step 3: Clean up**

```bash
pkill -f "vite preview" 2>/dev/null; rm -f /tmp/cd-home.png /tmp/cd.log; rm -rf /tmp/cr-cd
```

---

## Self-Review

**Spec coverage:**
- State store (`useCartDrawer`) → Task 1 ✅
- CartDrawer component (header, trust strip, line items w/ qty+remove, recommendations, empty state, sticky checkout footer) → Task 2 ✅
- Mount at app root → Task 3 ✅
- Add-to-Cart opens drawer (toast removed) → Task 4 ✅
- Navbar icon opens drawer; `/cart` still reachable directly → Task 5 ✅
- On-palette styling (forest CTA, cream/white, Cormorant headings, clay/sage accents) → Task 2 classes ✅
- Recommendations reuse featured query, exclude cart items, hide on empty/error → Task 2 ✅
- Verification (build/lint/types/screenshot) → Task 6 ✅
- Out of scope (coupons/discounts) → none added ✅

**Placeholder scan:** All code steps contain complete code; commands have expected output. The only non-literal step is Task 5 Step 3 (two `</Link>` closings) — instructed to read-and-match because exact line numbers may drift; the find/replace string and matching rule are explicit. ✅

**Type consistency:** `useCartDrawer` exposes `isOpen`/`open`/`close` — used consistently in Tasks 2 (`isOpen`, `close`), 4 (`open`), 5 (`open`). `ProductProps` fields used in recommendations (`id,name,price,rating,image,category,slug`) match the interface in `ProductCard.tsx`. Cart store methods (`addItem,removeItem,updateQuantity,getSubtotal,getTotalItems`) match `useCartStore.ts`. ✅
