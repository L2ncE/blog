#!/usr/bin/env node
// 手动运行：node scripts/optimize-images.mjs
// 把 content/ 里引用的远程图片下载、转成 WebP 落到 static/images/posts/，并改写 Markdown 引用。
// 需要重跑的时机：新增文章引用了 remote 图片之后。已改写成站内路径的文章不会被重复处理。
// 选型规则：无损优先（像素与缩放后原图完全一致）；无损不划算时退到有损，取满足体积目标下最高质量；
// 都不如原图就保留原图不动。

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const OUT_DIR = 'static/images/posts';
const MAX_SIDE = 1728; // 正文内容宽 576px CSS × 3 倍屏

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return p.endsWith('.md') ? [p] : [];
  });
}

function convert(tmp, out) {
  const code = `
import json, os, shutil
from PIL import Image
im = Image.open(${JSON.stringify(tmp)})
w, h = im.size
scale = min(1.0, ${MAX_SIDE} / max(w, h))
im2 = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS) if scale < 1 else im
rgb = im2.convert('RGB')
orig = os.path.getsize(${JSON.stringify(tmp)})
cand = {}
rgb.save('/tmp/_lossless.webp', 'WEBP', lossless=True, quality=100, method=6)
cand['lossless'] = os.path.getsize('/tmp/_lossless.webp')
for q in (92, 88, 84, 80):
    rgb.save('/tmp/_q%d.webp' % q, 'WEBP', quality=q, method=6)
    cand['q%d' % q] = os.path.getsize('/tmp/_q%d.webp' % q)
# 体积目标：压到原图 30% 以内。达到目标的高质量档里，无损优先（像素完全一致）
target = orig * 0.30
qualifying = [k for k, v in cand.items() if v <= target]
if qualifying:
    pick = 'lossless' if 'lossless' in qualifying else max(qualifying, key=lambda k: (k != 'lossless', int(k[1:]) if k[0] == 'q' else 0))
else:
    best = min(cand, key=cand.get)
    pick = best if cand[best] < orig else 'orig'
if pick == 'orig':
    shutil.copy(${JSON.stringify(tmp)}, ${JSON.stringify(out)})
else:
    shutil.copy('/tmp/_%s.webp' % pick, ${JSON.stringify(out)})
print(json.dumps({'src_w': w, 'src_h': h, 'w': rgb.size[0], 'h': rgb.size[1],
                  'orig': orig, 'final': os.path.getsize(${JSON.stringify(out)}) if os.path.exists(${JSON.stringify(out)}) else 0,
                  'mode': pick, 'cand': cand}))
`;
  // 先写候选，再由上面的逻辑落盘
  const res = JSON.parse(execFileSync('python3', ['-c', code], { encoding: 'utf8' }));
  return res;
}

mkdirSync(OUT_DIR, { recursive: true });
const files = walk('content');
const REMOTE = /^!\[[^\]]*\]\((https:\/\/raw\.githubusercontent\.com\/L2ncE\/images\/main\/.+)\)\s*$/gm;

const urls = new Set();
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(REMOTE)) urls.add(m[1]);
if (!urls.size) {
  console.log('没有需要处理的远程图片');
  process.exit(0);
}

const results = [];
for (const url of urls) {
  const slug = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))
    .replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const name = `${slug}-${createHash('sha1').update(url).digest('hex').slice(0, 8)}`;
  const out = `${OUT_DIR}/${name}.webp`;
  const tmp = `/tmp/optimg-${name.slice(-8)}`;
  if (!existsSync(tmp) || statSync(tmp).size === 0) execFileSync('curl', ['-sL', '--max-time', '180', '-o', tmp, url]);
  const info = convert(tmp, out);
  results.push({ url, name, out, ...info });
  console.log(`${(info.orig / 1024).toFixed(0).padStart(5)}KB -> ${(info.final / 1024).toFixed(0).padStart(4)}KB ${info.mode.padEnd(8)} ${info.src_w}x${info.src_h} -> ${info.w}x${info.h}`);
}

let changed = 0;
for (const f of files) {
  const before = readFileSync(f, 'utf8');
  let text = before;
  for (const r of results) {
    const escaped = r.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^!\\[[^\\]]*\\]\\(${escaped}\\)\\s*$`, 'gm'),
      `<img src="/images/posts/${r.name}.webp" width="${r.w}" height="${r.h}" loading="lazy" decoding="async" alt="">`);
  }
  if (text !== before) { writeFileSync(f, text); changed++; }
}
const o = results.reduce((s, r) => s + r.orig, 0);
const n = results.reduce((s, r) => s + r.final, 0);
console.log(`\n改写 ${changed} 篇，输出 ${results.length} 个 webp：${(o / 1048576).toFixed(2)}MB -> ${(n / 1048576).toFixed(2)}MB`);
