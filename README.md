# LanLance's Blog

Deployed on Cloudflare Pages

## Infra

```
blog/
├── zola.toml            # 站点配置
├── content/             # 文章内容
│   ├── posts/           # 技术文与杂谈
│   ├── books/           # 书评/读书笔记
│   ├── annual/          # 年终总结
│   ├── about/           # 关于页面
│   └── friends/         # 友链页面
├── static/              # 静态资源（含 _headers 缓存规则）
└── themes/              # 主题（vendored）
    └── no-style-please/
```

## Usage

```bash
zola serve
```

## 主题维护

样式源码在 `themes/no-style-please/sass/style.scss`，编译后的 CSS 已内联进 `themes/no-style-please/templates/base.html`（消除渲染阻塞）。改样式后：`zola build`，再把 `public/style.css` 的内容同步进 `base.html`。

## License

No License