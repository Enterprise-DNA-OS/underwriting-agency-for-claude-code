---
description: Open complaints and the days each has run, and recording the response.
---

1. Run `npm run agency -- complaints --json`.
2. Show days open. Australian complaints need a written response within 30 calendar days (ASIC RG 271); New Zealand ones run to the house standard in settings.
3. Record a complaint: `npm run agency -- add-complaint <INSURED> --summary="..." --policy=<POLICY>`. Record the response once sent: `npm run agency -- respond <ID> --outcome="..."`.
4. Draft responses go to `drafts/`. Never send from here.
