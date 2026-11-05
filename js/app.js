import * as L from './logic.js';
import { store, uid } from './store.js';
import { drawShareCard, drawAchievementCard } from './card.js';
import { stampSvg, stampLabel, stampColor, pigeonSvg, animalSvg, badgeSvg, parseCode, ZHUPI, GU, ANIMALS } from './art.js';
import { ACHIEVEMENTS, RARITY, computeAchievements, streakOf, streakTitle, guDays } from './achievements.js';

const $app = document.getElementById('app');
const DEMO = store.mode === 'local';

// ---------- 身份与时间 ----------
const ME_KEY = 'jgcc_me', USERS_KEY = 'jgcc_users', OFFSET_KEY = 'jgcc_offset_days';
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式下忽略 */ } }
let me = lsGet(ME_KEY, null);
function setMe(user) {
  me = user; lsSet(ME_KEY, user);
  const users = lsGet(USERS_KEY, []);
  if (!users.some(u => u.id === user.id)) { users.push(user); lsSet(USERS_KEY, users); }
}
function now() { return Date.now() + (DEMO ? lsGet(OFFSET_KEY, 0) * L.DAY : 0); }

// ---------- 小工具 ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
const linkTo = id => `${location.origin}${location.pathname}#/c/${id}`;
const AV = ['#E8434F', '#3E5BF2', '#17A673', '#9B4DE0', '#E07A00', '#0E8BC0'];
const avatar = (name, id) => `<span class="av" style="background:${AV[L.serialFor(id || name) % AV.length]}" aria-hidden="true">${esc(String(name).slice(-1))}</span>`;
const topbar = () => `<div class="top"><span class="logo-gu">${pigeonSvg('normal', '', 34)}</span>集个戳戳<a class="top-link" href="#/me">我的成就</a></div>`;
const rewardText = c => `${esc(c.reward_name)}${c.reward_amount ? ` ¥${esc(c.reward_amount)}` : ''}`;
const colsFor = n => (n <= 2 ? 3 : n <= 8 ? 4 : n <= 15 ? 5 : 6);
function fmtTime(ts) { const d = new Date(ts + 8 * L.HOUR).toISOString(); return `${L.fmtDate(d.slice(0, 10))} ${d.slice(11, 16)}`; }

function stampEl(s, cls = '') {
  return `<span class="stamp ${cls}" style="--r:${L.tiltFor(s.id || s.text)}deg" role="img" aria-label="${esc(stampLabel(s.text))}">${stampSvg(s.text, stampColor(s.text, s.color), s.user_name || '')}</span>`;
}
function stampsOf(k, stamps) { return stamps.filter(s => s.checkin_id === k.id && s.kind === 'stamp').sort((a, b) => a.created_at - b.created_at); }
function autoStamp(k) { return { id: 'auto-' + k.id, text: '@gu:auto', color: '#E8434F', user_name: '' }; }
const guBubble = (expr, prop, text, size = 64) => `<div class="gu-say">${pigeonSvg(expr, prop, size)}<p>${text}</p></div>`;

function showModal(html) {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  m.onclick = e => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; };
  return m;
}
function confetti() {
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#E8434F', '#3E5BF2', '#17A673', '#9B4DE0', '#FFE15C', '#E07A00'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * .6 + 's';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2800);
}
async function shareText(text, url) {
  if (navigator.share) { try { await navigator.share({ title: '集个戳戳', text, url }); return; } catch { /* 取消或不支持 */ } }
  try { await navigator.clipboard.writeText(text); toast('链接已复制，粘贴到微信发给朋友'); return; } catch { /* 部分 WebView 不支持 */ }
  const m = showModal(`<h3>复制下面这段发给朋友</h3><textarea readonly>${esc(text)}</textarea><button class="btn ghost" data-close>好了</button>`);
  m.querySelector('textarea').select();
}
const inviteText = c => `【集个戳戳】我在攒「${c.goal}」，${L.rhythmText(c)}，集满 ${L.targetOf(c)} 个戳就奖励自己「${c.reward_name}」。来当我的戳戳搭子，帮我盖戳 👉 ${linkTo(c.id)}`;
const remindText = c => `【集个戳戳】${c.owner_name}，你今天的戳还空着，快去打卡 👉 ${linkTo(c.id)}`;

// ---------- 演示条 ----------
function renderDemoBar() {
  const bar = document.getElementById('demo-bar');
  if (!DEMO) { bar.hidden = true; return; }
  const off = lsGet(OFFSET_KEY, 0);
  bar.hidden = false;
  bar.innerHTML = `<span>单机演示 · 当前身份：<b>${esc(me ? me.name : '未登录')}</b>${off ? ` · 模拟 +${off} 天` : ''}</span>
    <button data-demo="switch">切换身份</button><button data-demo="time">时间 +1 天</button>${off ? '<button data-demo="reset">回到今天</button>' : ''}`;
  bar.onclick = e => {
    const a = e.target.dataset.demo;
    if (a === 'time') { lsSet(OFFSET_KEY, off + 1); render(); }
    if (a === 'reset') { lsSet(OFFSET_KEY, 0); render(); }
    if (a === 'switch') {
      const users = lsGet(USERS_KEY, []);
      const m = showModal(`<h3>切换身份</h3><p class="hint">演示模式下，用不同身份扮演"发卡的人"和"戳戳搭子"。</p>
        <div class="chips" style="margin:12px 0">${users.map(u => `<button class="btn ghost sm" style="margin:0" data-uid="${esc(u.id)}">${esc(u.name)}</button>`).join('')}</div>
        <label class="f" for="nn">新身份的名字</label><input id="nn" type="text" maxlength="10" placeholder="比如：阿张"><button class="btn" id="nn-ok">用新身份</button>`);
      m.querySelectorAll('[data-uid]').forEach(b => b.onclick = () => { setMe(users.find(u => u.id === b.dataset.uid)); m.hidden = true; render(); });
      m.querySelector('#nn-ok').onclick = () => {
        const name = m.querySelector('#nn').value.trim();
        if (!name) return toast('写个名字');
        setMe({ id: uid(), name }); m.hidden = true; render();
      };
    }
  };
}

// ---------- 起个名字 ----------
function nameGate() {
  $app.innerHTML = `${topbar()}
    <div class="hero">${guBubble('happy', '', '我是咕咕，专治各种"鸽了"。<br>每天打卡，朋友盖戳，集满了奖励自己。', 72)}</div>
    <div class="card"><label class="f" for="name">朋友怎么称呼你？</label>
      <input id="name" type="text" maxlength="10" placeholder="比如：小王" autocomplete="nickname">
      <p class="hint">会出现在你的集戳卡和盖的戳上</p>
      <button class="btn" id="ok">开始</button></div>`;
  const input = $app.querySelector('#name');
  const submit = () => { const n = input.value.trim(); if (!n) return toast('写个名字'); setMe({ id: uid(), name: n }); render(); };
  $app.querySelector('#ok').onclick = submit;
  input.onkeydown = e => { if (e.key === 'Enter') submit(); };
}

// ---------- 首页 ----------
function dotsHtml(sum) {
  const n = Math.min(sum.target, 30);
  const on = sum.stamped.slice(0, n);
  return `<div class="dots">${Array.from({ length: n }, (_, i) => i < on.length ? '<i class="on"></i>' : '<i></i>').join('')}</div>`;
}
async function pageHome() {
  document.body.classList.remove('buddy');
  const { owned, buddying } = await store.listMine(me.id);
  const t = now();
  const ownItem = p => {
    const s = L.summarize(p.card, p.checkins, p.stamps, t);
    const badge = s.phase === 'ended' ? (s.full ? '<span class="pill y">集满了</span>' : '<span class="pill">已结束</span>')
      : s.canCheckin ? '<span class="pill ink">今天还没打卡</span>' : s.full ? '<span class="pill y">集满了</span>' : '';
    return { hot: s.phase === 'active' && s.canCheckin, at: p.card.created_at, html: `<a class="item" href="#/c/${esc(p.card.id)}">
      <div class="r"><span class="t">${esc(p.card.goal)}</span>${badge}</div>
      <div class="s">${Math.min(s.count, s.target)} / ${s.target} 个戳${s.extra ? ` · 多集 ${s.extra} 个` : ''} · ${L.rhythmText(p.card)} · 搭子 ${p.buddies.length} 人</div>${dotsHtml(s)}</a>` };
  };
  const budItem = p => {
    const s = L.summarize(p.card, p.checkins, p.stamps, t);
    const waiting = L.waitingFor(me.id, s, p.checkins, p.stamps, t).length;
    return { hot: waiting > 0, at: p.card.created_at, html: `<a class="item" href="#/c/${esc(p.card.id)}">
      <div class="r"><span class="t">${esc(p.card.owner_name)}：${esc(p.card.goal)}</span>${waiting ? `<span class="pill y">${waiting} 个待盖</span>` : ''}</div>
      <div class="s">${Math.min(s.count, s.target)} / ${s.target} 个戳${s.extra ? ` · 多集 ${s.extra} 个` : ''}${s.phase === 'ended' ? ' · 已结束' : ''}</div>${dotsHtml(s)}</a>` };
  };
  const list = arr => arr.sort((a, b) => b.hot - a.hot || b.at - a.at).map(x => x.html).join('');
  const streak = streakOf(owned, t);
  const got = computeAchievements(me.id, owned, buddying, t);
  const owe = owned.filter(p => L.summarize(p.card, p.checkins, p.stamps, t).canCheckin).length;
  const say = owe ? guBubble('guilty', 'guilty', `还有 <b>${owe} 张卡</b>今天没打卡。<br>咕咕盯着你呢，别鸽。`)
    : streak ? guBubble('happy', '', `连戳 <b>${streak} 天</b>${streakTitle(streak) ? `，「${streakTitle(streak)}」` : ''}。<br>今天也没鸽，咕咕很欣慰。`)
    : guBubble('normal', '', '每天打卡，朋友盖戳。<br>集满了，奖励自己。别鸽。');
  $app.innerHTML = `${topbar()}
    <div class="hero">${say}</div>
    <a class="stats-strip" href="#/me"><span><b class="flame">${streak}</b> 天连戳</span><span><b>${got.size}</b> / ${ACHIEVEMENTS.length} 个成就</span><span class="go">去成就墙 ›</span></a>
    <a class="btn" href="#/new">发一张集戳卡</a>
    <h2 class="sec">我的卡 <small>${owned.length} 张</small></h2>
    ${owned.length ? list(owned.map(ownItem)) : '<p class="empty">还没有卡。想坚持什么，就发一张，再叫朋友来盖戳。</p>'}
    <h2 class="sec">我在帮盖戳 <small>${buddying.length} 张</small></h2>
    ${buddying.length ? list(buddying.map(budItem)) : '<p class="empty">朋友发来的集戳卡，接下后会出现在这里。</p>'}`;
  announce(owned, buddying);
}

// ---------- 发卡 ----------
async function pageNew(params) {
  document.body.classList.remove('buddy');
  let base = null;
  if (params.get('from')) { const d = await store.getCard(params.get('from')); if (d && d.card.owner_id === me.id) base = d.card; }
  const v = base ? { ...base } : { theme: 'sport', freq_type: 'daily', freq_n: 3, days: 7, goal: '', reward_name: '', reward_amount: null };
  const radio = (name, value, label, on) => `<input type="radio" id="${name}-${value}" name="${name}" value="${value}" ${on ? 'checked' : ''}><label for="${name}-${value}">${label}</label>`;
  $app.innerHTML = `<a class="back" href="#/">‹ 返回</a>
    <p class="h1">发一张集戳卡</p><p class="sub">想坚持什么？集满就奖励自己</p>
    <form id="f" class="card" novalidate>
      <label class="f">选个模板</label>
      <div class="chips">${L.TEMPLATES.map(t => radio('theme', t.key, `${t.icon} ${t.name}`, t.key === v.theme)).join('')}</div>
      <label class="f">节奏</label>
      <div class="chips">${radio('freq', 'daily', '每天一次', v.freq_type === 'daily')}${radio('freq', 'weekly', '每周几次', v.freq_type === 'weekly')}${radio('freq', 'once', '一次完成', v.freq_type === 'once')}</div>
      <p class="hint" id="freq-hint"></p>
      <div id="n-wrap"><label class="f">每周几次</label><div class="chips">${[2, 3, 4, 5].map(n => radio('n', n, `${n} 次`, n === v.freq_n)).join('')}</div></div>
      <label class="f" for="goal" id="goal-label">要坚持的事</label>
      <input id="goal" type="text" maxlength="30" value="${esc(v.goal)}">
      <label class="f" id="days-label">坚持多久</label>
      <div id="days" class="chips"></div>
      <div id="custom-wrap" class="row" style="margin-top:8px"><input id="cd" type="number" inputmode="numeric" min="1" max="${L.MAX_DAYS}" style="width:110px" aria-label="自定义天数"><span>天（1–${L.MAX_DAYS}）</span></div>
      <label class="f" for="reward" id="reward-label">集满奖励自己</label>
      <input id="reward" type="text" maxlength="24" placeholder="比如：一双新跑鞋" value="${esc(v.reward_name)}">
      <input id="amount" type="number" inputmode="decimal" min="0" placeholder="多少钱（选填）" value="${v.reward_amount ?? ''}" style="margin-top:8px">
      <label class="f" id="pv-label">预览</label>
      <div id="pv" class="slots"></div>
    </form>
    <div class="dock"><div class="in"><button class="btn" id="go">发卡，去找戳戳搭子</button></div></div>`;
  const f = $app.querySelector('#f');
  const cd = f.querySelector('#cd');
  // 天数：一个预设值，或者 'custom'
  let pick = String(v.days);
  let custom = L.periodsFor(v.freq_type).includes(v.days) ? '' : String(v.days);
  if (custom) pick = 'custom';
  cd.value = custom;
  const tpl = () => L.TEMPLATES.find(t => t.key === f.theme.value);
  const daysNow = () => (pick === 'custom' ? Number(cd.value) : Number(pick));
  const paint = () => {
    const freq = f.freq.value;
    const once = freq === 'once';
    f.querySelector('#n-wrap').hidden = freq !== 'weekly';
    f.querySelector('#freq-hint').textContent = once ? '只要做成一次：提交证明，搭子盖上戳就能拿奖励' : freq === 'daily' ? '每天打卡一次，每次一个戳' : '一周里任选几天打卡，每次一个戳';
    f.querySelector('#goal-label').textContent = once ? '要完成的事' : '要坚持的事';
    f.querySelector('#days-label').textContent = once ? '多少天内完成' : '坚持多久';
    f.querySelector('#reward-label').textContent = once ? '完成后奖励自己' : '集满奖励自己';
    const opts = L.periodsFor(freq);
    if (pick !== 'custom' && !opts.includes(Number(pick))) pick = String(opts[0]);
    f.querySelector('#days').innerHTML = opts.map(d => radio('days', d, `${d} 天`, String(d) === pick)).join('') + radio('days', 'custom', '自定义', pick === 'custom');
    f.querySelector('#custom-wrap').hidden = pick !== 'custom';
    const days = daysNow();
    const ok = L.validDays(days);
    const c = { freq_type: freq, freq_n: Number(f.n.value), days: ok ? days : 7, extra: 0 };
    const target = L.targetOf(c);
    f.querySelector('#pv-label').textContent = !ok ? '预览：先填一个 1–90 的天数'
      : once ? `预览：${days} 天内完成，搭子盖 1 个戳就开礼物`
      : freq === 'weekly' ? `预览：${days} 天里集 ${target} 个戳，集满开礼物` : `预览：${target} 个格子，集满开礼物`;
    const pv = f.querySelector('#pv');
    pv.style.setProperty('--cols', colsFor(target + 1));
    pv.innerHTML = Array.from({ length: target }, () => '<div class="slot"></div>').join('') + '<div class="slot gift">🎁</div>';
    f.goal.placeholder = once ? '比如：考过雅思 7 分' : (tpl().goal || '比如：每天弹 20 分钟吉他');
  };
  paint();
  f.addEventListener('change', e => {
    if (e.target.name === 'days') { pick = e.target.value; if (pick === 'custom') setTimeout(() => cd.focus(), 0); }
    paint();
  });
  cd.addEventListener('input', paint);
  $app.querySelector('#go').onclick = async e => {
    const freq = f.freq.value;
    const once = freq === 'once';
    const goal = f.goal.value.trim() || (once ? '' : tpl().goal);
    const reward = f.reward.value.trim();
    const days = daysNow();
    if (!goal) return toast(once ? '写下要完成的事' : '写下要坚持的事');
    if (!L.validDays(days)) return toast(`天数填 1–${L.MAX_DAYS} 之间的整数`);
    if (!reward) return toast('写个奖励，集满了才有盼头');
    const amount = f.amount.value === '' ? null : Number(f.amount.value);
    const card = {
      id: uid(), owner_id: me.id, owner_name: me.name, theme: f.theme.value, goal,
      proof: once ? '能证明你做到了的照片，比如成绩单、完赛照' : tpl().proof,
      freq_type: freq, freq_n: freq === 'weekly' ? Number(f.n.value) : freq === 'daily' ? 7 : 1, days, extra: 0,
      reward_name: reward, reward_amount: Number.isFinite(amount) ? amount : null, abandoned_at: null, created_at: now(),
    };
    e.target.disabled = true;
    try { await store.insert('cards', card); go(`#/c/${card.id}?new=1`); } catch (err) { toast(err.message); e.target.disabled = false; }
  };
}

// ---------- 卡片 ----------
function slotsHtml(card, sum, checkins, stamps) {
  const cells = [];
  for (const k of sum.stamped.slice(0, sum.target)) {
    const ss = stampsOf(k, stamps);
    const shown = ss.length ? ss.slice(0, 2) : [autoStamp(k)];
    cells.push(`<div class="slot" title="${L.fmtDate(k.date)}">${shown.map((s, i) => stampEl(s, i ? 'stack' : '')).join('')}</div>`);
  }
  for (const k of sum.pending) {
    if (cells.length >= sum.target) break;
    cells.push(`<div class="slot wait"><span class="ph" style="${k.image_url ? `background-image:url('${esc(k.image_url)}')` : ''}"></span><span class="lbl">等盖戳</span></div>`);
  }
  if (sum.phase === 'active' && cells.length < sum.target) {
    if (sum.todayState === 'nope') cells.push('<div class="slot nope">这不算</div>');
    else if (sum.todayState === 'none') cells.push('<div class="slot today">今天</div>');
  }
  while (cells.length < sum.target) cells.push('<div class="slot"></div>');
  cells.push(`<div class="slot gift ${sum.full ? 'open' : ''}" aria-label="礼物格">🎁</div>`);
  const extras = sum.stamped.slice(sum.target);
  return `<div class="slots" style="--cols:${colsFor(sum.target + 1)}">${cells.join('')}</div>
    ${extras.length ? `<div class="extras">多集了 ${extras.length} 个：${extras.map(k => { const s = stampsOf(k, stamps)[0] || autoStamp(k); return stampEl({ ...s, user_name: '' }, 'inline'); }).join('')}</div>` : ''}`;
}

function entryHtml(k, ctx) {
  const { stamps, sum, isOwner, isBuddy } = ctx;
  const r = sum.results.get(k.id);
  const mine = stamps.filter(s => s.checkin_id === k.id);
  const tag = r.status === 'pending' ? '<span class="pill ink">等盖戳</span>' : r.status === 'nope' ? '<span class="pill" style="color:#E8434F">这不算</span>' : r.auto ? '<span class="pill">咕咕代盖</span>' : '<span class="pill y">盖上了</span>';
  const canStamp = isBuddy && !isOwner && L.canStampOn(me.id, k, sum, stamps, ctx.t);
  return `<article class="entry"><header><b>${L.fmtDate(k.date)}${k.attempt > 1 ? ' · 补交' : ''}</b>${tag}</header>
    ${k.image_url ? `<img src="${esc(k.image_url)}" alt="${L.fmtDate(k.date)}的打卡照片" loading="lazy">` : ''}
    ${k.note ? `<p class="note">${esc(k.note)}</p>` : ''}
    ${mine.length ? `<div class="reacts">${mine.sort((a, b) => a.created_at - b.created_at).map(s => `<div class="react">${s.kind === 'stamp' ? stampEl({ ...s, user_name: '' }, 'inline') : '<span class="nope-mark">这不算</span>'}<span><b>${esc(s.user_name)}</b>${s.comment ? `：${esc(s.comment)}` : s.kind === 'nope' ? ' 觉得这次不算' : ` 盖了「${esc(stampLabel(s.text))}」`}</span></div>`).join('')}</div>` : ''}
    ${canStamp ? `<button class="btn red sm" data-act="stamp" data-kid="${esc(k.id)}">给 Ta 盖戳</button>` : ''}
  </article>`;
}

async function pageCard(id, params) {
  const data = await store.getCard(id);
  if (!data) {
    $app.innerHTML = `<a class="back" href="#/">‹ 返回</a><div class="card"><p class="goal">找不到这张卡</p>
      <p class="hint">链接可能不完整，让朋友重新发一次。${DEMO ? '演示模式下，卡片只存在发卡人的手机里，别人打不开。' : ''}</p></div>`;
    return;
  }
  const { card, buddies, checkins, stamps, raises } = data;
  const isOwner = card.owner_id === me.id;
  const myBuddy = buddies.find(b => b.user_id === me.id);
  document.body.classList.toggle('buddy', !isOwner);
  if (!isOwner && !myBuddy) return pageInvite(data);

  const t = now();
  const sum = L.summarize(card, checkins, stamps, t);
  const ended = sum.phase === 'ended';
  const once = card.freq_type === 'once';
  const gu = guDays(card, checkins, t);
  const pill = ended ? (sum.full ? '<span class="pill y">集满了</span>' : '<span class="pill">已结束</span>')
    : sum.full ? `<span class="pill y">${once ? '完成了' : '集满了'}</span>` : `<span class="pill">${once ? '进行中' : `第 ${sum.dayIndex} 天`}</span>`;
  let html = `<a class="back" href="#/">‹ 返回</a>`;
  if (!isOwner) html += `<p class="sub" style="margin-top:4px">${esc(card.owner_name)} 的集戳卡 · 你的专属戳「${esc(myBuddy.custom_stamp)}」</p>`;

  // 结束页
  if (ended) {
    html += `<div class="done"><p class="big">${sum.full ? (once ? '搞定了！' : '集满了！') : once ? '这次没完成' : `差 ${sum.missing} 个戳`}</p>
      <p class="sub">${L.rhythmText(card)} · 集到 ${Math.min(sum.count, sum.target)} / ${sum.target} 个戳${sum.extra ? ` · 多集了 ${sum.extra} 个` : ''}</p></div>
      <div class="prize ${sum.full ? '' : 'miss'}"><div class="ico">${sum.full ? '🎁' : '🫶'}</div><b>${rewardText(card)}</b>
      <span style="font-size:13px">${card.abandoned_at ? '这张卡提前撕掉了，下次再来' : sum.full ? (isOwner ? '去买吧，这是你挣来的' : `${esc(card.owner_name)} 挣到了`) : '这次没集满，奖励先欠着'}</span></div>
      <div id="card-out"></div>`;
  }

  html += `<div class="card"><div class="card-head"><p class="goal">${esc(card.goal)}</p>${pill}</div>
    <p class="sub">${L.rhythmText(card)}${ended ? '' : ` · 还剩 ${sum.daysLeft} 天`}</p>
    ${slotsHtml(card, sum, checkins, stamps)}
    ${gu ? `<p class="gu-days"><span class="gu-chip">咕</span>这张卡已经鸽了 <b>${gu}</b> 天${ended ? '' : '，今天别再鸽了'}</p>` : ''}
    <p class="count">${once ? `<span>${sum.full ? '<b>已完成</b>，搭子盖上戳了' : sum.pending.length ? '已提交，<b>等搭子盖戳</b>' : '完成后提交证明，搭子盖上戳就开礼物'}</span>` : `<span>已集 <b>${Math.min(sum.count, sum.target)}</b> / ${sum.target} 个戳</span><span>${sum.full ? '礼物已解锁' : `还差 ${sum.missing} 个`}</span>`}</p>
    ${sum.full ? '' : `<button class="link-btn" data-act="preview" style="padding:6px 0 0">预览${once ? '完成' : '集满'}后的分享卡</button>`}
    <div class="reward-line"><span>${once ? '完成奖励' : '集满奖励'}</span><b>${rewardText(card)}</b></div></div>`;

  // 提示条
  const pendingRaises = raises.filter(r => r.status === 'pending');
  if (isOwner && !ended) {
    if (params.get('new')) html += `<div class="banner y"><b>卡发好了！</b>发给朋友，请 Ta 当你的戳戳搭子。你今天就可以开始打卡。</div>`;
    for (const r of pendingRaises) {
      html += `<div class="banner y">${avatar(r.user_name, r.user_id)} <b>${esc(r.user_name)}</b> 觉得太简单，想给你<b>加 ${L.RAISE_SLOTS} 格</b> 😈
        <div class="row"><button class="btn ghost" data-act="raise-no" data-rid="${esc(r.id)}">婉拒</button><button class="btn" data-act="raise-ok" data-rid="${esc(r.id)}" ${L.canRaise(card) ? '' : 'disabled'}>接受挑战</button></div></div>`;
    }
    if (sum.full) html += `<div class="banner"><b>${once ? '搞定了！' : '集满了！'}🎁 礼物已解锁。</b>${once ? '' : '还没到最后一天，继续打卡会算"多集的"。'}<button class="btn y sm" data-act="card">生成分享卡</button></div>`;
    if (sum.canCheckin && sum.todayState === 'none' && !params.get('new')) html += `<div class="banner">${guBubble('guilty', 'guilty', once ? '做成了吗？做成了就拍张照，咕咕等着给你盖戳。' : '今天的格子还空着。<br>咕咕就在这儿，不走。', 56)}</div>`;
    if (sum.todayState === 'nope') html += `<div class="banner">今天这张被盖了"这不算"，可以<b>再补交一次</b>。</div>`;
    if (sum.todayState === 'nope-final') html += `<div class="banner">今天补交的也没过，明天再来。</div>`;
  }
  if (!isOwner) {
    const waiting = L.waitingFor(me.id, sum, checkins, stamps, t);
    if (params.get('joined')) html += `<div class="banner y"><b>接下了！</b>${esc(card.owner_name)} 每次打卡，你都可以来盖戳。</div>`;
    if (!ended && waiting.length) html += `<div class="banner"><b>${waiting.length} 次打卡</b>等你盖戳。打卡 24 小时内都能盖，别人盖过也能再叠一个。</div>`;
  }

  // 搭子
  html += `<h2 class="sec">戳戳搭子 <small>${buddies.length} 人</small></h2>`;
  html += buddies.length
    ? `<div class="buddies">${buddies.map(b => `<span class="buddy-chip">${avatar(b.user_name, b.user_id)}${esc(b.user_name)} · 专属戳「${esc(b.custom_stamp)}」</span>`).join('')}</div>`
    : `<p class="empty">还没有搭子。没人盖的打卡，24 小时后咕咕会替你盖，顺便阴阳一下没来的搭子。叫朋友来盖更有意思。</p>`;

  // 打卡记录
  const sorted = [...checkins].sort((a, b) => b.created_at - a.created_at);
  html += `<h2 class="sec">打卡记录 <small>${checkins.length} 次</small></h2>`;
  html += sorted.length ? sorted.map(k => entryHtml(k, { stamps, sum, isOwner, isBuddy: !!myBuddy, t })).join('')
    : `<p class="empty">${isOwner ? (once ? '做成了就拍张照提交，让搭子盖戳。' : '还没打卡。做完今天的事，拍张照提交就行。') : `${esc(card.owner_name)} 还没打卡。`}</p>`;
  if (isOwner && !ended) html += `<button class="link-btn" data-act="abandon">撕掉这张卡</button>`;

  // 底部按钮
  let dock = '';
  if (isOwner) {
    if (ended) dock = `<button class="btn ghost" data-act="card">生成分享卡</button><a class="btn y" href="#/new?from=${esc(card.id)}">再发一张卡</a>`;
    else if (sum.canCheckin) dock = `<button class="btn ghost" data-act="invite">叫搭子</button><a class="btn" href="#/c/${esc(card.id)}/checkin">${sum.attempt === 2 ? '补交一次' : once ? '我完成了，求盖戳' : '今天打卡，求盖戳'}</a>`;
    else dock = `<button class="btn" data-act="invite">叫搭子来盖戳</button>`;
  } else {
    const waiting = L.waitingFor(me.id, sum, checkins, stamps, t);
    const raised = raises.some(r => r.user_id === me.id);
    const raiseBtn = !ended && !raised && L.canRaise(card) ? `<button class="btn ghost" data-act="raise">加 ${L.RAISE_SLOTS} 格 😈</button>` : '';
    if (ended) dock = `<button class="btn" data-act="card">生成分享卡</button>`;
    else if (waiting.length) dock = `${raiseBtn}<button class="btn red" data-act="stamp" data-kid="${esc(waiting[0].id)}">去盖戳（${waiting.length}）</button>`;
    else dock = `${raiseBtn}<button class="btn" data-act="remind">催 Ta 打卡</button>`;
  }
  html += `<div class="dock"><div class="in">${dock}</div></div>`;
  $app.innerHTML = html;
  if (params.get('celebrate') || (ended && sum.full && params.get('done'))) confetti();
  store.listMine(me.id).then(({ owned, buddying }) => announce(owned, buddying)).catch(() => {});

  // 事件
  $app.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    try {
      if (act === 'invite') return shareText(inviteText(card), linkTo(card.id));
      if (act === 'remind') return shareText(remindText(card), linkTo(card.id));
      if (act === 'stamp') return openStampSheet({ card, checkin: checkins.find(k => k.id === b.dataset.kid), myBuddy, stamps, wasFull: sum.full });
      if (act === 'raise') {
        b.disabled = true;
        await store.insert('raises', { id: uid(), card_id: card.id, user_id: me.id, user_name: me.name, status: 'pending', created_at: now() });
        toast(`已发给 ${card.owner_name}，Ta 同意才生效`); return render();
      }
      if (act === 'raise-ok' || act === 'raise-no') {
        b.disabled = true;
        const ok = act === 'raise-ok';
        await store.update('raises', b.dataset.rid, { status: ok ? 'accepted' : 'declined' });
        if (ok) await store.update('cards', card.id, L.applyRaise(card));
        toast(ok ? `挑战接下了，多了 ${L.RAISE_SLOTS} 格` : '婉拒了'); return render();
      }
      if (act === 'abandon') {
        if (!confirm('撕掉这张卡？已经集到的戳会保留，但这张卡就结束了。')) return;
        await store.update('cards', card.id, { abandoned_at: now() }); return render();
      }
      if (act === 'preview') {
        b.disabled = true;
        const url = await drawShareCard(previewData(card, buddies, sum));
        b.disabled = false;
        showModal(`<h3>${once ? '完成' : '集满'}后的分享卡长这样</h3><p class="hint">用你这张卡的搭子和专属戳模拟盖满。真集满时会按实际盖的戳生成，图上不会有"预览"字样。</p>
          <img class="card-img" src="${url}" alt="分享卡预览"><button class="btn ghost" data-close>知道了</button>`);
        return;
      }
      if (act === 'card') {
        const out = $app.querySelector('#card-out') || (() => { const d = document.createElement('div'); d.id = 'card-out'; $app.querySelector('.card').before(d); return d; })();
        b.disabled = true;
        const url = await drawShareCard({ card, sum, stamps, buddies });
        b.disabled = false;
        out.innerHTML = `<img class="card-img" src="${url}" alt="${esc(card.owner_name)}的集戳卡：${esc(card.goal)}，集到 ${Math.min(sum.count, sum.target)}/${sum.target} 个戳"><p class="hint" style="text-align:center">长按图片保存，发朋友圈或小红书</p>`;
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) { toast(err.message); b.disabled = false; }
  };
}

// 预览：用搭子的专属戳和系统戳把格子盖满
function previewData(card, buddies, sum) {
  const sys = t => ({ text: t, color: '#E8434F', user_id: 'sys', user_name: '' });
  const mix = ['@zp:zhidao', '@gu:heart', '@an:cat', '@zp:zhunzou', '@gu:confetti', '@an:capy', '@gu:shades', '@zp:jitui', '@gu:cry', '@an:blob', '@zp:qinci', '@flower'].map(sys);
  const pool = [...buddies.map(b => ({ text: b.custom_stamp, color: L.customColorFor(b.user_id), user_id: b.user_id, user_name: b.user_name })), ...mix];
  const stamped = [], stamps = [];
  for (let i = 0; i < sum.target; i++) {
    const k = { id: `pv-k${i}`, date: L.addDays(sum.win.start, i), created_at: 0 };
    const p = pool[i % pool.length];
    stamped.push(k);
    stamps.push({ id: `pv-s${i}`, checkin_id: k.id, kind: 'stamp', text: p.text, color: p.color, user_id: p.user_id, user_name: p.user_name });
  }
  return { card, buddies, stamps, preview: true,
    sum: { ...sum, stamped, count: sum.target, full: true, missing: 0, extra: 0 } };
}

// ---------- 搭子邀请 ----------
function pageInvite({ card, buddies, checkins, stamps }) {
  document.body.classList.add('buddy');
  const sum = L.summarize(card, checkins, stamps, now());
  const def = [...me.name].slice(-1).join('');
  const color = L.customColorFor(me.id);
  $app.innerHTML = `<a class="back" href="#/">‹ 返回</a>
    <p class="h1">${esc(card.owner_name)} 请你当戳戳搭子</p>
    <p class="sub">接下后，Ta 每次打卡都等你来盖戳</p>
    <div class="card"><div class="card-head"><p class="goal">${esc(card.goal)}</p><span class="pill">${L.rhythmText(card)}</span></div>
      ${slotsHtml(card, sum, checkins, stamps)}
      <div class="reward-line"><span>${card.freq_type === 'once' ? '完成奖励' : '集满奖励'}</span><b>${rewardText(card)}</b></div></div>
    ${buddies.length ? `<h2 class="sec">已经接下的搭子</h2><div class="buddies">${buddies.map(b => `<span class="buddy-chip">${avatar(b.user_name, b.user_id)}${esc(b.user_name)}</span>`).join('')}</div>` : ''}
    <div class="card"><label class="f" for="cs">刻一个你的专属戳</label>
      <div class="my-stamp"><div class="preview" id="cs-pv"></div>
        <div style="flex:1"><input id="cs" type="text" maxlength="2" value="${esc(def)}" aria-describedby="cs-h"><p class="hint" id="cs-h">1–2 个字，比如"猛""再来""服了"</p></div></div></div>
    ${sum.phase === 'ended' ? '<div class="banner">这张卡已经结束了。</div>' : ''}
    <div class="dock"><div class="in">${sum.phase === 'active' && L.canRaise(card) ? `<button class="btn ghost" data-act="join-raise">加 ${L.RAISE_SLOTS} 格 😈</button>` : ''}<button class="btn" data-act="join" ${sum.phase === 'ended' ? 'disabled' : ''}>接下，当戳戳搭子</button></div></div>`;
  const cs = $app.querySelector('#cs');
  const paint = () => { $app.querySelector('#cs-pv').innerHTML = stampEl({ id: 'pv', text: cs.value.trim() || '戳', color }); };
  cs.oninput = paint; paint();
  $app.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const v = L.validCustomStamp(cs.value);
    if (!v.ok) return toast(v.msg);
    b.disabled = true;
    try {
      await store.addBuddy({ card_id: card.id, user_id: me.id, user_name: me.name, custom_stamp: v.text, created_at: now() });
      if (b.dataset.act === 'join-raise') await store.insert('raises', { id: uid(), card_id: card.id, user_id: me.id, user_name: me.name, status: 'pending', created_at: now() });
      go(`#/c/${card.id}?joined=1`);
    } catch (err) { toast(err.message); b.disabled = false; }
  };
}

// ---------- 盖戳弹层 ----------
const TABS = [
  { key: 'zp', name: '朱批' },
  { key: 'gu', name: '咕咕' },
  { key: 'an', name: '动物园' },
  { key: 'base', name: '基础' },
];
function stampOptions(myBuddy, unlockedCount) {
  return {
    zp: ZHUPI.map(z => ({ text: '@zp:' + z.key, color: '#C8102E', label: z.label })),
    gu: GU.map(g => ({ text: '@gu:' + g.key, color: g.color, label: g.label })),
    an: ANIMALS.map(a => ({ text: '@an:' + a.key, color: a.color, label: a.name, locked: unlockedCount < a.need, need: a.need })),
    base: [...L.ICON_STAMPS.map(i => ({ ...i, label: stampLabel(i.text) })), ...L.SYSTEM_STAMPS.map(t => ({ ...t, label: '' })),
      { text: myBuddy.custom_stamp, color: L.customColorFor(me.id), label: '我的专属' }],
  };
}
async function openStampSheet({ card, checkin, myBuddy, stamps, wasFull }) {
  let unlocked = 0;
  try { const d = await store.listMine(me.id); unlocked = computeAchievements(me.id, d.owned, d.buddying, now()).size; } catch { /* 拿不到就当 0 */ }
  const opts = stampOptions(myBuddy, unlocked);
  let tab = lsGet('jgcc_tab', 'zp');
  if (!opts[tab]) tab = 'zp';
  let pick = opts[tab].find(o => !o.locked) || opts.zp[0];
  const m = showModal(`<h3>给 ${esc(card.owner_name)} 盖个戳</h3><p class="hint">${L.fmtDate(checkin.date)}的打卡${checkin.note ? `：${esc(checkin.note)}` : ''}</p>
    <div class="target" id="tg" style="${checkin.image_url ? `background-image:url('${esc(checkin.image_url)}')` : ''}"></div>
    <div class="tabs" role="tablist">${TABS.map(t => `<button type="button" role="tab" data-tab="${t.key}" aria-selected="${t.key === tab}">${t.name}</button>`).join('')}</div>
    <div class="tray" id="tray" role="group" aria-label="选一个戳"></div>
    <label class="f" for="cm">说一句（选填）</label><input id="cm" type="text" maxlength="30" placeholder="比如：配速可以啊">
    <button class="btn red" id="press">按下去 · 啪！</button>`);
  const tray = m.querySelector('#tray');
  const paintTray = () => {
    const list = opts[tab];
    tray.innerHTML = list.map((o, i) => `<button type="button" data-i="${i}" aria-pressed="${pick && pick.text === o.text}" ${o.locked ? 'disabled' : ''}>
        <span class="ring">${stampEl({ id: 'o' + tab + i, text: o.text, color: o.color })}${o.locked ? '<span class="lock">🔒</span>' : ''}</span>
        ${o.locked ? `再解锁 ${o.need - unlocked} 个成就` : esc(o.label)}</button>`).join('')
      + '<button type="button" data-i="nope" aria-pressed="false"><span class="nope-ring">这不算</span>不算数</button>';
    tray.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      pick = b.dataset.i === 'nope' ? 'nope' : list[Number(b.dataset.i)];
      tray.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      m.querySelector('#press').textContent = pick === 'nope' ? '这次不算' : '按下去 · 啪！';
    });
  };
  m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    tab = b.dataset.tab; lsSet('jgcc_tab', tab);
    m.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    paintTray();
  });
  paintTray();
  m.querySelector('#press').onclick = async e => {
    e.target.disabled = true;
    const nope = pick === 'nope';
    const o = nope ? null : pick;
    const row = { id: uid(), card_id: card.id, checkin_id: checkin.id, user_id: me.id, user_name: me.name, kind: nope ? 'nope' : 'stamp',
      text: o ? o.text : null, color: o ? stampColor(o.text, o.color) : null, comment: m.querySelector('#cm').value.trim(), created_at: now() };
    try {
      await store.insert('stamps', row);
      const tg = m.querySelector('#tg');
      tg.innerHTML = nope
        ? '<div class="slam go"><span class="nope-ring big">这不算</span></div>'
        : `<div class="slam go">${stampEl({ id: row.id, text: o.text, color: o.color })}</div><span class="pa">啪！</span>`;
      if (navigator.vibrate) navigator.vibrate(nope ? 20 : [30, 30, 60]);
      const after = await store.getCard(card.id);
      const s2 = L.summarize(after.card, after.checkins, after.stamps, now());
      setTimeout(() => { m.hidden = true; render({ celebrate: !wasFull && s2.full }); }, 750);
    } catch (err) { toast(err.message); e.target.disabled = false; }
  };
}

// ---------- 成就 ----------
const seenKey = () => 'jgcc_seen_' + me.id;
let announcing = false;
function announce(owned, buddying) {
  if (announcing || !document.getElementById('modal').hidden) return;
  const got = computeAchievements(me.id, owned, buddying, now());
  const seen = new Set(lsGet(seenKey(), []));
  const fresh = ACHIEVEMENTS.filter(a => got.has(a.key) && !seen.has(a.key));
  if (!fresh.length) return;
  const markSeen = () => lsSet(seenKey(), [...new Set([...seen, ...got.keys()])]);
  const order = { legend: 0, rare: 1, common: 2 };
  fresh.sort((a, b) => order[a.rarity] - order[b.rarity]);
  const a = fresh[0];
  const before = got.size - fresh.length;
  const newAnimals = ANIMALS.filter(x => x.need > before && x.need <= got.size);
  announcing = true;
  const m = showModal(`<div class="ach-pop"><div class="rays"></div>
      <p class="kicker" style="color:${RARITY[a.rarity].color}">解锁成就 · ${RARITY[a.rarity].name}</p>
      <div class="badge-big">${badgeSvg(a.glyph, a.rarity, 'on', 132)}</div>
      <p class="ach-name">${esc(a.name)}</p><p class="ach-desc">${esc(a.desc)}</p>
      ${fresh.length > 1 ? `<p class="hint">另外还解锁了 ${fresh.length - 1} 个成就，去成就墙看看。</p>` : ''}
      ${newAnimals.length ? `<div class="new-animal">${newAnimals.map(x => animalSvg(x.key, 44)).join('')}<span>动物园新成员：<b>${newAnimals.map(x => x.name).join('、')}</b>，盖戳时可以用了</span></div>` : ''}
      <button class="btn" id="ach-share">生成成就卡，去炫耀</button>
      <button class="btn ghost" data-close>收下</button></div>`);
  confetti();
  const onClick = e => {
    if (e.target === m || e.target.closest('[data-close]')) { markSeen(); announcing = false; m.removeEventListener('click', onClick); }
  };
  m.addEventListener('click', onClick);
  m.querySelector('#ach-share').onclick = () => { markSeen(); announcing = false; m.removeEventListener('click', onClick); shareAchievement(a, got.get(a.key)); };
}
async function shareAchievement(a, at) {
  const m = showModal('<h3>正在生成成就卡…</h3>');
  const url = await drawAchievementCard({ ach: a, userName: me.name, at });
  m.querySelector('.panel').innerHTML = `<h3>${esc(a.name)}</h3><p class="hint">长按图片保存，发朋友圈或小红书</p>
    <img class="card-img" src="${url}" alt="成就卡：${esc(a.name)}"><button class="btn ghost" data-close>好了</button>`;
}

async function pageMe() {
  document.body.classList.remove('buddy');
  const { owned, buddying } = await store.listMine(me.id);
  const t = now();
  const got = computeAchievements(me.id, owned, buddying, t);
  lsSet(seenKey(), [...got.keys()]);
  const streak = streakOf(owned, t);
  const tile = a => {
    const on = got.has(a.key);
    const state = on ? 'on' : a.hidden ? 'hidden' : 'locked';
    return `<button class="ach ${on ? '' : 'off'}" data-ach="${a.key}" ${on ? '' : 'disabled'}>
      ${badgeSvg(a.glyph, a.rarity, state, 64)}
      <span class="nm">${on || !a.hidden ? esc(a.name) : '???'}</span>
      <span class="rs" style="color:${on ? RARITY[a.rarity].color : '#9AAFA6'}">${on ? RARITY[a.rarity].name : a.hidden ? '隐藏' : RARITY[a.rarity].name}</span>
      <span class="ds">${on ? esc(a.desc) : a.hidden ? esc(a.hint) : esc(a.rule)}</span></button>`;
  };
  $app.innerHTML = `<a class="back" href="#/">‹ 返回</a>
    <div class="hero">${guBubble(streak ? 'happy' : 'normal', streak >= 7 ? 'confetti' : '', streak ? `连戳 <b>${streak} 天</b>${streakTitle(streak) ? `，「${streakTitle(streak)}」` : ''}。<br>已经解锁 <b>${got.size}</b> / ${ACHIEVEMENTS.length} 个成就。` : `已经解锁 <b>${got.size}</b> / ${ACHIEVEMENTS.length} 个成就。<br>点亮一个，咕咕就给你发一张成就卡。`, 72)}</div>
    <div class="streak-tiers">${[[3, '开始上道'], [7, '小有坚持'], [30, '月度靠谱'], [100, '百日筑基']].map(([d, n]) => `<span class="${streak >= d ? 'on' : ''}">${d} 天 · ${n}</span>`).join('')}</div>
    <h2 class="sec">发卡人成就</h2><div class="ach-grid">${ACHIEVEMENTS.filter(a => a.who === 'owner' && !a.hidden).map(tile).join('')}</div>
    <h2 class="sec">搭子成就</h2><div class="ach-grid">${ACHIEVEMENTS.filter(a => a.who === 'buddy' && !a.hidden).map(tile).join('')}</div>
    <h2 class="sec">隐藏成就</h2><div class="ach-grid">${ACHIEVEMENTS.filter(a => a.hidden).map(tile).join('')}</div>
    <h2 class="sec">戳戳动物园 <small>当搭子盖戳时，可以用它们当你的分身</small></h2>
    <div class="zoo">${ANIMALS.map(a => { const on = got.size >= a.need; return `<div class="${on ? '' : 'off'}">${animalSvg(a.key, 60)}<b>${a.name}</b><span>${on ? a.kind : `解锁 ${a.need} 个成就后加入`}</span></div>`; }).join('')}</div>`;
  $app.onclick = e => {
    const b = e.target.closest('[data-ach]');
    if (!b || b.disabled) return;
    const a = ACHIEVEMENTS.find(x => x.key === b.dataset.ach);
    shareAchievement(a, got.get(a.key));
  };
}

// ---------- 打卡 ----------
function compress(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1080 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('这张照片处理不了，换一张')), 'image/jpeg', DEMO ? 0.55 : 0.75);
    };
    img.onerror = () => reject(new Error('读不出这张照片，换一张'));
    img.src = url;
  });
}
async function pageCheckin(id) {
  const data = await store.getCard(id);
  if (!data || data.card.owner_id !== me.id) return go(`#/c/${id}`);
  const { card, checkins, stamps } = data;
  const sum = L.summarize(card, checkins, stamps, now());
  if (!sum.canCheckin) return go(`#/c/${id}`);
  document.body.classList.remove('buddy');
  $app.innerHTML = `<a class="back" href="#/c/${esc(id)}">‹ 返回</a>
    <p class="h1">${sum.attempt === 2 ? '补交一次' : card.freq_type === 'once' ? '提交完成证明' : '今天打卡'}</p>
    <p class="sub">${card.freq_type === 'once' ? `${esc(card.goal)} · 还剩 ${sum.daysLeft} 天` : `第 ${sum.dayIndex} 天`} · 拍张照，让搭子盖戳</p>
    <label class="photo-pick" style="margin-top:12px"><span aria-hidden="true">📷</span>拍照或选一张：${esc(card.proof || '能证明你做到了的照片')}
      <input id="pic" type="file" accept="image/*"><img id="pv" alt="打卡照片预览" hidden></label>
    <label class="f" for="note">说一句（选填）</label>
    <input id="note" type="text" maxlength="40" placeholder="${card.freq_type === 'once' ? '比如：成绩出来了，7 分！' : '比如：今天跑了 5 公里，腿已废'}">
    <div class="dock"><div class="in"><button class="btn" id="go">提交，求盖戳 🙏</button></div></div>`;
  let blob = null;
  const pv = $app.querySelector('#pv');
  $app.querySelector('#pic').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { blob = await compress(file); pv.src = URL.createObjectURL(blob); pv.hidden = false; } catch (err) { toast(err.message); }
  };
  $app.querySelector('#go').onclick = async e => {
    if (!blob) return toast('先拍张照');
    e.target.disabled = true; e.target.textContent = '提交中…';
    try {
      await store.addCheckin({ id: uid(), card_id: id, date: L.bjDate(now()), attempt: sum.attempt, note: $app.querySelector('#note').value.trim(), created_at: now() }, blob);
      toast('提交了，等搭子来盖戳');
      go(`#/c/${id}`);
    } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = '提交，求盖戳 🙏'; }
  };
}

// ---------- 路由 ----------
async function render(extra) {
  renderDemoBar();
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  if (extra && extra.celebrate) params.set('celebrate', '1');
  if (!me) return nameGate();
  if (!extra) window.scrollTo(0, 0);
  try {
    let m;
    if ((m = path.match(/^\/c\/([^/]+)\/checkin$/))) return await pageCheckin(decodeURIComponent(m[1]));
    if ((m = path.match(/^\/c\/([^/]+)$/))) return await pageCard(decodeURIComponent(m[1]), params);
    if (path === '/new') return await pageNew(params);
    if (path === '/me') return await pageMe();
    return await pageHome();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="card"><p class="goal">加载失败</p><p class="hint">${esc(err.message)}</p><button class="btn" onclick="location.reload()">重新加载</button></div>`;
  }
}
window.addEventListener('hashchange', () => render());
render();
