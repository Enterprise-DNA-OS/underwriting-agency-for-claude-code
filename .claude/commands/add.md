---
description: Add an insured, broker, binder or product.
---

Pick the command that fits what the operator described, fill only what they said, and confirm in one line.

- Insured: `npm run agency -- add-insured --name="..." --country=NZ|AU --occupation="..."`
- Broker: `npm run agency -- add-broker --name="..." --firm="..." --commission=15`
- Binder: `npm run agency -- add-binder --insurer="..." --reference=... --name="..." --classes=a,b --starts=YYYY-MM-DD --ends=YYYY-MM-DD --cap=AMOUNT --max-sum-insured=AMOUNT --commission=25 --clause="..."`
- Product: `npm run agency -- add-product <BINDER> --name="..." --class=... --rate=<per mille> --min-premium=AMOUNT`

For quotes use `/quote`; for claims `/claims`; for complaints `/complaints`.
