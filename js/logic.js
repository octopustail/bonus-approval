// 奖金请批准 · 共用业务逻辑（纯函数，H5 与小程序共用）
// 所有时间戳为毫秒；所有日期为北京时间 YYYY-MM-DD 字符串。

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;
export const CHALLENGE_AUTO_PASS_MS = 48 * HOUR; // 立项 48 小时无人审批自动通过
export const CHECKIN_AUTO_PASS_MS = 24 * HOUR;   // 日报 24 小时无人审批自动通过

export const REJECT_REASONS = ['颗粒度不够', '抓手在哪里', '没有形成闭环', '建议再对齐一下', '我看你是在摸鱼'];

export const DAILY_PERIODS = [7, 14, 21, 30];
export const WEEKLY_PERIODS = [7, 14, 21, 28];

// ---------- 日期 ----------
export function bjDate(ts) {
  return new Date(ts + 8 * HOUR).toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const t = Date.parse(dateStr + 'T00:00:00Z') + n * DAY;
  return new Date(t).toISOString().slice(0, 10);
}

export function diffDays(a, b) {
  // b - a，按天
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
}

export function fmtDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

// ---------- 立项审批 ----------
// 返回 { state: 'pending'|'approved'|'rejected', approvedAt, auto, raises, latestReject }
export function challengeApproval(ch, reviews, now) {
  const rs = reviews
    .filter(r => r.target_type === 'challenge' && r.created_at >= ch.submitted_at)
    .sort((a, b) => a.created_at - b.created_at);
  const passes = rs.filter(r => r.result === 'pass');
  const raises = rs.filter(r => r.result === 'raise');
  const rejects = rs.filter(r => r.result === 'reject');
  const candidates = [];
  if (passes.length) candidates.push({ at: passes[0].created_at, auto: false });
  if (ch.raise_accepted_at && ch.raise_accepted_at >= ch.submitted_at) candidates.push({ at: ch.raise_accepted_at, auto: false });
  if (candidates.length) {
    const first = candidates.sort((a, b) => a.at - b.at)[0];
    return { state: 'approved', approvedAt: first.at, auto: false, raises, latestReject: null };
  }
  const latest = rs[rs.length - 1];
  if (latest && latest.result === 'reject') {
    return { state: 'rejected', approvedAt: null, auto: false, raises, latestReject: latest };
  }
  if (now - ch.submitted_at >= CHALLENGE_AUTO_PASS_MS) {
    return { state: 'approved', approvedAt: ch.submitted_at + CHALLENGE_AUTO_PASS_MS, auto: true, raises, latestReject: null };
  }
  return { state: 'pending', approvedAt: null, auto: false, raises, latestReject: rejects[rejects.length - 1] || null };
}

// 原型阶段：审批通过当天即开始计周期
export function challengeWindow(ch, approval) {
  if (approval.state !== 'approved') return null;
  const start = bjDate(approval.approvedAt);
  const end = addDays(start, ch.days - 1);
  return { start, end };
}

// ---------- 日报审批 ----------
// 返回 { status: 'pending'|'pass'|'reject', auto, pass, reject }
export function checkinStatus(ck, reviews, now) {
  const rs = reviews.filter(r => r.target_type === 'checkin' && r.target_id === ck.id);
  const pass = rs.filter(r => r.result === 'pass').length;
  const reject = rs.filter(r => r.result === 'reject').length;
  if (pass + reject === 0) {
    if (now - ck.created_at >= CHECKIN_AUTO_PASS_MS) return { status: 'pass', auto: true, pass, reject };
    return { status: 'pending', auto: false, pass, reject };
  }
  return { status: reject > pass ? 'reject' : 'pass', auto: false, pass, reject };
}

// 每一天的状态：取当天最后一次提交
// 'done' | 'pending' | 'rejected'(当天还能重交) | 'missed' | 'today' | 'future' | 'rest'
export function dayStatuses(ch, win, checkins, reviews, now) {
  const today = bjDate(now);
  const out = [];
  for (let i = 0; i < ch.days; i++) {
    const date = addDays(win.start, i);
    const list = checkins.filter(c => c.date === date).sort((a, b) => a.attempt - b.attempt || a.created_at - b.created_at);
    const last = list[list.length - 1];
    let status;
    if (last) {
      const st = checkinStatus(last, reviews, now).status;
      if (st === 'pass') status = 'done';
      else if (st === 'pending') status = 'pending';
      else status = (date === today && list.length < 2) ? 'rejected' : 'missed';
    } else if (date === today) status = 'today';
    else if (date > today) status = 'future';
    else status = ch.freq_type === 'weekly' ? 'rest' : 'missed';
    out.push({ date, index: i, status, checkin: last || null, attempts: list.length });
  }
  return out;
}

// ---------- 完成率与评级 ----------
export const GRADES = [
  { key: 'excellent', min: 1.2, name: '卓越', tag: '破格晋升', bonus: true },
  { key: 'exceed', min: 1.0, name: '超出预期', tag: '', bonus: true },
  { key: 'meet', min: 0.8, name: '符合预期', tag: '', bonus: true },
  { key: 'improve', min: 0.5, name: '需改进', tag: '', bonus: false },
  { key: 'graduate', min: -Infinity, name: '毕业', tag: '', bonus: false },
];

export function gradeFor(effectiveRate, abandoned) {
  if (abandoned) return GRADES[GRADES.length - 1];
  return GRADES.find(g => effectiveRate >= g.min);
}

// pending 的日报在结算时视为通过（与 24 小时自动放行一致）
export function completion(ch, days, { settle = false } = {}) {
  const counts = d => d.status === 'done' || (settle && d.status === 'pending');
  const rejectCount = days.filter(d => d.status === 'missed' && d.checkin).length;
  if (ch.freq_type === 'daily') {
    const expected = ch.days;
    const done = days.filter(counts).length;
    const rate = done / expected;
    const perfect = done === expected && rejectCount === 0 && !days.some(d => d.attempts > 1);
    return { expected, done, rate, effectiveRate: perfect ? 1.2 : rate, perfect, capped: false };
  }
  const n = ch.freq_n;
  const weeks = Math.ceil(ch.days / 7);
  const perWeek = [];
  for (let w = 0; w < weeks; w++) {
    perWeek.push(days.slice(w * 7, w * 7 + 7).filter(counts).length);
  }
  const expected = n * weeks;
  const hasGap = perWeek.some(c => c === 0);
  const done = hasGap ? perWeek.reduce((s, c) => s + Math.min(c, n), 0) : perWeek.reduce((s, c) => s + c, 0);
  const rate = done / expected;
  return { expected, done, rate, effectiveRate: rate, perfect: false, capped: hasGap, perWeek };
}

// ---------- 汇总 ----------
// 一次性算出页面需要的全部状态
export function summarize(ch, reviews, checkins, now) {
  const approval = challengeApproval(ch, reviews, now);
  const win = challengeWindow(ch, approval);
  if (!win) return { approval, win: null, phase: approval.state };
  const days = dayStatuses(ch, win, checkins, reviews, now);
  const today = bjDate(now);
  const ended = !!ch.abandoned_at || today > win.end;
  const comp = completion(ch, days, { settle: ended });
  const grade = gradeFor(comp.effectiveRate, !!ch.abandoned_at);
  const dayIndex = Math.min(Math.max(diffDays(win.start, today) + 1, 1), ch.days);
  const todayStatus = days.find(d => d.date === today) || null;
  return {
    approval, win, days, comp, grade,
    phase: ended ? 'ended' : 'active',
    dayIndex, todayStatus,
  };
}

// 是否能提交今天的日报，以及第几次提交
export function canSubmitToday(summary) {
  if (!summary || summary.phase !== 'active' || !summary.todayStatus) return { ok: false };
  const t = summary.todayStatus;
  if (t.status === 'today') return { ok: true, attempt: 1 };
  if (t.status === 'rejected') return { ok: true, attempt: 2 };
  return { ok: false };
}

export function rateText(rate) {
  return Math.round(rate * 100) + '%';
}

export function krText(ch) {
  return ch.freq_type === 'daily' ? '每天打卡' : `每周打卡 ${ch.freq_n} 次`;
}

export function serialFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(h % 10000).padStart(4, '0');
}
