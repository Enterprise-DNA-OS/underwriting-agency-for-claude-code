#!/usr/bin/env node
// npm test. A temp database, the migration, the demo agency, every command, and the paperwork.
// Runs on Windows and Linux with nothing installed but Node. Set TEST_DATABASE_URL to a disposable
// local database named rebuild_test to run the same checks on real Postgres.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, usage, human, cents, date, month, rate, csvDate, csvMoney, mapStatus, parseArgs } from './agency.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'underwriting-agency-test-'));
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
process.env.DATABASE_URL = '';
if (process.env.TEST_DATABASE_URL) {
  const u = new URL(process.env.TEST_DATABASE_URL);
  assert(['localhost', '127.0.0.1'].includes(u.hostname) && u.pathname === '/rebuild_test', 'TEST_DATABASE_URL must be a disposable local database named rebuild_test');
  process.env.DATABASE_URL = u.href;
}

const seen = new Set();
let db;
const call = (cmd, args = [], o = {}) => { seen.add(cmd); return run(db, cmd, args, o); };
const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => iso(new Date(Date.now() + n * 86400000));
const rules = async () => (await call('compliance')).map((x) => x.rule);
const count = (list, rule) => list.filter((r) => r === rule).length;

try {
  db = await getDb();
  if (db.mode === 'postgres') await db.exec('drop schema public cascade; create schema public;');
  assert.equal((await migrate(db)).ran.length, 1);
  assert.equal((await migrate(db)).ran.length, 0, 'migrate twice is a no-op');
  await seed(db);
  await seed(db);

  // Units
  assert.equal(cents('2,400.50'), 240050);
  assert.equal(cents('$1.2m'), 120000000);
  assert.equal(cents('250k'), 25000000);
  assert.throws(() => date('2026-02-30'), /YYYY-MM-DD/);
  assert.equal(month('2026-09'), '2026-09-01');
  assert.throws(() => month('2026-13'), /YYYY-MM/);
  assert.equal(rate({ rate_permille: '1.2', min_premium_cents: 65000 }, 200000000), 240000);
  assert.equal(rate({ rate_permille: '1.2', min_premium_cents: 65000 }, 10000000), 65000, 'never below the minimum premium');
  assert.equal(csvDate('01/09/2026'), '2026-09-01');
  assert.equal(csvMoney('(1,950.00)'), -195000);
  assert.equal(mapStatus('Cancelled'), 'cancelled');
  assert.deepEqual(parseArgs(['quote', 'kea', '--sum-insured=1m', '--json']).options, { 'sum-insured': '1m', json: true });

  // Reads on the demo agency
  assert.equal((await call('help')).length, Object.keys(usage).length);
  assert.equal((await call('binders')).length, 2);
  const kahu = await call('binder', ['kahu']);
  assert.equal(kahu.products.length, 3);
  assert.equal(kahu.authority.commission_bps, 2750);
  assert.equal((await call('products')).length, 5);
  assert.equal((await call('brokers')).length, 4);
  assert.equal((await call('insureds')).length, 24);
  assert.equal((await call('insureds', [], { country: 'au' })).length, 13);
  assert.equal((await call('policies')).length, 18);
  assert.equal((await call('policies', [], { status: 'all' })).length, 19);
  assert.equal((await call('policies', [], { binder: 'SU-IRB-26', class: 'home-buildings' })).length, 3);
  assert.equal((await call('policies', [], { broker: 'aroha' })).length, 4);
  const redgum = await call('policy', ['SU-A-2005']);
  assert.equal(redgum.transactions.length, 2);
  assert.equal(Number(redgum.transactions[0].net_due_cents), 4100000 + 410000 - 1025000);
  assert.equal(redgum.claims.length, 1);
  assert.equal((await call('quotes')).length, 4);
  assert.equal((await call('quotes', [], { status: 'bound' })).length, 4);
  assert.equal((await call('quotes', [], { status: 'all' })).length, 10);
  assert.equal((await call('referrals')).length, 1);
  const ren = await call('renewals');
  assert.equal(ren.length, 6);
  assert(ren.find((r) => r.number === 'SU-A-2007').expiry_notice.startsWith('LATE'));
  assert.equal(ren.find((r) => r.number === 'SU-N-1007').expiry_notice, 'not required');
  assert.equal((await call('renewals', [], { days: '15' })).length, 1);
  const cap = await call('capacity');
  assert.equal(cap[0].reference, 'SU-IRB-26');
  assert.equal(Number(cap[0].gwp_cents), 22610000);
  const lastMonth = new Date(); lastMonth.setUTCDate(1); lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 2);
  const twoAgo = iso(lastMonth).slice(0, 7);
  const bdx = await call('bordereau', ['irb'], { month: twoAgo });
  assert.equal(bdx.submitted_on, null, 'the demo leaves this bordereau unsent');
  assert.equal(bdx.net_due_cents, bdx.gross_cents + bdx.tax_cents - bdx.agency_commission_cents);
  assert((await call('bordereau', ['kahu'])).binder === 'SU-KAHU-26');
  assert((await call('bordereaux')).some((b) => b.state.startsWith('LATE')));
  assert.equal((await call('bordereaux', [], { binder: 'kahu' })).filter((b) => !b.submitted_on).length, 1);
  const rem = await call('remittance');
  assert.equal(rem.filter((r) => r.state === 'OVERDUE').length, 1);
  assert.equal(Number(rem.find((r) => r.state === 'OVERDUE').unremitted_cents), 3100000 + 310000 - 775000);
  assert.equal((await call('remittance', [], { binder: 'kahu' })).filter((r) => r.state === 'OVERDUE').length, 0);
  assert.equal((await call('claims')).length, 4);
  assert.equal((await call('claims', [], { all: true })).length, 5);
  assert.equal((await call('loss-ratio')).length, 2);
  assert.equal((await call('complaints')).length, 2);
  assert.equal((await call('complaints', [], { all: true })).length, 3);

  // The legal and binder checks on the demo data
  const r0 = await rules();
  assert.equal(count(r0, 'BINDER-AUTHORITY'), 2);
  assert.equal(count(r0, 'BINDER-CAPACITY'), 1);
  assert.equal(count(r0, 'BINDER-RENEWAL'), 1);
  assert(count(r0, 'BORDEREAU') >= 1);
  assert.equal(count(r0, 'REMITTANCE'), 1);
  assert.equal(count(r0, 'ICA-S58'), 2);
  assert.equal(count(r0, 'CODE-CLAIM-DECISION'), 1);
  assert.equal(count(r0, 'CODE-CLAIM-RESPONSE'), 1);
  assert.equal(count(r0, 'HOUSE-CLAIM-DECISION'), 1);
  assert.equal(count(r0, 'RG271-IDR'), 1);
  assert.equal(count(r0, 'REFERRAL'), 1);
  const comp = await call('compliance');
  assert.equal(comp[0].severity, 'breached');
  assert(comp.find((c) => c.rule === 'ICA-S58' && c.severity === 'breached').record.includes('SU-A-2007'));
  const att = await call('attention');
  assert(att.length >= 18);
  assert(att.some((a) => a.what === 'RENEWAL' && a.record.includes('Kereru')));
  assert(att.some((a) => a.what === 'QUOTE' && a.record.includes('SQ-1003')));
  assert(att.some((a) => a.what === 'UNCOLLECTED' && a.record.includes('SU-N-1004')));
  assert.equal((await call('week')).length, 5);
  const ins = await call('insights');
  assert.equal(ins.length, 10);
  for (const [i, x] of ins.entries()) if (i !== 5) assert(x.rows.length > 0, `insight has rows: ${x.question}`);
  assert.equal(ins[0].rows.find((r) => r.reference === 'SU-IRB-26').at_this_pace, 'runs out');
  assert((await call('history', ['tallowood'])).length >= 3);

  // Ambiguous names list the candidates
  await assert.rejects(() => call('policy', ['SU-A']), /More than one policy/);

  // Writes: a new broker and insured, a quote rated from the product, bound into a policy
  await call('add-broker', [], { name: 'Riverside Insurance Brokers', firm: 'Riverside', country: 'AU', commission: '15' });
  const ins1 = await call('add-insured', [], { name: 'Kahikatea Design Ltd', country: 'NZ', occupation: 'Interior designers' });
  const qt = await call('quote', [ins1.name], { product: 'business liability', 'sum-insured': '2m', broker: 'aroha' });
  assert.equal(qt.status, 'quoted');
  assert.equal(Number(qt.premium_cents), 240000);
  const bound = await call('bind', [qt.number]);
  assert(bound.policy.startsWith('SU-N-'));
  assert.equal((await call('policy', [bound.policy])).transactions[0].kind, 'new');

  // Outside the binder: referred, accepted by the insurer, then bound
  const big = await call('quote', ['Kahikatea'], { product: 'consultants', 'sum-insured': '8m', broker: 'ben' });
  assert.equal(big.status, 'referred');
  assert.match(big.outside_authority, /above the binder limit/);
  await assert.rejects(() => call('bind', [big.number]), /only a quoted risk/);
  await call('decide', [big.number], { accept: true, note: 'Kahu accepts at NZ$8m with a NZ$25,000 excess' });
  const bigPolicy = await call('bind', [big.number]);
  assert(bigPolicy.outside_authority_accepted_by_insurer);
  const plain = await call('quote', ['Kahikatea'], { product: 'business liability', 'sum-insured': '1m' });
  await call('refer', [plain.number], { reason: 'Insured had a claim two years ago' });
  await call('decide', [plain.number], { decline: true });
  await assert.rejects(() => call('decide', [plain.number], { accept: true }), /not waiting/);

  // Endorse, cancel, renew
  const end = await call('endorse', ['SU-N-1001'], { premium: '750', description: 'Added a second office' });
  assert.equal(Number(end.agency_commission_cents), Math.round(75000 * 0.275));
  await assert.rejects(() => call('endorse', ['SU-N-1001'], { premium: '100', description: 'Raise limit', 'sum-insured': '9m' }), /Outside the binder/);
  const cx = await call('cancel', ['SU-N-1004'], { on: inDays(0) });
  assert(cx.refund_cents > 0 && cx.refund_cents < 600000);
  await assert.rejects(() => call('cancel', ['SU-N-1004']), /cancelled/);
  const rn = await call('renew', ['SU-A-2008']);
  assert.equal(rn.status, 'quoted');
  const rnBound = await call('bind', [rn.number]);
  assert.equal((await db.query("select status from policies where number = 'SU-A-2008'"))[0].status, 'renewed');
  assert.equal((await call('policy', [rnBound.policy])).transactions[0].kind, 'renewal');

  // s58: the notice clears the check; a policy not renewing still needs one
  await call('notice', ['SU-A-2007']);
  await call('not-renewing', ['SU-A-2010'], { reason: 'Insured moving to another agency' });
  const r1 = await rules();
  assert.equal(count(r1, 'ICA-S58'), 0, 'notice sent for 2007, 2008 renewed');
  assert((await call('renewals')).find((r) => r.number === 'SU-A-2010').not_renewing === true);

  // Money: collect from the broker, remit to the insurer, send the bordereau
  await call('collect', ['SU-N-1004']);
  await assert.rejects(() => call('collect', ['SU-N-1004']), /Nothing uncollected/);
  const overdue = (await call('remittance')).find((r) => r.state === 'OVERDUE');
  const paid = await call('remit', ['SU-IRB-26'], { month: overdue.month });
  assert.equal(paid.net_remitted_cents, Number(overdue.unremitted_cents));
  assert.equal(count(await rules(), 'REMITTANCE'), 0);
  await call('submit-bordereau', ['irb'], { month: twoAgo });
  for (const b of (await call('bordereaux')).filter((x) => !x.submitted_on && x.state.startsWith('LATE'))) await call('submit-bordereau', [b.binder], { month: b.month });
  assert.equal(count(await rules(), 'BORDEREAU'), 0);

  // A replacement binder clears the renewal check
  await call('add-binder', [], { insurer: 'Ironbark Insurance Ltd', reference: 'SU-IRB-27', name: 'AU management liability binder 2027', classes: 'management-liability,home-buildings',
    starts: inDays(40), ends: inDays(405), country: 'AU', cap: '400k', 'max-sum-insured': '10m', commission: '25' });
  await call('add-product', ['SU-IRB-27'], { name: 'Management Liability 2027', class: 'management-liability', rate: '3.9', 'min-premium': '1500' });
  assert.equal(count(await rules(), 'BINDER-RENEWAL'), 0);

  // Claims and complaints
  const cl = await call('add-claim', ['SU-A-2004'], { description: 'Employee alleges underpayment', reserve: '30000', 'loss-date': inDays(-10), handler: 'Sarah' });
  await assert.rejects(() => call('add-claim', ['SU-A-2004'], { description: 'Old matter', 'loss-date': '2020-01-01' }), /outside the policy period/);
  await call('update-claim', [cl.number], { responded: true });
  await call('update-claim', ['CL-3001'], { decision: 'accepted', reserve: '60000', paid: '25000' });
  await call('update-claim', ['CL-3002'], { responded: inDays(0) });
  const r2 = await rules();
  assert.equal(count(r2, 'CODE-CLAIM-DECISION'), 0);
  assert.equal(count(r2, 'CODE-CLAIM-RESPONSE'), 0);
  await call('update-claim', ['CL-3004'], { close: true });
  await assert.rejects(() => call('update-claim', ['CL-3003']), /Nothing to change/);
  const cp = await call('add-complaint', ['Wattle'], { summary: 'Slow claim acknowledgement', policy: 'SU-A-2004' });
  const open = (await call('complaints')).find((c) => c.insured === 'Dimitri Papadopoulos');
  await call('respond', [open.id], { outcome: 'Explained the rating change and offered a higher excess option' });
  await call('respond', [cp.id.slice(0, 8)], { outcome: 'Apologised; claim acknowledged' });
  assert.equal(count(await rules(), 'RG271-IDR'), 0);
  await call('log', ['SU-N-1002'], { note: 'Kahu asked for the latest accounts', actor: 'Underwriter' });
  assert((await call('history', ['SU-N-1002'])).some((h) => h.detail === 'Kahu asked for the latest accounts'));

  // Dry run changes nothing
  const before = (await call('insureds')).length;
  await call('add-insured', [], { name: 'Nobody Ltd', 'dry-run': true });
  assert.equal((await call('insureds')).length, before);

  // Import a policy list: new rows, then the same file again changes nothing
  const file = path.join(REPO_ROOT, 'examples', 'insly-policies.csv');
  const imp = await call('import', ['insly'], { policies: file, actor: 'test' });
  assert.equal(imp.policies, 3);
  assert.equal(imp.insureds, 3);
  assert.equal(imp.brokers, 0, 'Riverside was added above');
  assert.deepEqual(imp.products_not_matched, ['Marine Cargo']);
  const again = await call('import', ['insly'], { policies: file });
  assert.equal(again.policies + again.transactions, 0);
  assert.equal(again.unchanged, 3);
  assert.equal((await call('imports')).length, 2);
  const pk = await call('policy', ['INS-50021']);
  assert.equal(Number(pk.transactions[0].tax_cents), 32250, 'tax taken from the file');
  assert.equal(pk.policy.binder, 'SU-KAHU-26');

  const ex = await call('export', [], { out: path.join(temp, 'export.json') });
  assert(ex.records > 100);
  assert.equal(JSON.parse(fs.readFileSync(ex.file, 'utf8')).format, 1);

  // Every command ran
  const missing = Object.keys(usage).filter((c) => !seen.has(c));
  assert.deepEqual(missing, [], `commands not exercised: ${missing.join(', ')}`);
  assert(human(await call('capacity')).includes('$'));
} finally {
  if (db) await db.close();
}

// Paperwork and views render from the same database
const env = { ...process.env };
for (const script of ['docs', 'view']) {
  const res = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', `${script}.mjs`)], { env, encoding: 'utf8' });
  assert.equal(res.status, 0, `${script} failed: ${res.stderr}`);
}
const docs = fs.readdirSync(path.join(temp, 'docs-out'));
for (const d of JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'documents.json'), 'utf8'))) {
  assert(docs.includes(d.name) && fs.readdirSync(path.join(temp, 'docs-out', d.name)).length, `${d.name} rendered`);
}
assert(fs.readdirSync(path.join(temp, 'views')).includes('week.html'));
const dir = path.join(temp, 'docs-out', 'policy-schedule');
const schedule = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.startsWith('su-a-2001'))), 'utf8');
assert(schedule.includes('Coastal Freight'), 'the schedule carries the policy data');

fs.rmSync(temp, { recursive: true, force: true });
console.log(`PASS: ${Object.keys(usage).length} commands, demo agency, binder and legal checks, Insly import, documents and views`);
