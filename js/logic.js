// 集个戳戳 · 规则（纯函数，H5 与小程序共用）
// 时间戳为毫秒；日期为北京时间 YYYY-MM-DD 字符串。

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;
export const AUTO_STAMP_MS = 24 * HOUR; // 打卡 24 小时没人盖戳，系统补一个默认戳
export const RAISE_SLOTS = 2;            // 搭子"加 2 格"
export const MAX_DAYS = 60;

export const SYSTEM_STAMPS = [
  { key: 'juele', text: '绝了', color: '#E8434F' },
  { key: 'keyi', text: '可以', color: '#3E5BF2' },
  { key: 'niu', text: '牛', color: '#17A673' },
  { key: 'chong', text: '冲', color: '#9B4DE0' },
  { key: 'wen', text: '稳', color: '#E07A00' },
];
export const AUTO_STAMP = { key: 'auto', text: '默认', color: '#A3ADB2' };
export const CUSTOM_COLORS = ['#E8434F', '#3E5BF2', '#17A673', '#9B4DE0', '#E07A00', '#0E8BC0', '#D6336C'];

export const TEMPLATES = [
  { key: 'sport', icon: '🏃', name: '运动', goal: '每天运动 30 分钟', proof: '运动截图或自拍' },
  { key: 'words', icon: '📖', name: '背单词', goal: '每天背 30 个单词', proof: '背单词 App 截图' },
  { key: 'sleep', icon: '🌙', name: '早睡', goal: '12 点前上床', proof: '睡前截图，带上时间' },
  { key: 'custom', icon: '✏️', name: '自定义', goal: '', proof: '能证明你做到了的照片' },
];
export const DAILY_PERIODS = [7, 14, 21, 30];
export const WEEKLY_PERIODS = [7, 14, 21, 28];

// 自定义戳：1–2 个字，不能是空白或符号；更严格的审核在小程序里走微信内容安全接口
const BLOCK = ['傻', '逼', '死', '滚', '操', '妈的', '贱', '屎'];
export function validCustomStamp(text) {
  const t = String(text || '').trim();
  const chars = [...t];
  if (chars.length < 1 || chars.length > 2) return { ok: false, msg: '专属戳写 1–2 个字' };
  if (/[\s<>"'&]/.test(t)) return { ok: false, msg: '专属戳不能有空格或符号' };
  if (BLOCK.some(w => t.includes(w))) return { ok: false, msg: '换个友善点的字吧' };
  return { ok: true, text: t };
}

// ---------- 日期 ----------
export function bjDate(ts) { return new Date(ts + 8 * HOUR).toISOString().slice(0, 10); }
export function addDays(dateStr, n) { return new Date(Date.parse(dateStr + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
export function diffDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY); }
export function fmtDate(d) { const [, m, dd] = d.split('-'); return `${Number(m)}月${Number(dd)}日`; }

// ---------- 卡片 ----------
export function targetOf(card) {
  if (card.freq_type === 'daily') return card.days;
  const weeks = Math.ceil(card.days / 7);
  return Math.min(card.freq_n * weeks + (card.extra || 0), card.days);
}
export function windowOf(card) {
  const start = bjDate(card.created_at);
  return { start, end: addDays(start, card.days - 1) };
}
export function rhythmText(card) {
  return card.freq_type === 'daily' ? `每天 · ${card.days} 天` : `每周 ${card.freq_n} 次 · ${card.days} 天`;
}
// 加 2 格：每天模式延长 2 天；每周模式目标 +2（不超过天数）
export function applyRaise(card) {
  if (card.freq_type === 'daily') return { days: Math.min(card.days + RAISE_SLOTS, MAX_DAYS) };
  return { extra: (card.extra || 0) + RAISE_SLOTS };
}
export function canRaise(card) {
  if (card.freq_type === 'daily') return card.days + RAISE_SLOTS <= MAX_DAYS;
  return targetOf(card) + RAISE_SLOTS <= card.days;
}

// ---------- 盖戳结果 ----------
// 'stamped' | 'pending' | 'nope'；没人盖满 24 小时 = 默认戳
export function checkinResult(ck, stamps, now, { settle = false } = {}) {
  const mine = stamps.filter(s => s.checkin_id === ck.id);
  const yes = mine.filter(s => s.kind === 'stamp').length;
  const no = mine.filter(s => s.kind === 'nope').length;
  if (yes + no === 0) {
    if (settle || now - ck.created_at >= AUTO_STAMP_MS) return { status: 'stamped', auto: true, yes, no };
    return { status: 'pending', auto: false, yes, no };
  }
  return { status: no > yes ? 'nope' : 'stamped', auto: false, yes, no };
}

export function summarize(card, checkins, stamps, now) {
  const win = windowOf(card);
  const today = bjDate(now);
  const ended = !!card.abandoned_at || today > win.end;
  const target = targetOf(card);
  const results = new Map(checkins.map(k => [k.id, checkinResult(k, stamps, now, { settle: ended })]));
  const byTime = [...checkins].sort((a, b) => a.created_at - b.created_at);
  const stamped = byTime.filter(k => results.get(k.id).status === 'stamped');
  const pending = byTime.filter(k => results.get(k.id).status === 'pending');
  const count = stamped.length;

  const todays = byTime.filter(k => k.date === today);
  const last = todays[todays.length - 1];
  let todayState = 'none';
  if (last) {
    const st = results.get(last.id).status;
    todayState = st === 'nope' ? (todays.length < 2 ? 'nope' : 'nope-final') : st;
  }
  const active = !ended;
  const canCheckin = active && (todayState === 'none' || todayState === 'nope');
  const attempt = todayState === 'nope' ? 2 : 1;
  const dayIndex = Math.min(Math.max(diffDays(win.start, today) + 1, 1), card.days);
  const daysLeft = active ? diffDays(today, win.end) + 1 : 0;

  return {
    win, today, phase: ended ? 'ended' : 'active', target, count, results,
    stamped, pending,
    full: count >= target,
    extra: Math.max(0, count - target),
    missing: Math.max(0, target - count),
    todayState, canCheckin, attempt, dayIndex, daysLeft,
  };
}

// 搭子还能盖的打卡：打卡后 24 小时内、卡没结束、自己还没盖过（别人盖过也能再叠一个）
export function canStampOn(userId, ck, summary, stamps, now) {
  return summary.phase === 'active' && now - ck.created_at < AUTO_STAMP_MS
    && !stamps.some(s => s.checkin_id === ck.id && s.user_id === userId);
}
export function waitingFor(userId, summary, checkins, stamps, now) {
  return checkins.filter(k => canStampOn(userId, k, summary, stamps, now)).sort((a, b) => a.created_at - b.created_at);
}

export function serialFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
// 每个戳的倾斜角度固定（同一个戳每次渲染都一样）
export function tiltFor(id) { return (serialFor(id) % 31) - 15; }
export function customColorFor(userId) { return CUSTOM_COLORS[serialFor(userId) % CUSTOM_COLORS.length]; }
