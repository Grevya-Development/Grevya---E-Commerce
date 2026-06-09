# Palette & Design-System Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the whole site visually consistent with the Grevya Naturals logo using a soft & airy palette (Forest/Olive/Clay/Cream/Ink) and Cormorant Garamond headings, by remapping design tokens in place.

**Architecture:** Remap the Tailwind `green` color scale, the shadcn `:root` HSL variables, and the font families so existing class names render the correct colors/fonts. Add `clay`/`forest`/`olive`/`brown`/`cream-light` named tokens. Then sweep the only off-palette hardcoded utility (`amber-*`) across 8 files. `green-800/900` and `brown-*` become correct automatically via the remap.

**Tech Stack:** Vite + React + TypeScript, Tailwind CSS, shadcn/ui (HSL CSS variables), Google Fonts.

> **Repo note:** This directory is NOT a git repository (`git rev-parse` returns false). Wherever a normal plan would `git commit`, this plan uses a **Checkpoint** step (run build/type-check instead). Do not run git commands.

> **Reference spec:** `docs/superpowers/specs/2026-06-09-palette-design-system-design.md`

---

### Task 0: Capture baseline ("before") screenshots

**Files:**
- None modified (read-only baseline).

- [ ] **Step 1: Build and start a preview server**

```bash
npm run build && (pkill -f "vite preview" 2>/dev/null; npx vite preview --port 4200 >/tmp/vp.log 2>&1 &) ; sleep 3 ; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4200/
```
Expected: `200`

- [ ] **Step 2: Screenshot Home, Products, Cart with headless Chrome (separate profile, the user's Chrome holds the default lock)**

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for p in "home:/" "products:/products" "cart:/cart"; do n="${p%%:*}"; u="${p#*:}"; "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1440,1600 --user-data-dir=/tmp/cr-shot --screenshot=/tmp/before-$n.png "http://localhost:4200$u" >/dev/null 2>&1; done; ls -la /tmp/before-*.png
```
Expected: three PNG files exist.

- [ ] **Step 3: View them** with the Read tool (`/tmp/before-home.png`, `/tmp/before-products.png`, `/tmp/before-cart.png`) to record the current look. Keep the preview server running for later comparison.

---

### Task 1: Remap Tailwind colors & add named tokens

**Files:**
- Modify: `tailwind.config.ts` (the `colors` object inside `theme.extend`)

- [ ] **Step 1: Replace the `green`, `cream`, and `earth` entries and add new named tokens.**

Find the existing block (currently):
```ts
				green: {
					100: "#E5FFF1",
					400: "#63D993",
					600: "#20A068",
					700: "#118C4F",
					800: "#046D38",
				},
				cream: '#ECFFF4',
				earth: '#A3E6B1',
```
Replace with:
```ts
				green: {
					50: "#F4F5EE",
					100: "#E7E9DD",
					400: "#8A8B5A",
					600: "#5A5E33",
					700: "#474B26",
					800: "#33381C",
					900: "#262A14",
				},
				forest: '#33381C',
				olive: '#797439',
				clay: '#A68D65',
				cream: '#F7EEE4',
				'cream-light': '#FBF7F1',
				ink: '#1D1E19',
				earth: '#A68D65',
				brown: {
					600: '#5C5C54',
					800: '#1D1E19',
				},
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0 (no errors).

- [ ] **Step 3: Checkpoint** — `npm run build` succeeds.

---

### Task 2: Switch heading font family to Cormorant Garamond

**Files:**
- Modify: `tailwind.config.ts` (the `fontFamily` block inside `theme.extend`)

- [ ] **Step 1: Replace the `fontFamily` block.**

Find:
```ts
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				serif: ['Merriweather', 'serif'],
			},
```
Replace with:
```ts
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
			},
```

- [ ] **Step 2: Checkpoint** — `npm run build` succeeds.

---

### Task 3: Update font import + shadcn CSS variables

**Files:**
- Modify: `src/index.css` (the `@import` line at top, and the `:root` block)

- [ ] **Step 1: Replace the Google Fonts import (line 1).**

Find:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
```
Replace with:
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap');
```

- [ ] **Step 2: Replace the entire `:root { … }` block** inside the first `@layer base` with the logo-palette HSL values:

```css
  :root {
    --background: 32 54% 93%;           /* Cream #F7EEE4 */
    --foreground: 72 9% 11%;            /* Ink #1D1E19 */
    --card: 0 0% 100%;                  /* White */
    --card-foreground: 72 9% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 72 9% 11%;
    --primary: 71 33% 16%;              /* Forest #33381C */
    --primary-foreground: 0 0% 100%;
    --secondary: 37 27% 52%;            /* Clay #A68D65 */
    --secondary-foreground: 72 9% 11%;
    --muted: 39 33% 92%;                /* warm muted #F1ECE3 */
    --muted-foreground: 60 5% 35%;      /* #5C5C54 */
    --accent: 70 21% 89%;               /* sage #E7E9DD */
    --accent-foreground: 71 33% 16%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 38 28% 87%;               /* #E7E0D4 */
    --input: 38 28% 87%;
    --ring: 71 33% 16%;
    --radius: 0.625rem;

    --sidebar-background: 32 54% 93%;
    --sidebar-foreground: 72 9% 11%;
    --sidebar-primary: 71 33% 16%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 39 33% 92%;
    --sidebar-accent-foreground: 72 9% 11%;
    --sidebar-border: 38 28% 87%;
    --sidebar-ring: 71 33% 16%;
  }
```

- [ ] **Step 3: Checkpoint** — `npm run build` succeeds.

---

### Task 4: Update base headings + shared utility classes

**Files:**
- Modify: `src/index.css` (the second `@layer base` headings rule, and the `@layer components` utilities)

- [ ] **Step 1: Make headings use the serif font.**

Find:
```css
  h1, h2, h3, h4, h5, h6 {
    @apply font-sans tracking-tight;
  }
```
Replace with:
```css
  h1, h2, h3, h4, h5, h6 {
    @apply font-serif font-semibold tracking-normal;
  }
```

- [ ] **Step 2: Update the component utility classes.**

Find the `@layer components { … }` block and replace the `.eco-badge`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.section-heading` rules with:
```css
  .eco-badge {
    @apply bg-green-100 text-green-800 px-3 py-1 text-xs rounded-full font-semibold flex items-center shadow-sm border border-green-100;
  }

  .btn-primary {
    @apply bg-green-800 hover:bg-green-900 text-white px-8 py-3 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none;
  }

  .btn-secondary {
    @apply bg-clay hover:bg-olive text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0;
  }

  .btn-outline {
    @apply border-2 border-green-800 text-green-800 hover:bg-green-50 px-8 py-3 rounded-xl font-medium transition-all duration-300;
  }

  .section-heading {
    @apply font-serif text-4xl md:text-5xl font-semibold text-green-900 mb-8 tracking-normal;
  }
```
(Leave `.nav-link` as-is — it already references `green-800`, which is now forest.)

- [ ] **Step 3: Checkpoint** — `npm run build` succeeds.

---

### Task 5: Amber sweep — ratings, badges, status (3 files)

**Files:**
- Modify: `src/components/ProductCard.tsx:48` and `:83`
- Modify: `src/pages/ProductDetail.tsx:221`, `:247`, `:345`, `:401`
- Modify: `src/pages/Orders.tsx:76`

- [ ] **Step 1: ProductCard — badge + rating stars.**

`:48` find `bg-amber-400 text-neutral-900` → replace `bg-amber-400` with `bg-clay` (keep `text-neutral-900`).
`:83` replace both `text-amber-400` occurrences with `text-clay`.

- [ ] **Step 2: ProductDetail — gradient + 3 rating-star sites.**

`:221` replace `to-amber-50/30` with `to-clay/10`.
`:247`, `:345`, `:401` replace each `text-amber-400` with `text-clay`.

- [ ] **Step 3: Orders — pending status badge.**

`:76` replace `bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800` with `bg-cream-light px-3 py-1 text-xs font-bold capitalize text-olive`.

- [ ] **Step 4: Verify no amber remains in these files.**

Run: `grep -rn "amber-" src/components/ProductCard.tsx src/pages/ProductDetail.tsx src/pages/Orders.tsx`
Expected: no output.

- [ ] **Step 5: Checkpoint** — `npm run build` succeeds.

---

### Task 6: Amber sweep — decorative accents (5 files)

**Files:**
- Modify: `src/components/FeaturedProducts.tsx:63`
- Modify: `src/components/PersonalizedHome.tsx:54`, `:80`
- Modify: `src/pages/Index.tsx:51`
- Modify: `src/pages/Account.tsx:335`
- Modify: `src/pages/AuthPage.tsx:239`, `:257`, `:271`, `:289`
- Modify: `src/components/NotificationBell.tsx:197`

- [ ] **Step 1: FeaturedProducts — accent divider.**

`:63` replace `bg-amber-400` with `bg-clay`.

- [ ] **Step 2: PersonalizedHome — icons on dark band.**

`:54` replace `text-amber-300` with `text-clay`.
`:80` replace `text-amber-200` with `text-clay`.

- [ ] **Step 3: Index — "Member benefits" label.**

`:51` replace `text-amber-200` with `text-clay`.

- [ ] **Step 4: Account — "My Account" label.**

`:335` replace `text-amber-200` with `text-clay`.

- [ ] **Step 5: AuthPage — 4 icon/label sites.**

`:239`, `:257`, `:271`, `:289` replace each `text-amber-300` with `text-clay`.

- [ ] **Step 6: NotificationBell — order-type icon chip.**

`:197` replace `bg-amber-100 text-amber-700` with `bg-green-100 text-olive`. (The `blue-100/blue-700` branch is an intentional functional distinction and is out of scope — leave it.)

- [ ] **Step 7: Verify no amber remains anywhere.**

Run: `grep -rn "amber-" src --include="*.tsx" --include="*.ts"`
Expected: no output.

- [ ] **Step 8: Checkpoint** — `npm run build` succeeds.

---

### Task 7: Verify auto-remapped colors (green & brown) — no edits expected

**Files:**
- None (verification only).

- [ ] **Step 1: Confirm `text-brown-*` now resolves to a defined token.**

Run: `grep -rn "brown-" src --include="*.tsx" | head`
Then confirm `tailwind.config.ts` defines `brown.600` and `brown.800` (from Task 1). These utilities now theme correctly; no per-file edits needed.

- [ ] **Step 2: Confirm dark bands use forest.**

The `bg-green-900` bands (`Index.tsx:48`, `PersonalizedHome.tsx:50`) and `bg-green-800` buttons now render forest/darkest via the remap. No edits — verify visually in Task 8.

---

### Task 8: Final verification — build, lint, types, after-screenshots, contrast

**Files:**
- None (verification only).

- [ ] **Step 1: Type-check + build + lint.**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run build && npm run lint`
Expected: tsc exit 0; build succeeds; lint shows no NEW errors vs baseline.

- [ ] **Step 2: Rebuild preview and capture "after" screenshots.**

```bash
pkill -f "vite preview" 2>/dev/null; npx vite preview --port 4200 >/tmp/vp.log 2>&1 & sleep 3
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for p in "home:/" "products:/products" "cart:/cart"; do n="${p%%:*}"; u="${p#*:}"; "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1440,1600 --user-data-dir=/tmp/cr-shot --screenshot=/tmp/after-$n.png "http://localhost:4200$u" >/dev/null 2>&1; done; ls -la /tmp/after-*.png
```
Expected: three `after-*.png` files.

- [ ] **Step 3: Compare before/after** with the Read tool. Confirm: backgrounds are cream/white; primary buttons/links are forest green; accents (badges, prices, dividers) are clay; headings render in Cormorant Garamond serif; no bright kelly-green or amber/gold remains.

- [ ] **Step 4: Contrast spot-check.** Verify forest `#33381C` text on cream `#F7EEE4` reads clearly (it does — ratio ~9:1). Confirm clay is only used for large/bold accents (badges, dividers, ≥18px labels), never small body text. If any small clay text appears, change it to `text-ink` or `text-green-800`.

- [ ] **Step 5: Clean up.**

```bash
pkill -f "vite preview" 2>/dev/null; rm -f /tmp/before-*.png /tmp/after-*.png /tmp/vp.log; rm -rf /tmp/cr-shot
```

---

## Self-Review

**Spec coverage:**
- §1a Tailwind green remap + named tokens + brown scale → Task 1 ✅
- §1b shadcn HSL variables + radius → Task 3 ✅
- §2 Typography (font import, families, serif headings) → Tasks 2, 3, 4 ✅
- §3 Component utility classes → Task 4 ✅
- §4 Sweep scope (amber→clay; green-900/brown auto) → Tasks 5, 6, 7 ✅
- §5 Verification (build/lint/type/screenshots/contrast) → Tasks 0, 8 ✅

**Placeholder scan:** No TBD/TODO; every code step shows exact find/replace strings. ✅

**Type/name consistency:** Named tokens defined in Task 1 (`clay`, `olive`, `forest`, `cream-light`, `brown.600/800`) are exactly the ones referenced in Tasks 4–6 (`bg-clay`, `hover:bg-olive`, `text-olive`, `bg-cream-light`, `to-clay/10`). ✅

**Notes:**
- `blue-*` in NotificationBell is intentionally left (functional info color, out of palette scope).
- HSL triplets in Task 3 are computed from the spec hexes; minor visual tuning is allowed during Task 8 screenshot review.
