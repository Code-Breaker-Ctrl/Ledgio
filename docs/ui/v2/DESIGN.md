# Ledgio v2 Design System — "Halftone Ledger"

> **Design Direction**: Dark, dot-matrix, quiet.  
> **Brand Promise**: Local-first private finance. Zero trackers, zero bank logins, zero ads. Your data stays on your device.  
> **Aesthetic Philosophy**: Calm, precise, trustworthy, a little uncanny — like a quiet, high-precision instrument that turns scattered transactions into one serene, crystal-clear picture. Restraint is the premium signal.

---

## 1. Color System (Tokens)

All components must strictly consume CSS custom properties defined on `:root`. Raw hex in components is prohibited.

| Token | Value | Role | Contrast vs `--bg` |
| :--- | :--- | :--- | :--- |
| `--bg` | `#05080F` | Deep navy-black void base | — |
| `--surface` | `#0B111B` | Primary card & floating container surface | 1.1:1 (elevated with 1px border) |
| `--surface-2` | `#101826` | Secondary interactive surface (inputs, nested chips) | 1.3:1 |
| `--surface-glass` | `rgba(11, 17, 27, 0.82)` | Solid translucent backdrop for floating pills & nav | Glass effect |
| `--border-subtle` | `rgba(255, 255, 255, 0.07)` | 1px hairline card inner border | Specular boundary |
| `--border-focus` | `#5EEAD4` | Accessible keyboard focus outline | High visibility |
| `--text` | `#F2F6FA` | Primary display & body text | 18.5:1 (WCAG AAA) |
| `--text-dim` | `#9AA7B6` | Secondary descriptions, sublines, meta labels | 8.2:1 (WCAG AAA $\ge$ 4.5:1) |
| `--text-muted` | `#627284` | Tertiary timestamps, decorative mono captions | 4.8:1 (WCAG AA) |
| `--brand` | `#10B981` | Emerald identity, positive delta, safe-to-spend | 8.4:1 (WCAG AAA) |
| `--accent` | `#5EEAD4` | Aqua highlight from voxel artwork (sparingly: dots, focus) | 14.1:1 (WCAG AAA) |
| `--warn` | `#F59E0B` | Near-cap budget warnings, alerts | 9.6:1 (WCAG AAA) |
| `--danger` | `#F43F5E` | Over-budget warnings, debt indicators | 5.2:1 (WCAG AA) |
| `--ring` | `#5EEAD4` | Focus ring glow | Specular |

### Ambient Atmosphere Glows
- Single slow teal/emerald radial gradient behind the hero icon:
  `radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.12) 0%, rgba(94, 234, 212, 0.05) 35%, transparent 70%)`
- Tiled faint dot-grain texture: `assets/img/grain-dot.svg` ($\le$ 2KB, `opacity: 0.035`, fully static).

---

## 2. Typography Scale

Three deliberate typefaces create the quiet, editorial hierarchy:
1. **Sans**: `Inter` (variable, self-hosted `assets/fonts/inter-variable.woff2`) — UI text, body copy, button labels.
2. **Serif Accent**: `Instrument Serif` (italic, self-hosted `assets/fonts/instrument-serif-italic.woff2`) — used strictly for the single emphasis word in display headings (e.g., "*money*", "*practice*").
3. **Mono**: `Geist Mono` (regular & medium, self-hosted `assets/fonts/geist-mono-latin.woff2`, $\le$ 11KB) — all financial numerals (`font-variant-numeric: tabular-nums`), eyebrow labels, section chips (01–07), status chips.

### Type Hierarchy
- **Hero Title**: `clamp(2.5rem, 6.5vw, 4.5rem)` | `font-weight: 600` | `letter-spacing: -0.025em` | `line-height: 1.08` | Max 3 lines on mobile.
- **Section Heading (h2)**: `clamp(1.75rem, 4vw, 2.75rem)` | `font-weight: 600` | `letter-spacing: -0.02em` | `line-height: 1.15`.
- **Card Heading (h3)**: `clamp(1.15rem, 2.5vw, 1.4rem)` | `font-weight: 550` | `letter-spacing: -0.01em` | `line-height: 1.3`.
- **Body / Subtitle**: `clamp(1rem, 2vw, 1.125rem)` | `font-weight: 400` | `line-height: 1.55` | Color: `--text-dim`.
- **Mono Eyebrow / Label**: `11px` (`0.6875rem`) | `font-family: var(--font-mono)` | `text-transform: uppercase` | `letter-spacing: 0.08em` | `font-weight: 500`.
- **Mono Status Chip**: `12px` (`0.75rem`) | `font-family: var(--font-mono)` | `letter-spacing: 0.02em` | `tabular-nums`.
- **Financial Metric Display**: `clamp(1.75rem, 4vw, 2.5rem)` | `font-family: var(--font-mono)` | `font-variant-numeric: tabular-nums`.

---

## 3. Spacing & Spatial Scale

Generous whitespace gives the product the calm, intentional feel of the Nightjar reference.

- **Desktop Section Padding**: `110px 24px 120px` (min 96px, max 140px).
- **Mobile Section Padding**: `68px 16px 76px` (min 60px, max 80px).
- **Desktop Card Padding**: `32px` to `40px`.
- **Mobile Card Padding**: `20px` to `24px`.
- **Content Max Widths**:
  - Hero container: `1200px`
  - Text container (problem / headings): `760px`
  - Demo stage window: `1180px`
  - Grid card gap: `20px` (desktop), `14px` (mobile)

---

## 4. Radii & Surface Depth

- **Pills & Badges**: `9999px` (`--radius-pill`)
- **Large Cards (Desktop)**: `30px` (28px–32px) (`--radius-2xl`)
- **Large Cards (Mobile)**: `24px` (`--radius-xl`)
- **Inner Interactive Elements (Inputs, Buttons)**: `12px`–`14px` (`--radius-md`)
- **Hairline Specular Highlight**: `inset 0 1px 0 rgba(255, 255, 255, 0.07)`
- **Depth Shadows**:
  - Hero Window: `0 32px 80px -16px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.07)`
  - Standard Card: `0 16px 40px -8px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06)`

---

## 5. Signature Motifs

1. **Halftone Dot Matrix**:
   - The Ledgio pie logo, section numerals, and focal objects assemble from ordered dither dots.
   - Desktop: single `<canvas>` 2D (DPR capped at 2, single rAF, pauses when off-screen or hidden). Scatter $\to$ Assemble over 1.6s ease-out `cubic-bezier(.23, 1, .32, 1)`. Idle breathing ($\pm$0.4px, ~20s) and rare soft aqua scan pass (~12s interval, 1.2s duration). Pointer repulsion on `pointer: fine` devices.
   - Mobile: pre-rendered static SVG dithered logo ($\le$ 25KB) with 1.2s CSS-only scale/opacity arrival. No canvas on $\le$ 767px.
   - Reduced Motion: completely static assembled state.
2. **Voxel Cubes**:
   - Isometric stacked cube accents (flat teal faces, 3 tones: top highlight, left mid, right shadow) symbolizing stacked ledger savings and financial headroom.
3. **Stream Animation**:
   - Subtitle text reveals word-by-word with a short blur-in (desktop) or opacity-only (mobile, to avoid filter overhead) with 25ms stagger and a quiet blinking terminal cursor that halts upon completion.
4. **Status Chips**:
   - Styled after Nightjar's "Thinking 1.4s" chip with a 3x3 dot matrix glyph that pulses while live demo actions occur.

---

## 6. Motion & Performance Budgets

- **Target**: Mid-range mobile phones (4x CPU throttling in Chrome/Edge).
- **LCP**: $< 2.5\text{s}$ | **CLS**: $< 0.05$ | **Long tasks**: $0 > 50\text{ms}$.
- **Framerate**: $\ge 55\text{fps}$ throughout scrolling and idling.
- **Allowed Motion**: Only `transform` and `opacity` are animated.
- **Forbidden on Animated Elements**:
  - No animated `filter: blur` on mobile (causes GPU rasterization stalls).
  - No `backdrop-filter` over moving content.
  - No full-screen `mask-image` on animated layers.
  - No more than 3 elements with active `will-change`.
- **Off-Screen Throttling**: IntersectionObserver disconnects/pauses canvas rAF loop and demo intervals when out of view or tab is hidden (`document.hidden`).

---

## 7. Do / Don't Checklist

### Do:
- Use self-hosted, precached fonts only (Inter, Instrument Serif, Geist Mono).
- Use `clamp()` for fluid font sizing across 320px to 1440px.
- Use `dvh` / `svh` with `vh` fallback.
- Enforce 44x44px minimum tap target sizes on touch devices.
- Style `:hover` strictly inside `@media (hover: hover) and (pointer: fine)`.
- Use `:active` press feedback (`transform: scale(0.97)`) on all tappables.

### Don't:
- Never use ruled lines, grids, hairline-pattern background lines, or "paper" ledger motifs (explicitly rejected by owner).
- Never use WebGL, Three.js, or external animation libraries.
- Never use emoji as UI icons.
- Never allow raw hex colors in component CSS.
- Never allow unstyled classes in HTML (`scripts/check_unstyled.ps1` must be clean).
- Never change any marketing copy, feature text, claim, or heading words.
