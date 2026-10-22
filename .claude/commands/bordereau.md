---
description: The monthly risk and premium bordereau for a binder: lines, totals, the document, and marking it sent.
---

1. Ask which binder and month if not given (default: last month). Run `npm run agency -- bordereau <BINDER> --month=YYYY-MM --json`.
2. Check the lines before it goes: every policy inside the binder's classes and limit (`/compliance` shows any that are not), sums insured filled in, nothing dated outside the month.
3. Run `npm run docs -- risk-bordereau` to render it into `docs-out/risk-bordereau/`. If the insurer wants a spreadsheet, write the `lines` array to `drafts/bordereau-<binder>-<month>.csv`.
4. After the operator sends it, record it: `npm run agency -- submit-bordereau <BINDER> --month=YYYY-MM`.
