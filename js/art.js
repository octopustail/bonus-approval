// 集个戳戳 · 图形库
// 所有戳都画成一个 100×100 的 SVG：网页里直接内嵌，分享卡里转成图片画到 canvas 上，两边长得一模一样。
// 戳的 text 字段约定：
//   普通文字        '绝了'
//   图案戳          '@flower'            （icons.js）
//   朱批            '@zp:zhidao'
//   咕咕表情        '@gu:heart'          '@gu:auto' = 咕咕代盖
//   动物园分身      '@an:cat'
import { GLYPHS } from './glyphs.js';
import { ICONS } from './icons.js';

const INK = '#222';
const xml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 字形排版 ----------
function lineWidth(str, font) {
  return [...str].reduce((w, c) => w + ((GLYPHS[font][c] && GLYPHS[font][c].w) || 1000), 0);
}
// 把若干行字排进 (x, y, w, h) 方框，居中，统一缩放
export function glyphLines(lines, font, { x, y, w, h, color, rotate = 0, gap = 80 }) {
  const widths = lines.map(l => lineWidth(l, font));
  const totalH = lines.length * 1000 + (lines.length - 1) * gap;
  const s = Math.min(w / Math.max(...widths), h / totalH);
  const oy = y + (h - totalH * s) / 2;
  let out = '';
  lines.forEach((line, li) => {
    let cx = x + (w - widths[li] * s) / 2;
    const ly = oy + li * (1000 + gap) * s;
    for (const ch of line) {
      const g = GLYPHS[font][ch];
      if (g) out += `<path transform="translate(${cx.toFixed(2)} ${ly.toFixed(2)}) scale(${s.toFixed(4)})" d="${g.d}"/>`;
      else out += `<text x="${(cx + 500 * s).toFixed(2)}" y="${(ly + 860 * s).toFixed(2)}" font-size="${(1000 * s).toFixed(1)}" text-anchor="middle" font-weight="900" font-family="sans-serif">${xml(ch)}</text>`;
      cx += ((g && g.w) || 1000) * s;
    }
  });
  const cxm = x + w / 2, cym = y + h / 2;
  return `<g fill="${color}" transform="rotate(${rotate} ${cxm} ${cym})">${out}</g>`;
}

// ---------- 五官 ----------
const dot = (x, y, s = 1) => `<ellipse cx="${x}" cy="${y}" rx="${4.4 * s}" ry="${5.2 * s}" fill="${INK}"/><circle cx="${x + 1.5 * s}" cy="${y - 1.8 * s}" r="${1.6 * s}" fill="#fff"/>`;
const arc = (x, y, s = 1) => `<path d="M${x - 5 * s} ${y + 2} q${5 * s} ${-8 * s} ${10 * s} 0" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
const flat = (x, y, w = 9) => `<path d="M${x - w / 2} ${y} h${w}" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
const side = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="5.5" fill="#fff" stroke="${INK}" stroke-width="2.2"/><circle cx="${x + 2.6}" cy="${y}" r="2.4" fill="${INK}"/>`;
const wm = (x, y) => `<path d="M${x - 6} ${y} q3 4 6 0 q3 4 6 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const blush = (x1, x2, y, c = '#FFA8A8') => `<ellipse cx="${x1}" cy="${y}" rx="5.5" ry="3.2" fill="${c}" opacity=".85"/><ellipse cx="${x2}" cy="${y}" rx="5.5" ry="3.2" fill="${c}" opacity=".85"/>`;

// ---------- 咕咕（主吉祥物，120×120） ----------
export function pigeon(expr = 'normal', prop = '') {
  const L = 52, R = 74, Y = 44;
  const eyes = {
    normal: dot(L, Y) + dot(R, Y),
    happy: arc(L, Y) + arc(R, Y),
    guilty: side(L, Y) + side(R, Y),
    sad: dot(L, Y) + dot(R, Y) + `<path d="M${L - 6} ${Y - 9} l9 3" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M${R + 6} ${Y - 9} l-9 3" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    smug: flat(L, Y + 1, 10) + flat(R, Y + 1, 10),
    cry: arc(L, Y) + arc(R, Y) + `<path d="M${L} ${Y + 4} v18" stroke="#7CC4F2" stroke-width="4" stroke-linecap="round"/><path d="M${R} ${Y + 4} v18" stroke="#7CC4F2" stroke-width="4" stroke-linecap="round"/>`,
    shock: `<circle cx="${L}" cy="${Y}" r="6.5" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="${L}" cy="${Y}" r="2.6" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="6.5" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="${R}" cy="${Y}" r="2.6" fill="${INK}"/>`,
    sleepy: flat(L, Y + 1, 10) + flat(R, Y + 1, 10),
    shades: `<rect x="${L - 10}" y="${Y - 6}" width="18" height="11" rx="4" fill="${INK}"/><rect x="${R - 8}" y="${Y - 6}" width="18" height="11" rx="4" fill="${INK}"/><path d="M${L + 8} ${Y - 1} h${R - L - 16}" stroke="${INK}" stroke-width="2.4"/>`,
  }[expr] || dot(L, Y) + dot(R, Y);
  const props = {
    heart: '<path d="M62 6 C62 0 70 -2 72 4 C74 -2 82 0 82 6 C82 14 72 20 72 20 C72 20 62 14 62 6z" fill="#FF5C8A" transform="translate(-10 -2)"/>',
    confetti: '<circle cx="14" cy="22" r="4" fill="#FFE15C"/><circle cx="108" cy="18" r="4" fill="#3E5BF2"/><rect x="100" y="40" width="9" height="4" rx="2" fill="#17A673" transform="rotate(30 104 42)"/><rect x="6" y="44" width="9" height="4" rx="2" fill="#9B4DE0" transform="rotate(-30 10 46)"/><circle cx="28" cy="6" r="3" fill="#17A673"/><circle cx="94" cy="4" r="3" fill="#E07A00"/>',
    shock: '<path d="M104 14 l-4 18" stroke="#222" stroke-width="5" stroke-linecap="round"/><circle cx="98" cy="40" r="3" fill="#222"/><path d="M16 14 l4 18" stroke="#222" stroke-width="5" stroke-linecap="round"/><circle cx="22" cy="40" r="3" fill="#222"/>',
    zzz: '<text x="94" y="20" font-size="18" font-weight="900" fill="#3E5BF2" font-family="sans-serif">Z</text><text x="106" y="8" font-size="12" font-weight="900" fill="#3E5BF2" font-family="sans-serif">z</text><path d="M12 18a12 12 0 1 0 14 -14a10 10 0 1 1 -14 14z" fill="#FFE15C"/>',
    band: `<path d="M26 30 C40 22 84 22 98 30 L96 38 C82 31 42 31 28 38z" fill="#fff" stroke="#E8434F" stroke-width="1.5"/>${glyphLines(['必胜'], 'fun', { x: 50, y: 26, w: 24, h: 10, color: '#E8434F' })}`,
    guilty: glyphLines(['咕？'], 'fun', { x: 92, y: 6, w: 28, h: 18, color: '#3E5BF2' }),
  };
  return `
    <path d="M48 104 l-5 7 M48 104 l0 8 M48 104 l5 7 M72 104 l-5 7 M72 104 l0 8 M72 104 l5 7" stroke="#FF8FA3" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M48 96 v8 M72 96 v8" stroke="#FF8FA3" stroke-width="3.4"/>
    <path d="M20 76 C16 44 36 22 62 22 C88 22 104 44 100 76 C98 94 82 100 60 100 C38 100 22 94 20 76z" fill="#AEB9C6"/>
    <path d="M26 62 C34 72 48 76 62 76 C76 76 88 72 96 62" stroke="#7FC8A9" stroke-width="7" fill="none" opacity=".9"/>
    <path d="M26 66 C34 76 48 80 62 80 C76 80 88 76 96 66" stroke="#B49BDB" stroke-width="5" fill="none" opacity=".8"/>
    <path d="M86 70 C104 72 112 86 104 96 C96 92 90 84 86 70z" fill="#93A0AF"/>
    <path d="M58 52 l5 -2 l5 2 l-5 5z" fill="#4A4F57"/>
    ${eyes}${expr === 'shades' ? '' : blush(42, 84, 56)}
    ${expr === 'smug' ? '<path d="M56 62 q6 3 12 -2" stroke="#222" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : ''}
    ${expr === 'shock' ? '<ellipse cx="63" cy="64" rx="4" ry="5" fill="#222"/>' : ''}
    ${expr === 'sad' ? '<path d="M78 50 q3 6 0 9 q-3 -3 0 -9z" fill="#7CC4F2"/>' : ''}
    ${props[prop] || (expr === 'guilty' ? props.guilty : '')}`;
}

// ---------- 动物园（120×120） ----------
const ANIMAL_ART = {
  cat() {
    const C = '#F6A04D', D = '#E07F2A';
    return `<path d="M94 100 C110 102 120 90 115 70" stroke="${C}" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M24 46 L30 16 L52 34z" fill="${C}"/><path d="M30 38 L33 24 L44 33z" fill="#FFB8B8"/>
      <path d="M96 46 L90 16 L68 34z" fill="${C}"/><path d="M90 38 L87 24 L76 33z" fill="#FFB8B8"/>
      <rect x="16" y="30" width="88" height="74" rx="36" fill="${C}"/>
      <path d="M54 34 v8 M60 32 v10 M66 34 v8" stroke="${D}" stroke-width="3.4" stroke-linecap="round"/>
      <ellipse cx="60" cy="80" rx="22" ry="14" fill="#FFF3E6"/>
      ${dot(44, 62)}${dot(76, 62)}${blush(32, 88, 74)}<path d="M57 72 h6 l-3 3.5z" fill="#FF8C9A"/>${wm(60, 77)}
      <g transform="translate(98 50) rotate(-14)"><ellipse cx="0" cy="0" rx="13" ry="14" fill="${C}"/><ellipse cx="0" cy="4" rx="6.5" ry="5.5" fill="#E8434F"/><circle cx="-7" cy="-5" r="2.6" fill="#E8434F"/><circle cx="-2.4" cy="-8.6" r="2.6" fill="#E8434F"/><circle cx="2.8" cy="-8.6" r="2.6" fill="#E8434F"/><circle cx="7.4" cy="-5" r="2.6" fill="#E8434F"/></g>`;
  },
  capy() {
    return `<rect x="14" y="34" width="92" height="72" rx="34" fill="#B98A5E"/>
      <ellipse cx="30" cy="36" rx="7" ry="6" fill="#9C6F45"/><ellipse cx="86" cy="36" rx="7" ry="6" fill="#9C6F45"/>
      <rect x="34" y="58" width="52" height="34" rx="17" fill="#9C6F45"/>
      <ellipse cx="50" cy="68" rx="3" ry="2.2" fill="#3B2A1C"/><ellipse cx="70" cy="68" rx="3" ry="2.2" fill="#3B2A1C"/>
      <path d="M54 80 q6 4 12 0" stroke="#3B2A1C" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      ${flat(44, 50, 10)}${flat(70, 50, 10)}
      <circle cx="60" cy="24" r="13" fill="#FFA62B"/><path d="M60 11 c-2 -6 4 -8 8 -6 c-4 1 -6 3 -8 6z" fill="#3FA34D"/><circle cx="55" cy="20" r="3" fill="#FFD08A"/>`;
  },
  blob() {
    return `<path d="M18 88 C14 54 30 26 60 26 C90 26 106 54 102 88 C100 102 84 104 60 104 C36 104 20 102 18 88z" fill="#EE5A63"/>
      <path d="M30 40 C40 30 54 28 62 30" stroke="#FF9A9F" stroke-width="7" fill="none" stroke-linecap="round" opacity=".8"/>
      ${dot(46, 68)}${dot(74, 68)}${blush(35, 85, 79, '#FFC2C2')}${wm(60, 79)}`;
  },
  octo() {
    const C = '#FF6F61', L = '#FF9A8F';
    const arm = d => `<path d="${d}" stroke="${C}" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    return `${arm('M34 80 C24 92 18 100 12 96')}${arm('M46 88 C44 100 40 108 32 109')}${arm('M60 90 C60 102 64 110 72 110')}${arm('M74 88 C80 100 88 104 96 101')}${arm('M86 80 C98 90 106 92 110 86')}
      <path d="M24 64 C20 34 40 18 60 18 C80 18 100 34 96 64 C94 82 80 90 60 90 C40 90 26 82 24 64z" fill="${C}"/>
      <ellipse cx="44" cy="32" rx="9" ry="5" fill="#fff" opacity=".35" transform="rotate(-25 44 32)"/>
      <circle cx="80" cy="30" r="4" fill="${L}"/><circle cx="88" cy="42" r="2.6" fill="${L}"/><circle cx="72" cy="24" r="2.2" fill="${L}"/>
      ${dot(48, 60)}${dot(72, 60)}${blush(37, 83, 70)}${wm(60, 70)}`;
  },
  goose() {
    const O = '#FF9F1C';
    return `<path d="M52 108 l-6 6 h14z M74 108 l-6 6 h14z" fill="${O}"/><path d="M56 100 v8 M78 100 v8" stroke="${O}" stroke-width="4"/>
      <path d="M30 86 C30 66 52 62 70 66 C92 70 108 76 104 92 C100 106 80 106 62 104 C42 102 30 98 30 86z" fill="#fff" stroke="#222" stroke-width="3"/>
      <path d="M72 80 C84 78 94 82 96 90" stroke="#D5DCE0" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M52 70 C46 58 42 48 46 34" stroke="#222" stroke-width="21" fill="none" stroke-linecap="round"/>
      <path d="M52 70 C46 58 42 48 46 34" stroke="#fff" stroke-width="15" fill="none" stroke-linecap="round"/>
      <circle cx="48" cy="32" r="15" fill="#fff" stroke="#222" stroke-width="3"/>
      <path d="M34 34 C26 33 20 36 18 39 C24 41 30 41 35 40z" fill="${O}" stroke="#222" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="47" cy="32" r="3.6" fill="#222"/><circle cx="48.2" cy="30.8" r="1.2" fill="#fff"/><path d="M40 22 l14 5" stroke="#222" stroke-width="3.4" stroke-linecap="round"/>`;
  },
  hedge() {
    let sp = '';
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (1.05 + i * 0.09);
      const x = 62 + Math.cos(a) * 44, y = 70 + Math.sin(a) * 40, x2 = 62 + Math.cos(a) * 58, y2 = 70 + Math.sin(a) * 54;
      sp += `<path d="M${(x - 6).toFixed(1)} ${y.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${(x + 6).toFixed(1)} ${(y + 2).toFixed(1)}z" fill="#8A5A3B"/>`;
    }
    return `${sp}<ellipse cx="62" cy="74" rx="46" ry="34" fill="#A0704D"/>
      <path d="M18 80 C18 60 34 52 50 54 C66 56 74 70 72 84 C70 98 54 104 38 102 C26 100 18 92 18 80z" fill="#F5DDBF"/>
      <circle cx="20" cy="80" r="5" fill="#3B2A1C"/>${dot(40, 66, .9)}${dot(62, 66, .9)}${blush(32, 66, 78)}
      <path d="M38 86 q5 4 10 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  },
  wood() {
    return `<rect x="4" y="0" width="22" height="120" rx="6" fill="#C4A27A"/><path d="M10 20 q4 6 0 12 M18 60 q4 6 0 12 M12 92 q4 6 0 12" stroke="#A88660" stroke-width="2.4" fill="none"/>
      <path d="M80 86 L98 112 L84 108z" fill="#2E3440"/>
      <path d="M52 100 l-4 8 M58 100 l0 9 M66 100 l4 8" stroke="#FF9F1C" stroke-width="3" stroke-linecap="round"/>
      <path d="M34 70 C34 46 48 34 62 34 C78 34 88 48 86 70 C84 90 74 100 60 100 C44 100 34 90 34 70z" fill="#2E3440"/>
      <path d="M46 74 C46 60 54 54 62 54 C72 54 78 62 76 76 C74 90 68 96 60 96 C52 96 46 88 46 74z" fill="#F4EFE6"/>
      <circle cx="80" cy="62" r="2.6" fill="#fff"/><circle cx="82" cy="72" r="2.6" fill="#fff"/><circle cx="80" cy="82" r="2.6" fill="#fff"/>
      <path d="M44 38 C44 22 70 16 78 30 C70 30 58 30 44 38z" fill="#E8434F"/>
      <path d="M48 44 C48 34 58 30 66 32 C76 34 80 44 76 52 C70 58 54 58 48 44z" fill="#fff"/>
      <path d="M24 45 L48 40 L48 49z" fill="#FFB238" stroke="#222" stroke-width="1.6" stroke-linejoin="round"/>
      ${dot(56, 44, .9)}<ellipse cx="66" cy="50" rx="4.5" ry="2.6" fill="#FFA8A8"/>`;
  },
  panda() {
    return `<circle cx="28" cy="30" r="13" fill="#222"/><circle cx="92" cy="30" r="13" fill="#222"/>
      <ellipse cx="60" cy="64" rx="44" ry="40" fill="#fff" stroke="#222" stroke-width="3"/>
      <ellipse cx="45" cy="58" rx="11" ry="13" fill="#222" transform="rotate(-25 45 58)"/><ellipse cx="75" cy="58" rx="11" ry="13" fill="#222" transform="rotate(25 75 58)"/>
      <circle cx="46" cy="58" r="4.5" fill="#fff"/><circle cx="46.5" cy="58" r="2.6" fill="#222"/><circle cx="74" cy="58" r="4.5" fill="#fff"/><circle cx="73.5" cy="58" r="2.6" fill="#222"/>
      <ellipse cx="60" cy="74" rx="5" ry="3.6" fill="#222"/>${wm(60, 80)}${blush(32, 88, 76)}`;
  },
  koi() {
    return `<path d="M92 56 C108 40 118 46 114 60 C118 74 108 80 92 64z" fill="#FF6B4A"/>
      <path d="M24 60 C24 36 50 26 74 34 C92 40 98 52 94 62 C90 74 72 86 48 84 C32 82 24 72 24 60z" fill="#fff" stroke="#FFD7CC" stroke-width="2"/>
      <path d="M44 32 C56 28 70 32 76 42 C66 50 52 48 44 32z" fill="#FF6B4A"/>
      <path d="M64 66 C74 64 84 66 88 72 C80 80 68 80 64 66z" fill="#FF6B4A"/>
      <path d="M54 84 C56 94 52 100 46 100 C46 94 48 88 54 84z" fill="#FF8A6B"/>
      ${dot(42, 56, .95)}<ellipse cx="34" cy="66" rx="5" ry="3" fill="#FFA8A8"/>
      <path d="M26 62 q4 4 8 1" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  },
};

// ---------- 目录 ----------
export const ZHUPI = [
  { key: 'zhidao', lines: ['朕知', '道了'], label: '朕知道了' },
  { key: 'zhunzou', lines: ['准奏'], label: '准奏' },
  { key: 'aiqing', lines: ['爱卿', '辛苦'], label: '爱卿辛苦' },
  { key: 'kejiao', lines: ['此子', '可教'], label: '此子可教' },
  { key: 'jitui', lines: ['赏', '鸡腿一只'], label: '赏鸡腿一只' },
  { key: 'qinci', lines: ['钦此'], label: '钦此' },
];
export const GU = [
  { key: 'heart', label: '比心', color: '#FF5C8A', expr: 'happy', prop: 'heart' },
  { key: 'confetti', label: '撒花', color: '#E07A00', expr: 'happy', prop: 'confetti' },
  { key: 'cry', label: '泪目', color: '#3E5BF2', expr: 'cry' },
  { key: 'shock', label: '居然真做了', color: '#9B4DE0', expr: 'shock', prop: 'shock' },
  { key: 'zzz', label: '还不睡？', color: '#3E5BF2', expr: 'sleepy', prop: 'zzz' },
  { key: 'band', label: '冲', color: '#E8434F', expr: 'happy', prop: 'band' },
  { key: 'shades', label: '稳', color: '#222', expr: 'shades' },
];
export const GU_AUTO = { key: 'auto', label: '咕咕代盖', color: '#E8434F', expr: 'smug' };
// need = 解锁动物需要的成就数
export const ANIMALS = [
  { key: 'cat', name: '爪爪', kind: '盖章猫', color: '#F08C3A', need: 0 },
  { key: 'capy', name: '稳稳', kind: '卡皮巴拉', color: '#9C6F45', need: 0 },
  { key: 'blob', name: '泥泥', kind: '印泥团子', color: '#E8434F', need: 0 },
  { key: 'octo', name: '章章', kind: '小章鱼', color: '#FF6F61', need: 1 },
  { key: 'goose', name: '鹅大人', kind: '大鹅', color: '#222', need: 2 },
  { key: 'hedge', name: '刺刺', kind: '刺猬', color: '#8A5A3B', need: 3 },
  { key: 'wood', name: '啄啄', kind: '啄木鸟', color: '#2E3440', need: 4 },
  { key: 'panda', name: '滚滚', kind: '熊猫', color: '#222', need: 6 },
  { key: 'koi', name: '鲤鲤', kind: '锦鲤', color: '#FF6B4A', need: 8 },
];

export function parseCode(text) {
  if (typeof text !== 'string' || !text.startsWith('@')) return { type: 'text', text };
  const [a, b] = text.slice(1).split(':');
  if (b === undefined) return ICONS[a] ? { type: 'icon', key: a, icon: ICONS[a] } : { type: 'text', text };
  if (a === 'zp') { const z = ZHUPI.find(x => x.key === b); return z ? { type: 'zp', item: z } : { type: 'text', text: '准' }; }
  if (a === 'gu') { const g = b === 'auto' ? GU_AUTO : GU.find(x => x.key === b); return g ? { type: 'gu', item: g } : { type: 'text', text: '咕' }; }
  if (a === 'an') { const n = ANIMALS.find(x => x.key === b); return n ? { type: 'an', item: n } : { type: 'text', text: '戳' }; }
  return { type: 'text', text };
}
export function stampLabel(text) {
  const p = parseCode(text);
  if (p.type === 'icon') return p.icon.label;
  if (p.type === 'zp' || p.type === 'gu') return p.item.label;
  if (p.type === 'an') return p.item.name;
  return p.text;
}
export function stampColor(text, fallback) {
  const p = parseCode(text);
  if (p.type === 'zp') return '#C8102E';
  if (p.type === 'gu' || p.type === 'an') return p.item.color;
  return fallback;
}

// ---------- 一枚完整的戳（100×100 SVG 字符串） ----------
export function stampSvg(text, color, name = '') {
  const p = parseCode(text);
  const ring = (c, dashed) => `<circle cx="50" cy="50" r="46" fill="#fff"/><circle cx="50" cy="50" r="44" fill="none" stroke="${c}" stroke-width="5" ${dashed ? 'stroke-dasharray="9 6"' : ''}/><circle cx="50" cy="50" r="36" fill="none" stroke="${c}" stroke-width="1.5" opacity=".35"/>`;
  const nameEl = (c, y = 86, size = 10) => name ? `<text x="50" y="${y}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${c}" font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif">${xml(String(name).slice(0, 5))}</text>` : '';
  let body;
  if (p.type === 'zp') {
    body = `<circle cx="50" cy="50" r="46" fill="#FBF6EA" stroke="#E5D5B5" stroke-width="2"/>`
      + glyphLines(p.item.lines, 'brush', { x: 15, y: name ? 14 : 18, w: 70, h: name ? 58 : 64, color: '#C8102E', rotate: -6 })
      + nameEl('#B09A75', 90, 9);
  } else if (p.type === 'gu') {
    const it = p.item;
    body = ring(it.color, it.key === 'auto')
      + `<g transform="translate(22 7) scale(.47)">${pigeon(it.expr, it.prop)}</g>`
      + glyphLines([it.label], 'fun', { x: 16, y: 64, w: 68, h: [...it.label].length > 3 ? 13 : 17, color: it.color });
  } else if (p.type === 'an') {
    const it = p.item;
    body = ring(it.color) + `<g transform="translate(20 ${name ? 9 : 14}) scale(.5)">${ANIMAL_ART[it.key]()}</g>` + nameEl(it.color, 86);
  } else if (p.type === 'icon') {
    body = ring(color) + `<g transform="translate(25 ${name ? 13 : 20}) scale(2.1)">${p.icon.parts.map(pt => `<path d="${pt.d}" fill="${pt.paper ? '#fff' : color}"/>`).join('')}</g>` + nameEl(color);
  } else {
    const n = [...p.text].length;
    body = ring(color) + `<text x="50" y="${name ? (n > 1 ? 56 : 60) : (n > 1 ? 61 : 66)}" text-anchor="middle" font-size="${n > 1 ? 30 : 42}" font-weight="900" fill="${color}" font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif">${xml(p.text)}</text>` + nameEl(color, 80);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
}

// 咕咕单独出场（UI 里用）
export function pigeonSvg(expr = 'normal', prop = '', size = 80) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-6 -10 132 132" aria-hidden="true">${pigeon(expr, prop)}</svg>`;
}
export function animalSvg(key, size = 64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 -4 124 124" aria-hidden="true">${ANIMAL_ART[key]()}</svg>`;
}
// 单独的一个字（成就徽章用）
export function glyphSvg(ch, color, size = 40) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${glyphLines([ch], 'fun', { x: 0, y: 0, w: 100, h: 100, color })}</svg>`;
}

// 成就徽章：花边印章 + 一个大字。state = 'on' | 'locked' | 'hidden'
const BADGE = {
  common: { ring: '#17A673', fill: '#fff', ink: '#17A673' },
  rare: { ring: '#3E5BF2', fill: '#fff', ink: '#3E5BF2', double: true },
  legend: { ring: '#C99A00', fill: 'url(#bgGold)', ink: '#7A5200', double: true, glow: true },
};
export function badgeSvg(glyph, rarity, state = 'on', size = 64) {
  const pts = [];
  for (let i = 0; i < 36; i++) { const a = i * Math.PI / 18; const r = i % 2 ? 44 : 48; pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`); }
  let st = BADGE[rarity] || BADGE.common;
  if (state === 'locked') st = { ring: '#C9D9D1', fill: '#F1F5F3', ink: '#C9D9D1' };
  if (state === 'hidden') st = { ring: '#222', fill: '#222', ink: '#fff' };
  const face = state === 'hidden'
    ? '<text x="50" y="64" text-anchor="middle" font-size="40" font-weight="900" fill="#fff" font-family="sans-serif">?</text>'
    : glyphLines([glyph], 'fun', { x: 26, y: 26, w: 48, h: 48, color: st.ink });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-4 -4 108 108" aria-hidden="true">
    <defs><linearGradient id="bgGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4C2"/><stop offset=".5" stop-color="#FFD84D"/><stop offset="1" stop-color="#F2B600"/></linearGradient></defs>
    ${st.glow && state === 'on' ? '<circle cx="50" cy="50" r="52" fill="#FFE15C" opacity=".35"/>' : ''}
    <polygon points="${pts.join(' ')}" fill="${st.fill}" stroke="${st.ring}" stroke-width="4" stroke-linejoin="round"/>
    ${st.double && state === 'on' ? `<circle cx="50" cy="50" r="34" fill="none" stroke="${st.ring}" stroke-width="2" opacity=".55"/>` : ''}
    ${face}</svg>`;
}

// canvas 用：把 SVG 字符串变成可以 drawImage 的图片
export function svgImage(svgStr) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  });
}
