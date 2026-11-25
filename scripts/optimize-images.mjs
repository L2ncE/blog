#!/usr/bin/env node
// 手动运行：node scripts/optimize-images.mjs
// 1) 把 content/ 里新增的远程图片下载、转成 AVIF (2x 1152px) + WebP 回退 + 16px LQIP 模糊占位，落到 static/images/posts/ 并改写为 <picture>。
// 2) 把已有的站内 <img src="/images/posts/*.webp"> 补齐 AVIF 与 LQIP 占位并包进 <picture>（幂等，已包裹的跳过）。

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const OUT_DIR = 'static/images/posts';
const MAX_SIDE_WEBP = 1728; // 兼容历史 WebP 上限
const MAX_SIDE_AVIF = 1152; // 正文内容宽 576px CSS × 2 倍屏

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return p.endsWith('.md') ? [p] : [];
  });
}

function encodeAll(srcPath, webpOut, avifOut, skipWebp = false) {
  const code = `
import base64, json, os, shutil
from PIL import Image

im = Image.open(${JSON.stringify(srcPath)})
w, h = im.size

def resize_to(img, max_side):
    scale = min(1.0, max_side / max(img.size))
    return img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS) if scale < 1 else img

rgb_webp = resize_to(im, ${MAX_SIDE_WEBP}).convert('RGB')
if not ${skipWebp ? 'True' : 'False'}:
    orig = os.path.getsize(${JSON.stringify(srcPath)})
    cand = {}
    rgb_webp.save('/tmp/_lossless.webp', 'WEBP', lossless=True, quality=100, method=6)
    cand['lossless'] = os.path.getsize('/tmp/_lossless.webp')
    for q in (92, 88, 84, 80):
        rgb_webp.save('/tmp/_q%d.webp' % q, 'WEBP', quality=q, method=6)
        cand['q%d' % q] = os.path.getsize('/tmp/_q%d.webp' % q)
    target = orig * 0.30
    qualifying = [k for k, v in cand.items() if v <= target]
    if qualifying:
        pick = 'lossless' if 'lossless' in qualifying else max(qualifying, key=lambda k: int(k[1:]))
    else:
        best = min(cand, key=cand.get)
        pick = best if cand[best] < orig else 'orig'
    if pick == 'orig':
        shutil.copy(${JSON.stringify(srcPath)}, ${JSON.stringify(webpOut)})
    else:
        shutil.copy('/tmp/_%s.webp' % pick, ${JSON.stringify(webpOut)})
else:
    orig = os.path.getsize(${JSON.stringify(webpOut)})

webp_size = os.path.getsize(${JSON.stringify(webpOut)})

# Generate 1152px AVIF
rgb_avif = resize_to(im, ${MAX_SIDE_AVIF}).convert('RGB')
rgb_avif.save('/tmp/_out.avif', 'AVIF', quality=64, speed=4)
avif_cand = os.path.getsize('/tmp/_out.avif')
use_avif = avif_cand < webp_size
if use_avif:
    shutil.copy('/tmp/_out.avif', ${JSON.stringify(avifOut)})
elif os.path.exists(${JSON.stringify(avifOut)}):
    os.remove(${JSON.stringify(avifOut)})

# Generate 16px LQIP WebP base64
lqip_w = 16
lqip_h = max(1, round(16 * h / w))
lqip = rgb_avif.resize((lqip_w, lqip_h), Image.LANCZOS)
lqip.save('/tmp/_lqip.webp', 'WEBP', quality=30, method=6)
b64 = base64.b64encode(open('/tmp/_lqip.webp', 'rb').read()).decode('ascii')

print(json.dumps({
    'w': rgb_webp.size[0],
    'h': rgb_webp.size[1],
    'orig': orig,
    'webp': webp_size,
    'avif': avif_cand if use_avif else None,
    'lqip': b64,
}))
`;
  return JSON.parse(execFileSync('python3', ['-c', code], { encoding: 'utf8' }));
}

function buildPicture(name, w, h, lqip, alt) {
  const styleAttr = `background:url(data:image/webp;base64,${lqip}) center/cover`;
  const imgTag = `<img src="/images/posts/${name}.webp" width="${w}" height="${h}" loading="lazy" decoding="async" style="${styleAttr}" alt="${alt}">`;
  const avifPath = `${OUT_DIR}/${name}.avif`;
  if (existsSync(avifPath)) {
    return `<picture><source srcset="/images/posts/${name}.avif" type="image/avif">${imgTag}</picture>`;
  }
  return imgTag;
}

mkdirSync(OUT_DIR, { recursive: true });
const files = walk('content');
const REMOTE = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)[ \t]*$/gm;
const LOCAL_IMG = /^(<img\s+[^>]*src="\/images\/posts\/([^"]+)\.webp"[^>]*>)[ \t]*$/gm;

let remoteConverted = 0;
let localUpgraded = 0;
let totalWebp = 0;
let totalAvif = 0;

for (const f of files) {
  const before = readFileSync(f, 'utf8');
  let text = before;

  // 1) Upgrade existing standalone local <img> tags not already inside <picture>
  text = text.replace(LOCAL_IMG, (full, tag, name) => {
    const webpPath = `${OUT_DIR}/${name}.webp`;
    const avifPath = `${OUT_DIR}/${name}.avif`;
    if (!existsSync(webpPath)) return full;
    const altM = tag.match(/\balt="([^"]*)"/);
    const wM = tag.match(/\bwidth="(\d+)"/);
    const hM = tag.match(/\bheight="(\d+)"/);
    const info = encodeAll(webpPath, webpPath, avifPath, true);
    const w = wM ? Number(wM[1]) : info.w;
    const h = hM ? Number(hM[1]) : info.h;
    const alt = altM ? altM[1] : '';
    localUpgraded++;
    totalWebp += info.webp;
    totalAvif += info.avif || info.webp;
    console.log(`[local] ${name}: webp=${(info.webp / 1024).toFixed(1)}KB -> avif=${info.avif ? (info.avif / 1024).toFixed(1) + 'KB' : 'skipped'} lqip=${info.lqip.length}B`);
    return buildPicture(name, w, h, info.lqip, alt);
  });

  // 2) Download and convert remote markdown images
  const remoteMatches = [...text.matchAll(REMOTE)];
  for (const m of remoteMatches) {
    const alt = m[1];
    const url = m[2];
    const slug = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))
      .replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const name = `${slug}-${createHash('sha1').update(url).digest('hex').slice(0, 8)}`;
    const webpPath = `${OUT_DIR}/${name}.webp`;
    const avifPath = `${OUT_DIR}/${name}.avif`;
    const tmp = `/tmp/optimg-${name.slice(-8)}`;
    if (!existsSync(tmp) || statSync(tmp).size === 0) {
      execFileSync('curl', ['-sL', '--max-time', '180', '-o', tmp, url]);
    }
    const info = encodeAll(tmp, webpPath, avifPath, false);
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedAlt = alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(
      new RegExp(`^!\\[${escapedAlt}\\]\\(${escaped}\\)[ \\t]*$`, 'gm'),
      buildPicture(name, info.w, info.h, info.lqip, alt)
    );
    remoteConverted++;
    totalWebp += info.webp;
    totalAvif += info.avif || info.webp;
    console.log(`[remote] ${name}: ${(info.orig / 1024).toFixed(0)}KB -> webp=${(info.webp / 1024).toFixed(1)}KB avif=${info.avif ? (info.avif / 1024).toFixed(1) + 'KB' : 'skipped'}`);
  }

  if (text !== before) {
    writeFileSync(f, text);
  }
}

console.log(`\n完成：升级站内图 ${localUpgraded} 张，新转远程图 ${remoteConverted} 张；WebP 合计 ${(totalWebp / 1024).toFixed(1)}KB -> AVIF 合计 ${(totalAvif / 1024).toFixed(1)}KB`);
