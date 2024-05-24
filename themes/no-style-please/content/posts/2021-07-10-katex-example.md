---
title: "Katex examples"
extra:
  katex: true
---

## $\KaTeX$

[$\KaTeX$](https://katex.org/) is a fast and easy-to-use library that enables the rendering of mathematical notation, using LaTeX syntax.

You can use $\KaTeX$ **inline** by wrapping the expression between `$` or between `\\(` and `\\)`.

For example, `$ \sin(x) = \sum_{n=0}^{\infty} \frac{(-1)^n}{(2n + 1)!} x^{2n + 1} $` would render: $ \sin(x) = \sum_{n=0}^{\infty} \frac{(-1)^n}{(2n + 1)!} x^{2n + 1} $

To display the expression **on its own line and centered**, wrap it around `$$` or between `\\[` and `\\]`.

For example, `\\[ r = \frac{\sum_{i=1}^{n}(x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_{i=1}^{n}(x_i - \bar{x})^2}\sqrt{\sum_{i=1}^{n}(y_i - \bar{y})^2}} \\]` renders: \\[ r = \frac{\sum_{i=1}^{n}(x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_{i=1}^{n}(x_i - \bar{x})^2}\sqrt{\sum_{i=1}^{n}(y_i - \bar{y})^2}} \\]

To activate $\KaTeX$ for a post, include `katex = true` within the `[extra]` section of the post's front matter. For enhanced performance and security, the JavaScript, CSS, and fonts are hosted locally.

**Note**: After enabling $\KaTeX$, if you want to use \$ without rendering a mathematical expression, escape it with a single backslash: `\$`.
