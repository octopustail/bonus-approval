// 图案戳：单色印章图形，24×24 坐标系。HTML 里画成 SVG，分享卡里用 Path2D 画到 canvas 上。
// 每个图形由若干 part 组成：ink = 用戳的颜色填充，paper = 用白色挖空（比如花心）。

const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const ellipse = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;

function flowerPetals() {
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (2 * Math.PI / 5);
    d += circle(+(12 + Math.cos(a) * 5.4).toFixed(2), +(11 + Math.sin(a) * 5.4).toFixed(2), 4.3);
  }
  return d;
}

function starPath(cx, cy, R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
  }
  return d + 'z';
}

export const ICONS = {
  flower: {
    label: '小红花',
    parts: [
      { d: 'M11.2 15.5h1.6v7h-1.6z' },
      { d: 'M12 19.6c1.6-2 3.6-2.6 5.4-2.2-.9 1.9-3 3-5.4 2.2z' },
      { d: flowerPetals() },
      { d: circle(12, 11, 2.9), paper: true },
      { d: circle(12, 11, 1.5) },
    ],
  },
  heart: {
    label: '比心',
    parts: [{ d: 'M12 21.3s-8-4.9-9.8-9.8C.8 7.7 3.2 3.6 7 3.6c2.2 0 3.9 1.3 5 2.9 1.1-1.6 2.8-2.9 5-2.9 3.8 0 6.2 4.1 4.8 7.9C20 16.4 12 21.3 12 21.3z' }],
  },
  star: {
    label: '闪亮',
    parts: [
      { d: starPath(12, 12.6, 11, 4.8) },
      { d: starPath(12, 12.6, 4.6, 2.0), paper: true },
    ],
  },
  crown: {
    label: '王者',
    parts: [
      { d: 'M2.5 7.5l5.2 4.3L12 4l4.3 7.8 5.2-4.3-1.8 10.3H4.3z' },
      { d: 'M4.3 19.3h15.4v2.4H4.3z' },
      { d: circle(2.5, 6.6, 1.6) + circle(12, 3.2, 1.6) + circle(21.5, 6.6, 1.6) },
      { d: circle(12, 14, 1.6), paper: true },
    ],
  },
  paw: {
    label: '猫猫认证',
    parts: [{ d: ellipse(12, 16, 5, 4.2) + ellipse(5.4, 10.6, 2.1, 2.6) + ellipse(9.4, 6.4, 2.2, 2.8) + ellipse(14.6, 6.4, 2.2, 2.8) + ellipse(18.6, 10.6, 2.1, 2.6) }],
  },
  flame: {
    label: '燃',
    parts: [
      { d: 'M12.6 1.5c.8 3.6 5.9 6.2 5.9 11.7A6.5 6.5 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.5c0-3.4 2-5.3 3.4-7.2.4 2.1 1.3 3.3 2.6 4C10.7 9.5 10.9 4.6 12.6 1.5z' },
      { d: 'M12 21a3.4 3.4 0 0 1-3.4-3.4c0-1.9 1.4-3 2.3-4.3.3 1.2.9 1.9 1.7 2.3.1-.9.6-1.8 1.3-2.6.6 1.4 1.5 2.5 1.5 4.6A3.4 3.4 0 0 1 12 21z', paper: true },
    ],
  },
};

// 戳的 text 字段以 @ 开头表示图案戳，例如 '@flower'
export function iconOf(text) {
  return typeof text === 'string' && text.startsWith('@') ? ICONS[text.slice(1)] || null : null;
}
export function stampLabel(text) {
  const ic = iconOf(text);
  return ic ? ic.label : text;
}
export function iconSvg(text) {
  const ic = iconOf(text);
  if (!ic) return '';
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ic.parts.map(p => `<path d="${p.d}" fill="${p.paper ? '#fff' : 'currentColor'}"/>`).join('')}</svg>`;
}
// 在 canvas 上以 (cx, cy) 为中心、边长 size 画图案
export function drawIcon(ctx, text, cx, cy, size, color) {
  const ic = iconOf(text);
  if (!ic) return false;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  for (const p of ic.parts) { ctx.fillStyle = p.paper ? '#fff' : color; ctx.fill(new Path2D(p.d)); }
  ctx.restore();
  return true;
}
