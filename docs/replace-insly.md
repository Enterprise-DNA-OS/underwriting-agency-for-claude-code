# Moving off Insly

Insly does not publish its export layout, so this guide works from what every agency already has: a policy list it can save as CSV, and the monthly risk bordereau it sends each insurer. Both carry the policy facts this system needs.

## 1. Load the binders and products

The import puts each policy under a product, and each product sits under a binder. Load them first, from the binder wording:

```bash
npm run agency -- add-binder --insurer="Your Insurer Ltd" --reference=ABC-26 --name="Liability binder" --classes=public-liability,professional-indemnity \
  --starts=2026-01-01 --ends=2026-12-31 --cap=2m --max-sum-insured=5m --commission=25 --bordereau-days=15 --remit-days=60 --clause="ABC binder, schedule 2"
npm run agency -- add-product ABC-26 --name="Business Liability" --class=public-liability --rate=1.2 --min-premium=650
```

Use the product names exactly as they appear in your export, or give each product the class name your export uses.

## 2. Export from Insly

Export the policy list for the period you want (in force, plus anything that expired or cancelled this binder year) and save it as CSV. If your list leaves out a column, use last month's risk bordereau for each insurer instead: it has the policy number, insured, period, sum insured and premium.

## 3. Import

```bash
npm run agency -- import insly --policies=policies.csv --dry-run
npm run agency -- import insly --policies=policies.csv
```

The dry run shows what would be added and lists any product it could not match. Running the same file twice adds nothing.

## What maps

| Your column (any of these names) | Becomes |
|---|---|
| Policy Number, Policy No, Certificate Reference | the policy number |
| Insured Name, Client, Policyholder | the insured (created if new) |
| Product, Cover Type, Policy Type | the product, matched by name |
| Class of Business, Line of Business | the product, matched by class when the name does not match |
| Broker, Intermediary, Agent | the broker (created if new) |
| Inception Date, Start Date, Period From | inception |
| Expiry Date, End Date, Period To | expiry (a year after inception if missing) |
| Sum Insured, Limit, Limit of Indemnity | sum insured |
| Gross Premium, Gross Written Premium, Annual Premium | annual premium and a premium transaction |
| GST, Tax, Premium Tax | tax on that transaction (else the product's tax rate) |
| Status | in force, cancelled, lapsed, expired or renewed |
| State, Region | the insured's region |

Dates can be `YYYY-MM-DD` or `DD/MM/YYYY`. Amounts can carry `$`, commas and brackets for negatives.

If your headers differ, write a map file and pass it:

```json
{ "number": "Pol Ref", "premium": "GWP incl. fees" }
```

```bash
npm run agency -- import insly --policies=policies.csv --map=map.json
```

## What does not carry over

- **Quotes, referrals and underwriting notes.** Bring across open quotes by hand with `quote` (it rates them from your products), or keep working them in Insly until they bind.
- **Claims.** Add open claims with `add-claim` and their reserves; closed claims can stay in your old records or come across from the claims bordereau the same way.
- **Documents and wordings.** The schedules, notices, bordereaux and statements are rendered from the data here (`npm run docs`). Policy wordings stay where they are kept today.
- **Rating rules.** Each product has a per mille rate and a minimum premium. Loadings, rating tables and underwriting questions are added with `/customise`.
- **Commission splits.** Agency and broker commission are calculated from the binder's and broker's rates on import. If your file carries actual commission amounts, map them with `/customise` before importing.
- **Bordereaux already sent and remittances already paid.** After importing, mark past months sent and paid: `submit-bordereau <BINDER> --month=YYYY-MM` and `remit <BINDER> --month=YYYY-MM`.
