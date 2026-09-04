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

## 主题维护

- 只修 bug，不做结构性重构。
- 已有修过的坑，别改回去：emoji 渲染宏按 RI 对整体包 span（Safari 国旗）、nav 链接用 `&nbsp;` 分隔（minify_html 会折叠元素间空白）、`generate_feeds` 是 feed 判断键（`generate_feed` 已废弃）。

## 发布

- commit 后 push main，CF Pages 自动构建。
- 静态资源缓存规则在仓库根 `_headers`。
