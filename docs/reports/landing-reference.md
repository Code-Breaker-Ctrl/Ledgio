# Reference Study: screen.movie Landing Page Architecture & Motion Language

## 1. Overview & Verified Architecture
- **Tech Stack**: Built with Framer (pure modern HTML/CSS/JS output, zero GSAP/Lenis/Three.js dependencies).
- **Page Dimensions**: ~21,000px vertical flow, strictly dark mode throughout.
- **Background Palette**: Absolute pitch black (`#000000`), card surfaces at `#0b0b0c` with 1px hairlines (`rgba(255, 255, 255, 0.08)`).
- **Color Drama**: Dual-tone ambient aurora light ribbons (cool and warm glow) over deep black, providing high contrast and cinematic presence.
- **Typography**: Inter / Inter Display. Tight tracking (`letter-spacing: -0.04em` to `-0.05em`), heavy headings (`font-weight: 700`), secondary text in refined neutral grey (`rgba(255, 255, 255, 0.55)`).

## 2. Component Design & Spacing
- **Floating Pill Navigation**:
  - Border-radius ~18px (full pill).
  - Desktop: `backdrop-filter: blur(20px)` with inset glow (`box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.2)` + 1px border highlight `rgba(255, 255, 255, 0.12)`).
  - Mobile: Solid dark opaque pill (`rgba(9, 9, 11, 0.92)`) avoiding mobile GPU blur penalty.
  - Structure: Brand logo + anchor links + high-contrast solid white pill button on right.
  - Scroll dynamics: Padding tightens slightly on scroll with elevated backdrop opacity.
- **Hero Composition**:
  - Glowing ambient aurora gradient backdrop.
  - Centered glowing app icon in rounded container.
  - Version / release badge pill ("Local-first · v1.7.0 · free forever").
  - Singular commanding `<h1>` with tight tracking (`clamp(44px, 7vw, 92px)`, `line-height: 1.02`).
  - Balanced secondary grey subline.
  - Dual CTAs: Primary solid white pill button (black text, ~48-52px height) + secondary glass pill button.
  - Verification tag strip: 100% truthful, non-commercial trust metrics.
  - Scaled Product Window: Embedded showcase below hero scaling smoothly from ~0.92 to 1.0 and lifting on scroll.
- **Problem Statement**:
  - High-impact editorial headline emphasizing product philosophy, followed by a succinct grey descriptive paragraph.
- **Three-Step Workflow**:
  - Horizontal grid of 3 dark cards ("Step 1 Add · Step 2 Track · Step 3 Sync") with minimal line icons, bold headers, and subtle stagger entrance.
- **Numbered Feature Sections (01 to 07)**:
  - Standardized modular hierarchy:
    1. Small category pill indicator (e.g. `01 · Instant capture`).
    2. Centered `<h2>` (48px desktop, 700 weight, -2.4px tracking, ~2 lines).
    3. Grey descriptive body paragraph.
    4. Substantial dark card container (24px–32px radius) housing a looping interactive demo.
    5. Clean caption typography: bold title followed by secondary grey caption.
  - Alternating layout cadence: Full-width hero-style showcases alternating with balanced two-column presentations.
- **Closing & Sign-off**:
  - Secondary aurora ambiance, focused headline ("Your next budget is minutes away."), primary white pill CTA, and reassuring local-first zero-telemetry guarantee line.
- **Minimal Editorial Footer**:
  - Discreet links, MIT license, GitHub star CTA, and copyright metadata.

## 3. Motion System & Entrance Rules
- **Appearance Animation**:
  - Single observer system: `[data-appear]` triggers when an element is ~20% visible.
  - Motion parameters: `opacity: 0 -> 1`, `transform: translateY(24px) -> translateY(0)`, `filter: blur(8px) -> blur(0)` over 700ms using `cubic-bezier(0.22, 1, 0.36, 1)`.
  - Child staggering via CSS variable `--i` (80ms multiplier).
  - Mobile simplification: Translates and opacities only (omits filter blur during scroll for optimal 60fps performance).
  - Plays once, respects `prefers-reduced-motion` immediately without transitions.
- **Scroll-Driven Parallax**:
  - CSS `animation-timeline: view()` where supported, with lightweight `requestAnimationFrame` fallback reading cached geometry.
  - Product window scale/translate and subtle aurora drift.
- **Demo Playback Optimization**:
  - Looping demos execute only while $\ge 40\%$ visible in viewport; pause automatically when out of frame or when document is hidden.
