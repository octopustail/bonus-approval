import assert from 'node:assert/strict';
import * as L from '../js/logic.js';

const T0 = Date.parse('2026-11-05T02:00:00Z'); // 北京时间 11-05 10:00
const ch = (o = {}) => ({ id: 'c1', days: 7, freq_type: 'daily', freq_n: 7, submitted_at: T0, ...o });
const rv = (o) => ({ id: Math.random().toString(36), target_type: 'challenge', ...o });

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('bjDate 跨日', () => {
  assert.equal(L.bjDate(Date.parse('2026-11-05T16:30:00Z')), '2026-11-06');
  assert.equal(L.addDays('2026-11-30', 1), '2026-12-01');
});

test('立项：无人审批 48 小时内为 pending，之后自动通过', () => {
  assert.equal(L.challengeApproval(ch(), [], T0 + 47 * L.HOUR).state, 'pending');
  const a = L.challengeApproval(ch(), [], T0 + 48 * L.HOUR);
  assert.equal(a.state, 'approved'); assert.equal(a.auto, true);
});

test('立项：任意一人通过即通过；最新为驳回则驳回', () => {
  const a = L.challengeApproval(ch(), [rv({ result: 'reject', created_at: T0 + 1 }), rv({ result: 'pass', created_at: T0 + 2 })], T0 + 3);
  assert.equal(a.state, 'approved');
  const b = L.challengeApproval(ch(), [rv({ result: 'reject', created_at: T0 + 1 })], T0 + 49 * L.HOUR);
  assert.equal(b.state, 'rejected');
});

test('立项：重新提交后旧审批作废', () => {
  const c = ch({ submitted_at: T0 + 100 });
  assert.equal(L.challengeApproval(c, [rv({ result: 'reject', created_at: T0 + 1 })], T0 + 200).state, 'pending');
});

test('立项：接受加码视为通过', () => {
  const a = L.challengeApproval(ch({ raise_accepted_at: T0 + 10 }), [rv({ result: 'raise', created_at: T0 + 5, raise_days: 14 })], T0 + 20);
  assert.equal(a.state, 'approved'); assert.equal(a.approvedAt, T0 + 10);
});

test('日报：多数票，平票通过，24 小时自动通过', () => {
  const ck = { id: 'k1', created_at: T0 };
  const r = (res) => ({ target_type: 'checkin', target_id: 'k1', result: res });
  assert.equal(L.checkinStatus(ck, [], T0 + L.HOUR).status, 'pending');
  assert.equal(L.checkinStatus(ck, [], T0 + 24 * L.HOUR).status, 'pass');
  assert.equal(L.checkinStatus(ck, [r('pass'), r('reject')], T0).status, 'pass');
  assert.equal(L.checkinStatus(ck, [r('reject'), r('reject'), r('pass')], T0).status, 'reject');
});

function run(c, dates, now, extraReviews = []) {
  const reviews = [rv({ result: 'pass', created_at: T0 }), ...extraReviews];
  const checkins = dates.map((d, i) => ({ id: 'k' + i, date: d, attempt: 1, created_at: T0 }));
  return L.summarize(c, reviews, checkins, now);
}
const dates = (start, idx) => idx.map(i => L.addDays(start, i));
const END7 = T0 + 8 * L.DAY;

test('每天模式：全勤零驳回 = 卓越', () => {
  const s = run(ch(), dates('2026-11-05', [0, 1, 2, 3, 4, 5, 6]), END7);
  assert.equal(s.phase, 'ended'); assert.equal(s.comp.rate, 1); assert.equal(s.grade.name, '卓越');
});

test('每天模式：6/7 = 符合预期，5/7 = 需改进', () => {
  assert.equal(run(ch(), dates('2026-11-05', [0, 1, 2, 3, 4, 5]), END7).grade.name, '符合预期');
  assert.equal(run(ch(), dates('2026-11-05', [0, 1, 2, 3, 4]), END7).grade.name, '需改进');
});

test('每周 3 次：多打的卡计入，可超过 100%', () => {
  const s = run(ch({ freq_type: 'weekly', freq_n: 3 }), dates('2026-11-05', [0, 1, 2, 3]), END7);
  assert.equal(s.comp.done, 4); assert.equal(L.rateText(s.comp.rate), '133%'); assert.equal(s.grade.name, '卓越');
});

test('每周模式：某周断档时，其他周超额不计入', () => {
  const c = ch({ days: 14, freq_type: 'weekly', freq_n: 3 });
  const s = run(c, dates('2026-11-05', [7, 8, 9, 10, 11, 12, 13]), T0 + 15 * L.DAY);
  assert.equal(s.comp.capped, true); assert.equal(s.comp.done, 3); assert.equal(L.rateText(s.comp.rate), '50%');
});

test('主动放弃 = 毕业', () => {
  const s = run(ch({ abandoned_at: T0 + L.DAY }), dates('2026-11-05', [0]), T0 + L.DAY);
  assert.equal(s.phase, 'ended'); assert.equal(s.grade.name, '毕业');
});

test('当天被驳回可重交一次；第二次仍被驳回记为未完成', () => {
  const c = ch();
  const reviews = [rv({ result: 'pass', created_at: T0 }),
    { target_type: 'checkin', target_id: 'a1', result: 'reject' }];
  const ck1 = [{ id: 'a1', date: '2026-11-05', attempt: 1, created_at: T0 }];
  let s = L.summarize(c, reviews, ck1, T0 + L.HOUR);
  assert.equal(s.todayStatus.status, 'rejected');
  assert.deepEqual(L.canSubmitToday(s), { ok: true, attempt: 2 });
  const ck2 = [...ck1, { id: 'a2', date: '2026-11-05', attempt: 2, created_at: T0 + 2 * L.HOUR }];
  reviews.push({ target_type: 'checkin', target_id: 'a2', result: 'reject' });
  s = L.summarize(c, reviews, ck2, T0 + 3 * L.HOUR);
  assert.equal(s.todayStatus.status, 'missed');
  assert.equal(L.canSubmitToday(s).ok, false);
});

console.log(`\n${n} tests passed`);
