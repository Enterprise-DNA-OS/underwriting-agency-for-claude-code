---
description: Quotes waiting on the insurer, oldest first, and recording the insurer's answer.
---

1. Run `npm run agency -- referrals --json`.
2. Show each with the days waited and the reason it was referred.
3. When the operator relays the insurer's answer, run `npm run agency -- decide <QUOTE> --accept --note="<terms>"` or `--decline`. An accepted referral can then be bound.
4. For anything waiting more than the chase days in settings, offer `/draft-referral` as a follow-up.
