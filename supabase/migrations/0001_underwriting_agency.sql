-- Underwriting Agency for Claude Code: the schema.
-- An underwriting agency (MGA) writes policies for insurers under binders. This holds the
-- binders and their limits, the products and rates, brokers, insureds, quotes and referrals,
-- policies, every premium transaction, the monthly bordereaux and remittances owed to each
-- insurer, claims and complaints. Plain Postgres: runs on any Postgres, Supabase or PGlite.
-- Money is integer cents in the binder's currency. Rates are per mille of the sum insured.

create table settings (
  key text primary key,
  value text not null
);

create table insurers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  contact_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The binder: the insurer's written authority for the agency to quote, bind and issue.
create table binders (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references insurers(id),
  reference text not null unique,
  name text not null,
  country text not null default 'NZ' check (country in ('NZ', 'AU')),
  currency text not null default 'NZD',
  classes text[] not null default '{}',
  starts_on date not null,
  ends_on date not null,
  gwp_cap_cents bigint,
  max_sum_insured_cents bigint,
  commission_bps integer not null default 2500,
  bordereau_days integer not null default 15,
  remit_days integer not null default 60,
  referral_rule text,
  clause_ref text not null default 'Binder agreement',
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  binder_id uuid not null references binders(id),
  name text not null unique,
  class text not null,
  rate_permille numeric(10, 4) not null,
  min_premium_cents bigint not null default 0,
  tax_bps integer not null default 1500,
  renewable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table brokers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  firm text,
  email text,
  country text not null default 'NZ',
  commission_bps integer not null default 1500,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table insureds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'business' check (kind in ('business', 'person')),
  country text not null default 'NZ',
  region text,
  occupation text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table policies (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  product_id uuid not null references products(id),
  binder_id uuid not null references binders(id),
  insured_id uuid not null references insureds(id),
  broker_id uuid references brokers(id),
  inception date not null,
  expiry date not null,
  sum_insured_cents bigint not null,
  annual_premium_cents bigint not null,
  status text not null default 'in-force' check (status in ('in-force', 'cancelled', 'expired', 'renewed', 'lapsed')),
  renewal_of uuid references policies(id),
  expiry_notice_on date,
  not_renewing boolean not null default false,
  cancelled_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry > inception)
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  product_id uuid not null references products(id),
  insured_id uuid not null references insureds(id),
  broker_id uuid references brokers(id),
  sum_insured_cents bigint not null,
  premium_cents bigint not null,
  status text not null default 'quoted' check (status in ('draft', 'quoted', 'referred', 'bound', 'declined', 'lapsed')),
  quoted_on date not null default current_date,
  valid_until date,
  inception date,
  referral_reason text,
  referred_on date,
  insurer_decision text,
  decided_on date,
  renewal_of uuid references policies(id),
  policy_id uuid references policies(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every premium movement: new business, renewal, endorsement (mid-term change), cancellation.
-- The bordereau month is the month the transaction takes effect.
create table premium_transactions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id),
  kind text not null check (kind in ('new', 'renewal', 'endorsement', 'cancellation')),
  effective_on date not null,
  gross_cents bigint not null,
  tax_cents bigint not null default 0,
  agency_commission_cents bigint not null default 0,
  broker_commission_cents bigint not null default 0,
  description text,
  collected_on date,
  remitted_on date,
  external_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  policy_id uuid not null references policies(id),
  notified_on date not null,
  loss_date date,
  description text,
  reserve_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  status text not null default 'open' check (status in ('open', 'decided', 'closed')),
  decision text check (decision in ('accepted', 'declined', 'partial')),
  first_response_on date,
  decided_on date,
  closed_on date,
  handler text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  insured_id uuid not null references insureds(id),
  policy_id uuid references policies(id),
  received_on date not null,
  summary text not null,
  responded_on date,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A bordereau sent to the insurer: one per binder, month and kind.
create table bordereaux (
  id uuid primary key default gen_random_uuid(),
  binder_id uuid not null references binders(id),
  month date not null check (extract(day from month) = 1),
  kind text not null default 'risk' check (kind in ('risk', 'claims')),
  submitted_on date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (binder_id, month, kind)
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  record_kind text not null,
  record_id uuid not null,
  note text not null,
  actor text not null default '',
  at timestamptz not null default now()
);

create table imports (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  file text not null,
  digest text not null,
  inserted integer not null default 0,
  unchanged integer not null default 0,
  actor text not null default '',
  at timestamptz not null default now()
);

create index on policies (expiry);
create index on premium_transactions (policy_id);
create index on premium_transactions (effective_on);
create index on claims (policy_id);
create index on activities (record_id);

create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['insurers', 'binders', 'products', 'brokers', 'insureds', 'policies', 'quotes', 'premium_transactions', 'claims', 'complaints', 'bordereaux']
  loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------ views

create view policy_list as
select p.id, p.number, i.name as insured, b.name as broker, pr.name as product, pr.class, bd.reference as binder,
       bd.country, bd.currency, p.inception, p.expiry, (p.expiry - current_date) as days_to_expiry,
       p.sum_insured_cents, p.annual_premium_cents, p.status, p.binder_id, p.insured_id, p.broker_id, p.product_id
from policies p
join insureds i on i.id = p.insured_id
join products pr on pr.id = p.product_id
join binders bd on bd.id = p.binder_id
left join brokers b on b.id = p.broker_id;

-- Each premium transaction as a bordereau line. Net to the insurer is gross plus tax, less the
-- agency's commission (the broker is paid out of the agency's commission).
create view bordereau_lines as
select t.id, p.binder_id, bd.reference as binder, date_trunc('month', t.effective_on)::date as month,
       p.number as policy, i.name as insured, i.country as insured_country, i.region, pr.class, t.kind,
       t.effective_on, p.inception, p.expiry, p.sum_insured_cents, bd.currency,
       t.gross_cents, t.tax_cents, t.agency_commission_cents, t.broker_commission_cents,
       (t.gross_cents + t.tax_cents - t.agency_commission_cents) as net_due_cents,
       t.collected_on, t.remitted_on
from premium_transactions t
join policies p on p.id = t.policy_id
join binders bd on bd.id = p.binder_id
join insureds i on i.id = p.insured_id
join products pr on pr.id = p.product_id;

-- Gross written premium against each binder's cap, and the pace it is being used at.
create view binder_usage as
select bd.id, bd.reference, bd.name, ins.name as insurer, bd.country, bd.currency, bd.starts_on, bd.ends_on,
       (bd.ends_on - current_date) as days_left, bd.gwp_cap_cents,
       coalesce(sum(l.gross_cents), 0)::bigint as gwp_cents,
       round(100.0 * coalesce(sum(l.gross_cents), 0) / nullif(bd.gwp_cap_cents, 0), 1) as percent_used,
       case when current_date > bd.starts_on and bd.gwp_cap_cents is not null then
         round(coalesce(sum(l.gross_cents), 0) * ((bd.ends_on - bd.starts_on)::numeric / greatest(least(current_date, bd.ends_on) - bd.starts_on, 1)))::bigint
       end as projected_gwp_cents,
       bd.status
from binders bd
join insurers ins on ins.id = bd.insurer_id
left join bordereau_lines l on l.binder_id = bd.id and l.effective_on between bd.starts_on and bd.ends_on
group by bd.id, ins.name;

-- Every month a binder was live, the risk bordereau due for it, and whether it went.
create view bordereaux_due as
select bd.id as binder_id, bd.reference as binder, ins.name as insurer, m.month::date as month,
       ((m.month + interval '1 month')::date - 1 + bd.bordereau_days) as due_on,
       x.submitted_on,
       (select count(*) from bordereau_lines l where l.binder_id = bd.id and l.month = m.month::date) as lines,
       (select coalesce(sum(l.gross_cents), 0) from bordereau_lines l where l.binder_id = bd.id and l.month = m.month::date)::bigint as gross_cents,
       bd.currency
from binders bd
join insurers ins on ins.id = bd.insurer_id
cross join lateral generate_series(date_trunc('month', bd.starts_on), date_trunc('month', least(bd.ends_on, current_date)) - interval '1 month', interval '1 month') as m(month)
left join bordereaux x on x.binder_id = bd.id and x.month = m.month::date and x.kind = 'risk';

-- Net premium owed to each insurer, by binder and month, with the day it falls due.
create view remittance_due as
select l.binder_id, l.binder, ins.name as insurer, l.month, bd.currency,
       ((l.month + interval '1 month')::date - 1 + bd.remit_days) as due_on,
       count(*) as lines,
       sum(l.net_due_cents)::bigint as net_due_cents,
       coalesce(sum(l.net_due_cents) filter (where l.remitted_on is null), 0)::bigint as unremitted_cents,
       coalesce(sum(l.net_due_cents) filter (where l.remitted_on is null and l.collected_on is null), 0)::bigint as not_collected_cents
from bordereau_lines l
join binders bd on bd.id = l.binder_id
join insurers ins on ins.id = bd.insurer_id
group by l.binder_id, l.binder, ins.name, l.month, bd.currency, bd.remit_days;

create view renewals_due as
select p.id, p.number, i.name as insured, b.name as broker, pr.name as product, bd.country, bd.currency,
       p.expiry, (p.expiry - current_date) as days_left, p.annual_premium_cents, p.not_renewing, p.expiry_notice_on,
       (select q.number || ' ' || q.status from quotes q where q.renewal_of = p.id order by q.quoted_on desc limit 1) as renewal_quote,
       (bd.country = 'AU' and pr.renewable) as s58_applies,
       (select count(*) from claims c where c.policy_id = p.id) as claims
from policies p
join insureds i on i.id = p.insured_id
join products pr on pr.id = p.product_id
join binders bd on bd.id = p.binder_id
left join brokers b on b.id = p.broker_id
where p.status = 'in-force' and p.expiry <= current_date + 60
  and not exists (select 1 from policies n where n.renewal_of = p.id);

create view open_quotes as
select q.id, q.number, i.name as insured, b.name as broker, pr.name as product, bd.currency, q.status,
       q.sum_insured_cents, q.premium_cents, q.quoted_on, q.valid_until, (current_date - q.quoted_on) as age_days,
       q.referral_reason, q.referred_on, case when q.referred_on is not null then current_date - q.referred_on end as referred_days
from quotes q
join insureds i on i.id = q.insured_id
join products pr on pr.id = q.product_id
join binders bd on bd.id = pr.binder_id
left join brokers b on b.id = q.broker_id
where q.status in ('draft', 'quoted', 'referred');

create view open_claims as
select c.id, c.number, p.number as policy, i.name as insured, pr.class, bd.country, bd.currency, c.notified_on,
       (current_date - c.notified_on) as days_open, c.loss_date, c.reserve_cents, c.paid_cents,
       (c.reserve_cents + c.paid_cents) as incurred_cents, c.status, c.decision, c.first_response_on, c.decided_on, c.handler
from claims c
join policies p on p.id = c.policy_id
join insureds i on i.id = p.insured_id
join products pr on pr.id = p.product_id
join binders bd on bd.id = p.binder_id
where c.status <> 'closed';

create view loss_ratio as
select bd.reference as binder, ins.name as insurer, bd.currency,
       coalesce((select sum(l.gross_cents) from bordereau_lines l where l.binder_id = bd.id), 0)::bigint as written_cents,
       coalesce((select sum(c.reserve_cents + c.paid_cents) from claims c join policies p on p.id = c.policy_id where p.binder_id = bd.id), 0)::bigint as incurred_cents,
       (select count(*) from claims c join policies p on p.id = c.policy_id where p.binder_id = bd.id) as claims,
       round(100.0 * coalesce((select sum(c.reserve_cents + c.paid_cents) from claims c join policies p on p.id = c.policy_id where p.binder_id = bd.id), 0)
             / nullif((select sum(l.gross_cents) from bordereau_lines l where l.binder_id = bd.id), 0), 1) as loss_ratio_percent
from binders bd join insurers ins on ins.id = bd.insurer_id;

create view broker_production as
select b.id, b.name as broker, b.firm,
       (select count(*) from policies p where p.broker_id = b.id and p.status = 'in-force') as policies_in_force,
       coalesce((select sum(t.gross_cents) from premium_transactions t join policies p on p.id = t.policy_id
                 where p.broker_id = b.id and t.effective_on > current_date - 365), 0)::bigint as gwp_12m_cents,
       (select count(*) from quotes q where q.broker_id = b.id and q.quoted_on > current_date - 365) as quotes_12m,
       (select count(*) from quotes q where q.broker_id = b.id and q.quoted_on > current_date - 365 and q.status = 'bound') as bound_12m,
       round(100.0 * (select count(*) from quotes q where q.broker_id = b.id and q.quoted_on > current_date - 365 and q.status = 'bound')
             / nullif((select count(*) from quotes q where q.broker_id = b.id and q.quoted_on > current_date - 365 and q.status in ('bound', 'declined', 'lapsed')), 0), 0) as hit_rate_percent
from brokers b;

-- Every legal and contractual check. severity: breached, overdue, due soon, check.
create view compliance as
-- Outside the binder: class, sum insured or dates outside the insurer's written authority.
select 'BINDER-AUTHORITY'::text as rule, 'breached'::text as severity, p.number || ' (' || bd.reference || ')' as record,
       case when not (pr.class = any(bd.classes)) then pr.class || ' is not a class this binder covers'
            when bd.max_sum_insured_cents is not null and p.sum_insured_cents > bd.max_sum_insured_cents then 'Sum insured is above the binder limit'
            else 'Incepts outside the binder period ' || bd.starts_on || ' to ' || bd.ends_on end as issue,
       bd.clause_ref as source, p.inception as on_date
from policies p join binders bd on bd.id = p.binder_id join products pr on pr.id = p.product_id
where p.status in ('in-force', 'renewed')
  and (not (pr.class = any(bd.classes))
       or (bd.max_sum_insured_cents is not null and p.sum_insured_cents > bd.max_sum_insured_cents)
       or p.inception < bd.starts_on or p.inception > bd.ends_on)
union all
-- Capacity: gross written premium against the cap.
select 'BINDER-CAPACITY', case when u.percent_used >= 100 then 'breached' else 'due soon' end, u.reference,
       u.percent_used || '% of the premium cap used with ' || u.days_left || ' days of the binder left', 'Binder agreement: premium cap', u.ends_on
from binder_usage u where u.status = 'active' and u.percent_used >= 90
union all
-- A binder ending soon with no replacement loaded.
select 'BINDER-RENEWAL', case when u.days_left < 0 then 'overdue' else 'due soon' end, u.reference,
       'Binder ends ' || u.ends_on || ': no replacement binder recorded with ' || u.insurer, 'Binder agreement: period', u.ends_on
from binder_usage u
where u.status = 'active' and u.days_left <= 60
  and not exists (select 1 from binders n join insurers ni on ni.id = n.insurer_id where ni.name = u.insurer and n.starts_on >= u.ends_on)
union all
-- The monthly risk bordereau, due a set number of days after each month ends.
select 'BORDEREAU', 'overdue', d.binder || ' ' || to_char(d.month, 'Mon YYYY'),
       'Risk bordereau due ' || d.due_on || ' (' || (current_date - d.due_on) || ' days late, ' || d.lines || ' lines)', 'Binder agreement: bordereau reporting', d.due_on
from bordereaux_due d where d.submitted_on is null and d.due_on < current_date
union all
select 'BORDEREAU', 'due soon', d.binder || ' ' || to_char(d.month, 'Mon YYYY'),
       'Risk bordereau due ' || d.due_on || ' (' || d.lines || ' lines)', 'Binder agreement: bordereau reporting', d.due_on
from bordereaux_due d where d.submitted_on is null and d.due_on between current_date and current_date + 7
union all
-- Premium owed to the insurer past its settlement date.
select 'REMITTANCE', 'overdue', r.binder || ' ' || to_char(r.month, 'Mon YYYY'),
       r.currency || ' ' || to_char(r.unremitted_cents / 100.0, 'FM999,999,990') || ' not remitted to ' || r.insurer || ', due ' || r.due_on, 'Binder agreement: premium settlement', r.due_on
from remittance_due r where r.unremitted_cents > 0 and r.due_on < current_date
union all
-- Australia: notice of expiry at least 14 days before a renewable policy ends.
select 'ICA-S58', case when p.expiry - current_date < 14 then 'breached' else 'due soon' end, p.number || ' ' || i.name,
       case when p.expiry - current_date < 14 then 'Expires ' || p.expiry || ' with no expiry notice sent: the 14-day deadline has passed'
            else 'Expires ' || p.expiry || ': send the expiry notice by ' || (p.expiry - 14) end,
       'Insurance Contracts Act 1984 (Cth) s58', p.expiry - 14
from policies p join binders bd on bd.id = p.binder_id join products pr on pr.id = p.product_id join insureds i on i.id = p.insured_id
where bd.country = 'AU' and pr.renewable and p.status = 'in-force' and p.expiry_notice_on is null
  and p.expiry >= current_date and p.expiry <= current_date + 28
  and not exists (select 1 from policies n where n.renewal_of = p.id)
union all
-- Australia: a claim decision within four months of the claim being received.
select 'CODE-CLAIM-DECISION', case when c.notified_on + interval '4 months' < current_date then 'breached' else 'due soon' end, c.number || ' ' || i.name,
       'Claim received ' || c.notified_on || ', no decision after ' || (current_date - c.notified_on) || ' days', 'General Insurance Code of Practice 2020: decision within four months', (c.notified_on + interval '4 months')::date
from claims c join policies p on p.id = c.policy_id join binders bd on bd.id = p.binder_id join insureds i on i.id = p.insured_id
where bd.country = 'AU' and c.decided_on is null and c.status = 'open' and c.notified_on + interval '3 months' < current_date
union all
-- Australia: first response within 10 business days (counted here as 14 calendar days).
select 'CODE-CLAIM-RESPONSE', 'breached', c.number || ' ' || i.name,
       'No first response recorded ' || (current_date - c.notified_on) || ' days after the claim', 'General Insurance Code of Practice 2020: respond within 10 business days', c.notified_on + 14
from claims c join policies p on p.id = c.policy_id join binders bd on bd.id = p.binder_id join insureds i on i.id = p.insured_id
where bd.country = 'AU' and c.first_response_on is null and c.decided_on is null and c.notified_on + 14 < current_date
union all
-- New Zealand claims: the house standard in settings (no statutory clock).
select 'HOUSE-CLAIM-DECISION', 'overdue', c.number || ' ' || i.name,
       'Claim received ' || c.notified_on || ', no decision after ' || (current_date - c.notified_on) || ' days', 'House standard: settings.nz_claim_decision_days',
       c.notified_on + coalesce((select value::int from settings where key = 'nz_claim_decision_days'), 90)
from claims c join policies p on p.id = c.policy_id join binders bd on bd.id = p.binder_id join insureds i on i.id = p.insured_id
where bd.country = 'NZ' and c.decided_on is null and c.status = 'open'
  and c.notified_on + coalesce((select value::int from settings where key = 'nz_claim_decision_days'), 90) < current_date
union all
-- Australia: a written response to a complaint within 30 calendar days.
select 'RG271-IDR', case when cp.received_on + 30 < current_date then 'breached' else 'due soon' end, i.name,
       'Complaint received ' || cp.received_on || ': ' || left(cp.summary, 60), 'ASIC RG 271: IDR response within 30 calendar days', cp.received_on + 30
from complaints cp join insureds i on i.id = cp.insured_id
left join policies p on p.id = cp.policy_id left join binders bd on bd.id = p.binder_id
where coalesce(bd.country, i.country) = 'AU' and cp.responded_on is null and cp.received_on + 23 < current_date
union all
select 'HOUSE-COMPLAINT', 'overdue', i.name,
       'Complaint received ' || cp.received_on || ': ' || left(cp.summary, 60), 'House standard: settings.nz_complaint_days',
       cp.received_on + coalesce((select value::int from settings where key = 'nz_complaint_days'), 20)
from complaints cp join insureds i on i.id = cp.insured_id
left join policies p on p.id = cp.policy_id left join binders bd on bd.id = p.binder_id
where coalesce(bd.country, i.country) = 'NZ' and cp.responded_on is null
  and cp.received_on + coalesce((select value::int from settings where key = 'nz_complaint_days'), 20) < current_date
union all
-- A referral the insurer has not answered.
select 'REFERRAL', 'check', q.number || ' ' || i.name, 'Referred to the insurer ' || (current_date - q.referred_on) || ' days ago: ' || coalesce(q.referral_reason, ''), 'Binder agreement: referral',
       q.referred_on + coalesce((select value::int from settings where key = 'referral_chase_days'), 5)
from quotes q join insureds i on i.id = q.insured_id
where q.status = 'referred' and q.decided_on is null
  and q.referred_on + coalesce((select value::int from settings where key = 'referral_chase_days'), 5) < current_date;

-- What needs a person: the compliance checks, then renewals with nothing started, stale quotes, big reserves.
create view attention as
select severity as level, rule as what, record, issue, source, on_date from compliance
union all
select 'due soon', 'RENEWAL', r.number || ' ' || r.insured, 'Expires ' || r.expiry || ' (' || r.days_left || ' days): no renewal quote yet', 'Renewal book', r.expiry
from renewals_due r where r.renewal_quote is null and not r.not_renewing and r.days_left between 0 and 45
union all
select 'stale', 'QUOTE', q.number || ' ' || q.insured, 'Quoted ' || q.quoted_on || ', valid until ' || q.valid_until || ': chase the broker or lapse it', 'Quote book', q.valid_until
from open_quotes q where q.status = 'quoted' and q.valid_until < current_date
union all
select 'check', 'UNCOLLECTED', l.policy || ' ' || l.insured, l.currency || ' ' || to_char((l.gross_cents + l.tax_cents - l.broker_commission_cents) / 100.0, 'FM999,999,990') || ' premium not collected from the broker after ' || (current_date - l.effective_on) || ' days', 'Credit terms', l.effective_on + 30
from bordereau_lines l where l.collected_on is null and l.gross_cents > 0 and l.effective_on + 30 < current_date;

create view this_week as
select 'Policies in force' as item, count(*)::text as value from policies where status = 'in-force'
union all select 'Quotes open (referred)', (select count(*) from open_quotes)::text || ' (' || (select count(*) from open_quotes where status = 'referred')::text || ')'
union all select 'Renewals in the next 30 days', (select count(*) from renewals_due where days_left between 0 and 30)::text
union all select 'Premium owed to insurers, overdue', coalesce((select string_agg(currency || ' ' || to_char(total / 100.0, 'FM999,999,990'), ', ') from (select currency, sum(unremitted_cents) as total from remittance_due where due_on < current_date and unremitted_cents > 0 group by currency) s), 'none')
union all select 'Open claims (incurred)', (select count(*) from open_claims)::text || ' (' || coalesce((select string_agg(currency || ' ' || to_char(total / 100.0, 'FM999,999,990'), ', ') from (select currency, sum(incurred_cents) as total from open_claims group by currency) s), 'none') || ')';
