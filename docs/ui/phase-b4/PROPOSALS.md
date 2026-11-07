# Phase B4 Section Pruning & Architecture Proposals (For Owner Review)

All 13 existing sections and interactive demos are preserved intact in this release to maintain 100% test gate and functional parity. The following structural cuts and consolidations are proposed for owner sign-off:

---

### Proposal 1: Consolidate `offline-demo` and `simulator` into Feature Stories
- **Current state**: Two standalone sections (`#offline-demo` and `#simulator`) duplicate explanations already introduced in Feature 01 (local IndexedDB) and Feature 02 (monthly pacing headroom).
- **Proposed change**: Move the runway calculation formula into the interactive pacing widget in Feature 02, and replace the synthetic airplane mode simulator with a simple offline status badge in the header.
- **Estimated impact**: Reduces total landing page length by ~900 vertical pixels (-18% document height) and cuts 12 interactive DOM nodes.

---

### Proposal 2: Group the 5 Feature Deep-Dives into 3 Core Stories
- **Current state**: Five numbered feature sections (`#feature-01` through `#feature-05`) create repetitive layout rhythms (eyebrow, title, description, widget container).
- **Proposed change**:
  1. Story 1: Daily Ledger & Rapid Entry (combining instant entry and monthly category pacing).
  2. Story 2: Long-term Planning (combining emergency savings goals and peer loans).
  3. Story 3: Privacy & Security (combining encrypted vault and local-only architecture).
- **Estimated impact**: Reduces redundant section headings and creates a tighter, more compelling narrative flow.

---

### Proposal 3: Retire Decorative CSS Mac Window Frames in All Remaining Demos
- **Current state**: Interactive demos are wrapped in simulated OS window chrome (`.mac-window-frame`, `.mac-window-topbar`).
- **Proposed change**: Render interactive widgets inside honest, borderless card containers or directly on the canvas surface, using real product screenshots for static demonstrations.
- **Estimated impact**: Eliminates template cliche appearance (Hallmark Rule 47a) and reduces CSS styling surface.

---

### Proposal 4: Rationalize FAQ Down to 5 Concrete Questions
- **Current state**: 7 FAQ questions, some addressing speculative cloud features.
- **Proposed change**: Focus exclusively on the 4 questions real users ask:
  1. Where is my financial data stored? (IndexedDB on device)
  2. Does Ledgio ever see my bank balance? (No, no bank login)
  3. Can I export my records? (Yes, CSV and JSON export)
  4. How does encrypted sync work? (Zero-knowledge AES-GCM)
- **Estimated impact**: Cuts 180 words of redundant copy and improves mobile FAQ scanability.
