---
description: Every legal and binder check, with the rule it comes from, and the fix for anything breached.
---

1. Run `npm run agency -- compliance --json`. Each row has the rule, severity, the record, the issue and the source. The rules and their sources are listed in `docs/compliance.md`.
2. Report as a table: rule, count, the worst example, the source. Order by severity: breached first, then overdue, then due soon, then check.
3. For anything breached, name the fix the operator can approve:
   - BINDER-AUTHORITY: refer the policy to the insurer for retrospective acceptance (`/draft-referral`), or correct the record if it was keyed wrong.
   - ICA-S58: `/expiry-notices` today.
   - CODE-CLAIM-DECISION or CODE-CLAIM-RESPONSE: `/claims`, record the response or decision once made.
   - RG271-IDR: `/complaints`, draft the response.
   - BORDEREAU or REMITTANCE: `/bordereau` or `/remittance`.
4. If a rule in `docs/compliance.md` is out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the check together.

Nothing here is legal advice. The checks compare the records with the rules the operator has told the system to enforce, with sources.
