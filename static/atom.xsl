<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="zh">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/atom:feed/atom:title"/> - RSS / Atom Feed</title>
        <style>
          body { font-family: "Times New Roman", "Songti SC", "Noto Serif CJK SC", serif; color: #000; background: #fff; margin: 0; line-height: 1.75; }
          .w { max-width: 640px; margin: 0 auto; padding: 4rem 2rem; }
          .hint { border-left: 3px solid #000; padding: 0.4rem 1rem; margin: 1.5rem 0; color: #333; font-size: 0.95em; }
          code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #000; color: #fff; padding: 0.1em 0.35em; font-size: 0.88em; }
          .date { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.88em; color: #57606a; }
          li { margin: 0.5rem 0; }
          a { color: #000; text-underline-offset: 3px; }
        </style>
      </head>
      <body>
        <div class="w">
          <p><a href="/">..</a>/atom.xml</p>
          <h1><xsl:value-of select="/atom:feed/atom:title"/> (Atom Feed)</h1>
          <div class="hint">
            这是一个 Atom XML 订阅源。将地址 <code>https://lanlance.cn/atom.xml</code> 复制到你的 RSS 阅读器（如 NetNewsWire、Follow、Reeder、Inoreader）即可订阅最新文章。
          </div>
          <h2>最近 20 篇文章</h2>
          <ul>
            <xsl:for-each select="/atom:feed/atom:entry">
              <li>
                <span class="date"><xsl:value-of select="substring(atom:published, 1, 10)"/></span>
                <xsl:text> - </xsl:text>
                <a>
                  <xsl:attribute name="href"><xsl:value-of select="atom:link[@rel='alternate']/@href"/></xsl:attribute>
                  <xsl:value-of select="atom:title"/>
                </a>
              </li>
            </xsl:for-each>
          </ul>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
