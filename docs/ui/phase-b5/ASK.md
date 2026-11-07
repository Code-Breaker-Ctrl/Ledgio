# Phase B5: Owner Review & Copy Advisories

The following copy observations were surfaced during the Impeccable craft inspection. Per Phase B5 rules ("no copy/claim changes; list any copy concern in docs/ui/phase-b5/ASK.md instead of editing"), these are documented for owner decision rather than edited directly in the codebase:

1. **Aphoristic Cadence in Landing (#problem)**:
   - *Observation*: Three aphoristic sentence pairs occur in `#problem` and `#closing`:
     - *"Your data stays on your phone. No bank login, no ads."*
     - *"Most budgeting apps want your bank login. Ledgio doesn't."*
   - *Design Review*: While punchy and direct, if you wish to sound even less like startup marketing cadence, consider transitioning to conversational narrative in a future phase (e.g. *"We store your transactions locally in your browser and on your phone, so you never need to connect a bank account or see an ad."*).

2. **Em-Dash Density in Dashboard Helper Text**:
   - *Observation*: 18 em-dashes (`—`) are distributed across modal explanations and subtitle tooltips in `dashboard.html`.
   - *Design Review*: In technical ledgers, colons (`:`) or periods often read with cleaner data hierarchy than em-dashes. Consider standardizing subtitle delimiters during the next content pass.
