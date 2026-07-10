# Grevya Naturals — Palette & Design-System Foundation

**Date:** 2026-06-09
**Status:** Approved (design), pending implementation plan
**Scope:** Foundational design system only. This is workstream 1 of 4 (palette → redesign → bug/e2e → performance). It deliberately does NOT redesign page layouts; it makes colors, typography, and shared UI primitives consistent with the logo so the later redesign builds on a correct foundation.

## Goal

Make the entire site visually consistent with the Grevya Naturals logo, using a **soft & airy** application style (white/cream dominant, generous whitespace, brand color used sparingly) inspired by the reennaturals.in / Shopify "Sleek" aesthetic. Decisions confirmed with the user:

- Application style: **Soft & Airy** (not the high-contrast "grounded" variant).
- Heading font: **Cormorant Garamond**; body font: **Inter**.
- Implementation strategy: **remap existing tokens in place** (Approach 1), not a semantic-token refactor.

## Non-goals

- No page-layout redesign (that is workstream 2).
- No new components or features.
- No changes to data, auth, routing, or business logic.
- WhatsApp floating button keeps its official brand green (`#25D366`).

## Core palette (from logo)

| Token | Hex | Role |
|-------|-----|------|
| Forest | `#33381C` | Primary: buttons, links, headers, dark bands |
| Olive | `#797439` | Mid-tone: hover states, small highlights, accents |
| Clay / Tan | `#A68D65` | Warm accent: badges, prices, secondary pills, underlines (replaces `amber-*`) |
| Cream | `#F7EEE4` | Page background |
| Cream-light | `#FBF7F1` | Alternating section bands |
| White | `#FFFFFF` | Card surfaces |
| Ink | `#1D1E19` | Primary text / headings |
| Muted | `#5C5C54` | Secondary text |
| Border | `#E7E0D4` | Hairlines, card borders |

## Section 1 — Color tokens & role mapping

### 1a. Tailwind `green` scale remap (`tailwind.config.ts`)
Components reference `green-50…green-900` heavily, so remap that ramp to forest/olive tones (rather than rip them out):

| Step | New hex |
|------|---------|
| green-50 | `#F4F5EE` |
| green-100 | `#E7E9DD` |
| green-400 | `#8A8B5A` |
| green-600 | `#5A5E33` |
| green-700 | `#474B26` |
| green-800 | `#33381C` (forest / primary) |
| green-900 | `#262A14` (darkest) |

Also in the Tailwind theme:
- `cream` → `#F7EEE4`; add `cream-light` `#FBF7F1`.
- `earth`/`accent` → clay `#A68D65`.
- Add a **`clay`** color (`#A68D65`) and **`forest`** (`#33381C`) / **`olive`** (`#797439`) as named tokens for new code.
- **Add the missing `brown` scale** (currently used in markup but undefined): `brown-600` → `#5C5C54` (muted text), `brown-800` → `#1D1E19` (ink). This fixes silently-unthemed `text-brown-*` text in About/Contact/Navbar/etc.

### 1b. shadcn `:root` HSL variables (`index.css`)
Convert these hexes to HSL channel triplets and set:
- `--background` → cream `#F7EEE4`
- `--foreground` → ink `#1D1E19`
- `--primary` → forest `#33381C`; `--primary-foreground` → `#FFFFFF`
- `--secondary` → clay `#A68D65` (was amber); `--secondary-foreground` → ink
- `--accent` → `#E7E9DD`; `--accent-foreground` → forest
- `--muted` → `#F1ECE3`; `--muted-foreground` → `#5C5C54`
- `--border` / `--input` → `#E7E0D4`
- `--ring` → forest
- `--card` → white; `--card-foreground` → ink
- `--radius` → `0.625rem` (down from `1.5rem`)
- Mirror the same values into the `--sidebar-*` block.
- `--destructive` stays red (error semantics).

## Section 2 — Typography

- Replace the Inter-only Google Fonts `@import` in `index.css` with one that loads **Cormorant Garamond** (500/600/700) **and** Inter (300–800).
- `tailwind.config.ts` `fontFamily`: `serif` → `['Cormorant Garamond', 'serif']`; `sans` → `['Inter', 'sans-serif']`.
- `index.css` base layer: headings `h1–h6` switch from `font-sans tracking-tight` to **`font-serif`** at weight ~600, normal tracking (Cormorant is high-contrast; tight tracking hurts it).
- `.section-heading` utility → serif.
- Cormorant is for headings/display only. Buttons, labels, badges, nav, and all body copy remain Inter.

## Section 3 — Component conventions (`index.css` utilities)

- `.btn-primary` → forest bg, white text, hover `#262A14`.
- `.btn-secondary` → clay bg (`#A68D65`), ink text (was amber).
- `.btn-outline` → forest border + text, cream hover.
- `.eco-badge` → cream/sage bg (`#E7E9DD`), forest text.
- `.nav-link` underline → forest.
- Global radius softened via `--radius`; hero CTAs may use `rounded-full` explicitly.

## Section 4 — Sweep scope

The config + CSS remap handles most components automatically. Then targeted edits where colors are hardcoded off-palette:

- All `amber-*` utilities → clay equivalent (e.g., `text-amber-200` → `text-clay`, `bg-amber-400` → `bg-clay`). Known: `Index.tsx`, likely `Hero.tsx`, `Newsletter.tsx`.
- Dark `bg-green-900` CTA band in `Index.tsx` → forest (now correct via remap; verify it reads well).
- Verify `text-brown-*` now themes correctly via the new `brown` scale.
- Spot-check: `Hero`, `Index`, `Navbar`, `Newsletter`, `ProductCard`, `Footer` accents, `About`, `Contact`.

Estimated touch: **2 config/CSS files + ~6–10 component/page files.**

## Section 5 — Verification

1. `npx tsc -p tsconfig.app.json --noEmit` — passes.
2. `npm run build` — passes.
3. `npm run lint` — no new errors.
4. Headless-Chrome before/after screenshots of: Home (`/`), Products (`/products`), Product Detail, Cart (`/cart`).
5. Contrast: forest `#33381C` on cream `#F7EEE4` and clay `#A68D65` on white meet WCAG AA for their text sizes (forest-on-cream passes for body; clay is accent-only / large text — verify clay text usages are large/bold or swap to forest/ink).

## Risks & mitigations

- **Remapping `green-*` could make some incidental greens look muddy.** Mitigation: review the before/after screenshots; adjust the mid-ramp (green-400/600) if needed.
- **Cormorant at small sizes is thin/low-contrast.** Mitigation: restrict serif to headings; never apply to <16px text.
- **Clay text on white may fail AA at small sizes.** Mitigation: use clay for large/bold accents and fills; keep small body text in ink/forest.
- **Not a git repo** (`git rev-parse` is false here), so the spec is saved to disk but not committed.

## Acceptance criteria

- No `amber-*` utilities remain in `src/`.
- No undefined-color utilities (`brown-*`) render as un-themed text.
- Headings render in Cormorant Garamond; body in Inter.
- Primary actions are forest; warm accents are clay; backgrounds are cream/white.
- Build, types, and lint pass; before/after screenshots confirm a consistent, airy, logo-aligned look.
