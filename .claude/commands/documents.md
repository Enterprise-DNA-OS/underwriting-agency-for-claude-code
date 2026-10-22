---
description: Render the agency's paperwork: bordereaux, remittance advices, expiry notices, schedules, broker statements.
---

1. Run `npm run docs` for everything, or `npm run docs -- <name>` for one kind: risk-bordereau, remittance-advice, expiry-notice, claims-bordereau, policy-schedule, broker-statement.
2. Files land in `docs-out/<name>/` as branded HTML from `brand.json`. Print to PDF from a browser.
3. Change the business name, logo or colours in `brand.json`. Add or change a document in `documents.json`, or ask `/customise`.
