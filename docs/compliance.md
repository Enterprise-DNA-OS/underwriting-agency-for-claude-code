# Compliance: the rules this system checks

`npm run agency -- compliance` (or `/compliance`) runs every check below against the records and cites the source for each finding. This is a working tool against cited rules, not legal advice. When a rule changes, update this page and the matching part of the `compliance` view in `supabase/migrations/` together (use `/customise`).

## The law (Australia)

| Rule | What it checks | Source |
|---|---|---|
| `ICA-S58` | A renewable policy under an Australian binder expiring in the next 28 days with no expiry notice recorded. Breached once fewer than 14 days remain. | Insurance Contracts Act 1984 (Cth) s58: the insurer must give the insured written notice of the expiry not later than 14 days before the policy expires, stating the expiry date and time and whether it is willing to negotiate a renewal. If it does not, and the insured has not taken other cover, the Act extends the cover. A posted notice is presumed received some days after posting, so send early. |
| `CODE-CLAIM-RESPONSE` | An Australian claim with no first response recorded after 14 calendar days (the Code says 10 business days). | General Insurance Code of Practice 2020: within 10 business days of a claim, accept or decline it, or say what information is needed or that it is being investigated. |
| `CODE-CLAIM-DECISION` | An Australian claim with no decision three months after it was received (due soon) or four months (breached). | General Insurance Code of Practice 2020: a decision within four months of receiving the claim, unless exceptional circumstances apply. |
| `RG271-IDR` | An Australian complaint with no written response recorded: due soon from day 23, breached after day 30. | ASIC Regulatory Guide 271 (Internal dispute resolution), for complaints received from 5 October 2021: a written IDR response within 30 calendar days for a standard complaint, or a delay notice before then. |

The Code binds insurers that subscribe to it. An agency handling claims under a binder does that work for the insurer, so the insurer's Code obligations land on the agency's desk. Check your binder for the claims authority and service standards it sets.

## The binder (every agency)

Each binder record carries its own clause reference (`--clause`), and every finding cites it.

| Rule | What it checks | Source |
|---|---|---|
| `BINDER-AUTHORITY` | A policy whose class is not one the binder covers, whose sum insured is above the binder's maximum, or which incepts outside the binder period. | The binder agreement's authority schedule. |
| `BINDER-CAPACITY` | Gross written premium at 90% or more of the binder's premium cap (breached at 100%). | The binder agreement's premium cap. |
| `BINDER-RENEWAL` | A binder ending within 60 days with no later binder from the same insurer loaded. | The binder agreement's period. |
| `BORDEREAU` | A month's risk bordereau not recorded as sent by its due date (month end plus the binder's bordereau days). | The binder agreement's reporting clause. |
| `REMITTANCE` | Net premium for a month not recorded as paid to the insurer by its settlement date (month end plus the binder's settlement days). | The binder agreement's premium settlement clause. |
| `REFERRAL` | A referred quote with no insurer answer after the chase days in settings (default 5). | The binder agreement's referral clause. |

## House standards (New Zealand)

New Zealand has no statutory clock for claim decisions or complaint responses that this system can check on the agency's behalf. Two house standards stand in, set in the `settings` table:

| Rule | Setting | Default |
|---|---|---|
| `HOUSE-CLAIM-DECISION` | `nz_claim_decision_days` | 90 days from the claim being received |
| `HOUSE-COMPLAINT` | `nz_complaint_days` | 20 days from the complaint being received |

If your insurer is a member of the Fair Insurance Code or your binder sets service standards, set these to match: "our NZ claim decisions are due in 60 days" through `/customise`.

## Not checked here

- Stamp duty, the Fire and Emergency levy and other premium taxes: recorded per transaction as `tax_cents` from the file or the product's tax rate, not calculated per state or region.
- Client money and trust account rules for brokers: the agency acts for the insurer under the binder, and the premium settlement check covers what it owes.
