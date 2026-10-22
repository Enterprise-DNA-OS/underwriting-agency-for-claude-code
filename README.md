<h1 align="center">Underwriting Agency for Claude Code</h1>

<p align="center">
  <strong>The open-source underwriting agency system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Insly data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=insly">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/insly?utm_source=github&utm_medium=readme&utm_campaign=insly">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-insly">Instead of Insly</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Underwriting Agency for Claude Code does the job you pay Insly for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Insly dashboard cannot.

Insly does not publish a price. Its [pricing page](https://insly.com/en/pricing/) shows "Starting from: Get a tailored quote" for MGAs, and describes the model: "Flexible pricing based on system scope, implementation and volumes transacted through platform", a "Monthly fee for base package, plus additional modules", and implementation "for fixed fee or PAYG depending on size and scope". The more premium you put through it, the more it can cost.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=insly).

It holds an underwriting agency's whole book in one database: the insurers and the binders they have given you (classes, maximum sum insured, premium cap, commission, bordereau and settlement days), the products and rates under each binder, brokers, insureds, quotes and referrals, policies, every premium movement, the monthly bordereaux, the premium owed to each insurer, claims and complaints. It is for underwriting agencies (MGAs and coverholders) in New Zealand and Australia, 10 to 50 people, writing under one or more binders.

It checks the binder next to the law: every policy against the binder's authority, the premium cap and the pace it is being used at, bordereaux and remittances against their due dates, Insurance Contracts Act s58 expiry notices, the General Insurance Code of Practice claim clocks and ASIC RG 271 complaint responses. Each finding cites its source ([docs/compliance.md](docs/compliance.md)).

### Ten questions Insly's dashboard does not answer

Every one is a command that runs today (`/insights` runs all ten):

1. Which binder runs out of premium cap before it ends, at the pace so far?
2. Which brokers bring premium that turns into claims?
3. What share of quotes does each broker bind, product by product?
4. How much premium have brokers not paid us yet, and how old is it?
5. What do we owe each insurer over the next 90 days, and when?
6. Which renewals in the next 90 days carry an open or paid claim?
7. Which occupations write the most premium, and what do they cost in claims?
8. How much of each binder rests on its three largest insureds?
9. How long does each insurer take to answer a referral, and what does it say?
10. What commission has the agency earned, month by month, after paying brokers?

### Three real runs on the demo agency

The demo is Southerly Underwriting (fictional): a New Zealand professional and liability binder with one insurer, and an Australian management liability and landlord binder with another.

**"What needs my attention this week?"** (`/attention`, trimmed)

```
  level     what                  record                                   issue
  breached  BINDER-AUTHORITY      SU-N-1006 (SU-KAHU-26)                   cyber is not a class this binder covers
  breached  BINDER-AUTHORITY      SU-N-1002 (SU-KAHU-26)                   Sum insured is above the binder limit
  breached  CODE-CLAIM-DECISION   CL-3001 Redgum Logistics Pty Ltd         Claim received 2026-06-04, no decision after 140 days
  breached  ICA-S58               SU-A-2007 Priya and Arjun Mehta          Expires 2026-11-01 with no expiry notice sent: the 14-day deadline has passed
  breached  RG271-IDR             Dimitri Papadopoulos                     Complaint received 2026-09-18: Says the renewal premium rose 38%...
  overdue   BORDEREAU             SU-IRB-26 Aug 2026                       Risk bordereau due 2026-09-15 (37 days late, 1 lines)
  overdue   REMITTANCE            SU-IRB-26 Jun 2026                       AUD 26,350 not remitted to Ironbark Insurance Ltd, due 2026-08-29
  due soon  BINDER-CAPACITY       SU-IRB-26                                90.4% of the premium cap used with 40 days of the binder left
```

**"How much of each binder's cap is left?"** (`/binders`)

```
  reference   insurer                     currency  ends on     days left     gwp cap       gwp  percent used  projected gwp
  SU-IRB-26   Ironbark Insurance Ltd      AUD       2026-12-01         40    $250,000  $226,100  90.4               $251,222
  SU-KAHU-26  Kahu General Insurance Ltd  NZD       2027-11-16        390  $1,500,000   $62,700  4.2                $134,621
```

**"Which renewals are coming, and have the notices gone?"** (`/renewals`)

```
  number     insured                       product                  expiry      days left  annual premium  renewal quote   expiry notice
  SU-A-2007  Priya and Arjun Mehta         Landlord Home Buildings  2026-11-01         10          $1,850                  LATE: was due 2026-10-18
  SU-A-2008  Dimitri Papadopoulos          Landlord Home Buildings  2026-11-11         20          $2,150                  due by 2026-10-28
  SU-A-2009  Grace O'Neill                 Landlord Home Buildings  2026-11-16         25          $1,600                  sent 2026-10-19
  SU-N-1007  Kereru Cafe Ltd               Business Liability       2026-11-21         30          $1,200                  not required
  SU-A-2010  Tallowood Accounting Pty Ltd  Management Liability     2026-12-01         40         $26,000  SQ-1004 quoted  due by 2026-11-17
```

Dates in the demo move with today, so there is always something to find.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No charge that grows with the premium you write. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/underwriting-agency-for-claude-code.git
cd underwriting-agency-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type a slash command. Start with `/attention`, then `/binders` and `/renewals`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that needs a person this week: the law, the binder, the book |
| `/binders` | Each binder's authority, premium cap used, and money owed on it |
| `/quote` | Rate a risk from the product, check it against the binder, refer or bind it |
| `/quotes` | The quote book: open, referred, past validity |
| `/referrals` | Quotes waiting on the insurer, and recording the answer |
| `/renewals` | Policies expiring with nothing bound, renewal quotes, notice status |
| `/expiry-notices` | Insurance Contracts Act s58 notices: who needs one, drafts, recording them |
| `/policy` | One policy in full; endorsements and cancellations |
| `/bordereau` | A binder's monthly risk and premium bordereau, rendered and marked sent |
| `/remittance` | Net premium owed to each insurer, when it falls due, recording payment |
| `/month-end` | Bordereaux, remittances, claims bordereaux and broker statements in one pass |
| `/claims` | Open claims with the Code clocks; recording each step |
| `/complaints` | Open complaints and the RG 271 clock; recording the response |
| `/loss-ratio` | Claims against premium by binder, broker and occupation |
| `/brokers` | Broker production, hit rate and premium they owe |
| `/compliance` | Every legal and binder check, with its source |
| `/insights` | The ten questions above |
| `/weekly-review` | A one-page Monday review, written to `drafts/` |
| `/draft-referral` | A referral to the insurer for a risk outside the binder |
| `/draft-renewal-invite` | Renewal terms to the broker |
| `/draft-broker-chase` | A note to a broker for premium not received |
| `/documents` | Render bordereaux, remittance advices, expiry notices, schedules, broker statements |
| `/log` | A note against a policy, quote, claim or insured |
| `/history` | Everything recorded against a record |
| `/add` | Add an insured, broker, binder or product |
| `/import` | Bring policies across from Insly |
| `/export` | Every record as one JSON file |
| `/customise` | Add a field, a rating rule or a check, in plain language |
| `/new-view` | Add a read-only page to `npm run view` |
| `/help` | The list |

`npm run docs` renders the paperwork (risk and premium bordereaux, premium remittance advices, s58 expiry notices, claims bordereaux, policy schedules, broker statements) as branded HTML from `brand.json`. `npm run view` renders read-only pages: the week, binders, renewals, claims.

## Your first hour: ten things to ask for

1. "Our agency is Harbour Underwriting, and our logo is in logo.png." (`/customise`)
2. "Load our binder with Kahu: liability and PI, NZ$3m cap, NZ$5m maximum limit, 27.5% commission, bordereau 15 days after month end." (`/add`)
3. "Import this policy list from Insly." (`/import`)
4. "What needs my attention?" (`/attention`)
5. "Quote Fantail Physio for NZ$2m liability through Aroha." (`/quote`)
6. "Which Australian policies need an expiry notice this week? Draft them." (`/expiry-notices`)
7. "Run the bordereau for Ironbark for last month." (`/bordereau`)
8. "What do we owe each insurer this month?" (`/remittance`)
9. "Load professional indemnity for engineers at 25% extra." (`/customise`)
10. "Write the Monday review." (`/weekly-review`)

## Instead of Insly

Export your policy list from Insly (or use last month's risk bordereau for each insurer), save it as CSV, load your binders and products, and run `/import` (or `npm run agency -- import insly --policies=FILE.csv --dry-run`, then again without `--dry-run`). Policies, insureds, brokers and premium come across; open quotes and claims you add once. The full guide, with the column mapping and what does not carry over: [docs/replace-insly.md](docs/replace-insly.md).

## Architecture

```
underwriting-agency-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Underwriting Agency for Claude Code for your business, migrates your Insly data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=insly)
- Read more: [enterprisedna.co/omni/instead-of/insly](https://enterprisedna.co/omni/instead-of/insly?utm_source=github&utm_medium=readme&utm_campaign=insly)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
