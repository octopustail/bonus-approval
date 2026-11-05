import assert from 'node:assert/strict';
import * as L from '../js/logic.js';

const T0 = Date.parse('2026-11-05T02:00:00Z'); // 北京时间 11-05 10:00
const card = (o = {}) => ({ id: 'c1', days: 7, freq_type: 'daily', freq_n: 7, extra: 0, created_at: T0, ...o });
const ck = (date, o = {}) => ({ id: 'k-' + date + (o.attempt || 1), date, attempt: 1, created_at: Date.parse(date + 'T02:00:00Z'), ...o });
const stamp = (k, kind = 'stamp', user = 'u1') => ({ checkin_id: k.id, kind, user_id: user });
const days = n => Array.from({ length: n }, (_, i) => L.addDays('2026-11-05', i));

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('格子数：每天 = 天数；每周 = 次数 × 周数（不超过天数）', () => {
  assert.equal(L.targetOf(card()), 7);
  assert.equal(L.targetOf(card({ freq_type: 'weekly', freq_n: 3, days: 14 })), 6);
  assert.equal(L.targetOf(card({ freq_type: 'weekly', freq_n: 6, days: 7, extra: 2 })), 7);
});

test('发卡当天开始，不用等审批', () => {
  const s = L.summarize(card(), [], [], T0);
  assert.equal(s.win.start, '2026-11-05'); assert.equal(s.phase, 'active'); assert.equal(s.canCheckin, true);
});

test('盖戳：没人盖 24 小时内等待，之后默认戳', () => {
  const k = ck('2026-11-05');
  assert.equal(L.checkinResult(k, [], k.created_at + 23 * L.HOUR).status, 'pending');
  const r = L.checkinResult(k, [], k.created_at + 24 * L.HOUR);
  assert.equal(r.status, 'stamped'); assert.equal(r.auto, true);
});

test('盖戳：多数决，平票算盖上', () => {
  const k = ck('2026-11-05');
  assert.equal(L.checkinResult(k, [stamp(k), stamp(k, 'nope', 'u2')], T0).status, 'stamped');
  assert.equal(L.checkinResult(k, [stamp(k, 'nope'), stamp(k, 'nope', 'u2'), stamp(k, 'stamp', 'u3')], T0).status, 'nope');
});

test('"这不算"当天能补交一次，第二次还不算就结束', () => {
  const k1 = ck('2026-11-05');
  let s = L.summarize(card(), [k1], [stamp(k1, 'nope')], T0 + L.HOUR);
  assert.equal(s.todayState, 'nope'); assert.equal(s.canCheckin, true); assert.equal(s.attempt, 2);
  const k2 = ck('2026-11-05', { attempt: 2, created_at: T0 + 2 * L.HOUR });
  s = L.summarize(card(), [k1, k2], [stamp(k1, 'nope'), stamp(k2, 'nope')], T0 + 3 * L.HOUR);
  assert.equal(s.todayState, 'nope-final'); assert.equal(s.canCheckin, false);
});

test('集满：每天模式 7 天全盖上', () => {
  const ks = days(7).map(d => ck(d));
  const s = L.summarize(card(), ks, ks.map(k => stamp(k)), T0 + 8 * L.DAY);
  assert.equal(s.phase, 'ended'); assert.equal(s.full, true); assert.equal(s.count, 7);
});

test('每周模式可以提前集满，超额照样记', () => {
  const c = card({ freq_type: 'weekly', freq_n: 3 });
  const ks = days(5).map(d => ck(d));
  const s = L.summarize(c, ks, ks.map(k => stamp(k)), T0 + 4 * L.DAY + L.HOUR);
  assert.equal(s.phase, 'active'); assert.equal(s.full, true); assert.equal(s.extra, 2);
});

test('结束时还在等的打卡算盖上；没集满显示差几个', () => {
  const ks = days(5).map(d => ck(d));
  const s = L.summarize(card(), ks, [], T0 + 7 * L.DAY + 23 * L.HOUR);
  assert.equal(s.phase, 'ended'); assert.equal(s.count, 5); assert.equal(s.missing, 2); assert.equal(s.full, false);
});

test('加 2 格：每天模式延长 2 天，每周模式目标 +2', () => {
  assert.deepEqual(L.applyRaise(card()), { days: 9 });
  assert.deepEqual(L.applyRaise(card({ freq_type: 'weekly', freq_n: 3, days: 14 })), { extra: 2 });
  assert.equal(L.canRaise(card({ freq_type: 'weekly', freq_n: 3, days: 7 })), true);
  assert.equal(L.canRaise(card({ freq_type: 'weekly', freq_n: 6, days: 7 })), false);
});

test('别人盖过也能再叠一个戳，24 小时后就不能盖了', () => {
  const k = ck('2026-11-05');
  const st = [stamp(k, 'stamp', 'u1')];
  const s = L.summarize(card(), [k], st, k.created_at + L.HOUR);
  assert.equal(L.canStampOn('u2', k, s, st, k.created_at + L.HOUR), true);
  assert.equal(L.canStampOn('u1', k, s, st, k.created_at + L.HOUR), false);
  assert.equal(L.canStampOn('u2', k, s, st, k.created_at + 25 * L.HOUR), false);
});

test('撕卡 = 立即结束', () => {
  const s = L.summarize(card({ abandoned_at: T0 + L.HOUR }), [], [], T0 + L.HOUR);
  assert.equal(s.phase, 'ended'); assert.equal(s.full, false);
});

test('专属戳：1–2 个字，挡掉符号和脏字', () => {
  assert.equal(L.validCustomStamp('猛').ok, true);
  assert.equal(L.validCustomStamp('好家伙').ok, false);
  assert.equal(L.validCustomStamp('<b').ok, false);
  assert.equal(L.validCustomStamp('傻').ok, false);
});

console.log(`\n${n} tests passed`);
