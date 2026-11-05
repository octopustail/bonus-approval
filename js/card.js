// 分享卡：1080 × 1440（3:4，朋友圈 / 小红书），一张盖满戳的集戳卡
import * as L from './logic.js';

const FONT = '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const MINT = '#DDF3E9', EDGE = '#B9DCCB', INK = '#222222', MUTED = '#5E6E67', DASH = '#C9D9D1', YELLOW = '#FFE15C';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
function stamp(ctx, cx, cy, r, text, color, tiltDeg) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tiltDeg * Math.PI / 180);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const size = [...text].length > 1 ? r * 0.62 : r * 0.9;
  ctx.font = `900 ${size}px ${FONT}`; ctx.fillText(text, 0, r * 0.04);
  ctx.restore();
}

export function drawShareCard({ card, sum, stamps, buddies }) {
  const W = 1080, H = 1440;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = MINT; ctx.fillRect(0, 0, W, H);

  // 标题
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK;
  ctx.font = `900 96px ${FONT}`;
  ctx.fillText(sum.full ? '集满了！' : `差 ${sum.missing} 个戳`, 80, 190);
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(fit(ctx, sum.full ? `换到${card.reward_name}` : '这次先欠着，下次一定', W - 160), 80, 272);

  // 卡片
  const cx = 64, cw = W - 128;
  const cols = sum.target + 1 <= 8 ? 4 : sum.target + 1 <= 15 ? 5 : 6;
  const rows = Math.ceil((sum.target + 1) / cols);
  const gap = 26, inner = cw - 112;
  const cell = (inner - gap * (cols - 1)) / cols;
  const gridH = rows * cell + (rows - 1) * gap;
  const ch = 210 + gridH + 120;
  const cy = Math.round(312 + Math.max(0, (H - 230 - 312 - ch) / 2));
  ctx.fillStyle = EDGE; rr(ctx, cx, cy + 10, cw, ch, 48); ctx.fill();
  ctx.fillStyle = '#fff'; rr(ctx, cx, cy, cw, ch, 48); ctx.fill();

  ctx.fillStyle = INK; ctx.font = `900 56px ${FONT}`;
  ctx.fillText(fit(ctx, card.goal, inner), cx + 56, cy + 104);
  ctx.fillStyle = MUTED; ctx.font = `500 34px ${FONT}`;
  ctx.fillText(`${L.rhythmText(card)} · 集到 ${Math.min(sum.count, sum.target)} / ${sum.target} 个戳${sum.extra ? ` · 多集 ${sum.extra} 个` : ''}`, cx + 56, cy + 160);

  const gx = cx + 56, gy = cy + 210;
  const filled = sum.stamped.slice(0, sum.target);
  for (let i = 0; i < sum.target + 1; i++) {
    const x = gx + (i % cols) * (cell + gap) + cell / 2;
    const y = gy + Math.floor(i / cols) * (cell + gap) + cell / 2;
    const r = cell / 2;
    if (i === sum.target) {
      ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${r * 0.95}px ${FONT}`; ctx.fillText('🎁', x, y + r * 0.05);
      continue;
    }
    const k = filled[i];
    if (k) {
      const s = stamps.find(z => z.checkin_id === k.id && z.kind === 'stamp');
      const st = s || { ...L.AUTO_STAMP, id: 'auto-' + k.id };
      stamp(ctx, x, y, r, st.text, st.color, L.tiltFor(st.id));
    } else {
      ctx.setLineDash([12, 10]); ctx.strokeStyle = DASH; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r - 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // 奖励条
  const ry = gy + gridH + 40;
  ctx.fillStyle = '#F4F8F6'; rr(ctx, cx + 56, ry, inner, 70, 22); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = MUTED; ctx.font = `500 32px ${FONT}`; ctx.fillText('集满奖励', cx + 84, ry + 36);
  ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `800 34px ${FONT}`;
  ctx.fillText(fit(ctx, card.reward_name + (card.reward_amount ? ` ¥${card.reward_amount}` : ''), inner - 220), cx + 56 + inner - 28, ry + 36);

  // 页脚
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const names = buddies.map(b => b.user_name);
  ctx.fillStyle = INK; ctx.font = `700 36px ${FONT}`;
  ctx.fillText(fit(ctx, names.length ? `盖戳的搭子：${names.slice(0, 4).join('、')}${names.length > 4 ? ' 等' : ''}` : '一个人也坚持下来了', W - 340), 80, H - 140);
  ctx.fillStyle = MUTED; ctx.font = `500 30px ${FONT}`;
  ctx.fillText(`${L.fmtDate(sum.win.start)} — ${L.fmtDate(sum.win.end)} · ${card.owner_name} 的集戳卡`, 80, H - 88);
  // 角标
  ctx.save(); ctx.translate(W - 150, H - 120); ctx.rotate(-0.2);
  ctx.strokeStyle = '#E8434F'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#E8434F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 30px ${FONT}`; ctx.fillText('集个', 0, -16); ctx.fillText('戳戳', 0, 22);
  ctx.restore();

  return c.toDataURL('image/png');
}
