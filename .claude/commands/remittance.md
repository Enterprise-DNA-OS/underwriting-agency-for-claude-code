---
description: Premium owed to each insurer by month, what falls due when, and recording a payment.
---

1. Run `npm run agency -- remittance --json` (or `--binder=<BINDER>`).
2. Show what is overdue first, then what falls due in the next 30 days, with the amount per insurer. Point out lines where the broker has not paid us yet (`not_collected`): the agency still owes the insurer on the settlement date.
3. Run `npm run docs -- remittance-advice` for the advice to send with the payment.
4. Nothing is paid from here. When the operator confirms the payment went, run `npm run agency -- remit <BINDER> --month=YYYY-MM --on=YYYY-MM-DD`.
