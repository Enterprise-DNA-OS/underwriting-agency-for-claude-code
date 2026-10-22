---
description: One policy in full: cover, premium transactions, claims, notes; and mid-term changes.
---

1. Run `npm run agency -- policy <POLICY> --json`.
2. Show the cover, every premium movement with tax, commission and net to the insurer, collected and remitted dates, claims and notes.
3. Mid-term change: `npm run agency -- endorse <POLICY> --premium=AMOUNT --description="..."` (add `--sum-insured=` for a limit change; outside the binder it stops).
4. Cancellation: `npm run agency -- cancel <POLICY> --on=YYYY-MM-DD` refunds pro rata; `--refund=AMOUNT` for an agreed figure. Confirm with the operator before cancelling.
5. `npm run docs -- policy-schedule <id-prefix>` renders the schedule.
