import * as L from './logic.js';
import { store, uid } from './store.js';
import { drawResultCard } from './card.js';

const $app = document.getElementById('app');
const DEMO = store.mode === 'local';

// ---------- 身份与时间 ----------
const ME_KEY = 'ba_me';
const USERS_KEY = 'ba_users';
const OFFSET_KEY = 'ba_offset_days';

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
function fmtTime(ts) {
  const d = new Date(ts + 8 * L.HOUR).toISOString();
  return `${L.fmtDate(d.slice(0, 10))} ${d.slice(11, 16)}`;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function linkTo(id) { return `${location.origin}${location.pathname}#/c/${id}`; }
function reviewLabel(r) { return r.result === 'pass' ? '同意' : r.result === 'raise' ? '加码' : '驳回'; }
const AV_COLORS = ['#2D3BFF', '#FF6B2C', '#1E9E5E', '#7B61FF', '#0E8BC0', '#D6336C'];
function avatar(name, id) {
  let h = 0;
  for (const c of String(id || name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="av" style="background:${AV_COLORS[h % AV_COLORS.length]}" aria-hidden="true">${esc(String(name).slice(-1))}</span>`;
}
const topbar = () => '<header class="topbar"><span class="logo" aria-hidden="true">批</span>奖金请批准<small>用自律换审批</small></header>';
function statusPill(s) {
  if (s.phase === 'pending') return '<span class="pill blue">审批中</span>';
  if (s.phase === 'rejected') return '<span class="pill orange">已驳回</span>';
  if (s.phase === 'active') return '<span class="pill green">考核中</span>';
  return s.grade.bonus ? '<span class="pill green">奖金已批准</span>' : '<span class="pill grey">未通过</span>';
}

function showModal(html) {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  m.onclick = e => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; };
  return m;
}

async function share(ch) {
  const url = linkTo(ch.id);
  const text = `【OKR立项书】${ch.owner_name} 申请：${ch.objective}。达成后申请发放奖金「${ch.reward_name}」。请领导审批：${url}`;
  if (navigator.share) {
    try { await navigator.share({ title: '奖金请批准', text, url }); return; } catch { /* 用户取消或不支持，继续往下 */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('审批链接已复制，粘贴到微信群或发给朋友');
    return;
  } catch { /* 部分 WebView 不支持剪贴板，改为手动复制 */ }
  const m = showModal(`<h3>复制后发给你的上级</h3><textarea readonly>${esc(text)}</textarea>
    <p class="hint">长按上面的文字，全选后复制</p><button class="btn ghost" data-close>关闭</button>`);
  m.querySelector('textarea').select();
}

// ---------- 演示条 ----------
function renderDemoBar() {
  const bar = document.getElementById('demo-bar');
  if (!DEMO) { bar.hidden = true; return; }
  const off = lsGet(OFFSET_KEY, 0);
  bar.hidden = false;
  bar.innerHTML = `<span>单机演示 · 当前身份：<b>${esc(me ? me.name : '未签名')}</b>${off ? ` · 模拟时间 +${off} 天` : ''}</span>
    <button data-demo="switch">切换身份</button><button data-demo="time">时间 +1 天</button>${off ? '<button data-demo="reset">回到今天</button>' : ''}`;
  bar.onclick = e => {
    const a = e.target.dataset.demo;
    if (a === 'time') { lsSet(OFFSET_KEY, off + 1); render(); }
    if (a === 'reset') { lsSet(OFFSET_KEY, 0); render(); }
    if (a === 'switch') {
      const users = lsGet(USERS_KEY, []);
      const m = showModal(`<h3>切换身份</h3><p class="hint">演示模式下，用不同身份模拟「申请人」和「上级」。</p>
        <div class="chips" style="margin:10px 0">${users.map(u => `<button class="btn ghost" style="width:auto;margin:0" data-uid="${esc(u.id)}">${esc(u.name)}</button>`).join('')}</div>
        <label class="f" for="nn">新身份的名字</label><input id="nn" type="text" maxlength="12" placeholder="比如：张三">
        <button class="btn" id="nn-ok">用新身份</button>`);
      m.querySelectorAll('[data-uid]').forEach(b => b.onclick = () => { setMe(users.find(u => u.id === b.dataset.uid)); m.hidden = true; render(); });
      m.querySelector('#nn-ok').onclick = () => {
        const name = m.querySelector('#nn').value.trim();
        if (!name) return toast('请填写名字');
        setMe({ id: uid(), name }); m.hidden = true; render();
      };
    }
  };
}

// ---------- 签名 ----------
function nameGate(next) {
  $app.innerHTML = `${topbar()}
    <div class="hero"><h1>别人审批你花钱，<br>你用自律换审批。</h1><p>写下目标和想要的奖金，让朋友当你的上级。</p></div>
    <div class="sheet"><h2 class="doc-title">先签个名</h2>
    <p class="hint">这个名字会出现在立项书和审批记录里</p>
    <label class="f" for="name">你的名字</label><input id="name" type="text" maxlength="12" placeholder="比如：小王" autocomplete="nickname">
    <button class="btn" id="ok">签好了</button></div>`;
  const input = $app.querySelector('#name');
  const submit = () => {
    const name = input.value.trim();
    if (!name) return toast('请填写名字');
    setMe({ id: uid(), name }); next();
  };
  $app.querySelector('#ok').onclick = submit;
  input.onkeydown = e => { if (e.key === 'Enter') submit(); };
  input.focus();
}

// ---------- 首页 ----------
function listStatus(pack, forOwner) {
  const { challenge: ch, reviews, checkins } = pack;
  const s = L.summarize(ch, reviews, checkins, now());
  if (s.phase === 'pending') return { text: '立项待审批', hot: !forOwner && !reviews.some(r => r.target_type === 'challenge' && r.reviewer_id === me.id && r.created_at >= ch.submitted_at) };
  if (s.phase === 'rejected') return { text: '立项被驳回，待修改', hot: forOwner };
  if (s.phase === 'ended') return { text: `已结案 · ${s.grade.name} · 完成率 ${L.rateText(s.comp.rate)}`, hot: false };
  if (forOwner) {
    const can = L.canSubmitToday(s);
    return { text: `第 ${s.dayIndex} 天 / 共 ${ch.days} 天 · ${can.ok ? '今日日报未提交' : '今日已交'}`, hot: can.ok };
  }
  const waiting = s.days.filter(d => d.status === 'pending' && d.checkin && !reviews.some(r => r.target_id === d.checkin.id && r.reviewer_id === me.id)).length;
  return { text: waiting ? `${waiting} 份日报待你审批` : `第 ${s.dayIndex} 天 / 共 ${ch.days} 天`, hot: waiting > 0 };
}

async function pageHome() {
  const { owned, approving } = await store.listMine(me.id);
  const sortHot = arr => arr.map(p => ({ p, st: listStatus(p, arr === owned) })).sort((a, b) => b.st.hot - a.st.hot || b.p.challenge.created_at - a.p.challenge.created_at);
  const item = ({ p, st }) => `<a class="item" href="#/c/${esc(p.challenge.id)}">
      <div class="r"><span class="t">${esc(p.challenge.objective)}</span>${st.hot ? '<span class="pill orange">待处理</span>' : ''}</div>
      <div class="s">${p.challenge.owner_id === me.id ? '' : esc(p.challenge.owner_name) + ' · '}${esc(st.text)}</div></a>`;
  $app.innerHTML = `${topbar()}
    <div class="hero"><h1>别人审批你花钱，<br>你用自律换审批。</h1><p>写下目标和想要的奖金，让朋友当你的上级。</p>
    <a class="btn" href="#/new">发起 OKR 立项</a></div>
    <h2 class="sec">我的立项 <small>${owned.length} 项</small></h2>
    ${owned.length ? sortHot(owned).map(item).join('') : '<p class="empty">还没有立项。写下一个目标和想要的奖金，再找朋友当你的上级。</p>'}
    <h2 class="sec">待我审批 <small>${approving.length} 项</small></h2>
    ${approving.length ? sortHot(approving).map(item).join('') : '<p class="empty">朋友把立项书发给你后，会出现在这里。</p>'}`;
}

// ---------- 立项书表单 ----------
async function pageForm({ editId, fromId }) {
  let base = null;
  const srcId = editId || fromId;
  if (srcId) {
    const data = await store.getChallenge(srcId);
    if (data && data.challenge.owner_id === me.id) base = data.challenge;
  }
  const v = base || { theme: 'fitness', freq_type: 'daily', freq_n: 3, days: 7 };
  const radio = (name, value, label, checked) =>
    `<input type="radio" id="${name}-${value}" name="${name}" value="${value}" ${checked ? 'checked' : ''}><label for="${name}-${value}">${label}</label>`;
  $app.innerHTML = `<a class="back" href="#/">‹ 返回</a>
    <div class="sheet"><h2 class="doc-title">OKR 立项书</h2><p class="doc-no">${editId ? '修改后重新提交审批' : '填写后发给上级审批'}</p>
    <form id="f" novalidate>
      <label class="f">考核方向</label>
      <div class="chips">${radio('theme', 'fitness', '健身', v.theme === 'fitness')}${radio('theme', 'english', '学英语', v.theme === 'english')}</div>
      <label class="f" for="objective">目标 O</label>
      <input id="objective" type="text" maxlength="40" placeholder="比如：春节前瘦 5 斤" value="${esc(v.objective || '')}">
      <label class="f">打卡频率</label>
      <div class="chips">${radio('freq', 'daily', '每天', v.freq_type === 'daily')}${radio('freq', 'weekly', '每周几次', v.freq_type === 'weekly')}</div>
      <div id="n-wrap" class="row" style="margin-top:8px">
        <span>每周</span><select id="n" style="width:auto">${[2, 3, 4, 5, 6].map(n => `<option ${n === v.freq_n ? 'selected' : ''}>${n}</option>`).join('')}</select><span>次</span>
      </div>
      <label class="f">考核周期</label>
      <div class="chips" id="days"></div>
      <label class="f" for="kr">打卡标准 <small>上级按这个审批日报</small></label>
      <input id="kr" type="text" maxlength="60" placeholder="比如：每次运动不少于 30 分钟，上传运动截图" value="${esc(v.kr || '')}">
      <label class="f" for="reward">奖金</label>
      <input id="reward" type="text" maxlength="30" placeholder="比如：一双新跑鞋" value="${esc(v.reward_name || '')}">
      <label class="f" for="amount">金额 <small>选填，单位元</small></label>
      <input id="amount" type="number" inputmode="decimal" min="0" placeholder="比如：599" value="${v.reward_amount ?? ''}">
      <button class="btn" type="submit">${editId ? '重新提交审批' : '提交立项'}</button>
      <p class="hint">提交后发给朋友。任意一位上级同意即立项；48 小时没人审批，系统默认通过。</p>
    </form></div>`;

  const f = $app.querySelector('#f');
  const daysWrap = f.querySelector('#days');
  const nWrap = f.querySelector('#n-wrap');
  let chosenDays = v.days;
  const paintDays = () => {
    const weekly = f.freq.value === 'weekly';
    nWrap.hidden = !weekly;
    const opts = weekly ? L.WEEKLY_PERIODS : L.DAILY_PERIODS;
    if (!opts.includes(chosenDays)) chosenDays = opts[0];
    daysWrap.innerHTML = opts.map(d => radio('days', d, `${d} 天`, d === chosenDays)).join('');
  };
  paintDays();
  f.addEventListener('change', e => {
    if (e.target.name === 'days') chosenDays = Number(e.target.value);
    if (e.target.name === 'freq') paintDays();
  });
  f.onsubmit = async e => {
    e.preventDefault();
    const objective = f.objective.value.trim();
    const reward = f.reward.value.trim();
    if (!objective) return toast('请填写目标 O');
    if (!reward) return toast('请填写奖金');
    const weekly = f.freq.value === 'weekly';
    const amount = f.amount.value === '' ? null : Number(f.amount.value);
    const fields = {
      theme: f.theme.value, objective, kr: f.kr.value.trim(),
      freq_type: weekly ? 'weekly' : 'daily', freq_n: weekly ? Number(f.n.value) : 7,
      days: chosenDays, reward_name: reward, reward_amount: Number.isFinite(amount) ? amount : null,
      submitted_at: now(), raise_accepted_at: null,
    };
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      if (editId) {
        await store.updateChallenge(editId, fields);
        go(`#/c/${editId}?share=1`);
      } else {
        const ch = { id: uid(), owner_id: me.id, owner_name: me.name, created_at: now(), abandoned_at: null, ...fields };
        await store.createChallenge(ch);
        go(`#/c/${ch.id}?share=1`);
      }
    } catch (err) { toast(err.message); btn.disabled = false; }
  };
}

// ---------- 立项详情 ----------
function opinionsHtml(ch, list, landId, auto) {
  const steps = [`<div class="step">${avatar(ch.owner_name, ch.owner_id)}<div><p class="who">${esc(ch.owner_name)}<span class="act start">发起申请</span><time>${fmtTime(ch.submitted_at)}</time></p></div></div>`];
  for (const r of list) {
    const act = r.result === 'pass' ? '同意了立项' : r.result === 'raise' ? '要求加码' : '驳回了立项';
    const words = r.result === 'raise'
      ? `${r.raise_days ? `周期改为 ${r.raise_days} 天` : ''}${r.raise_days && r.raise_n ? '，' : ''}${r.raise_n ? `每周 ${r.raise_n} 次` : ''}`
      : r.reason;
    steps.push(`<div class="step">${avatar(r.reviewer_name, r.reviewer_id)}<div>
      <p class="who">${esc(r.reviewer_name)}<span class="act ${r.result} ${r.id === landId ? 'pop' : ''}">${act}</span><time>${fmtTime(r.created_at)}</time></p>
      ${words ? `<p class="cm">${esc(words)}</p>` : ''}</div></div>`);
  }
  if (auto) steps.push(`<div class="step"><span class="av" style="background:#8F959E" aria-hidden="true">⏱</span><div><p class="who">系统<span class="act pass">默认通过</span></p><p class="cm">48 小时无人审批</p></div></div>`);
  else if (!list.length) steps.push(`<div class="step"><span class="av" style="background:#C2C6CC" aria-hidden="true">?</span><div><p class="who" style="color:#8F959E">等待上级审批</p></div></div>`);
  return `<div class="tl">${steps.join('')}</div>`;
}

function reasonPicker(id) {
  return `<div class="chips" data-reasons="${id}">${L.REJECT_REASONS.map((r, i) =>
    `<input type="radio" name="rs-${id}" id="rs-${id}-${i}" value="${esc(r)}"><label for="rs-${id}-${i}">${esc(r)}</label>`).join('')}</div>
    <input type="text" maxlength="30" placeholder="或者自己写驳回理由" data-reason-text="${id}" style="margin-top:8px">`;
}
function pickedReason(root, id) {
  const typed = root.querySelector(`[data-reason-text="${id}"]`).value.trim();
  const picked = root.querySelector(`input[name="rs-${id}"]:checked`);
  return typed || (picked ? picked.value : '');
}

async function pageDetail(id, params) {
  const data = await store.getChallenge(id);
  if (!data) {
    $app.innerHTML = `<a class="back" href="#/">‹ 返回</a><div class="sheet"><h2 class="doc-title">找不到这份立项书</h2>
      <p class="hint">链接可能不完整。请让发起人重新分享一次。${DEMO ? '<br>演示模式下，数据只存在发起人的手机里，别人打不开。' : ''}</p></div>`;
    return;
  }
  const { challenge: ch, members, reviews, checkins } = data;
  const isOwner = ch.owner_id === me.id;
  if (!isOwner && !members.some(m => m.user_id === me.id)) {
    await store.join({ challenge_id: ch.id, user_id: me.id, user_name: me.name, created_at: now() });
  }
  const t = now();
  const s = L.summarize(ch, reviews, checkins, t);
  const chReviews = reviews.filter(r => r.target_type === 'challenge' && r.created_at >= ch.submitted_at).sort((a, b) => a.created_at - b.created_at);
  const myChReview = chReviews.find(r => r.reviewer_id === me.id);
  const approvers = [...new Set(reviews.map(r => r.reviewer_name))];

  const landId = params.get('stamp') ? (chReviews.filter(r => r.result === 'pass').pop() || {}).id : null;
  const period = s.win ? `${ch.days} 天（${L.fmtDate(s.win.start)}—${L.fmtDate(s.win.end)}）` : `${ch.days} 天（审批通过当天开始）`;
  const rewardHtml = `${esc(ch.reward_name)}${ch.reward_amount ? ` <span class="money">¥${esc(ch.reward_amount)}</span>` : ''}`;
  const approvalBlock = `<div class="sheet"><h2 class="sec">立项审批 <small>任意一人同意即开始</small></h2>${opinionsHtml(ch, chReviews, landId, s.approval.auto)}</div>`;
  let dock = '';
  let html = `<a class="back" href="#/">‹ 返回</a>
  <div class="sheet">
    <div class="head"><h1 class="obj">${esc(ch.objective)}</h1>${statusPill(s)}</div>
    <p class="sub">${esc(ch.owner_name)} 的 OKR 立项 · 审批编号 ${L.serialFor(ch.id)}${s.phase === 'active' ? ` · 第 ${s.dayIndex} 天 / 共 ${ch.days} 天` : ''}</p>
    <dl class="kv"><dt>关键结果</dt><dd>${L.krText(ch)}${ch.kr ? `<br><span style="color:#646A73">${esc(ch.kr)}</span>` : ''}</dd>
      <dt>考核周期</dt><dd>${period}</dd><dt>奖金</dt><dd>${rewardHtml}</dd></dl>
  </div>`;

  // ----- 立项阶段 -----
  if (s.phase === 'pending' || s.phase === 'rejected') {
    html += approvalBlock;
    if (isOwner) {
      if (s.phase === 'rejected') {
        html += `<div class="notice red"><b>立项被驳回。</b>修改后可以重新提交，之前的审批记录作废。</div>`;
        dock = `<a class="btn" href="#/edit/${esc(ch.id)}">修改后重新提交</a>`;
      } else {
        const left = Math.max(0, Math.ceil((ch.submitted_at + L.CHALLENGE_AUTO_PASS_MS - t) / L.HOUR));
        html += `<div class="notice">把立项书发给朋友，<b>任意一人同意即开始</b>。${left} 小时内没人审批，系统默认通过。</div>`;
        dock = '<button class="btn" data-act="share">发给上级审批</button>';
        const raises = s.approval.raises.filter(r => r.reviewer_id !== me.id);
        if (raises.length) {
          html += `<h2 class="sec">上级要求加码</h2>` + raises.map(r => `<div class="report"><p>${esc(r.reviewer_name)} 建议：${r.raise_days ? `周期改为 <b>${r.raise_days} 天</b>` : ''}${r.raise_n ? ` 每周 <b>${r.raise_n} 次</b>` : ''}</p>
            <button class="btn pen" data-act="accept-raise" data-rid="${esc(r.id)}">接受加码并立项</button></div>`).join('');
        }
      }
    } else if (s.phase === 'pending' && !myChReview) {
      const dayOpts = (ch.freq_type === 'weekly' ? L.WEEKLY_PERIODS : L.DAILY_PERIODS).filter(d => d > ch.days);
      html += `<div class="notice">${esc(ch.owner_name)} 指定你为<b>直属上级</b>，请审批这份立项。</div>
        <div class="btns"><button class="btn ghost" data-act="ch-reject-open">驳回</button><button class="btn pen" data-act="ch-raise-open" ${dayOpts.length || ch.freq_type === 'weekly' ? '' : 'disabled'}>加码</button><button class="btn" data-act="ch-pass">同意</button></div>
        <div id="ch-reject" hidden class="sheet" style="margin-top:10px">${reasonPicker('ch')}<button class="btn" data-act="ch-reject">确认驳回</button></div>
        <div id="ch-raise" hidden class="sheet" style="margin-top:10px">
          ${dayOpts.length ? `<label class="f" style="margin-top:0">周期加到</label><div class="chips">${dayOpts.map((d, i) => `<input type="radio" name="rd" id="rd${i}" value="${d}"><label for="rd${i}">${d} 天</label>`).join('')}</div>` : ''}
          ${ch.freq_type === 'weekly' && ch.freq_n < 6 ? `<label class="f">频率加到</label><div class="chips">${[ch.freq_n + 1, ch.freq_n + 2].filter(n => n <= 6).map((n, i) => `<input type="radio" name="rn" id="rn${i}" value="${n}"><label for="rn${i}">每周 ${n} 次</label>`).join('')}</div>` : ''}
          <button class="btn pen" data-act="ch-raise">提交加码意见</button></div>`;
    } else if (s.phase === 'pending') {
      html += `<div class="notice">你已提交审批意见，等申请人处理。</div>`;
    } else {
      html += `<div class="notice red">立项已被驳回，等申请人修改后重新提交。</div>`;
    }
  }

  // ----- 考核阶段 -----
  if (s.phase === 'active' || s.phase === 'ended') {
    const marks = { pending: '待', rejected: '驳', missed: '缺', today: '今' };
    const grid = `<div class="grid-days">${s.days.map(d => `<div class="cell ${d.status}" title="${L.fmtDate(d.date)}">${marks[d.status] || Number(d.date.slice(8))}</div>`).join('')}</div>
      <p class="legend">蓝色 = 审批通过 · 待 = 待审批 · 驳 = 被驳回可重交 · 缺 = 未完成${ch.freq_type === 'weekly' ? ' · 灰色日期 = 当天没打卡（每周模式不扣分）' : ''}</p>`;

    if (s.phase === 'ended') {
      const bonusLine = ch.abandoned_at ? '申请人已主动申请毕业，奖金不予发放。'
        : s.grade.bonus ? `奖金「${esc(ch.reward_name)}」已批准发放。` : '未达到发放标准（完成率 80%），奖金驳回。';
      html += `<div class="result ${s.grade.bonus ? '' : 'fail'}"><p class="rh">结案通知</p>
        <div class="badge"><span class="hole"></span><span class="role">申请人 · ${esc(ch.owner_name)}</span><span class="stamp">${s.grade.bonus ? 'APPROVED' : 'REJECTED'}</span>
          <p class="obj">${esc(ch.objective)}</p>
          <p class="big">${L.rateText(s.comp.rate)}<small>完成率</small></p>
          <span class="lv">${s.grade.name}${s.grade.tag ? ` · ${s.grade.tag}` : ''}</span>
          <p class="hint">打卡通过 ${s.comp.done} 次 / 目标 ${s.comp.expected} 次${s.comp.perfect ? ' · 全勤零驳回' : ''}${s.comp.capped ? ' · 有一周断档，超额不计' : ''}</p></div>
        <p class="rf">${bonusLine}</p></div>
        <div id="card-out"></div>
        <div class="sheet"><h2 class="sec">考核记录</h2>${grid}</div>`;
      dock = `${isOwner ? `<a class="btn ghost" href="#/new?from=${esc(ch.id)}">再立一项</a>` : ''}<button class="btn" data-act="card">生成分享卡片</button>`;
    } else {
      const can = L.canSubmitToday(s);
      html += `<div class="sheet"><h2 class="sec">考核进度 <small>第 ${s.dayIndex} 天 / 共 ${ch.days} 天</small></h2>
        <div class="stats"><div><b>${s.comp.done} 次</b><span>已通过 · 目标 ${s.comp.expected}</span></div>
        <div><b>${L.rateText(s.comp.rate)}</b><span>当前完成率</span></div>
        <div><b>${s.grade.name}</b><span>绩效预估</span></div></div>${grid}</div>`;
      if (isOwner) {
        if (!can.ok) html += `<div class="notice">今日日报已提交。${s.todayStatus && s.todayStatus.status === 'missed' ? '今天的日报两次被驳回，记为未完成。' : ''}</div>`;
        dock = can.ok
          ? `<button class="btn ghost" data-act="share">邀请上级</button><a class="btn" href="#/c/${esc(ch.id)}/report">${can.attempt === 2 ? '重新提交日报' : '提交今日日报'}</a>`
          : '<button class="btn ghost" style="flex:1" data-act="share">邀请更多上级</button>';
      }
    }

    const sorted = [...checkins].sort((a, b) => b.created_at - a.created_at);
    html += `<h2 class="sec">日报 <small>${checkins.length} 份</small></h2>`;
    if (!sorted.length) html += `<p class="empty">${isOwner ? '还没有日报。完成今天的运动或学习后，拍张截图提交。' : '申请人还没有提交日报。'}</p>`;
    html += sorted.map(k => {
      const st = L.checkinStatus(k, reviews, t);
      const krs = reviews.filter(r => r.target_type === 'checkin' && r.target_id === k.id);
      const mine = krs.some(r => r.reviewer_id === me.id);
      const tag = st.status === 'pass' ? `<span class="pill green">${st.auto ? '默认通过' : '已通过'}</span>` : st.status === 'pending' ? '<span class="pill blue">待审批</span>' : '<span class="pill orange">已驳回</span>';
      const canReview = !isOwner && !mine && st.status === 'pending' && s.phase === 'active';
      return `<article class="report"><header><b>${L.fmtDate(k.date)}${k.attempt > 1 ? ' · 重交' : ''}</b>${tag}</header>
        ${k.image_url ? `<img src="${esc(k.image_url)}" alt="${esc(ch.owner_name)} ${L.fmtDate(k.date)} 的打卡图" loading="lazy">` : ''}
        ${k.note ? `<p>${esc(k.note)}</p>` : ''}
        ${krs.map(r => `<div class="mini-op">${avatar(r.reviewer_name, r.reviewer_id)}<span class="cm"><b>${esc(r.reviewer_name)}</b> <span class="act ${r.result}">${reviewLabel(r)}</span>${r.reason ? `：${esc(r.reason)}` : ''}</span></div>`).join('')}
        ${canReview ? `<div class="btns" style="grid-template-columns:1fr 1fr;margin-top:10px"><button class="btn ghost" data-act="k-reject-open" data-kid="${esc(k.id)}">驳回</button><button class="btn" data-act="k-pass" data-kid="${esc(k.id)}">通过</button></div>
          <div hidden data-kreject="${esc(k.id)}" style="margin-top:8px">${reasonPicker(k.id)}<button class="btn" data-act="k-reject" data-kid="${esc(k.id)}">确认驳回</button></div>` : ''}
      </article>`;
    }).join('');
    html += approvalBlock;
    if (isOwner && s.phase === 'active') html += `<button class="link-btn" data-act="abandon">主动申请毕业（放弃本次考核）</button>`;
  }

  if (dock) html += `<div class="dock"><div class="in">${dock}</div></div>`;
  $app.innerHTML = html;

  if (params.get('share') && isOwner && s.phase === 'pending') toast('立项书已生成，发给朋友审批吧');

  // ----- 事件 -----
  const review = (fields) => store.addReview({
    id: uid(), challenge_id: ch.id, reviewer_id: me.id, reviewer_name: me.name, created_at: now(), reason: '', raise_days: null, raise_n: null, ...fields,
  });
  $app.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    try {
      if (act === 'share') return share(ch);
      if (act === 'ch-pass') { b.disabled = true; await review({ target_type: 'challenge', target_id: ch.id, result: 'pass' }); return go(`#/c/${ch.id}?stamp=1`); }
      if (act === 'ch-reject-open') { $app.querySelector('#ch-reject').hidden = false; $app.querySelector('#ch-raise').hidden = true; return; }
      if (act === 'ch-raise-open') { $app.querySelector('#ch-raise').hidden = false; $app.querySelector('#ch-reject').hidden = true; return; }
      if (act === 'ch-reject') {
        const reason = pickedReason($app, 'ch');
        if (!reason) return toast('选一个驳回理由，或自己写一句');
        b.disabled = true; await review({ target_type: 'challenge', target_id: ch.id, result: 'reject', reason }); return render();
      }
      if (act === 'ch-raise') {
        const rd = $app.querySelector('input[name=rd]:checked');
        const rn = $app.querySelector('input[name=rn]:checked');
        if (!rd && !rn) return toast('选择要加码的周期或频率');
        b.disabled = true;
        await review({ target_type: 'challenge', target_id: ch.id, result: 'raise', raise_days: rd ? Number(rd.value) : null, raise_n: rn ? Number(rn.value) : null });
        return render();
      }
      if (act === 'accept-raise') {
        const r = reviews.find(x => x.id === b.dataset.rid);
        b.disabled = true;
        await store.updateChallenge(ch.id, { days: r.raise_days || ch.days, freq_n: r.raise_n || ch.freq_n, raise_accepted_at: now() });
        return go(`#/c/${ch.id}?stamp=1`);
      }
      if (act === 'k-pass') { b.disabled = true; await review({ target_type: 'checkin', target_id: b.dataset.kid, result: 'pass' }); return render(); }
      if (act === 'k-reject-open') { $app.querySelector(`[data-kreject="${CSS.escape(b.dataset.kid)}"]`).hidden = false; return; }
      if (act === 'k-reject') {
        const reason = pickedReason($app, b.dataset.kid);
        if (!reason) return toast('选一个驳回理由，或自己写一句');
        b.disabled = true; await review({ target_type: 'checkin', target_id: b.dataset.kid, result: 'reject', reason }); return render();
      }
      if (act === 'abandon') {
        if (!confirm('确定放弃本次考核吗？评级将记为「毕业」，奖金不予发放。')) return;
        await store.updateChallenge(ch.id, { abandoned_at: now() }); return render();
      }
      if (act === 'card') {
        b.disabled = true; b.textContent = '正在生成…';
        const url = drawResultCard({ ch, s, approvers });
        const out = $app.querySelector('#card-out');
        out.innerHTML = `<p class="hint" style="text-align:center;margin:0 0 4px">长按图片保存，发朋友圈或小红书</p><img class="card-img" src="${url}" alt="${esc(ch.owner_name)}的结案卡片：${esc(ch.objective)}，完成率 ${L.rateText(s.comp.rate)}，${s.grade.name}">`;
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
        b.textContent = '已生成，长按保存';
      }
    } catch (err) { toast(err.message); b.disabled = false; }
  };
}

// ---------- 提交日报 ----------
function compress(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1080;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('图片处理失败，请换一张')), 'image/jpeg', DEMO ? 0.55 : 0.75);
    };
    img.onerror = () => reject(new Error('读不出这张图片，请换一张'));
    img.src = url;
  });
}

async function pageReport(id) {
  const data = await store.getChallenge(id);
  if (!data || data.challenge.owner_id !== me.id) return go(`#/c/${id}`);
  const { challenge: ch, reviews, checkins } = data;
  const s = L.summarize(ch, reviews, checkins, now());
  const can = L.canSubmitToday(s);
  if (!can.ok) return go(`#/c/${id}`);
  $app.innerHTML = `<a class="back" href="#/c/${esc(id)}">‹ 返回</a>
    <div class="sheet"><h2 class="doc-title">工作日报</h2><p class="doc-no">${L.fmtDate(L.bjDate(now()))} · 第 ${s.dayIndex} 天${can.attempt === 2 ? ' · 重新提交' : ''}</p>
    <p class="hint">打卡标准：${esc(ch.kr || L.krText(ch))}</p>
    <label class="f" for="pic">打卡截图</label>
    <input id="pic" type="file" accept="image/*">
    <img id="pv" class="preview" alt="打卡截图预览" hidden>
    <label class="f" for="note">今日工作内容 <small>选填</small></label>
    <textarea id="note" maxlength="100" placeholder="比如：跑步 5 公里，配速 6 分 30 秒"></textarea>
    <button class="btn" id="go">提交日报</button></div>`;
  let blob = null;
  const pv = $app.querySelector('#pv');
  $app.querySelector('#pic').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { blob = await compress(file); pv.src = URL.createObjectURL(blob); pv.hidden = false; } catch (err) { toast(err.message); }
  };
  $app.querySelector('#go').onclick = async e => {
    if (!blob) return toast('请上传一张打卡截图');
    e.target.disabled = true; e.target.textContent = '提交中…';
    try {
      await store.addCheckin({ id: uid(), challenge_id: id, date: L.bjDate(now()), attempt: can.attempt, note: $app.querySelector('#note').value.trim(), created_at: now() }, blob);
      toast('日报已提交，等上级审批');
      go(`#/c/${id}`);
    } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = '提交日报'; }
  };
}

// ---------- 路由 ----------
async function render() {
  renderDemoBar();
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  if (!me) return nameGate(render);
  window.scrollTo(0, 0);
  try {
    let m;
    if ((m = path.match(/^\/c\/([^/]+)\/report$/))) return await pageReport(decodeURIComponent(m[1]));
    if ((m = path.match(/^\/c\/([^/]+)$/))) return await pageDetail(decodeURIComponent(m[1]), params);
    if ((m = path.match(/^\/edit\/([^/]+)$/))) return await pageForm({ editId: decodeURIComponent(m[1]) });
    if (path === '/new') return await pageForm({ fromId: params.get('from') });
    return await pageHome();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="sheet"><h2 class="doc-title">加载失败</h2><p class="hint">${esc(err.message)}</p>
      <button class="btn" onclick="location.reload()">重新加载</button></div>`;
  }
}

window.addEventListener('hashchange', render);
render();
