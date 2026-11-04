// 结案通知书卡片：1080 × 1440，公文红头 + 印章，长按保存
import * as L from './logic.js';

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif';
const SANS = '-apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const RED = '#C0262D', INK = '#1D2226', MUTED = '#6B7378', PEN = '#24489A', GRID = '#DCE6DF';

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

function stamp(ctx, x, y, top, bottom, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.24);
  ctx.globalAlpha = 0.86;
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 128, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `700 76px ${SERIF}`; ctx.fillText(top, 0, 18);
  ctx.font = `400 30px ${SERIF}`; ctx.fillText(bottom, 0, 74);
  // 五角星
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 4 / 5);
    const px = Math.cos(a) * 22, py = -82 + Math.sin(a) * 22;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawResultCard({ ch, s, approvers }) {
  const W = 1080, H = 1440, P = 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);

  // 红头
  ctx.fillStyle = RED; ctx.textAlign = 'center';
  ctx.font = `700 92px ${SERIF}`;
  ctx.fillText('奖金审批结果通知书', W / 2, 190);
  ctx.fillStyle = MUTED; ctx.font = `400 34px ${SERIF}`;
  ctx.fillText(`自律字〔${new Date(ch.created_at).getFullYear()}〕第 ${L.serialFor(ch.id)} 号`, W / 2, 262);
  ctx.fillStyle = RED;
  ctx.fillRect(P, 300, W - 2 * P, 6);
  ctx.fillRect(P, 316, W - 2 * P, 2);

  // 正文
  ctx.textAlign = 'left';
  let y = 410;
  ctx.fillStyle = INK; ctx.font = `400 40px ${SERIF}`;
  ctx.fillText(`${ch.owner_name}同志：`, P, y);
  y += 84;

  const rows = [
    ['考核目标', ch.objective],
    ['考核周期', `${L.fmtDate(s.win.start)} 至 ${L.fmtDate(s.win.end)}，共 ${ch.days} 天`],
    ['完成情况', `${L.rateText(s.comp.rate)}（${s.comp.done} / ${s.comp.expected} 次）${s.comp.perfect ? '，全勤零驳回' : ''}`],
    ['奖金', ch.reward_name + (ch.reward_amount ? `（¥${ch.reward_amount}）` : '')],
  ];
  const labelW = 210;
  for (const [k, v] of rows) {
    ctx.fillStyle = MUTED; ctx.font = `400 36px ${SANS}`;
    ctx.fillText(k, P, y);
    ctx.fillStyle = INK; ctx.font = `700 40px ${SERIF}`;
    const lines = wrap(ctx, v, W - 2 * P - labelW);
    lines.forEach((ln, i) => ctx.fillText(ln, P + labelW, y + i * 56));
    y += 56 * lines.length + 28;
    ctx.fillStyle = GRID; ctx.fillRect(P, y - 50, W - 2 * P, 2);
  }

  // 评级
  y += 40;
  ctx.fillStyle = MUTED; ctx.font = `400 36px ${SANS}`;
  ctx.fillText('绩效评级', P, y);
  ctx.fillStyle = s.grade.bonus ? RED : INK; ctx.font = `700 104px ${SERIF}`;
  ctx.fillText(s.grade.name, P, y + 124);
  if (s.grade.tag) {
    const w = ctx.measureText(s.grade.name).width;
    ctx.font = `700 46px ${SERIF}`; ctx.fillText(`· ${s.grade.tag}`, P + w + 20, y + 120);
  }

  // 结论
  y += 220;
  ctx.fillStyle = PEN; ctx.font = `400 46px "Kaiti SC", "STKaiti", "KaiTi", ${SERIF}`;
  const verdict = ch.abandoned_at ? '本人主动申请毕业，奖金不予发放。'
    : s.grade.bonus ? '经审议，准予发放。' : '未达发放标准，奖金驳回。';
  wrap(ctx, verdict, W - 2 * P - 280).forEach((ln, i) => ctx.fillText(ln, P, y + i * 62));

  // 落款
  const signY = 1250;
  ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `400 36px ${SERIF}`;
  const signer = approvers.length ? `审批人：${approvers.slice(0, 3).join('、')}${approvers.length > 3 ? ' 等' : ''}` : '审批人：系统默认通过';
  ctx.fillText(signer, W - P, signY);
  ctx.fillText(L.fmtDate(s.win.end), W - P, signY + 56);

  stamp(ctx, W - P - 170, signY - 40, s.grade.bonus ? '批准' : '驳回', s.grade.bonus ? '发放奖金' : '奖 金', s.grade.bonus ? RED : PEN);

  // 页脚
  ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = `400 28px ${SANS}`;
  ctx.fillText('奖金请批准 · 用自律换审批', W / 2, H - 48);

  return c.toDataURL('image/png');
}
