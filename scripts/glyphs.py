"""从开源字体里提取指定汉字的轮廓，生成 js/glyphs.js（SVG path，1000 单位的 em 方框，y 轴向下）。"""
import glob, json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

BASE = '/tmp/claude-0/-home-claude/c17c030b-123a-50e5-aa5c-f8f67352838c/scratchpad/fonts/'
FONTS = {
    'brush': (BASE + 'fontsource-ma-shan-zheng-5.3.1/files/*-400-normal.woff2',
              '朕知道了准奏爱卿辛苦此子可教赏鸡腿一只钦'),
    'fun': (BASE + 'fontsource-zcool-kuaile-5.3.0/files/*-400-normal.woff2',
            '比心撒花泪目居然真做了还不睡？冲稳咕代盖今天别鸽爪章鹅大人泥滚鲤刺啄开三早卡头卷一机勇秒判证仙猫必胜'),
}

out = {}
for key, (pattern, chars) in FONTS.items():
    files = sorted(glob.glob(pattern))
    need = set(chars)
    glyphs = {}
    for f in files:
        if not need: break
        font = TTFont(f)
        cmap = font.getBestCmap()
        upem = font['head'].unitsPerEm
        asc = font['hhea'].ascent
        desc = -font['hhea'].descent
        gs = font.getGlyphSet()
        for ch in list(need):
            cp = ord(ch)
            if cp not in cmap: continue
            name = cmap[cp]
            pen = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
            s = 1000 / upem
            # 把字放进 1000×1000 方框：基线按 ascent/descent 居中，y 轴向下
            em_h = (asc + desc)
            tp = TransformPen(pen, (s, 0, 0, -s, 0, asc * s + (upem - em_h) * s / 2))
            gs[name].draw(tp)
            glyphs[ch] = {'d': pen.getCommands(), 'w': round(gs[name].width * s)}
            need.discard(ch)
    if need:
        print('missing', key, need, file=sys.stderr)
    out[key] = glyphs

js = ('// 自动生成：scripts/glyphs.py。字形来自开源字体（SIL OFL 1.1）：\n'
      '//   brush = 马善政毛笔楷书 Ma Shan Zheng；fun = 站酷快乐体 ZCOOL KuaiLe\n'
      '// 每个字是 1000×1000 方框里的 SVG 路径，y 轴向下。\n'
      'export const GLYPHS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(sys.argv[1], 'w').write(js)
print('ok', {k: len(v) for k, v in out.items()}, len(js) // 1024, 'KB')
