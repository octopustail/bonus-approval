// 分享卡：1080 × 1440（3:4，朋友圈 / 小红书）。戳和咕咕都用 art.js 的同一套 SVG 画上去。
import * as L from './logic.js?v=20261106';
import { stampSvg, stampColor, svgImage, pigeonSvg, badgeSvg } from './art.js?v=20261106';
import { RARITY } from './achievements.js?v=20261106';

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
function drawTilted(ctx, img, cx, cy, size, deg) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(deg * Math.PI / 180);
  ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.restore();
}
async function footer(ctx, W, H, line1, line2) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = `700 36px ${FONT}`; ctx.fillText(fit(ctx, line1, W - 360), 80, H - 140);
  ctx.fillStyle = MUTED; ctx.font = `500 30px ${FONT}`; ctx.fillText(fit(ctx, line2, W - 360), 80, H - 88);
  const gu = await svgImage(pigeonSvg('happy', '', 200));
  ctx.drawImage(gu, W - 250, H - 260, 170, 170);
  ctx.fillStyle = '#E8434F'; ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('集个戳戳', W - 165, H - 70);
}

export async function drawShareCard({ card, sum, stamps, buddies, preview = false }) {
  const once = card.freq_type === 'once';
  const W = 1080, H = 1440;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = MINT; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK;
  ctx.font = `900 96px ${FONT}`;
  ctx.fillText(sum.full ? (once ? '搞定了！' : '集满了！') : once ? '这次没完成' : `差 ${sum.missing} 个戳`, 80, 190);
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(fit(ctx, sum.full ? `换到${card.reward_name}` : '这次先欠着，下次一定', W - 160), 80, 272);

  const cx = 64, cw = W - 128;
  const n = sum.target + 1;
  const cols = n <= 2 ? 3 : n <= 8 ? 4 : n <= 15 ? 5 : 6;
  const rows = Math.ceil(n / cols);
  const gap = 26, inner = cw - 112;
  const cell = (inner - gap * (cols - 1)) / cols;
  const gridH = rows * cell + (rows - 1) * gap;
  const ch = 210 + gridH + 120;
  const cy = Math.round(312 + Math.max(0, (H - 300 - 312 - ch) / 2));
  ctx.fillStyle = EDGE; rr(ctx, cx, cy + 10, cw, ch, 48); ctx.fill();
  ctx.fillStyle = '#fff'; rr(ctx, cx, cy, cw, ch, 48); ctx.fill();

  ctx.fillStyle = INK; ctx.font = `900 56px ${FONT}`;
  ctx.fillText(fit(ctx, card.goal, inner), cx + 56, cy + 104);
  ctx.fillStyle = MUTED; ctx.font = `500 34px ${FONT}`;
  ctx.fillText(once ? `${L.rhythmText(card)} · ${sum.full ? '搭子盖戳认证' : '没赶上'}` : `${L.rhythmText(card)} · 集到 ${Math.min(sum.count, sum.target)} / ${sum.target} 个戳${sum.extra ? ` · 多集 ${sum.extra} 个` : ''}`, cx + 56, cy + 160);

  // 先把要画的戳都转成图片
  const filled = sum.stamped.slice(0, sum.target);
  const imgs = await Promise.all(filled.map(k => {
    const s = stamps.find(z => z.checkin_id === k.id && z.kind === 'stamp') || { id: 'auto-' + k.id, text: '@gu:auto', color: '#E8434F' };
    return svgImage(stampSvg(s.text, stampColor(s.text, s.color), '')).then(img => ({ img, tilt: L.tiltFor(s.id || s.text) }));
  }));

  const gx = cx + 56, gy = cy + 210;
  for (let i = 0; i < n; i++) {
    const x = gx + (i % cols) * (cell + gap) + cell / 2;
    const y = gy + Math.floor(i / cols) * (cell + gap) + cell / 2;
    const r = cell / 2;
    if (i === sum.target) {
      ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${r * 0.95}px ${FONT}`; ctx.fillText('🎁', x, y + r * 0.05);
      ctx.textBaseline = 'alphabetic';
    } else if (imgs[i]) {
      drawTilted(ctx, imgs[i].img, x, y, cell, imgs[i].tilt);
    } else {
      ctx.setLineDash([12, 10]); ctx.strokeStyle = DASH; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r - 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  const ry = gy + gridH + 40;
  ctx.fillStyle = '#F4F8F6'; rr(ctx, cx + 56, ry, inner, 70, 22); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = MUTED; ctx.font = `500 32px ${FONT}`; ctx.fillText(once ? '完成奖励' : '集满奖励', cx + 84, ry + 36);
  ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `800 34px ${FONT}`;
  ctx.fillText(fit(ctx, card.reward_name + (card.reward_amount ? ` ¥${card.reward_amount}` : ''), inner - 220), cx + 56 + inner - 28, ry + 36);

  const names = buddies.map(b => b.user_name);
  await footer(ctx, W, H,
    names.length ? `盖戳的搭子：${names.slice(0, 4).join('、')}${names.length > 4 ? ' 等' : ''}` : '一个人也没鸽',
    `${L.fmtDate(sum.win.start)} — ${L.fmtDate(sum.win.end)} · ${card.owner_name} 的集戳卡`);

  if (preview) {
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.5);
    ctx.fillStyle = 'rgba(34,34,34,0.10)'; ctx.font = `900 260px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('预览', 0, 0); ctx.restore();
  }
  return c.toDataURL('image/png');
}

// 单个成就的分享卡
export async function drawAchievementCard({ ach, userName, at }) {
  const W = 1080, H = 1440;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const rar = RARITY[ach.rarity];
  ctx.fillStyle = MINT; ctx.fillRect(0, 0, W, H);
  // 放射光
  ctx.save(); ctx.translate(W / 2, 640);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 18; i++) { ctx.rotate(Math.PI / 9); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -560); ctx.lineTo(60, -560); ctx.closePath(); ctx.fill(); }
  ctx.restore();

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rar.color; ctx.font = `800 40px ${FONT}`; ctx.fillText(`解锁成就 · ${rar.name}`, W / 2, 190);
  ctx.fillStyle = INK; ctx.font = `900 ${[...ach.name].length > 6 ? 76 : 96}px ${FONT}`; ctx.fillText(ach.name, W / 2, 310);

  const badge = await svgImage(badgeSvg(ach.glyph, ach.rarity, 'on', 440));
  ctx.drawImage(badge, W / 2 - 220, 390, 440, 440);

  ctx.fillStyle = INK; ctx.font = `700 46px ${FONT}`; ctx.fillText(fit(ctx, ach.desc, W - 180), W / 2, 920);
  ctx.fillStyle = MUTED; ctx.font = `500 34px ${FONT}`; ctx.fillText(fit(ctx, `解锁条件：${ach.rule}`, W - 180), W / 2, 990);

  await footer(ctx, W, H, `${userName} 的成就`, `${L.fmtDate(L.bjDate(at))} 解锁 · 你也来集个戳？`);
  return c.toDataURL('image/png');
}
