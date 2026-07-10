# Slide-out Cart Drawer — Design

**Date:** 2026-06-09
**Status:** Approved (design), pending implementation plan
**Goal:** When a shopper clicks "Add to Cart" (or the navbar cart icon), a slide-out cart drawer opens from the right instead of bouncing them to a separate page — keeping them in the buying flow to increase conversion. Inspired by reennaturals.in's cart, adapted to the Grevya palette, minus the discount machinery.

## Confirmed decisions
- **Scope:** Conversion-focused drawer, **frontend-only**. No coupons, no tiered discount ladder, no prepaid offer (those require a backend discount engine — separate future workstream).
- **Drawer is primary:** Add-to-Cart opens it; navbar cart icon opens it; drawer Checkout → `/checkout`. The `/cart` page stays reachable as a fallback but is no longer the main path.
- **Trust badge:** value-props text, no fabricated numbers — "100% Natural · Cruelty-Free · Secure Checkout".

## Non-goals
- No coupon/discount/promo logic (UI or backend).
- No changes to checkout/payment logic or order schema.
- No removal of the `/cart` page.
- No new product/recommendation backend — recommendations reuse the existing featured-products query.

## Architecture

### State
- **New `src/store/useCartDrawer.ts`** — a minimal zustand store for UI open-state only:
  - `isOpen: boolean`
  - `open(): void` → sets `isOpen = true`
  - `close(): void` → sets `isOpen = false`
- Cart data remains entirely in the existing `src/store/useCartStore.ts` (`items`, `addItem`, `removeItem`, `updateQuantity`, `getTotalItems`, `getSubtotal`). No changes to its shape.

### Components
- **New `src/components/CartDrawer.tsx`** — the slide-out panel, built on the existing shadcn `Sheet` (`src/components/ui/sheet.tsx`), `side="right"`. Reads `isOpen`/`close` from `useCartDrawer` and cart data from `useCartStore`. Mounted **once** at the app root.
- **`src/App.tsx`** — render `<CartDrawer />` inside the `BrowserRouter` (so `Link`/navigation works) but outside `<Routes>`, so it overlays on every page.
- **`src/components/ProductCard.tsx`** — `addToCart` calls `addItem(props, 1)` then `useCartDrawer.open()`. Remove the current `toast(...)` (the opening drawer is the confirmation).
- **`src/components/Navbar.tsx`** — both the desktop and mobile cart icons call `useCartDrawer.open()` instead of `<Link to="/cart">`. Keep the item-count badge.

### Drawer layout (top → bottom)
1. **Header:** `MY CART (n)` where n = `getTotalItems()`; close button (Sheet's built-in close).
2. **Trust strip:** sage/forest band, centered: "100% Natural · Cruelty-Free · Secure Checkout".
3. **Line items** (scrollable): for each `useCartStore` item — thumbnail (`item.image`), name (links to product, closes drawer on click), unit price `Rs {price}`, quantity stepper `−  {qty}  +` (calls `updateQuantity(id, qty±1)`; `−` disabled at 1), remove icon (`removeItem(id)`), and per-line subtotal optional.
4. **"You may also like":** horizontal scroll of 3–4 products from the existing featured-products Supabase query (`supabase.from('products').select(...).eq('featured', true)` as in `FeaturedProducts.tsx`), filtered to exclude ids already in the cart. Each card: thumbnail, name, price, "+ Add" → `addItem`. If the query fails/returns empty, the section is hidden (graceful).
5. **Empty state** (when `items.length === 0`): bag icon, "Your Bag is Empty", subtext, and a "Shop Our Collection" button → `/products` (closes drawer). Trust strip + recommendations may still show; footer hidden.
6. **Sticky footer:** "Estimated Total" / subtotal via `getSubtotal()` (formatted `Rs {n}`), and a full-width **forest "Proceed to Checkout"** button → navigate to `/checkout` and `close()` the drawer. Secondary text link "View full cart" → `/cart` (optional, small).

### Styling
- Surfaces cream/white; headings Cormorant (`font-serif`); primary CTA forest (`bg-green-800 hover:bg-green-900 text-white`); accents clay; borders warm (`border` token).
- Desktop panel width ~`sm:max-w-[420px]`; full-width on mobile (Sheet default).
- Body scroll-locked while open (Sheet handles this).

## Data flow
1. User clicks Add to Cart on a `ProductCard` → `addItem(product)` updates `useCartStore` (persisted to localStorage) → `useCartDrawer.open()` → Sheet renders with `isOpen`.
2. Quantity/remove actions mutate `useCartStore`; the drawer re-renders reactively; `getSubtotal()`/`getTotalItems()` recompute.
3. "Proceed to Checkout" → `navigate('/checkout')` + `close()`. Existing checkout reads the same `useCartStore`, so no checkout changes needed.

## Error / edge handling
- Empty cart → empty state, footer hidden.
- Recommendations query error → log + hide the "You may also like" section (never block the drawer).
- Product with missing image → fallback to `/placeholder.svg`.
- Drawer must close on: overlay click, Escape, close button, navigating to checkout/product (Sheet handles overlay/Escape; we call `close()` on link clicks).
- `getTotalItems` hydration: Navbar already guards client-only count with `useEffect`; the drawer reads the store directly (client-only component), so no SSR mismatch (this is a Vite SPA anyway).

## Testing / verification
- Type-check (`tsc`), build, lint (no new errors).
- Headless screenshots: (a) drawer open with items, (b) empty state, (c) mobile width.
- Manual/flow check: Add to Cart opens drawer; qty +/− updates subtotal; remove works; navbar icon opens drawer; "Proceed to Checkout" lands on `/checkout` with the same items; Escape/overlay closes.

## Files
- Create: `src/store/useCartDrawer.ts`, `src/components/CartDrawer.tsx`
- Modify: `src/App.tsx`, `src/components/ProductCard.tsx`, `src/components/Navbar.tsx`

## Acceptance criteria
- Clicking Add to Cart anywhere opens the drawer with the item present and the count updated.
- Quantity stepper and remove work and update the subtotal live.
- Navbar cart icon opens the drawer; `/cart` still loads if visited directly.
- "Proceed to Checkout" navigates to `/checkout` with the cart intact and closes the drawer.
- Drawer is on-palette (forest CTA, cream/white, Cormorant headings), accessible (Escape/overlay close, focus trap), and responsive.
- No coupon/discount UI present.
