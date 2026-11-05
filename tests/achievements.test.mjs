import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as A from '../js/achievements.js';

const BJ = (date, hm) => Date.parse(`${date}T${hm}:00+08:00`);
const card = (o = {}) => ({ id: 'c1', days: 7, freq_type: 'daily', freq_n: 7, extra: 0, created_at: BJ('2026-11-05', '09:00'), ...o });
const ck = (id, date, hm, o = {}) => ({ id, date, attempt: 1, created_at: BJ(date, hm), ...o });
const st = (k, user = 'b1', o = {}) => ({ id: 's' + k.id + user, checkin_id: k.id, kind: 'stamp', text: '绝了', user_id: user, created_at: k.created_at + 60 * 1000, ...o });
const NOW = BJ('2026-11-08', '12:00');
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('开张、连续三天、早八、卡点、修仙', () => {
  const ks = [ck('a', '2026-11-05', '07:30'), ck('b', '2026-11-06', '23:55'), ck('c', '2026-11-07', '03:10')];
  const got = A.computeAchievements('me', [{ card: card(), checkins: ks, stamps: ks.map(k => st(k)), raises: [] }], [], NOW);
  for (const k of ['kaizhang', 'santian', 'zaoba', 'kadian', 'xiuxian']) assert.ok(got.has(k), k);
  assert.ok(!got.has('toutie'));
});

test('头铁：补交后盖上', () => {
  const k1 = ck('a', '2026-11-05', '10:00'), k2 = ck('b', '2026-11-05', '11:00', { attempt: 2 });
  const got = A.computeAchievements('me', [{ card: card(), checkins: [k1, k2], stamps: [st(k1, 'b1', { kind: 'nope' }), st(k2)], raises: [] }], [], NOW);
  assert.ok(got.has('toutie'));
});

test('卷王：每周模式多集一半以上', () => {
  const c = card({ freq_type: 'weekly', freq_n: 2, days: 7 });
  const ks = ['05', '06', '07'].map(d => ck(d, `2026-11-${d}`, '10:00'));
  const got = A.computeAchievements('me', [{ card: c, checkins: ks, stamps: ks.map(k => st(k)), raises: [] }], [], NOW);
  assert.ok(got.has('juanwang'));
});

test('一把过 / 越加越勇 / 打卡机', () => {
  const once = card({ id: 'o', freq_type: 'once', days: 30 });
  const k = ck('x', '2026-11-06', '10:00');
  let got = A.computeAchievements('me', [{ card: once, checkins: [k], stamps: [st(k)], raises: [] }], [], NOW);
  assert.ok(got.has('yibaguo'));
  const c14 = card({ days: 14, created_at: BJ('2026-10-20', '09:00') });
  const ks = Array.from({ length: 14 }, (_, i) => ck('d' + i, L.addDays('2026-10-20', i), '10:00'));
  got = A.computeAchievements('me', [{ card: c14, checkins: ks, stamps: ks.map(x => st(x)), raises: [{ status: 'accepted' }] }], [], NOW);
  assert.ok(got.has('dakaji')); assert.ok(got.has('yuejia'));
});

test('搭子：秒回、铁面判官、唯一见证人、猫猫教', () => {
  const ks = ['05', '06', '07'].map(d => ck(d, `2026-11-${d}`, '10:00'));
  const c = card({ freq_type: 'weekly', freq_n: 3, days: 7 });
  const stamps = ks.map(k => st(k, 'me', { text: '@an:cat' }));
  let got = A.computeAchievements('me', [], [{ card: c, checkins: ks, stamps, raises: [] }], NOW);
  assert.ok(got.has('miaohui')); assert.ok(got.has('jianzheng')); assert.ok(!got.has('maomao'));
  const more = Array.from({ length: 5 }, (_, i) => ck('n' + i, '2026-11-05', '10:00'));
  got = A.computeAchievements('me', [], [{ card: card({ id: 'c2' }), checkins: more, stamps: more.map(k => st(k, 'me', { kind: 'nope', created_at: k.created_at + 3600e3 })), raises: [] }], NOW);
  assert.ok(got.has('tiemian')); assert.ok(!got.has('miaohui'));
});

test('连戳：到今天或昨天为止的连续天数', () => {
  const ks = ['06', '07', '08'].map(d => ck(d, `2026-11-${d}`, '10:00'));
  assert.equal(A.streakOf([{ card: card(), checkins: ks, stamps: ks.map(k => st(k)) }], NOW), 3);
  assert.equal(A.streakOf([{ card: card(), checkins: ks.slice(0, 2), stamps: ks.slice(0, 2).map(k => st(k)) }], NOW), 2);
  assert.equal(A.streakOf([{ card: card(), checkins: ks.slice(0, 1), stamps: [st(ks[0])] }], NOW), 0);
  assert.equal(A.streakTitle(8), '小有坚持');
});

test('咕了几天：每天模式里没打卡的日子', () => {
  const ks = [ck('a', '2026-11-05', '10:00'), ck('b', '2026-11-07', '10:00')];
  assert.equal(A.guDays(card(), ks, NOW), 1);
  assert.equal(A.guDays(card({ freq_type: 'weekly', freq_n: 3 }), ks, NOW), 0);
});

console.log(`\n${n} tests passed`);
