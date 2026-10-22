#!/usr/bin/env node
// The one CLI. Every slash command in .claude/commands runs one of these.
//
//   npm run agency -- <command> [args] [--flags] [--json]
//   npm run agency -- help
//
// Records match by exact name or number, then id prefix, then part of the name (case-insensitive).
// More than one match lists the candidates and exits 1. Amounts are typed in dollars
// (--premium=2400 or 2,400.50) and stored as cents in the binder's currency.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv } from './lib/csv.mjs';
import { table as textTable, money } from './lib/format.mjs';

export const usage = {
  help: 'Show every command',
  binders: 'Every binder: insurer, classes, limits, period, premium cap used',
  binder: 'BINDER: one binder with its products, usage, bordereaux and money owed',
  products: 'Products, the binder each sits under, rate and minimum premium',
  brokers: 'Brokers with policies in force, premium and hit rate',
  insureds: '[--country=NZ|AU]: every insured',
  policies: '[--status=in-force] [--binder=BINDER] [--broker=BROKER] [--class=CLASS]',
  policy: 'POLICY: one policy with its premium transactions, claims and notes',
  quotes: '[--status=quoted|referred|bound|declined|lapsed|all]: the quote book',
  referrals: 'Quotes waiting on the insurer, oldest first',
  renewals: '[--days=60]: policies expiring with no renewal bound, and the s58 notice status',
  capacity: 'Premium written against each binder cap, and the pace',
  bordereau: 'BINDER [--month=YYYY-MM]: the risk bordereau lines and totals for one month',
  bordereaux: '[--binder=BINDER]: every bordereau due, sent or late',
  remittance: '[--binder=BINDER]: net premium owed to each insurer, by month, and when it falls due',
  claims: '[--all]: open claims with the clock on each',
  'loss-ratio': 'Incurred claims against written premium, by binder',
  complaints: '[--all]: open complaints with the days each has run',
  compliance: 'Every legal and binder check, with the rule it comes from',
  attention: 'What needs a person this week',
  insights: 'Ten questions a policy system dashboard does not answer',
  week: 'The week in five numbers',
  history: 'POLICY, QUOTE, CLAIM or INSURED: everything recorded against it',
  'add-insured': '--name=NAME [--kind=business|person] [--country=NZ|AU] [--region=TEXT] [--occupation=TEXT] [--email=EMAIL]',
  'add-broker': '--name=NAME [--firm=TEXT] [--email=EMAIL] [--country=NZ|AU] [--commission=15]',
  'add-binder': '--insurer=NAME --reference=REF --name=TEXT --classes=a,b --starts=DATE --ends=DATE [--country=NZ|AU] [--currency=NZD] [--cap=AMOUNT] [--max-sum-insured=AMOUNT] [--commission=25] [--bordereau-days=15] [--remit-days=60] [--clause=TEXT]',
  'add-product': 'BINDER --name=NAME --class=CLASS --rate=PERMILLE [--min-premium=AMOUNT] [--tax=15] [--renewable=yes|no]',
  quote: 'INSURED --product=PRODUCT --sum-insured=AMOUNT [--broker=BROKER] [--premium=AMOUNT] [--inception=DATE] [--valid-days=30]: rates it, refers it if it is outside the binder',
  refer: 'QUOTE --reason=TEXT: send a quote to the insurer for a decision',
  decide: 'QUOTE --accept|--decline [--note=TEXT] [--on=DATE]: record the insurer\'s answer',
  bind: 'QUOTE [--inception=DATE]: bind a quote into a policy and book the premium',
  endorse: 'POLICY --premium=AMOUNT --description=TEXT [--on=DATE] [--sum-insured=AMOUNT]: a mid-term change',
  cancel: 'POLICY [--on=DATE] [--refund=AMOUNT]: cancel, with a pro rata refund unless given',
  renew: 'POLICY [--premium=AMOUNT] [--sum-insured=AMOUNT]: a renewal quote at the same terms or new ones',
  notice: 'POLICY [--on=DATE]: record that the expiry notice went out',
  'not-renewing': 'POLICY [--reason=TEXT]: mark a policy as not being renewed',
  collect: 'POLICY [--on=DATE]: premium received from the broker',
  remit: 'BINDER --month=YYYY-MM [--on=DATE]: net premium paid to the insurer for a month',
  'submit-bordereau': 'BINDER --month=YYYY-MM [--kind=risk|claims] [--on=DATE]',
  'add-claim': 'POLICY --description=TEXT [--reserve=AMOUNT] [--loss-date=DATE] [--notified=DATE] [--handler=NAME] [--force]',
  'update-claim': 'CLAIM [--reserve=AMOUNT] [--paid=AMOUNT] [--responded=DATE] [--decision=accepted|declined|partial] [--decided=DATE] [--close]',
  'add-complaint': 'INSURED --summary=TEXT [--policy=POLICY] [--received=DATE]',
  respond: 'COMPLAINT_ID --outcome=TEXT [--on=DATE]: the written response went out',
  log: 'POLICY, QUOTE, CLAIM or INSURED --note=TEXT [--actor=NAME]',
  import: 'insly --policies=FILE.csv [--map=FILE.json] [--dry-run]: a policy list or risk bordereau saved as CSV',
  imports: 'Import receipts',
  export: '[--out=FILE.json]: every record as JSON',
};

const WRITES = new Set(['add-insured', 'add-broker', 'add-binder', 'add-product', 'quote', 'refer', 'decide', 'bind', 'endorse', 'cancel', 'renew',
  'notice', 'not-renewing', 'collect', 'remit', 'submit-bordereau', 'add-claim', 'update-claim', 'add-complaint', 'respond', 'log', 'import']);

export class Ambiguous extends Error {}

const today = () => new Date().toISOString().slice(0, 10);
function need(v, label) {
  if (v === undefined || v === null || v === true || String(v).trim() === '') throw new Error(`${label} is required`);
  return String(v).trim();
}
export function date(v, label = 'date') {
  const s = need(v, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s) throw new Error(`${label} must be YYYY-MM-DD`);
  return s;
}
const optDate = (v, label) => (v === undefined ? today() : date(v, label));
// "2400", "2,400.50", "$1.2m", "250k" -> cents
export function cents(v, label = 'amount') {
  let s = need(v, label).replace(/[$,\s]/g, '').toLowerCase();
  let mult = 1;
  if (s.endsWith('m')) { mult = 1e6; s = s.slice(0, -1); } else if (s.endsWith('k')) { mult = 1e3; s = s.slice(0, -1); }
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`${label} must be a number`);
  return Math.round(Number(s) * mult * 100);
}
const bps = (v, label) => { const n = Number(need(v, label)); if (!(n >= 0 && n <= 100)) throw new Error(`${label} is a percent from 0 to 100`); return Math.round(n * 100); };
const oneOf = (v, list, label) => { const s = need(v, label); if (!list.includes(s)) throw new Error(`${label} must be one of ${list.join(', ')}`); return s; };
export function month(v) {
  const s = need(v, 'month');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new Error('month must be YYYY-MM');
  return `${s}-01`;
}

const KINDS = {
  insurers: { label: 'name' },
  binders: { label: 'reference', also: 'name' },
  products: { label: 'name' },
  brokers: { label: 'name' },
  insureds: { label: 'name' },
  policies: { label: 'number' },
  quotes: { label: 'number' },
  claims: { label: 'number' },
  complaints: { label: 'summary' },
};

// Exact name, then id prefix, then part of the name.
export async function resolve(db, kind, value) {
  const k = KINDS[kind];
  if (!k) throw new Error(`Unknown record kind ${kind}`);
  const noun = kind === 'policies' ? 'policy' : kind.replace(/s$/, '');
  const v = need(value, noun);
  const search = k.also ? `(${k.label} || ' ' || ${k.also})` : k.label;
  const tries = [
    [`lower(${k.label}) = lower($1)`, v],
    ['starts_with(id::text, lower($1))', v],
    [`${search} ilike $1`, `%${v.replace(/[%_]/g, '')}%`],
  ];
  for (const [where, param] of tries) {
    const rows = await db.query(`select id, ${k.label} as label from ${kind} where ${where} order by ${k.label} limit 20`, [param]);
    if (rows.length === 1) return (await db.query(`select * from ${kind} where id = $1`, [rows[0].id]))[0];
    if (rows.length > 1) throw new Ambiguous(`More than one ${noun} matches "${v}":\n${rows.map((r) => `  ${r.id.slice(0, 8)}  ${r.label}`).join('\n')}`);
  }
  throw new Error(`No ${noun} matches "${v}"`);
}
// A policy, quote, claim or insured, for log and history.
async function anyRecord(db, value) {
  for (const kind of ['policies', 'quotes', 'claims', 'insureds']) {
    try { return { kind, record: await resolve(db, kind, value) }; } catch (e) { if (e instanceof Ambiguous) throw e; }
  }
  throw new Error(`No policy, quote, claim or insured matches "${value}"`);
}

// Rate a risk: sum insured times the product rate (per mille), never below the minimum.
export function rate(product, sumInsuredCents) {
  return Math.max(Math.round(sumInsuredCents * Number(product.rate_permille) / 1000), Number(product.min_premium_cents));
}
// Why a risk sits outside the binder, or null when it is inside.
async function outsideAuthority(db, product, sumInsuredCents, premiumCents, onDate) {
  const b = (await db.query('select * from binders where id = $1', [product.binder_id]))[0];
  const u = (await db.query('select gwp_cents from binder_usage where id = $1', [b.id]))[0];
  if (b.status !== 'active') return `binder ${b.reference} is ${b.status}`;
  if (!b.classes.includes(product.class)) return `${product.class} is not a class binder ${b.reference} covers`;
  if (b.max_sum_insured_cents && sumInsuredCents > Number(b.max_sum_insured_cents)) return `sum insured is above the binder limit of ${money(b.max_sum_insured_cents, b.currency)}`;
  if (onDate && (onDate < String(b.starts_on).slice(0, 10) || onDate > String(b.ends_on).slice(0, 10))) return `inception ${onDate} is outside the binder period`;
  if (b.gwp_cap_cents && Number(u.gwp_cents) + premiumCents > Number(b.gwp_cap_cents)) return `the premium would take binder ${b.reference} past its cap`;
  return null;
}
async function nextNumber(db, table, prefix) {
  const rows = await db.query(`select number from ${table} where number like $1`, [`${prefix}%`]);
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.number).slice(prefix.length)) || 0), 1000);
  return `${prefix}${max + 1}`;
}
async function book(db, policy, kind, onDate, grossCents, description) {
  const [x] = await db.query(`select pr.tax_bps, bd.commission_bps, coalesce(b.commission_bps, 0) as broker_bps
                              from policies p join products pr on pr.id = p.product_id join binders bd on bd.id = p.binder_id
                              left join brokers b on b.id = p.broker_id where p.id = $1`, [policy.id]);
  return (await db.query(`insert into premium_transactions (policy_id, kind, effective_on, gross_cents, tax_cents, agency_commission_cents, broker_commission_cents, description)
                          values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
  [policy.id, kind, onDate, grossCents, Math.round(grossCents * x.tax_bps / 10000), Math.round(grossCents * x.commission_bps / 10000), Math.round(grossCents * x.broker_bps / 10000), description]))[0];
}
const addYear = (d) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCFullYear(t.getUTCFullYear() + 1); return t.toISOString().slice(0, 10); };
const plusDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export async function run(db, cmd, args = [], o = {}) {
  if (!Object.hasOwn(usage, cmd)) throw new Error(`Unknown command "${cmd}". Run: npm run agency -- help`);
  if (!WRITES.has(cmd)) return execute(db, cmd, args, o);
  await db.exec('BEGIN');
  try {
    const result = await execute(db, cmd, args, o);
    await db.exec(o['dry-run'] ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

async function execute(db, cmd, args, o) {
  const q = (sql, p = []) => db.query(sql, p);
  switch (cmd) {
    case 'help':
      return Object.entries(usage).map(([command, what]) => ({ command, what }));

    case 'binders':
      return q(`select u.reference, u.insurer, u.country, u.currency, array_to_string(b.classes, ', ') as classes, u.starts_on, u.ends_on, u.days_left,
                       b.max_sum_insured_cents, u.gwp_cap_cents, u.gwp_cents, u.percent_used, u.status
                from binder_usage u join binders b on b.id = u.id order by u.ends_on`);

    case 'binder': {
      const b = await resolve(db, 'binders', args[0]);
      return {
        binder: (await q('select * from binder_usage where id = $1', [b.id]))[0],
        authority: { classes: b.classes.join(', '), max_sum_insured_cents: b.max_sum_insured_cents, currency: b.currency, commission_bps: b.commission_bps,
          bordereau_days_after_month_end: b.bordereau_days, remit_days_after_month_end: b.remit_days, referral_rule: b.referral_rule, clause: b.clause_ref },
        products: await q('select name, class, rate_permille, min_premium_cents, tax_bps, renewable from products where binder_id = $1 order by name', [b.id]),
        bordereaux_open: await q('select month, due_on, lines, gross_cents, currency from bordereaux_due where binder_id = $1 and submitted_on is null order by month', [b.id]),
        money_owed: await q('select month, due_on, net_due_cents, unremitted_cents, currency from remittance_due where binder_id = $1 and unremitted_cents <> 0 order by month', [b.id]),
      };
    }

    case 'products':
      return q(`select pr.name, pr.class, bd.reference as binder, bd.currency, pr.rate_permille, pr.min_premium_cents, pr.tax_bps, pr.renewable, pr.active
                from products pr join binders bd on bd.id = pr.binder_id order by bd.reference, pr.name`);

    case 'brokers':
      return q(`select bp.broker, bp.firm, b.country, b.commission_bps, bp.policies_in_force, bp.gwp_12m_cents, bp.quotes_12m, bp.bound_12m, bp.hit_rate_percent
                from broker_production bp join brokers b on b.id = bp.id order by bp.gwp_12m_cents desc`);

    case 'insureds':
      return q(`select i.name, i.kind, i.country, i.region, i.occupation,
                       (select count(*) from policies p where p.insured_id = i.id and p.status = 'in-force') as policies,
                       (select count(*) from claims c join policies p on p.id = c.policy_id where p.insured_id = i.id) as claims
                from insureds i where ($1::text is null or i.country = upper($1)) order by i.name`, [o.country || null]);

    case 'policies': {
      const binder = o.binder ? await resolve(db, 'binders', o.binder) : null;
      const broker = o.broker ? await resolve(db, 'brokers', o.broker) : null;
      const status = o.status === 'all' ? null : (o.status || 'in-force');
      return q(`select number, insured, broker, product, binder, currency, inception, expiry, days_to_expiry, sum_insured_cents, annual_premium_cents, status
                from policy_list
                where ($1::text is null or status = $1) and ($2::uuid is null or binder_id = $2) and ($3::uuid is null or broker_id = $3)
                  and ($4::text is null or class = $4)
                order by expiry`, [status, binder?.id || null, broker?.id || null, o.class || null]);
    }

    case 'policy': {
      const p = await resolve(db, 'policies', args[0]);
      return {
        policy: (await q(`select number, insured, broker, product, class, binder, country, currency, inception, expiry, days_to_expiry, sum_insured_cents, annual_premium_cents, status
                          from policy_list where id = $1`, [p.id]))[0],
        transactions: await q(`select kind, effective_on, currency, gross_cents, tax_cents, agency_commission_cents, broker_commission_cents, net_due_cents, collected_on, remitted_on
                               from bordereau_lines where id in (select id from premium_transactions where policy_id = $1) order by effective_on`, [p.id]),
        claims: await q('select number, notified_on, status, decision, reserve_cents, paid_cents from claims where policy_id = $1 order by notified_on', [p.id]),
        notes: await q(`select at::date as on_date, actor, note from activities where record_id = $1 order by at desc`, [p.id]),
      };
    }

    case 'quotes': {
      const status = o.status === 'all' ? null : o.status || null;
      return q(`select q.number, i.name as insured, b.name as broker, pr.name as product, bd.currency, q.status, q.sum_insured_cents, q.premium_cents,
                       q.quoted_on, q.valid_until, q.referral_reason
                from quotes q join insureds i on i.id = q.insured_id join products pr on pr.id = q.product_id join binders bd on bd.id = pr.binder_id
                left join brokers b on b.id = q.broker_id
                where ($1::text is null and q.status in ('draft', 'quoted', 'referred')) or q.status = $1 or $2::boolean
                order by q.quoted_on desc`, [status, o.status === 'all']);
    }

    case 'referrals':
      return q(`select number, insured, broker, product, currency, premium_cents, referred_on, referred_days, referral_reason
                from open_quotes where status = 'referred' order by referred_on`);

    case 'renewals': {
      const days = o.days !== undefined ? Number(o.days) : 60;
      return q(`select number, insured, broker, product, currency, expiry, days_left, annual_premium_cents, claims, renewal_quote,
                       case when not s58_applies then 'not required' when expiry_notice_on is not null then 'sent ' || expiry_notice_on
                            when days_left < 14 then 'LATE: was due ' || (expiry - 14) else 'due by ' || (expiry - 14) end as expiry_notice,
                       not_renewing
                from renewals_due where days_left <= $1 order by expiry`, [days]);
    }

    case 'capacity':
      return q('select reference, insurer, currency, starts_on, ends_on, days_left, gwp_cap_cents, gwp_cents, percent_used, projected_gwp_cents from binder_usage order by percent_used desc nulls last');

    case 'bordereau': {
      const b = await resolve(db, 'binders', args[0]);
      const m = o.month ? month(o.month) : (await q("select to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM-DD') as m"))[0].m;
      const lines = await q(`select policy, insured, region, class, kind, effective_on, inception, expiry, sum_insured_cents, currency, gross_cents, tax_cents,
                                    agency_commission_cents, net_due_cents
                             from bordereau_lines where binder_id = $1 and month = $2 order by effective_on, policy`, [b.id, m]);
      const sum = (k) => lines.reduce((n, l) => n + Number(l[k]), 0);
      const due = (await q('select due_on, submitted_on from bordereaux_due where binder_id = $1 and month = $2', [b.id, m]))[0];
      return { binder: b.reference, month: m.slice(0, 7), currency: b.currency, due_on: due?.due_on || null, submitted_on: due?.submitted_on || null,
        lines_count: lines.length, gross_cents: sum('gross_cents'), tax_cents: sum('tax_cents'), agency_commission_cents: sum('agency_commission_cents'), net_due_cents: sum('net_due_cents'), lines };
    }

    case 'bordereaux': {
      const b = o.binder ? await resolve(db, 'binders', o.binder) : null;
      return q(`select binder, insurer, to_char(month, 'YYYY-MM') as month, due_on, submitted_on, lines, currency, gross_cents,
                       case when submitted_on is not null then 'sent' when due_on < current_date then 'LATE ' || (current_date - due_on) || ' days' else 'due' end as state
                from bordereaux_due where ($1::uuid is null or binder_id = $1) order by month desc, binder limit 36`, [b?.id || null]);
    }

    case 'remittance': {
      const b = o.binder ? await resolve(db, 'binders', o.binder) : null;
      return q(`select binder, insurer, to_char(month, 'YYYY-MM') as month, due_on, currency, lines, net_due_cents, unremitted_cents, not_collected_cents,
                       case when unremitted_cents = 0 then 'paid' when due_on < current_date then 'OVERDUE' else 'owing' end as state
                from remittance_due where ($1::uuid is null or binder_id = $1) and (unremitted_cents <> 0 or month >= date_trunc('month', current_date) - interval '3 months')
                order by month desc, binder`, [b?.id || null]);
    }

    case 'claims':
      if (o.all) {
        return q(`select c.number, p.number as policy, i.name as insured, c.notified_on, c.status, c.decision, c.reserve_cents, c.paid_cents, bd.currency
                  from claims c join policies p on p.id = c.policy_id join insureds i on i.id = p.insured_id join binders bd on bd.id = p.binder_id order by c.notified_on desc`);
      }
      return q(`select number, policy, insured, country, currency, notified_on, days_open, reserve_cents, paid_cents, status, decision, first_response_on, handler
                from open_claims order by days_open desc`);

    case 'loss-ratio':
      return q('select binder, insurer, currency, written_cents, incurred_cents, claims, loss_ratio_percent from loss_ratio order by binder');

    case 'complaints':
      return q(`select substr(cp.id::text, 1, 8) as id, i.name as insured, p.number as policy, cp.received_on, (current_date - cp.received_on) as days, cp.summary, cp.responded_on, cp.outcome
                from complaints cp join insureds i on i.id = cp.insured_id left join policies p on p.id = cp.policy_id
                where $1::boolean or cp.responded_on is null order by cp.received_on`, [!!o.all]);

    case 'compliance':
      return q(`select rule, severity, record, issue, source, on_date from compliance
                order by case severity when 'breached' then 0 when 'overdue' then 1 when 'due soon' then 2 else 3 end, rule, on_date`);

    case 'attention':
      return q(`select level, what, record, issue, source from attention
                order by case level when 'breached' then 0 when 'overdue' then 1 when 'due soon' then 2 when 'stale' then 3 else 4 end, what, on_date`);

    case 'week':
      return q('select item, value from this_week');

    case 'insights':
      return insights(db);

    case 'history': {
      const { kind, record } = await anyRecord(db, args[0]);
      const id = record.id;
      const policyIds = kind === 'policies' ? [id] : kind === 'insureds' ? (await q('select id from policies where insured_id = $1', [id])).map((r) => r.id)
        : kind === 'claims' ? [record.policy_id] : record.policy_id ? [record.policy_id] : [];
      return q(`select * from (
                  select at::date as on_date, 'note' as type, note as detail from activities where record_id = $1 or record_id = any($2::uuid[])
                  union all select effective_on, 'premium ' || kind, to_char(gross_cents / 100.0, 'FM999,999,990.00') || ' ' || coalesce(description, '') from premium_transactions where policy_id = any($2::uuid[])
                  union all select notified_on, 'claim', number || ': ' || coalesce(description, '') from claims where policy_id = any($2::uuid[])
                  union all select coalesce(decided_on, notified_on), 'claim ' || coalesce(decision, status), number from claims where policy_id = any($2::uuid[]) and decided_on is not null
                  union all select quoted_on, 'quote ' || status, number || ' ' || to_char(premium_cents / 100.0, 'FM999,999,990.00') from quotes where id = $1 or policy_id = any($2::uuid[]) or renewal_of = any($2::uuid[]) or insured_id = $1
                  union all select received_on, 'complaint', summary from complaints where insured_id = $1 or policy_id = any($2::uuid[])
                  union all select expiry_notice_on, 'expiry notice', number from policies where id = any($2::uuid[]) and expiry_notice_on is not null
                ) h order by on_date desc nulls last limit 60`, [id, policyIds]);
    }

    // ------------------------------------------------------------ writes

    case 'add-insured':
      return (await q('insert into insureds (name, kind, country, region, occupation, email) values ($1, $2, $3, $4, $5, $6) returning *',
        [need(o.name, '--name'), o.kind ? oneOf(o.kind, ['business', 'person'], '--kind') : 'business', o.country ? oneOf(String(o.country).toUpperCase(), ['NZ', 'AU'], '--country') : 'NZ',
          o.region || null, o.occupation || null, o.email || null]))[0];

    case 'add-broker':
      return (await q('insert into brokers (name, firm, email, country, commission_bps) values ($1, $2, $3, $4, $5) returning *',
        [need(o.name, '--name'), o.firm || null, o.email || null, o.country ? String(o.country).toUpperCase() : 'NZ', o.commission !== undefined ? bps(o.commission, '--commission') : 1500]))[0];

    case 'add-binder': {
      let insurer = (await q('select * from insurers where lower(name) = lower($1)', [need(o.insurer, '--insurer')]))[0];
      if (!insurer) insurer = (await q('insert into insurers (name) values ($1) returning *', [o.insurer]))[0];
      const country = o.country ? oneOf(String(o.country).toUpperCase(), ['NZ', 'AU'], '--country') : 'NZ';
      return (await q(`insert into binders (insurer_id, reference, name, country, currency, classes, starts_on, ends_on, gwp_cap_cents, max_sum_insured_cents,
                                            commission_bps, bordereau_days, remit_days, clause_ref)
                       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning *`,
      [insurer.id, need(o.reference, '--reference'), need(o.name, '--name'), country, o.currency ? String(o.currency).toUpperCase() : (country === 'AU' ? 'AUD' : 'NZD'),
        need(o.classes, '--classes').split(',').map((s) => s.trim()).filter(Boolean), date(o.starts, '--starts'), date(o.ends, '--ends'),
        o.cap ? cents(o.cap, '--cap') : null, o['max-sum-insured'] ? cents(o['max-sum-insured'], '--max-sum-insured') : null,
        o.commission !== undefined ? bps(o.commission, '--commission') : 2500, Number(o['bordereau-days'] ?? 15), Number(o['remit-days'] ?? 60),
        o.clause || `Binder ${o.reference}`]))[0];
    }

    case 'add-product': {
      const b = await resolve(db, 'binders', args[0]);
      const r = Number(need(o.rate, '--rate'));
      if (!(r > 0)) throw new Error('--rate is per mille of the sum insured, above 0');
      return (await q('insert into products (binder_id, name, class, rate_permille, min_premium_cents, tax_bps, renewable) values ($1, $2, $3, $4, $5, $6, $7) returning *',
        [b.id, need(o.name, '--name'), need(o.class, '--class'), r, o['min-premium'] ? cents(o['min-premium'], '--min-premium') : 0,
          o.tax !== undefined ? bps(o.tax, '--tax') : (b.country === 'AU' ? 1000 : 1500), o.renewable === undefined ? true : !/^(no|false|n|0)$/i.test(o.renewable)]))[0];
    }

    case 'quote': {
      const insured = await resolve(db, 'insureds', args[0]);
      const product = await resolve(db, 'products', o.product);
      const broker = o.broker ? await resolve(db, 'brokers', o.broker) : null;
      const si = cents(o['sum-insured'], '--sum-insured');
      const premium = o.premium !== undefined ? cents(o.premium, '--premium') : rate(product, si);
      const inception = o.inception ? date(o.inception, '--inception') : today();
      const why = await outsideAuthority(db, product, si, premium, inception);
      const number = await nextNumber(db, 'quotes', 'SQ-');
      const row = (await q(`insert into quotes (number, product_id, insured_id, broker_id, sum_insured_cents, premium_cents, status, quoted_on, valid_until, inception, referral_reason, referred_on)
                            values ($1, $2, $3, $4, $5, $6, $7, current_date, current_date + $8::int, $9, $10, $11) returning *`,
      [number, product.id, insured.id, broker?.id || null, si, premium, why ? 'referred' : 'quoted', Number(o['valid-days'] ?? 30), inception, why, why ? today() : null]))[0];
      return { ...row, rated: o.premium === undefined, outside_authority: why };
    }

    case 'refer': {
      const qt = await resolve(db, 'quotes', args[0]);
      if (!['draft', 'quoted'].includes(qt.status)) throw new Error(`${qt.number} is ${qt.status}`);
      return (await q("update quotes set status = 'referred', referral_reason = $2, referred_on = current_date where id = $1 returning *", [qt.id, need(o.reason, '--reason')]))[0];
    }

    case 'decide': {
      const qt = await resolve(db, 'quotes', args[0]);
      if (qt.status !== 'referred') throw new Error(`${qt.number} is not waiting on the insurer (${qt.status})`);
      if (!o.accept === !o.decline) throw new Error('Give --accept or --decline');
      return (await q('update quotes set status = $2, insurer_decision = $3, decided_on = $4 where id = $1 returning *',
        [qt.id, o.accept ? 'quoted' : 'declined', o.note || (o.accept ? 'Accepted by the insurer' : 'Declined by the insurer'), optDate(o.on, '--on')]))[0];
    }

    case 'bind': {
      const qt = await resolve(db, 'quotes', args[0]);
      if (qt.status !== 'quoted') throw new Error(`${qt.number} is ${qt.status}: only a quoted risk can be bound`);
      const product = (await q('select * from products where id = $1', [qt.product_id]))[0];
      const inception = o.inception ? date(o.inception, '--inception') : (qt.inception ? iso(qt.inception) : today());
      const why = await outsideAuthority(db, product, Number(qt.sum_insured_cents), Number(qt.premium_cents), inception);
      if (why && !qt.insurer_decision) throw new Error(`Outside the binder: ${why}. Refer it first (refer ${qt.number} --reason=...)`);
      const prefix = (await q('select country from binders where id = $1', [product.binder_id]))[0].country === 'AU' ? 'SU-A-' : 'SU-N-';
      const number = await nextNumber(db, 'policies', prefix);
      const policy = (await q(`insert into policies (number, product_id, binder_id, insured_id, broker_id, inception, expiry, sum_insured_cents, annual_premium_cents, renewal_of)
                               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
      [number, product.id, product.binder_id, qt.insured_id, qt.broker_id, inception, addYear(inception), qt.sum_insured_cents, qt.premium_cents, qt.renewal_of]))[0];
      await q("update quotes set status = 'bound', policy_id = $2 where id = $1", [qt.id, policy.id]);
      if (qt.renewal_of) await q("update policies set status = 'renewed' where id = $1", [qt.renewal_of]);
      const txn = await book(db, policy, qt.renewal_of ? 'renewal' : 'new', inception, Number(qt.premium_cents), qt.renewal_of ? 'Renewal' : 'New business');
      return { policy: policy.number, inception, expiry: policy.expiry, premium_cents: policy.annual_premium_cents, transaction: txn.kind, outside_authority_accepted_by_insurer: why || null };
    }

    case 'endorse': {
      const p = await resolve(db, 'policies', args[0]);
      if (p.status !== 'in-force') throw new Error(`${p.number} is ${p.status}`);
      const on = optDate(o.on, '--on');
      if (o['sum-insured']) {
        const si = cents(o['sum-insured'], '--sum-insured');
        const product = (await q('select * from products where id = $1', [p.product_id]))[0];
        const why = await outsideAuthority(db, product, si, Math.max(cents(o.premium, '--premium'), 0), null);
        if (why) throw new Error(`Outside the binder: ${why}. Refer the change to the insurer first.`);
        await q('update policies set sum_insured_cents = $2 where id = $1', [p.id, si]);
      }
      return book(db, p, 'endorsement', on, cents(o.premium, '--premium'), need(o.description, '--description'));
    }

    case 'cancel': {
      const p = await resolve(db, 'policies', args[0]);
      if (p.status !== 'in-force') throw new Error(`${p.number} is ${p.status}`);
      const on = optDate(o.on, '--on');
      const total = Date.parse(iso(p.expiry)) - Date.parse(iso(p.inception));
      const left = Math.max(0, Date.parse(iso(p.expiry)) - Date.parse(on));
      const refund = o.refund !== undefined ? cents(o.refund, '--refund') : Math.round(Number(p.annual_premium_cents) * left / total);
      await q("update policies set status = 'cancelled', cancelled_on = $2 where id = $1", [p.id, on]);
      const txn = await book(db, p, 'cancellation', on, -refund, o.refund !== undefined ? 'Cancelled: agreed refund' : 'Cancelled: pro rata refund');
      return { policy: p.number, cancelled_on: on, refund_cents: refund, transaction: txn.id };
    }

    case 'renew': {
      const p = await resolve(db, 'policies', args[0]);
      if (p.status !== 'in-force') throw new Error(`${p.number} is ${p.status}`);
      const product = (await q('select * from products where id = $1', [p.product_id]))[0];
      const si = o['sum-insured'] ? cents(o['sum-insured'], '--sum-insured') : Number(p.sum_insured_cents);
      const premium = o.premium !== undefined ? cents(o.premium, '--premium') : Math.max(rate(product, si), Number(p.annual_premium_cents));
      const inception = iso(p.expiry);
      const why = await outsideAuthority(db, product, si, premium, inception);
      const number = await nextNumber(db, 'quotes', 'SQ-');
      const row = (await q(`insert into quotes (number, product_id, insured_id, broker_id, sum_insured_cents, premium_cents, status, quoted_on, valid_until, inception, renewal_of, referral_reason, referred_on)
                            values ($1, $2, $3, $4, $5, $6, $7, current_date, $8, $8, $9, $10, $11) returning *`,
      [number, product.id, p.insured_id, p.broker_id, si, premium, why ? 'referred' : 'quoted', inception, p.id, why, why ? today() : null]))[0];
      return { ...row, outside_authority: why };
    }

    case 'notice': {
      const p = await resolve(db, 'policies', args[0]);
      return (await q('update policies set expiry_notice_on = $2 where id = $1 returning number, expiry, expiry_notice_on', [p.id, optDate(o.on, '--on')]))[0];
    }

    case 'not-renewing': {
      const p = await resolve(db, 'policies', args[0]);
      await q('update policies set not_renewing = true where id = $1', [p.id]);
      if (o.reason) await q("insert into activities (record_kind, record_id, note, actor) values ('policies', $1, $2, $3)", [p.id, `Not renewing: ${o.reason}`, o.actor || '']);
      return { policy: p.number, not_renewing: true, note: 'An Australian renewable policy still needs its expiry notice: it says the insurer will not renew.' };
    }

    case 'collect': {
      const p = await resolve(db, 'policies', args[0]);
      const rows = await q('update premium_transactions set collected_on = $2 where policy_id = $1 and collected_on is null returning kind, effective_on, gross_cents', [p.id, optDate(o.on, '--on')]);
      if (!rows.length) throw new Error(`Nothing uncollected on ${p.number}`);
      return rows;
    }

    case 'remit': {
      const b = await resolve(db, 'binders', args[0]);
      const m = month(o.month);
      const rows = await q(`update premium_transactions t set remitted_on = $3 from policies p
                            where p.id = t.policy_id and p.binder_id = $1 and date_trunc('month', t.effective_on) = $2::date and t.remitted_on is null
                            returning t.gross_cents + t.tax_cents - t.agency_commission_cents as net_cents, t.collected_on`, [b.id, m, optDate(o.on, '--on')]);
      if (!rows.length) throw new Error(`Nothing left to remit on ${b.reference} for ${o.month}`);
      return { binder: b.reference, month: o.month, lines: rows.length, net_remitted_cents: rows.reduce((n, r) => n + Number(r.net_cents), 0), currency: b.currency,
        not_yet_collected_lines: rows.filter((r) => !r.collected_on).length };
    }

    case 'submit-bordereau': {
      const b = await resolve(db, 'binders', args[0]);
      return (await q(`insert into bordereaux (binder_id, month, kind, submitted_on) values ($1, $2, $3, $4)
                       on conflict (binder_id, month, kind) do update set submitted_on = excluded.submitted_on returning *`,
      [b.id, month(o.month), o.kind ? oneOf(o.kind, ['risk', 'claims'], '--kind') : 'risk', optDate(o.on, '--on')]))[0];
    }

    case 'add-claim': {
      const p = await resolve(db, 'policies', args[0]);
      const loss = o['loss-date'] ? date(o['loss-date'], '--loss-date') : null;
      if (loss && !o.force && (loss < iso(p.inception) || loss > iso(p.expiry))) throw new Error(`Loss date ${loss} is outside the policy period ${iso(p.inception)} to ${iso(p.expiry)}: record it, but tell the operator first (pass --force)`);
      const number = await nextNumber(db, 'claims', 'CL-');
      return (await q(`insert into claims (number, policy_id, notified_on, loss_date, description, reserve_cents, handler) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
        [number, p.id, optDate(o.notified, '--notified'), loss, need(o.description, '--description'), o.reserve ? cents(o.reserve, '--reserve') : 0, o.handler || null]))[0];
    }

    case 'update-claim': {
      const c = await resolve(db, 'claims', args[0]);
      const sets = [];
      const vals = [c.id];
      const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
      if (o.reserve !== undefined) set('reserve_cents', cents(o.reserve, '--reserve'));
      if (o.paid !== undefined) set('paid_cents', cents(o.paid, '--paid'));
      if (o.responded !== undefined) set('first_response_on', o.responded === true ? today() : date(o.responded, '--responded'));
      if (o.decision !== undefined) {
        set('decision', oneOf(o.decision, ['accepted', 'declined', 'partial'], '--decision'));
        set('decided_on', o.decided ? date(o.decided, '--decided') : today());
        if (!c.first_response_on) set('first_response_on', o.decided ? date(o.decided, '--decided') : today());
        set('status', 'decided');
      }
      if (o.close) { set('status', 'closed'); set('closed_on', today()); }
      if (!sets.length) throw new Error('Nothing to change: give --reserve, --paid, --responded, --decision or --close');
      return (await q(`update claims set ${sets.join(', ')} where id = $1 returning *`, vals))[0];
    }

    case 'add-complaint': {
      const i = await resolve(db, 'insureds', args[0]);
      const p = o.policy ? await resolve(db, 'policies', o.policy) : null;
      return (await q('insert into complaints (insured_id, policy_id, received_on, summary) values ($1, $2, $3, $4) returning *',
        [i.id, p?.id || null, optDate(o.received, '--received'), need(o.summary, '--summary')]))[0];
    }

    case 'respond': {
      const c = (await q('select * from complaints where starts_with(id::text, lower($1))', [need(args[0], 'complaint id')]));
      if (c.length !== 1) throw new Error(c.length ? `More than one complaint starts with ${args[0]}` : `No complaint ${args[0]} (see: complaints)`);
      return (await q('update complaints set responded_on = $2, outcome = $3 where id = $1 returning *', [c[0].id, optDate(o.on, '--on'), need(o.outcome, '--outcome')]))[0];
    }

    case 'log': {
      const { kind, record } = await anyRecord(db, args[0]);
      return (await q('insert into activities (record_kind, record_id, note, actor) values ($1, $2, $3, $4) returning *', [kind, record.id, need(o.note, '--note'), o.actor || '']))[0];
    }

    case 'import':
      return importInsly(db, args, o);

    case 'imports':
      return q('select at::date as on_date, source, file, inserted, unchanged, actor from imports order by at desc');

    case 'export': {
      const tables = ['settings', 'insurers', 'binders', 'products', 'brokers', 'insureds', 'policies', 'quotes', 'premium_transactions', 'claims', 'complaints', 'bordereaux', 'activities', 'imports'];
      const records = {};
      for (const t of tables) records[t] = await q(`select * from ${t} order by 1`);
      const file = path.resolve(REPO_ROOT, o.out || `exports/underwriting-agency-${today()}.json`);
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      fs.writeFileSync(file, JSON.stringify({ format: 1, exported_at: new Date().toISOString(), records }, null, 2), { mode: 0o600 });
      return { file, records: Object.values(records).reduce((n, r) => n + r.length, 0) };
    }
  }
}

// ------------------------------------------------------------ ten questions

export async function insights(db) {
  const one = async (question, sql) => ({ question, rows: await db.query(sql) });
  return [
    await one('Which binder runs out of premium cap before it ends, at the pace so far?',
      `select reference, currency, gwp_cap_cents, gwp_cents, projected_gwp_cents, days_left,
              case when projected_gwp_cents > gwp_cap_cents then 'runs out' else 'fits' end as at_this_pace
       from binder_usage where gwp_cap_cents is not null order by percent_used desc`),
    await one('Which brokers bring premium that turns into claims?',
      `select b.name as broker, bd.currency, sum(t.gross_cents)::bigint as written_cents,
              coalesce((select sum(c.reserve_cents + c.paid_cents) from claims c join policies cp on cp.id = c.policy_id join binders cb on cb.id = cp.binder_id
                        where cp.broker_id = b.id and cb.currency = bd.currency), 0)::bigint as incurred_cents,
              round(100.0 * coalesce((select sum(c.reserve_cents + c.paid_cents) from claims c join policies cp on cp.id = c.policy_id join binders cb on cb.id = cp.binder_id
                        where cp.broker_id = b.id and cb.currency = bd.currency), 0) / nullif(sum(t.gross_cents), 0), 1) as loss_ratio_percent
       from premium_transactions t join policies p on p.id = t.policy_id join brokers b on b.id = p.broker_id join binders bd on bd.id = p.binder_id
       group by b.id, b.name, bd.currency order by loss_ratio_percent desc nulls last`),
    await one('What share of quotes does each broker bind, product by product?',
      `select b.name as broker, pr.name as product, count(*) as quotes, count(*) filter (where q.status = 'bound') as bound,
              round(100.0 * count(*) filter (where q.status = 'bound') / nullif(count(*) filter (where q.status in ('bound', 'declined', 'lapsed')), 0), 0) as hit_rate_percent
       from quotes q join brokers b on b.id = q.broker_id join products pr on pr.id = q.product_id
       where q.quoted_on > current_date - 365 group by b.name, pr.name order by b.name, pr.name`),
    await one('How much premium have brokers not paid us yet, and how old is it?',
      `select b.name as broker, l.currency, count(*) as lines, sum(l.gross_cents + l.tax_cents - l.broker_commission_cents)::bigint as owed_by_broker_cents,
              max(current_date - l.effective_on) as oldest_days
       from bordereau_lines l join premium_transactions t on t.id = l.id join policies p on p.id = t.policy_id join brokers b on b.id = p.broker_id
       where l.collected_on is null and l.gross_cents > 0 group by b.name, l.currency order by oldest_days desc`),
    await one('What do we owe each insurer over the next 90 days, and when?',
      `select insurer, currency, to_char(month, 'YYYY-MM') as month, due_on, unremitted_cents
       from remittance_due where unremitted_cents > 0 and due_on <= current_date + 90 order by due_on`),
    await one('Which renewals in the next 90 days carry an open or paid claim?',
      `select p.number, i.name as insured, p.expiry, c.number as claim, c.status, (c.reserve_cents + c.paid_cents)::bigint as incurred_cents, bd.currency
       from policies p join insureds i on i.id = p.insured_id join binders bd on bd.id = p.binder_id join claims c on c.policy_id = p.id
       where p.status = 'in-force' and p.expiry <= current_date + 90 order by p.expiry`),
    await one('Which occupations write the most premium, and what do they cost in claims?',
      `select occupation, currency, count(*) as policies, sum(written)::bigint as written_cents, sum(incurred)::bigint as incurred_cents,
              round(100.0 * sum(incurred) / nullif(sum(written), 0), 1) as loss_ratio_percent
       from (select coalesce(i.occupation, 'not recorded') as occupation, bd.currency,
                    (select coalesce(sum(t.gross_cents), 0) from premium_transactions t where t.policy_id = p.id) as written,
                    (select coalesce(sum(c.reserve_cents + c.paid_cents), 0) from claims c where c.policy_id = p.id) as incurred
             from policies p join insureds i on i.id = p.insured_id join binders bd on bd.id = p.binder_id) s
       group by occupation, currency order by written_cents desc limit 10`),
    await one('How much of each binder rests on its three largest insureds?',
      `select binder, currency, round(100.0 * sum(premium) filter (where rk <= 3) / nullif(sum(premium), 0), 1) as top_three_percent, sum(premium)::bigint as total_cents
       from (select bd.reference as binder, bd.currency, p.insured_id, sum(t.gross_cents) as premium,
                    rank() over (partition by bd.id order by sum(t.gross_cents) desc) as rk
             from premium_transactions t join policies p on p.id = t.policy_id join binders bd on bd.id = p.binder_id
             group by bd.id, bd.reference, bd.currency, p.insured_id) s
       group by binder, currency order by binder`),
    await one('How long does each insurer take to answer a referral, and what does it say?',
      `select ins.name as insurer, count(*) as referred, count(*) filter (where q.decided_on is null) as waiting,
              round(avg(q.decided_on - q.referred_on) filter (where q.decided_on is not null), 1) as avg_days_to_answer,
              count(*) filter (where q.status = 'declined') as declined
       from quotes q join products pr on pr.id = q.product_id join binders bd on bd.id = pr.binder_id join insurers ins on ins.id = bd.insurer_id
       where q.referred_on is not null group by ins.name order by ins.name`),
    await one('What commission has the agency earned, month by month, after paying brokers?',
      `select to_char(month, 'YYYY-MM') as month, binder, currency, sum(agency_commission_cents)::bigint as agency_commission_cents,
              sum(broker_commission_cents)::bigint as broker_commission_cents, sum(agency_commission_cents - broker_commission_cents)::bigint as kept_cents
       from bordereau_lines where month > current_date - interval '12 months' group by month, binder, currency order by month desc, binder limit 24`),
  ];
}

// ------------------------------------------------------------ import

// Insly does not publish its export layout. A policy list saved as CSV, or the monthly risk
// bordereau the agency already sends its insurers, carries the same facts. Columns are matched
// by these names (case-insensitive); a --map file names any column these miss.
export const POLICY_COLUMNS = {
  number: ['policy number', 'policy no', 'policy no.', 'policy', 'policy reference', 'certificate reference', 'certificate number', 'policy id'],
  insured: ['insured', 'insured name', 'client', 'client name', 'policyholder', 'insured full name or company name', 'customer'],
  product: ['product', 'product name', 'cover', 'cover type', 'policy type'],
  class: ['class', 'class of business', 'line of business', 'lob'],
  broker: ['broker', 'broker name', 'intermediary', 'agent'],
  inception: ['inception', 'inception date', 'start date', 'risk inception date', 'effective date', 'period from'],
  expiry: ['expiry', 'expiry date', 'end date', 'risk expiry date', 'period to'],
  sum_insured: ['sum insured', 'total sum insured', 'limit', 'limit of indemnity', 'sum insured amount'],
  premium: ['premium', 'gross premium', 'gross written premium', 'annual premium', 'total premium', 'gwp'],
  tax: ['tax', 'gst', 'premium tax', 'tax amount'],
  status: ['status', 'policy status'],
  country: ['country', 'risk country', 'insured country'],
  region: ['region', 'state', 'risk state', 'insured state or province'],
};

function columnsFor(row, wanted, override) {
  const out = {};
  const headers = Object.keys(row);
  for (const [key, aliases] of Object.entries(wanted)) {
    const forced = override[key];
    if (forced) {
      if (!headers.includes(forced)) throw new Error(`--map says ${key} is "${forced}", but the file has no such column`);
      out[key] = forced;
      continue;
    }
    out[key] = headers.find((h) => aliases.includes(h.trim().toLowerCase())) || null;
  }
  return out;
}
export const csvDate = (v) => {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // NZ and AU write day first
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  throw new Error(`Cannot read the date "${s}" (use YYYY-MM-DD or DD/MM/YYYY)`);
};
export const csvMoney = (v) => {
  let s = String(v ?? '').trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[()$,\s]/g, '').replace(/^[A-Z]{3}/i, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Cannot read the amount "${v}"`);
  return Math.round(Number(s) * 100) * (negative ? -1 : 1);
};
export function mapStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (/cancel/.test(s)) return 'cancelled';
  if (/lapse/.test(s)) return 'lapsed';
  if (/expir/.test(s)) return 'expired';
  if (/renew/.test(s)) return 'renewed';
  return 'in-force';
}

async function importInsly(db, args, o) {
  if (args[0] !== 'insly') throw new Error('Use: import insly --policies=FILE.csv [--map=FILE.json] [--dry-run]');
  const file = need(o.policies, '--policies');
  const override = o.map ? JSON.parse(fs.readFileSync(path.resolve(o.map), 'utf8')) : {};
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const rows = parseCsv(raw);
  if (!rows.length) throw new Error('The file has no rows');
  const cols = columnsFor(rows[0], POLICY_COLUMNS, override);
  for (const k of ['number', 'insured', 'inception', 'premium']) {
    if (!cols[k]) throw new Error(`The file has no ${k} column (headers: ${Object.keys(rows[0]).join(', ')}). Name it in a --map file: {"${k}": "<header>"}`);
  }
  if (!cols.product && !cols.class) throw new Error('The file needs a product or a class column so each policy lands under the right binder');
  const counts = { insureds: 0, brokers: 0, policies: 0, transactions: 0, unchanged: 0 };
  const unplaced = new Set();
  const products = await db.query('select pr.*, bd.country, bd.starts_on, bd.ends_on from products pr join binders bd on bd.id = pr.binder_id');

  for (const row of rows) {
    const number = String(row[cols.number] || '').trim();
    if (!number) continue;
    const productName = cols.product ? String(row[cols.product] || '').trim() : '';
    const cls = cols.class ? String(row[cols.class] || '').trim().toLowerCase().replace(/\s+/g, '-') : '';
    const product = products.find((p) => productName && p.name.toLowerCase() === productName.toLowerCase())
      || products.find((p) => cls && p.class === cls);
    if (!product) { unplaced.add(productName || cls); continue; }

    const insuredName = need(row[cols.insured], 'insured column');
    let insured = (await db.query('select * from insureds where lower(name) = lower($1)', [insuredName]))[0];
    if (!insured) {
      const country = cols.country && row[cols.country] ? String(row[cols.country]).trim().toUpperCase().slice(0, 2) : product.country;
      insured = (await db.query('insert into insureds (name, kind, country, region) values ($1, $2, $3, $4) returning *',
        [insuredName, /\b(ltd|limited|pty|inc|trust|partnership)\b/i.test(insuredName) ? 'business' : 'person', country === 'AU' ? 'AU' : 'NZ', cols.region ? row[cols.region] || null : null]))[0];
      counts.insureds++;
    }
    let broker = null;
    if (cols.broker && String(row[cols.broker] || '').trim()) {
      const bn = String(row[cols.broker]).trim();
      broker = (await db.query('select * from brokers where lower(name) = lower($1)', [bn]))[0];
      if (!broker) { broker = (await db.query('insert into brokers (name, country) values ($1, $2) returning *', [bn, product.country]))[0]; counts.brokers++; }
    }
    const inception = csvDate(row[cols.inception]);
    const expiry = cols.expiry && row[cols.expiry] ? csvDate(row[cols.expiry]) : addYear(inception);
    const premium = csvMoney(row[cols.premium]);
    const existing = (await db.query('select * from policies where number = $1', [number]))[0];
    let policy = existing;
    if (!existing) {
      policy = (await db.query(`insert into policies (number, product_id, binder_id, insured_id, broker_id, inception, expiry, sum_insured_cents, annual_premium_cents, status)
                                values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
      [number, product.id, product.binder_id, insured.id, broker?.id || null, inception, expiry, cols.sum_insured ? csvMoney(row[cols.sum_insured]) : 0, premium,
        mapStatus(cols.status ? row[cols.status] : '')]))[0];
      counts.policies++;
    }
    const ref = 'insly:' + number + ':' + createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 16);
    const [x] = await db.query(`select pr.tax_bps, bd.commission_bps, coalesce(b.commission_bps, 0) as broker_bps from policies p join products pr on pr.id = p.product_id
                                join binders bd on bd.id = p.binder_id left join brokers b on b.id = p.broker_id where p.id = $1`, [policy.id]);
    const tax = cols.tax && String(row[cols.tax] || '').trim() ? csvMoney(row[cols.tax]) : Math.round(premium * x.tax_bps / 10000);
    const res = await db.query(`insert into premium_transactions (policy_id, kind, effective_on, gross_cents, tax_cents, agency_commission_cents, broker_commission_cents, description, external_ref)
                                values ($1, $2, $3, $4, $5, $6, $7, 'Imported from Insly', $8) on conflict (external_ref) do nothing returning id`,
    [policy.id, existing ? 'endorsement' : 'new', inception, premium, tax, Math.round(premium * x.commission_bps / 10000), Math.round(premium * x.broker_bps / 10000), ref]);
    if (res.length) counts.transactions++; else counts.unchanged++;
  }

  if (!o['dry-run']) {
    await db.query('insert into imports (source, file, digest, inserted, unchanged, actor) values ($1, $2, $3, $4, $5, $6)',
      ['insly', path.basename(file), createHash('sha256').update(raw).digest('hex'), counts.policies + counts.transactions, counts.unchanged, o.actor || '']);
  }
  return { ...counts, dry_run: !!o['dry-run'], products_not_matched: [...unplaced] };
}

// ------------------------------------------------------------ output

export function parseArgs(argv) {
  const args = [];
  const options = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const i = a.indexOf('=');
      options[a.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : a.slice(i + 1);
    } else args.push(a);
  }
  return { cmd: args.shift() || 'help', args, options };
}

const label = (k) => k.replace(/_cents$/, '').replace(/_bps$/, ' %').replace(/_/g, ' ');
function cell(v, key, row) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (key.endsWith('_cents')) return money(v, row.currency || 'NZD');
  if (key.endsWith('_bps')) return `${(Number(v) / 100).toFixed(2)}%`;
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function rowsTable(rows) {
  if (!rows.length) return '  (none)';
  const keys = Object.keys(rows[0]).filter((k) => !/^(id|.*_id)$/.test(k));
  return textTable(rows, keys.map((k) => ({ key: k, label: label(k), align: /_cents$|_bps$|_percent$|^(days|days_left|days_open|days_to_expiry|lines|claims|policies|quotes|bound|referred_days|age_days)$/.test(k) ? 'right' : 'left', width: 48, format: (v, r) => cell(v, k, r) })));
}
export function human(value) {
  if (Array.isArray(value)) {
    if (value.length && value[0]?.question) return value.map((x, i) => `\n${i + 1}. ${x.question}\n${rowsTable(x.rows)}`).join('\n');
    return rowsTable(value);
  }
  if (value && typeof value === 'object') {
    const flat = Object.entries(value).filter(([, v]) => !Array.isArray(v) && (v === null || typeof v !== 'object' || v instanceof Date));
    const lists = Object.entries(value).filter(([, v]) => Array.isArray(v) && (!v.length || typeof v[0] === 'object'));
    const objs = Object.entries(value).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date));
    const out = [];
    if (flat.length) out.push(flat.filter(([k]) => !/_id$|^id$|_at$/.test(k)).map(([k, v]) => `  ${label(k).padEnd(30)} ${cell(v, k, value)}`).join('\n'));
    for (const [k, v] of objs) out.push(`\n${label(k)}\n` + Object.entries(v).filter(([kk]) => !/_id$|^id$|_at$/.test(kk)).map(([kk, vv]) => `  ${label(kk).padEnd(30)} ${cell(vv, kk, v)}`).join('\n'));
    for (const [k, v] of lists) out.push(`\n${label(k)}\n${rowsTable(v)}`);
    return out.join('\n');
  }
  return String(value);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  let db;
  try {
    const { cmd, args, options } = parseArgs(process.argv.slice(2));
    db = await getDb();
    const result = await run(db, cmd, args, options);
    console.log(options.json ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
