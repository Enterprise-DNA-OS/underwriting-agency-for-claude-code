---
description: Each binder: what it lets the agency write, how much premium cap is left, and what is owed on it.
---

1. Run `npm run agency -- binders --json` and `npm run agency -- capacity --json`.
2. If the operator named a binder, run `npm run agency -- binder <BINDER> --json` instead and show its authority (classes, maximum sum insured, commission, bordereau and settlement days, referral rule), the bordereaux not yet sent and the money owed.
3. Flag any binder over 90% of its cap, any binder that runs out at the pace so far, and any binder ending within 60 days with no replacement loaded.
4. To load a new or renewed binder, use `add-binder` then `add-product` for each product under it. Read the binder wording first and copy the clause reference into `--clause`.
