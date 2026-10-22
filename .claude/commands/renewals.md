---
description: Policies expiring in the next 60 days with nothing bound, renewal quotes, and the s58 notice for each.
---

1. Run `npm run agency -- renewals --json` (or `--days=90`).
2. Show each with days left, the renewal quote if any, open claims, and the expiry notice status.
3. For a policy with no renewal quote, offer `npm run agency -- renew <POLICY>` (same terms, or `--premium=` from the underwriter). A policy with a claim gets the underwriter's eye before a renewal quote goes out.
4. For any Australian policy whose notice is LATE or due within 7 days, go to `/expiry-notices` first.
