---
description: Australian expiry notices under Insurance Contracts Act s58: who needs one, draft them, record them.
---

1. Run `npm run agency -- compliance --json` and keep the `ICA-S58` rows, then `npm run agency -- renewals --json` for the detail.
2. Run `npm run docs -- expiry-notice` to draft a notice per policy into `docs-out/expiry-notice/`. Each states the expiry date and time and whether the insurer will negotiate a renewal.
3. Show the operator the list. Nothing is sent from here. Once a notice has gone out, record it: `npm run agency -- notice <POLICY> --on=YYYY-MM-DD`.
4. Say plainly that a missed notice can mean the cover carries on after expiry, so a LATE item goes to the underwriter today. This is a check against the rule, not legal advice.
