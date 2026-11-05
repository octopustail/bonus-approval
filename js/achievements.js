// 成就、连戳、动物解锁 —— 全部从已有数据推算，不需要额外的数据库表
import * as L from './logic.js';

export const RARITY = {
  common: { name: '普通', color: '#17A673' },
  rare: { name: '稀有', color: '#3E5BF2' },
  legend: { name: '传说', color: '#C99A00' },
};

// glyph = 徽章中间的大字（站酷快乐体）
export const ACHIEVEMENTS = [
  { key: 'kaizhang', glyph: '开', name: '开张大吉', rarity: 'common', who: 'owner', rule: '第一次被盖上戳', desc: '万事开头难，你已经过了最难的。' },
  { key: 'santian', glyph: '三', name: '三天打鱼？不存在的', rarity: 'common', who: 'owner', rule: '同一张卡连续 3 天盖上戳', desc: '打破了人类最古老的诅咒。' },
  { key: 'zaoba', glyph: '早', name: '早八战神', rarity: 'rare', who: 'owner', rule: '早上 5 点到 8 点之间打卡', desc: '别人在挣扎，你已经交了。' },
  { key: 'kadian', glyph: '卡', name: '卡点大师', rarity: 'rare', who: 'owner', rule: '晚上 23:50 以后才打卡', desc: '不早不晚，刚刚好。' },
  { key: 'toutie', glyph: '头', name: '头铁', rarity: 'common', who: 'owner', rule: '被"这不算"后补交，又盖上了', desc: '驳回？那就再来一次。' },
  { key: 'juanwang', glyph: '卷', name: '卷王驾到', rarity: 'rare', who: 'owner', rule: '多集的戳超过目标的一半', desc: '目标只是参考。' },
  { key: 'yibaguo', glyph: '一', name: '一把过', rarity: 'rare', who: 'owner', rule: '一次完成卡，第一次提交就盖上', desc: '没有彩排，直接上线。' },
  { key: 'dakaji', glyph: '机', name: '人形自走打卡机', rarity: 'legend', who: 'owner', rule: '每天一次、14 天以上的卡集满', desc: '你可能不是人类。' },
  { key: 'yuejia', glyph: '勇', name: '越加越勇', rarity: 'legend', who: 'owner', rule: '被搭子加码后，依然集满', desc: '加码？谢谢，正好不够。' },
  { key: 'miaohui', glyph: '秒', name: '秒回之神', rarity: 'rare', who: 'buddy', rule: '打卡后 5 分钟内盖戳', desc: '你是不是一直盯着手机？' },
  { key: 'tiemian', glyph: '判', name: '铁面判官', rarity: 'common', who: 'buddy', rule: '盖过 3 次"这不算"', desc: '朋友归朋友，规矩归规矩。' },
  { key: 'yinzhangji', glyph: '章', name: '人形印章机', rarity: 'legend', who: 'buddy', rule: '累计盖戳 50 次', desc: '你盖的不是戳，是友情。' },
  { key: 'jianzheng', glyph: '证', name: '唯一见证人', rarity: 'legend', who: 'buddy', rule: '一张集满的卡，每个戳都是你盖的', desc: 'Ta 的每一天，你都在。' },
  { key: 'xiuxian', glyph: '仙', name: '修仙', rarity: 'rare', who: 'owner', hidden: true, hint: '提示：深夜', rule: '凌晨 2 点到 5 点之间打卡', desc: '凌晨还在打卡的人，已经不需要睡觉了。' },
  { key: 'maomao', glyph: '猫', name: '猫猫教信徒', rarity: 'rare', who: 'buddy', hidden: true, hint: '提示：和猫有关', rule: '用猫爪或爪爪盖了 5 次戳', desc: '吸猫使人快乐，盖猫爪也是。' },
];

const bjHourMin = ts => { const d = new Date(ts + 8 * L.HOUR); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

// owned / buddying：store.listMine 的结果（每项 {card, checkins, stamps, raises, buddies}）
// 返回 Map(key → 解锁时间戳)
export function computeAchievements(userId, owned, buddying, now) {
  const got = new Map();
  const give = (key, at) => { if (!got.has(key) || at < got.get(key)) got.set(key, at); };

  for (const p of owned) {
    const s = L.summarize(p.card, p.checkins, p.stamps, now);
    const stamped = s.stamped;
    if (stamped.length) give('kaizhang', stamped[0].created_at);
    // 连续 3 天
    const days = [...new Set(stamped.map(k => k.date))].sort();
    for (let i = 2; i < days.length; i++) {
      if (L.diffDays(days[i - 2], days[i]) === 2) { give('santian', stamped.find(k => k.date === days[i]).created_at); break; }
    }
    for (const k of stamped) {
      const hm = bjHourMin(k.created_at);
      if (hm >= 5 * 60 && hm < 8 * 60) give('zaoba', k.created_at);
      if (hm >= 23 * 60 + 50) give('kadian', k.created_at);
      if (hm >= 2 * 60 && hm < 5 * 60) give('xiuxian', k.created_at);
      if (k.attempt === 2) give('toutie', k.created_at);
    }
    const lastAt = stamped.length ? stamped[stamped.length - 1].created_at : now;
    if (s.target >= 2 && s.extra * 2 >= s.target) give('juanwang', lastAt);
    if (p.card.freq_type === 'once') {
      const first = [...p.checkins].sort((a, b) => a.created_at - b.created_at)[0];
      if (first && first.attempt === 1 && s.results.get(first.id).status === 'stamped') give('yibaguo', first.created_at);
    }
    if (p.card.freq_type === 'daily' && p.card.days >= 14 && s.full) give('dakaji', lastAt);
    if ((p.raises || []).some(r => r.status === 'accepted') && s.full) give('yuejia', lastAt);
  }

  const mine = [];
  for (const p of buddying) {
    const s = L.summarize(p.card, p.checkins, p.stamps, now);
    const myStamps = p.stamps.filter(x => x.user_id === userId);
    mine.push(...myStamps);
    for (const st of myStamps) {
      const k = p.checkins.find(c => c.id === st.checkin_id);
      if (k && st.created_at - k.created_at <= 5 * 60 * 1000) give('miaohui', st.created_at);
    }
    if (s.full && s.stamped.length >= 3 && s.stamped.every(k => {
      const ss = p.stamps.filter(x => x.checkin_id === k.id && x.kind === 'stamp');
      return ss.length && ss.every(x => x.user_id === userId);
    })) give('jianzheng', Math.max(...myStamps.map(x => x.created_at)));
  }
  const nopes = mine.filter(x => x.kind === 'nope').sort((a, b) => a.created_at - b.created_at);
  if (nopes.length >= 3) give('tiemian', nopes[2].created_at);
  const yes = mine.filter(x => x.kind === 'stamp').sort((a, b) => a.created_at - b.created_at);
  if (yes.length >= 50) give('yinzhangji', yes[49].created_at);
  const cats = yes.filter(x => x.text === '@an:cat' || x.text === '@paw');
  if (cats.length >= 5) give('maomao', cats[4].created_at);
  return got;
}

// 连戳：自己的卡里，按北京时间每天至少有一次打卡被盖上，连续的天数（截止到今天或昨天）
export function streakOf(owned, now) {
  const days = new Set();
  for (const p of owned) {
    const s = L.summarize(p.card, p.checkins, p.stamps, now);
    for (const k of [...s.stamped, ...s.pending]) days.add(k.date);
  }
  let d = L.bjDate(now);
  if (!days.has(d)) d = L.addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = L.addDays(d, -1); }
  return n;
}
export const STREAK_TITLES = [[100, '百日筑基'], [30, '月度靠谱'], [7, '小有坚持'], [3, '开始上道']];
export function streakTitle(n) { const t = STREAK_TITLES.find(([d]) => n >= d); return t ? t[1] : ''; }

// 没打卡、也没被盖的日子（只算每天一次的卡，到昨天为止）
export function guDays(card, checkins, now) {
  if (card.freq_type !== 'daily') return 0;
  const win = L.windowOf(card);
  const today = L.bjDate(now);
  const end = today > win.end ? win.end : L.addDays(today, -1);
  const has = new Set(checkins.map(k => k.date));
  let n = 0;
  for (let d = win.start; d <= end; d = L.addDays(d, 1)) if (!has.has(d)) n++;
  return n;
}
