# AGENTS.md

Zola 静态博客（0.22.1），主题 no-style-please（vendored，无上游）。

## 内容分区

- 书评/读后感/读书笔记 → `content/books/`
- 年终总结 → `content/annual/`
- 技术文与杂谈随笔 → `content/posts/`

## Slug 规范

新文章 front-matter 必须显式写 `slug`：短英文 2-4 词 kebab-case（如 `hertz-csrf`、`annual-2024`）。省略时 Zola 会把中文标题转成超长拼音 URL，禁止。

## 改动验证

任何改动完成后：

```sh
~/.local/bin/zola build
```

完成判据：build 无报错，且 `public/` 产物与预期一致。本机 zola 与 CF Pages 构建镜像（v3）版本保持一致，升级框架时两边同步。

## 样式同步（改 CSS 前必读）

CSS 已内联进 `themes/no-style-please/templates/base.html` 的 `<style>` 块（为消除渲染阻塞请求）。`themes/no-style-please/sass/style.scss` 是样式唯一源头。

改 sass 后依次：build → 把 `public/style.css` 的内容替换进 base.html 的 `<style>` 块 → 再 build 验证。只改 `zola.toml` 或 `content/` 无需同步。

## 前端设计规范

所有前端样式、模板与交互改动遵循根目录 [`DESIGN.md`](DESIGN.md)。

- 改动样式后必须同步遵守上方「样式同步」流程，并在真实浏览器中完成视觉验收。
- 项目级覆写：正文与标题沿用学术衬线字体（`Times New Roman` / `Songti SC`），不采用 `DESIGN.md` 中的 Geist；首页站点名使用自托管 `Pinyon Script` 斜花体；保留首页个性化装饰彩蛋。

## 主题维护

- 默认只修 bug，不做无授权的结构性重构；按 `DESIGN.md` 做样式调整时需先明确范围。
- 已有修过的坑，别改回去：emoji 渲染宏按 RI 对整体包 span（Safari 国旗）、nav 链接用 `&nbsp;` 分隔（minify_html 会折叠元素间空白）、`generate_feeds` 是 feed 判断键（`generate_feed` 已废弃）。

## 图片规范

- 禁止直接热链外部图床，所有正文配图统一托管在 `static/images/posts/`。
- 新增或更新配图后运行 `node scripts/optimize-images.mjs`：脚本会将图片转换为 1152px 档 AVIF + WebP 回退，并生成 16px LQIP 模糊占位 Base64，输出 `<picture>` 标签（含 `width`、`height`、`loading="lazy"`、`decoding="async"` 与内联模糊背景）。
- 每张图片必须填写有意义的中文 `alt` 描述；`<picture>` 块后必须保留空行，避免吞并后续 Markdown。
- 连续多张同类配图（如游记/年终总结摄影）可用 `<div class="img-gallery">...</div>` 包裹为双列画廊（`</div>` 后留空行）。

## 发布

- 新增文章后运行 `python3 scripts/generate-og.py`，为 `static/images/og/<slug>.png` 生成黑白印刷风 OG 分享卡片。
- commit 后 push main，CF Pages 自动构建。
- push 后等 CF Pages 构建完成，刷新 Cloudflare 边缘缓存（HTML 边缘缓存 15 分钟，清缓存可立刻生效）：

```sh
(cd /tmp && cf cache purge -z lanlance.cn --body '{"purge_everything":true}' --force)
```

- 静态资源缓存与安全响应头规则在 `static/_headers`。
