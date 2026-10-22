---
description: Quote a risk: rate it from the product, check it against the binder, refer it if it sits outside, bind it when the broker says go.
---

1. Find the insured (`npm run agency -- insureds`); add them with `add-insured` if new. Never invent details the operator did not give.
2. Run `npm run agency -- quote <INSURED> --product=<PRODUCT> --sum-insured=<AMOUNT> --broker=<BROKER> --json`. Leave out `--premium` to rate it from the product; give it when the underwriter sets the price.
3. If the result says `outside_authority`, the quote is already referred. Show the reason and offer `/draft-referral`.
4. When the broker accepts, run `npm run agency -- bind <QUOTE>` (add `--inception=YYYY-MM-DD` if it starts later). Bind refuses anything outside the binder that the insurer has not accepted.
5. Report the quote or policy number, premium, tax and the agency's commission in three lines.
