-- Demo data: Southerly Underwriting (fictional), an agency writing for two insurers under two
-- binders, one in New Zealand and one in Australia. Every name is invented. Dates move with
-- today, so there is always a bordereau late, a renewal notice due and a claim past its clock.
-- Safe to run twice.

insert into settings (key, value) values
  ('agency_name', 'Southerly Underwriting'),
  ('nz_claim_decision_days', '90'),
  ('nz_complaint_days', '20'),
  ('referral_chase_days', '5'),
  ('expiry_time', '4:00 pm local time at the insured''s address')
on conflict (key) do nothing;

insert into insurers (name, contact_name, contact_email) values
  ('Kahu General Insurance Ltd', 'Delegated authority team', 'binders@kahu.example'),
  ('Ironbark Insurance Ltd', 'Coverholder management', 'coverholders@ironbark.example')
on conflict (name) do nothing;

insert into binders (insurer_id, reference, name, country, currency, classes, starts_on, ends_on, gwp_cap_cents, max_sum_insured_cents,
                     commission_bps, bordereau_days, remit_days, referral_rule, clause_ref)
select i.id, b.reference, b.name, b.country, b.currency, b.classes, current_date + b.s, current_date + b.e, b.cap, b.maxsi, b.comm, b.bdx, b.remit, b.referral, b.clause
from (values
  ('Kahu General Insurance Ltd', 'SU-KAHU-26', 'NZ professional and liability binder', 'NZ', 'NZD', array['professional-indemnity', 'public-liability'],
     -340, 390, 150000000::bigint, 500000000::bigint, 2750, 15, 60, 'Refer any risk with revenue over NZ$20m or a claim in the last three years', 'Kahu binder SU-KAHU-26, schedule 2'),
  ('Ironbark Insurance Ltd', 'SU-IRB-26', 'AU management liability and landlord binder', 'AU', 'AUD', array['management-liability', 'home-buildings'],
     -360, 40, 25000000::bigint, 1000000000::bigint, 2500, 15, 60, 'Refer any risk with revenue over A$50m', 'Ironbark binder SU-IRB-26, clause 4')
) as b(insurer, reference, name, country, currency, classes, s, e, cap, maxsi, comm, bdx, remit, referral, clause)
join insurers i on i.name = b.insurer
on conflict (reference) do nothing;

insert into products (binder_id, name, class, rate_permille, min_premium_cents, tax_bps, renewable)
select bd.id, p.name, p.class, p.rate, p.minp, p.tax, true
from (values
  ('SU-KAHU-26', 'Consultants Professional Indemnity', 'professional-indemnity', 4.5, 120000::bigint, 1500),
  ('SU-KAHU-26', 'Business Liability', 'public-liability', 1.2, 65000::bigint, 1500),
  ('SU-KAHU-26', 'Small Business Cyber', 'cyber', 3.8, 90000::bigint, 1500),
  ('SU-IRB-26', 'Management Liability', 'management-liability', 3.8, 150000::bigint, 1000),
  ('SU-IRB-26', 'Landlord Home Buildings', 'home-buildings', 1.6, 90000::bigint, 1000)
) as p(binder, name, class, rate, minp, tax)
join binders bd on bd.reference = p.binder
on conflict (name) do nothing;

insert into brokers (name, firm, email, country, commission_bps) values
  ('Aroha Ngata', 'Harbourside Insurance Brokers', 'aroha@harbourside.example', 'NZ', 1500),
  ('Ben Whitfield', 'Southern Alps Risk', 'ben@southernalps.example', 'NZ', 1250),
  ('Chloe Tran', 'Parramatta Commercial Insurance', 'chloe@parracommercial.example', 'AU', 1500),
  ('Daniel Okafor', 'Bayside Risk Partners', 'daniel@baysiderisk.example', 'AU', 1750)
on conflict (name) do nothing;

insert into insureds (name, kind, country, region, occupation, email) values
  ('Kowhai Architects Ltd', 'business', 'NZ', 'Auckland', 'Architects', 'office@kowhai.example'),
  ('Tui Engineering Consultants Ltd', 'business', 'NZ', 'Wellington', 'Structural engineers', 'admin@tuieng.example'),
  ('Rata Landscapes Ltd', 'business', 'NZ', 'Canterbury', 'Landscaping', 'hello@ratalandscapes.example'),
  ('Moana Events Ltd', 'business', 'NZ', 'Bay of Plenty', 'Event management', 'team@moanaevents.example'),
  ('Harakeke Planning Ltd', 'business', 'NZ', 'Waikato', 'Resource consent planners', 'info@harakeke.example'),
  ('Pounamu IT Ltd', 'business', 'NZ', 'Otago', 'IT support', 'support@pounamuit.example'),
  ('Kereru Cafe Ltd', 'business', 'NZ', 'Nelson', 'Cafe', 'kereru@cafe.example'),
  ('Totara Surveyors Ltd', 'business', 'NZ', 'Hawke''s Bay', 'Land surveyors', 'survey@totara.example'),
  ('Fantail Physio Ltd', 'business', 'NZ', 'Auckland', 'Physiotherapy', 'clinic@fantail.example'),
  ('Kea Joinery Ltd', 'business', 'NZ', 'Southland', 'Joinery', 'orders@keajoinery.example'),
  ('Matai Valuers Ltd', 'business', 'NZ', 'Auckland', 'Property valuers', 'val@matai.example'),
  ('Coastal Freight Pty Ltd', 'business', 'AU', 'NSW', 'Road freight', 'accounts@coastalfreight.example'),
  ('Banksia Dental Group Pty Ltd', 'business', 'AU', 'VIC', 'Dental practices', 'pm@banksiadental.example'),
  ('Marlin Engineering Pty Ltd', 'business', 'AU', 'QLD', 'Mechanical engineering', 'office@marlineng.example'),
  ('Wattle Legal Pty Ltd', 'business', 'AU', 'NSW', 'Law firm', 'reception@wattlelegal.example'),
  ('Redgum Logistics Pty Ltd', 'business', 'AU', 'SA', 'Warehousing', 'finance@redgum.example'),
  ('Seaview Hotels Pty Ltd', 'business', 'AU', 'QLD', 'Hotels', 'gm@seaviewhotels.example'),
  ('Priya and Arjun Mehta', 'person', 'AU', 'NSW', 'Landlords', 'mehta@mail.example'),
  ('Dimitri Papadopoulos', 'person', 'AU', 'VIC', 'Landlord', 'dimitri@mail.example'),
  ('Grace O''Neill', 'person', 'AU', 'WA', 'Landlord', 'grace@mail.example'),
  ('Tallowood Accounting Pty Ltd', 'business', 'AU', 'NSW', 'Accountants', 'partners@tallowood.example'),
  ('Ironstone Mining Services Pty Ltd', 'business', 'AU', 'WA', 'Mining services', 'cfo@ironstone.example'),
  ('Southern Cross Drilling Pty Ltd', 'business', 'AU', 'WA', 'Drilling contractor', 'risk@scdrilling.example'),
  ('Blackbutt Finance Pty Ltd', 'business', 'AU', 'QLD', 'Equipment finance', 'compliance@blackbutt.example')
on conflict (name) do nothing;

-- Policies: expiry is days from today; inception is a year before it.
insert into policies (number, product_id, binder_id, insured_id, broker_id, inception, expiry, sum_insured_cents, annual_premium_cents, status, expiry_notice_on, cancelled_on)
select v.number, pr.id, pr.binder_id, i.id, b.id, (current_date + v.e - interval '1 year')::date, current_date + v.e, v.si * 100, v.prem * 100,
       v.status, case when v.notice is not null then current_date + v.notice end, case when v.cancelled is not null then current_date + v.cancelled end
from (values
  ('SU-N-1001', 'Consultants Professional Indemnity', 'Kowhai Architects Ltd', 'Aroha Ngata', 265, 2000000, 9000, 'in-force', null::int, null::int),
  ('SU-N-1002', 'Consultants Professional Indemnity', 'Tui Engineering Consultants Ltd', 'Ben Whitfield', 300, 6000000, 27000, 'in-force', null, null),
  ('SU-N-1003', 'Business Liability', 'Rata Landscapes Ltd', 'Ben Whitfield', 180, 2000000, 2400, 'in-force', null, null),
  ('SU-N-1004', 'Business Liability', 'Moana Events Ltd', 'Aroha Ngata', 320, 5000000, 6000, 'in-force', null, null),
  ('SU-N-1005', 'Consultants Professional Indemnity', 'Harakeke Planning Ltd', 'Aroha Ngata', 150, 1000000, 4500, 'in-force', null, null),
  ('SU-N-1006', 'Small Business Cyber', 'Pounamu IT Ltd', 'Ben Whitfield', 240, 1000000, 3800, 'in-force', null, null),
  ('SU-N-1007', 'Business Liability', 'Kereru Cafe Ltd', 'Aroha Ngata', 30, 1000000, 1200, 'in-force', null, null),
  ('SU-N-1008', 'Consultants Professional Indemnity', 'Totara Surveyors Ltd', 'Ben Whitfield', 50, 2000000, 8800, 'in-force', null, null),
  ('SU-A-2001', 'Management Liability', 'Coastal Freight Pty Ltd', 'Chloe Tran', 200, 5000000, 24000, 'in-force', null, null),
  ('SU-A-2002', 'Management Liability', 'Banksia Dental Group Pty Ltd', 'Daniel Okafor', 280, 5000000, 18500, 'in-force', null, null),
  ('SU-A-2003', 'Management Liability', 'Marlin Engineering Pty Ltd', 'Chloe Tran', 235, 5000000, 31000, 'in-force', null, null),
  ('SU-A-2004', 'Management Liability', 'Wattle Legal Pty Ltd', 'Daniel Okafor', 130, 5000000, 22000, 'in-force', null, null),
  ('SU-A-2005', 'Management Liability', 'Redgum Logistics Pty Ltd', 'Chloe Tran', 90, 10000000, 41000, 'in-force', null, null),
  ('SU-A-2006', 'Management Liability', 'Seaview Hotels Pty Ltd', 'Daniel Okafor', 160, 10000000, 38000, 'cancelled', null, -25),
  ('SU-A-2007', 'Landlord Home Buildings', 'Priya and Arjun Mehta', 'Chloe Tran', 10, 950000, 1850, 'in-force', null, null),
  ('SU-A-2008', 'Landlord Home Buildings', 'Dimitri Papadopoulos', 'Daniel Okafor', 20, 1150000, 2150, 'in-force', null, null),
  ('SU-A-2009', 'Landlord Home Buildings', 'Grace O''Neill', 'Daniel Okafor', 25, 820000, 1600, 'in-force', -3, null),
  ('SU-A-2010', 'Management Liability', 'Tallowood Accounting Pty Ltd', 'Chloe Tran', 40, 5000000, 26000, 'in-force', null, null),
  ('SU-A-2011', 'Management Liability', 'Ironstone Mining Services Pty Ltd', 'Daniel Okafor', 330, 10000000, 27000, 'in-force', null, null)
) as v(number, product, insured, broker, e, si, prem, status, notice, cancelled)
join products pr on pr.name = v.product
join insureds i on i.name = v.insured
join brokers b on b.name = v.broker
on conflict (number) do nothing;

-- Premium transactions: new business at inception, one endorsement, one cancellation refund.
with x(number, kind, at, gross, what) as (
  select number, 'new', null::int, null::bigint, 'New business' from policies
  union all select 'SU-A-2005', 'endorsement', -60, 250000::bigint, 'Added a subsidiary: Redgum Cold Storage Pty Ltd'
  union all select 'SU-A-2006', 'cancellation', -25, -950000::bigint, 'Cancelled mid-term at the insured''s request: pro rata refund'
)
insert into premium_transactions (policy_id, kind, effective_on, gross_cents, tax_cents, agency_commission_cents, broker_commission_cents, description, external_ref)
select p.id, x.kind, coalesce(current_date + x.at, p.inception), g.cents, round(g.cents * pr.tax_bps / 10000.0)::bigint,
       round(g.cents * bd.commission_bps / 10000.0)::bigint, round(g.cents * coalesce(b.commission_bps, 0) / 10000.0)::bigint, x.what, 'seed:' || p.number || ':' || x.kind
from x
join policies p on p.number = x.number
join products pr on pr.id = p.product_id
join binders bd on bd.id = p.binder_id
left join brokers b on b.id = p.broker_id
cross join lateral (select coalesce(x.gross, p.annual_premium_cents) as cents) g
on conflict (external_ref) do nothing;

-- Collected from the broker 20 days after it took effect, except Moana Events (still owed).
update premium_transactions t set collected_on = least(t.effective_on + 20, current_date)
from policies p where p.id = t.policy_id and t.collected_on is null and p.number <> 'SU-N-1004' and t.effective_on <= current_date;

-- Remitted to the insurer five days before settlement, except Marlin Engineering's month.
update premium_transactions t set remitted_on = r.due_on - 5
from policies p, bordereau_lines l, remittance_due r
where p.id = t.policy_id and l.id = t.id and r.binder_id = l.binder_id and r.month = l.month
  and t.remitted_on is null and t.collected_on is not null and r.due_on < current_date and p.number <> 'SU-A-2003';

-- Bordereaux sent, except Ironbark two months ago and Kahu last month.
insert into bordereaux (binder_id, month, kind, submitted_on)
select d.binder_id, d.month, 'risk', least(d.due_on - 3, current_date)
from bordereaux_due d
where not (d.binder = 'SU-IRB-26' and d.month = date_trunc('month', current_date - interval '2 months')::date)
  and not (d.binder = 'SU-KAHU-26' and d.month = date_trunc('month', current_date - interval '1 month')::date)
on conflict (binder_id, month, kind) do nothing;

insert into quotes (number, product_id, insured_id, broker_id, sum_insured_cents, premium_cents, status, quoted_on, valid_until, referral_reason, referred_on,
                    insurer_decision, decided_on, renewal_of, policy_id)
select q.number, pr.id, i.id, b.id, q.si * 100, q.prem * 100, q.status, current_date + q.quoted, current_date + q.valid, q.reason,
       case when q.referred is not null then current_date + q.referred end, q.decision, case when q.decided is not null then current_date + q.decided end,
       (select id from policies where number = q.renewal_of), (select id from policies where number = q.policy)
from (values
  ('SQ-1001', 'Business Liability', 'Fantail Physio Ltd', 'Aroha Ngata', 2000000, 1450, 'quoted', -6, 24, null, null::int, null, null::int, null, null),
  ('SQ-1002', 'Management Liability', 'Southern Cross Drilling Pty Ltd', 'Daniel Okafor', 10000000, 52000, 'referred', -11, 19, 'Revenue A$64m: over the A$50m referral threshold', -9, null, null, null, null),
  ('SQ-1003', 'Business Liability', 'Kea Joinery Ltd', 'Ben Whitfield', 2000000, 1900, 'quoted', -40, -5, null, null, null, null, null, null),
  ('SQ-1004', 'Management Liability', 'Tallowood Accounting Pty Ltd', 'Chloe Tran', 5000000, 27300, 'quoted', -3, 27, null, null, null, null, 'SU-A-2010', null),
  ('SQ-1005', 'Management Liability', 'Blackbutt Finance Pty Ltd', 'Chloe Tran', 5000000, 0, 'declined', -70, -40, 'Finance company: outside appetite', -69, 'Declined by Ironbark', -66, null, null),
  ('SQ-1006', 'Consultants Professional Indemnity', 'Matai Valuers Ltd', 'Aroha Ngata', 2000000, 11500, 'lapsed', -120, -90, null, null, null, null, null, null),
  ('SQ-1007', 'Consultants Professional Indemnity', 'Kowhai Architects Ltd', 'Aroha Ngata', 2000000, 9000, 'bound', -105, -75, null, null, null, null, null, 'SU-N-1001'),
  ('SQ-1008', 'Business Liability', 'Rata Landscapes Ltd', 'Ben Whitfield', 2000000, 2400, 'bound', -190, -160, null, null, null, null, null, 'SU-N-1003'),
  ('SQ-1009', 'Management Liability', 'Coastal Freight Pty Ltd', 'Chloe Tran', 5000000, 24000, 'bound', -170, -140, null, null, null, null, null, 'SU-A-2001'),
  ('SQ-1010', 'Management Liability', 'Banksia Dental Group Pty Ltd', 'Daniel Okafor', 5000000, 18500, 'bound', -90, -60, null, null, null, null, null, 'SU-A-2002')
) as q(number, product, insured, broker, si, prem, status, quoted, valid, reason, referred, decision, decided, renewal_of, policy)
join products pr on pr.name = q.product
join insureds i on i.name = q.insured
join brokers b on b.name = q.broker
on conflict (number) do nothing;

insert into claims (number, policy_id, notified_on, loss_date, description, reserve_cents, paid_cents, status, decision, first_response_on, decided_on, closed_on, handler)
select c.number, p.id, current_date + c.notified, current_date + c.loss, c.what, c.reserve * 100, c.paid * 100, c.status, c.decision,
       case when c.responded is not null then current_date + c.responded end, case when c.decided is not null then current_date + c.decided end,
       case when c.closed is not null then current_date + c.closed end, c.handler
from (values
  ('CL-3001', 'SU-A-2005', -140, -150, 'Former warehouse manager alleges unfair dismissal and bullying', 85000, 0, 'open', null, -132, null::int, null::int, 'Sarah'),
  ('CL-3002', 'SU-A-2002', -20, -25, 'WorkSafe Victoria inspection notice after a needlestick injury', 15000, 0, 'open', null, null::int, null, null, 'Sarah'),
  ('CL-3003', 'SU-N-1005', -100, -130, 'Client says a consent condition was missed, delaying a subdivision', 40000, 0, 'open', null, -95, null, null, 'Tom'),
  ('CL-3004', 'SU-N-1003', -60, -64, 'Neighbour''s fence damaged by a digger during works', 0, 12500, 'decided', 'accepted', -57, -40, null, 'Tom'),
  ('CL-3005', 'SU-A-2006', -200, -210, 'Guest injury claim: incident before the policy period', 0, 0, 'closed', 'declined', -195, -170, -150, 'Sarah')
) as c(number, policy, notified, loss, what, reserve, paid, status, decision, responded, decided, closed, handler)
join policies p on p.number = c.policy
on conflict (number) do nothing;

insert into complaints (insured_id, policy_id, received_on, summary, responded_on, outcome)
select i.id, p.id, current_date + c.received, c.summary, case when c.responded is not null then current_date + c.responded end, c.outcome
from (values
  ('Dimitri Papadopoulos', 'SU-A-2008', -34, 'Says the renewal premium rose 38% with no explanation', null::int, null),
  ('Rata Landscapes Ltd', 'SU-N-1003', -10, 'Unhappy with how long the fence claim took to pay', null, null),
  ('Coastal Freight Pty Ltd', 'SU-A-2001', -80, 'Certificate of currency sent with the wrong ABN', -78, 'Corrected certificate issued the same week')
) as c(insured, policy, received, summary, responded, outcome)
join insureds i on i.name = c.insured
left join policies p on p.number = c.policy
where not exists (select 1 from complaints x where x.insured_id = i.id and x.summary = c.summary);

insert into activities (record_kind, record_id, note, actor)
select 'policies', p.id, a.note, a.actor
from (values
  ('SU-A-2010', 'Broker says Tallowood is also talking to another agency about renewal', 'Chloe Tran'),
  ('SU-N-1002', 'Engineer asked for higher limit after a large council contract', 'Ben Whitfield')
) as a(policy, note, actor)
join policies p on p.number = a.policy
where not exists (select 1 from activities x where x.record_id = p.id and x.note = a.note);
