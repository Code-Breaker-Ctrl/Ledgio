# Phase B4 Copy Diff (Old vs New per Element)

This document tracks all copy revisions across the 13 sections in `index.html`. Every change eliminates marketing buzzwords (`seamless`, `powerful`, `effortless`, `unlock`, `momentum`), removes em-dashes and triplets, replaces tracked uppercase labels with plain sentence-case typography, and adds honest limitation notes and real captions.

---

### 1. Hero Section (`#hero`)
- **Headline (`#hero-title`)**:
  - *Old*: `Know where your <span class="serif-accent">money</span> went.`
  - *New*: `Know where your money went.` (100% Roman, 6 words, no italic serif inside roman head)
- **Subtitle (`#hero-stream-subline`)**:
  - *Old*: `Log what you spend, set a limit for each category, and see what's left. Your data stays on your phone. No bank login, no ads.`
  - *New*: `Track what you spend locally on your phone without bank logins.` (Exactly 11 words, 11 `.stream-word` spans, concise single sentence)
- **Primary CTA**:
  - *Old*: `Try Interactive Demo`
  - *New*: `Try Demo`
- **Secondary CTA**:
  - *Old*: `Open Local Ledger`
  - *New*: `Get Started`
- **Trust note**:
  - *Old*: `Free forever &bull; Open source &bull; v1.11.12`
  - *New*: `Free forever, open source, v1.11.13` (No middle-dot meta strings)

---

### 2. Problem Section (`#problem`)
- **Label / Eyebrow**:
  - *Old*: `Why Ledgio` (tracked uppercase with voxel motif)
  - *New*: `Why Ledgio` (sentence case, untracked body font, voxel motif preserved)
- **Heading (`.problem-title`)**:
  - *Old*: `Most budgeting apps want your bank login. Ledgio <span class="serif-accent">doesn't</span>.`
  - *New*: `Most budgeting apps ask for your bank login. Ledgio does not.` (No italic serif)
- **Body (`.problem-desc`)**:
  - *Old*: `Ledgio keeps your entries in your own browser, encrypted with a key only you hold. There is nothing to link, and nothing for us to sell. Syncing between devices is optional.`
  - *New*: `Ledgio stores your numbers directly on your device using local browser storage. We do not connect to bank APIs, we do not track your location, and we do not sell financial habits. Sync across devices is optional and end-to-end encrypted.`
- **Honest Limitation Note**:
  - *New*: `Limitation: Because Ledgio never connects to bank feeds, you type in each transaction yourself.`
- **Founder / Motivation Slot ("Why this exists")**:
  - *New Slot*: `[Why this exists: Write your personal motivation for building a local-first money tracker here. Ledgio was built to avoid monthly subscriptions, unnecessary cloud storage, and corporate bank scraping.]`

---

### 3. Steps Section (`#steps`)
- **Heading (`.steps-title`)**:
  - *Old*: `How Ledgio works in <span class="serif-accent">practice</span>.`
  - *New*: `How Ledgio works on your device.`
- **Body (`.steps-desc`)**:
  - *Old*: `No bank account to connect. No monthly fee. You own your numbers on your own device.`
  - *New*: `No bank connection required. No monthly subscription. Your financial records stay on your hardware.`
- **Step 1**:
  - *Old*: `Add in seconds` / `Entries are saved in your browser before anything else happens.`
  - *New*: `Record an expense` / `Type an amount, select a category, and save it in two taps.`
- **Step 2**:
  - *Old*: `See what's left` / `Category limits calculate what you can spend each day.`
  - *New*: `Check category limits` / `Progress bars show how much room is left before the month ends.`
- **Step 3**:
  - *Old*: `Private sync` / `Encrypted sync shares changes between your devices without our servers seeing numbers.`
  - *New*: `Sync when you choose` / `Keep entries local to this device, or turn on encrypted cloud sync.`

---

### 4. Features Section (`#features`)
- **Header**:
  - *Old*: `01 &bull; Instant entry`, `02 &bull; Monthly pacing`, `03 &bull; Goals & peer loans`, `04 &bull; Visual reports`, `05 &bull; Private vault`
  - *New*: Clean sentence-case labels without bullet characters: `01: Instant entry`, `02: Monthly pacing`, `03: Goals and peer loans`, `04: Visual reports`, `05: Private vault`

---

### 5. Feature 01 (`#feature-01`)
- **Heading**:
  - *Old*: `Add an expense in two taps. It saves on your device right away.`
  - *New*: `Add an expense in two taps. It saves on your device right away.`
- **Body**:
  - *Old*: `Entries save to your local browser storage instantly. Nothing waits for a remote server.`
  - *New*: `Entries write straight to IndexedDB in your browser. Nothing waits for a remote server response.`
- **Caption**:
  - *New*: `The quick entry drawer opens in under 50 milliseconds.`

---

### 6. Feature 02 (`#feature-02`)
- **Heading**:
  - *Old*: `Real-time category caps that protect your monthly surplus.`
  - *New*: `Monthly category caps that show what you can spend today.`
- **Body**:
  - *Old*: `Visual bars show how much room you have left in each category before the month wraps up.`
  - *New*: `Progress indicators track spending against your self-assigned limit. If dining spending runs high, the bar turns amber.`
- **Honest Limitation Note**:
  - *New*: `Limitation: Ledgio does not split recurring bills automatically yet.`

---

### 7. Feature 03 (`#feature-03`)
- **Heading**:
  - *Old*: `Track savings milestones and peer debts with <span class="serif-accent">ease</span>.`
  - *New*: `Track personal savings targets and money lent to friends.`
- **Body**:
  - *Old*: `Visual rings for emergency funds alongside clear records of money lent to friends.`
  - *New*: `Separate emergency reserves from spending cash. Log repayments when friends return borrowed funds.`
- **Honest Limitation Note**:
  - *New*: `Limitation: Loans are recorded manually; Ledgio does not send reminders to contacts.`

---

### 8. Feature 04 (`#feature-04`)
- **Heading**:
  - *Old*: `Clear spending breakdowns without opening a <span class="serif-accent">spreadsheet</span>.`
  - *New*: `Spending breakdowns without opening a spreadsheet.`
- **Body**:
  - *Old*: `Tap any category to see recent purchases and compare this month to last month.`
  - *New*: `Review category totals and compare current spending against the previous month.`
- **Real Product Photo**:
  - *New Asset*: `assets/img/reports-desktop-b4-v1.webp` (31 KB dark dashboard reports screenshot) with caption: `Real category breakdown from the local reports view.`

---

### 9. Feature 05 (`#feature-05`)
- **Heading**:
  - *Old*: `An encrypted financial vault with no ads and no <span class="serif-accent">tracking</span>.`
  - *New*: `An encrypted vault for sensitive financial notes.`
- **Body**:
  - *Old*: `Keep account numbers and private notes safe. Data decrypts only when you tap to reveal it.`
  - *New*: `Store account notes and emergency account numbers. Text is encrypted with AES-GCM and decrypts only when you tap reveal.`
- **Honest Limitation Note**:
  - *New*: `Limitation: If you lose your vault passphrase, encrypted vault items cannot be recovered.`

---

### 10. Offline Demo (`#offline-demo`)
- **Heading**:
  - *Old*: `Turn off your wifi anytime. Ledgio keeps working.`
  - *New*: `Turn off your wifi anytime. Ledgio keeps working.`
- **Body**:
  - *Old*: `Everything runs locally on your device. When you get back online, changes sync smoothly.`
  - *New*: `Every screen and calculation runs on your device. When your connection returns, queued changes sync cleanly.`
- **Caption**:
  - *New*: `Tested in airplane mode across Chrome, Safari, and Edge.`

---

### 11. Simulator (`#simulator`)
- **Heading**:
  - *Old*: `Find your safe-to-spend number in seconds.`
  - *New*: `Calculate your monthly buffer in seconds.`
- **Body**:
  - *Old*: `Move the sliders to see how your income and expenses change your monthly buffer.`
  - *New*: `Adjust monthly income and fixed expenses to see your safety margin and months of runway.`
- **Caption**:
  - *New*: `All math runs client-side in plain JavaScript.`

---

### 12. FAQ Section (`#faq`)
- **Heading**:
  - *Old*: `Common questions.`
  - *New*: `Frequently asked questions.`
- **Body**:
  - *Old*: `Straightforward answers about your data, privacy, and how sync works.`
  - *New*: `Answers about your data, privacy, and local storage.`

---

### 13. Closing Section (`#closing-cta`)
- **Heading**:
  - *Old*: `Set up your first budget in two minutes.`
  - *New*: `Set up your first category limit today.`
- **Body**:
  - *Old*: `Take complete control of your finances on your own device. Zero advertising telemetry, zero bank credentials, and zero subscription walls.`
  - *New*: `Your records remain in your browser. No subscription fee, no bank passwords, and no third-party trackers.`
