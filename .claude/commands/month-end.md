---
description: The month-end close: bordereaux, remittances, claims bordereau and broker statements, in one pass.
---

1. Run `npm run agency -- bordereaux --json`, `npm run agency -- remittance --json`, `npm run agency -- claims --json` and `npm run agency -- brokers --json`.
2. For last month, list per binder: the risk bordereau (lines and gross), the claims movements, the net premium due and its settlement date.
3. Run `npm run docs` to render the risk bordereaux, claims bordereaux, remittance advices and broker statements.
4. Write the close checklist to `drafts/month-end-YYYY-MM.md`: what to send to each insurer, what each broker owes us, and what to chase. Nothing is sent.
