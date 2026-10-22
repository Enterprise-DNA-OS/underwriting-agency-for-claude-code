---
description: Open claims with the clock on each, and recording the steps.
---

1. Run `npm run agency -- claims --json` (`--all` includes closed).
2. Show days open, reserve, paid, decision and handler. Mark Australian claims near four months without a decision, and any with no first response after 10 business days.
3. Record a new claim: `npm run agency -- add-claim <POLICY> --description="..." --reserve=AMOUNT --loss-date=YYYY-MM-DD`. A loss date outside the policy period stops: tell the operator before passing `--force`.
4. Record steps: `update-claim <CLAIM> --responded`, `--reserve=`, `--paid=`, `--decision=accepted|declined|partial`, `--close`.
