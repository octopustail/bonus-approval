// 分享卡片：蓝底撞色工牌，1080 × 1440（3:4，适合朋友圈和小红书），长按保存
import * as L from './logic.js';

const FONT = '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const BLUE = '#2D3BFF', ORANGE = '#FF6B2C', LIME = '#C8F25C', INK = '#1F2329', MUTED = '#8F959E', SOFT = '#F1F2FF';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
  }
  return lines;
}

function chip(ctx, x, y, text, font, bg, fg, padX, h) {
  ctx.font = font;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = bg; rr(ctx, x, y, w, h, h / 2 > 24 ? 20 : h / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.fillText(text, x + padX, y + h / 2 + 2);
  ctx.textBaseline = 'alphabetic';
  return w;
}

export function drawResultCard({ ch, s, approvers }) {
  const W = 1080, H = 1440;
  const ok = s.grade.bonus;
  const bg = ok ? BLUE : '#3B3F45';
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // 底色
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // 顶部标题
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.font = `900 52px ${FONT}`; ctx.fillText('奖金请批准', 80, 138);
  ctx.globalAlpha = 0.75; ctx.font = `600 32px ${FONT}`; ctx.fillText('结案通知 · 用自律换审批', 80, 192); ctx.globalAlpha = 1;
  ctx.textAlign = 'right'; ctx.font = `600 30px ${FONT}`; ctx.globalAlpha = 0.75;
  ctx.fillText(`No.${L.serialFor(ch.id)}`, W - 80, 138); ctx.globalAlpha = 1;

  // 工牌
  const bx = 72, by = 250, bw = W - 144, bh = 900;
  ctx.save(); ctx.translate(W / 2, by + bh / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -(by + bh / 2));
  ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(ctx, bx + 10, by + 16, bw, bh, 56); ctx.fill();
  ctx.fillStyle = '#fff'; rr(ctx, bx, by, bw, bh, 56); ctx.fill();
  ctx.fillStyle = bg; rr(ctx, W / 2 - 70, by + 30, 140, 26, 13); ctx.fill();

  const px = bx + 64;
  ctx.textAlign = 'left';
  chip(ctx, px, by + 104, `申请人 · ${ch.owner_name}`, `800 32px ${FONT}`, ORANGE, '#fff', 26, 60);

  // 目标
  ctx.fillStyle = INK; ctx.font = `900 76px ${FONT}`;
  const objLines = wrap(ctx, ch.objective, bw - 128 - 40, 2);
  objLines.forEach((ln, i) => ctx.fillText(ln, px, by + 270 + i * 92));
  let y = by + 270 + (objLines.length - 1) * 92;

  // 完成率
  y += 210;
  ctx.fillStyle = ok ? BLUE : INK; ctx.font = `900 200px ${FONT}`;
  const rate = L.rateText(s.comp.rate);
  ctx.fillText(rate, px - 6, y);
  const rw = ctx.measureText(rate).width;
  ctx.fillStyle = MUTED; ctx.font = `600 36px ${FONT}`; ctx.fillText('完成率', px + rw + 16, y - 6);

  // 评级
  y += 50;
  chip(ctx, px, y, `${s.grade.name}${s.grade.tag ? ' · ' + s.grade.tag : ''}`, `900 46px ${FONT}`, ok ? LIME : '#EBECEF', ok ? INK : MUTED, 30, 84);

  // 明细
  y += 150;
  const rows = [
    ['关键结果', `${L.krText(ch)} · ${ch.days} 天打卡 ${s.comp.done} 次`],
    ['奖金', ch.reward_name + (ch.reward_amount ? ` ¥${ch.reward_amount}` : '')],
    ['审批人', approvers.length ? approvers.slice(0, 3).join('、') + (approvers.length > 3 ? ' 等' : '') : '系统默认通过'],
  ];
  ctx.fillStyle = SOFT; rr(ctx, px, y - 74, bw - 128, rows.length * 66 + 60, 28); ctx.fill();
  rows.forEach(([k, v], i) => {
    ctx.fillStyle = MUTED; ctx.font = `500 34px ${FONT}`; ctx.fillText(k, px + 32, y + i * 66);
    ctx.fillStyle = INK; ctx.font = `700 34px ${FONT}`;
    ctx.fillText(wrap(ctx, v, bw - 128 - 240, 1)[0], px + 200, y + i * 66);
  });

  // 印章
  ctx.save();
  ctx.translate(bx + bw - 210, by + 150); ctx.rotate(-0.21);
  const stampText = ok ? 'APPROVED' : 'REJECTED';
  const stampColor = ok ? ORANGE : MUTED;
  ctx.font = `900 58px ${FONT}`;
  const sw = ctx.measureText(stampText).width + 44;
  ctx.strokeStyle = stampColor; ctx.lineWidth = 8;
  rr(ctx, -sw / 2, -46, sw, 92, 18); ctx.stroke();
  ctx.fillStyle = stampColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(stampText, 0, 4);
  ctx.restore();
  ctx.restore();

  // 底部
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff'; ctx.font = `800 38px ${FONT}`;
  const verdict = ch.abandoned_at ? '已主动申请毕业，奖金不予发放'
    : ok ? `奖金已批准发放：${ch.reward_name}` : '未达发放标准，奖金驳回';
  ctx.fillText(wrap(ctx, verdict, W - 160, 1)[0], 80, 1290);
  ctx.globalAlpha = 0.75; ctx.font = `500 30px ${FONT}`;
  ctx.fillText(`${L.fmtDate(s.win.start)} — ${L.fmtDate(s.win.end)} · 你也来立一项？搜「奖金请批准」`, 80, 1344);
  ctx.globalAlpha = 1;

  return c.toDataURL('image/png');
}
