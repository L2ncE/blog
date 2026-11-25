const ASSET_EXT_RE = /\.(png|jpe?g|webp|gif|svg|ico|xml|txt|json|css|js|woff2?|map)$/i;
const CLI_UA_RE = /^(curl|wget|httpie|fetch|xh)\b/i;

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ""));
}

function parseAtomEntries(xml, limit = 8) {
  const entries = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml)) !== null && entries.length < limit) {
    const block = m[1];
    const titleM = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const pubM = block.match(/<published>([\s\S]*?)<\/published>/i) || block.match(/<updated>([\s\S]*?)<\/updated>/i);
    const linkM = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
    if (!titleM || !linkM) continue;
    const title = decodeEntities(titleM[1].replace(/<[^>]+>/g, "")).trim();
    const date = pubM ? pubM[1].trim().slice(0, 10) : "";
    const href = decodeEntities(linkM[1].trim());
    entries.push({ title, date, href });
  }
  return entries;
}

function renderTerminalCard(entries) {
  const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
  };
  const lines = [
    `${c.bold}${c.cyan} _                 _                              ${c.reset}`,
    `${c.bold}${c.cyan}| |    __ _ _ __  | |    __ _ _ __   ___ ___      ${c.reset}`,
    `${c.bold}${c.cyan}| |   / _\` | '_ \\ | |   / _\` | '_ \\ / __/ _ \\     ${c.reset}`,
    `${c.bold}${c.cyan}| |__| (_| | | | || |__| (_| | | | | (_|  __/     ${c.reset}`,
    `${c.bold}${c.cyan}|_____\\__,_|_| |_||_____\\__,_|_| |_|\\___\\___|     ${c.reset}`,
    "",
    `${c.bold}LanLance's Blog${c.reset} ${c.dim}// Code is Cheap${c.reset}`,
    "",
    `${c.green}web${c.reset}     https://lanlance.cn/        ${c.green}photo${c.reset}  https://photo.lanlance.cn/`,
    `${c.green}gists${c.reset}   https://gists.lanlance.cn/  ${c.green}rss${c.reset}    https://lanlance.cn/atom.xml`,
    `${c.green}github${c.reset}  https://github.com/L2ncE    ${c.green}x${c.reset}      https://x.com/LanLance24`,
    "",
    `${c.bold}${c.yellow}Latest Posts${c.reset}`,
    `${c.dim}${"-".repeat(64)}${c.reset}`,
  ];
  for (const e of entries) {
    lines.push(`  ${c.dim}${e.date}${c.reset}  ${c.bold}${e.title}${c.reset}`);
    lines.push(`              ${c.blue}${e.href}${c.reset}`);
  }
  const tipUrl = (entries[0] && entries[0].href) || "https://lanlance.cn/posts/harness-llm-dynamic-game/";
  lines.push(
    "",
    `${c.bold}${c.yellow}Terminal Tips${c.reset}`,
    `  ${c.dim}$${c.reset} curl ${tipUrl}`,
    `  ${c.dim}$${c.reset} curl -H "Accept: text/markdown" ${tipUrl}`,
    ""
  );
  return lines.join("\n");
}

function inlineHtmlToMarkdown(html) {
  return decodeEntities(
    html
      .replace(/<a\b[^>]*class=["']?zola-anchor["']?[^>]*>[\s\S]*?<\/a>/gi, "")
      .replace(/<img\b([^>]*)>/gi, (_, attrs) => {
        const srcM = attrs.match(/\bsrc=["']?([^"'\s>]+)/i);
        const altM = attrs.match(/\balt=["']([^"']*)["']/i);
        const src = srcM ? srcM[1] : "";
        const alt = altM ? altM[1] : "";
        return src ? `![${alt}](${src})` : "";
      })
      .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, text) => {
        const hrefM = attrs.match(/\bhref=["']?([^"'\s>]+)/i);
        const inner = inlineHtmlToMarkdown(text).trim();
        if (!hrefM) return inner;
        return `[${inner}](${hrefM[1]})`;
      })
      .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${inlineHtmlToMarkdown(t).trim()}**`)
      .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${inlineHtmlToMarkdown(t).trim()}*`)
      .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${stripTags(t).trim()}\``)
      .replace(/<br\s*\/?>/gi, "  \n")
      .replace(/<[^>]+>/g, "")
  );
}

function htmlToMarkdown(html, pageUrl) {
  const titleM = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleM ? decodeEntities(titleM[1]).trim() : "";
  const dateM = html.match(/<time\b[^>]*datetime=["']?([^"'\s>]+)/i);
  const date = dateM ? dateM[1].trim() : "";
  const mainM = html.match(/<main\b[^>]*>([\s\S]*?)(?:<\/main>|<footer\b|$)/i);
  let body = (mainM ? mainM[1] : html)
    .replace(/<head\b[\s\S]*?<\/head>/gi, "")
    .replace(/<(script|style|header|footer|nav|dialog)\b[\s\S]*?<\/\1>/gi, "");

  const codeBlocks = [];
  body = body.replace(/<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, attrs, inner) => {
    const langM = attrs.match(/data-lang=["']?([^"'\s>]+)/i);
    const lang = langM ? langM[1] : "";
    const codeText = stripTags(inner).replace(/\n+$/, "");
    const token = `\n@@CODE_BLOCK_${codeBlocks.length}@@\n`;
    codeBlocks.push(`\`\`\`${lang}\n${codeText}\n\`\`\``);
    return token;
  });

  body = body.replace(/<details\b[^>]*class=["']?toc["']?[^>]*>[\s\S]*?<\/details>/gi, "");

  body = body.replace(/<math\b[^>]*>([\s\S]*?)<\/math>/gi, (_, inner) => {
    const txt = stripTags(inner).replace(/\s+/g, " ").trim();
    return txt ? `\n\n$$ ${txt} $$\n\n` : "";
  });

  body = body.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, tbl) => {
    const rows = [];
    const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let tr;
    while ((tr = trRe.exec(tbl)) !== null) {
      const cells = [];
      const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cell;
      while ((cell = cellRe.exec(tr[1])) !== null) {
        cells.push(inlineHtmlToMarkdown(cell[2]).replace(/\s+/g, " ").trim());
      }
      if (cells.length) rows.push(`| ${cells.join(" | ")} |`);
    }
    if (rows.length > 1) {
      const cols = rows[0].split("|").length - 2;
      rows.splice(1, 0, `| ${Array(Math.max(cols, 1)).fill("---").join(" | ")} |`);
    }
    return rows.length ? `\n\n${rows.join("\n")}\n\n` : "";
  });

  body = body
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) => {
      const txt = inlineHtmlToMarkdown(inner).replace(/\s+/g, " ").trim();
      return txt ? `\n\n${"#".repeat(Number(lvl))} ${txt}\n\n` : "";
    })
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
      const txt = inlineHtmlToMarkdown(inner).trim().split(/\n+/).map((l) => `> ${l.trim()}`).join("\n");
      return `\n\n${txt}\n\n`;
    })
    .replace(/<hr\b[^>]*>/gi, "\n\n---\n\n")
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${inlineHtmlToMarkdown(inner).replace(/\s+/g, " ").trim()}`)
    .replace(/<\/(ul|ol)>/gi, "\n\n")
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => `\n\n${inlineHtmlToMarkdown(inner).trim()}\n\n`)
    .replace(/<[^>]+>/g, "");

  body = decodeEntities(body);
  for (let i = 0; i < codeBlocks.length; i++) {
    body = body.replace(`@@CODE_BLOCK_${i}@@`, `\n\n${codeBlocks[i]}\n\n`);
  }

  body = body
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const header = [];
  if (title) header.push(`# ${title}`);
  if (date) header.push(`> Date: ${date} | Source: ${pageUrl}`);
  else header.push(`> Source: ${pageUrl}`);

  return `${header.join("\n\n")}\n\n${body}\n`;
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return context.next();
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith("/cdn-cgi/") || ASSET_EXT_RE.test(url.pathname)) {
    return context.next();
  }

  const ua = request.headers.get("user-agent") || "";
  const accept = request.headers.get("accept") || "";
  const isCli = CLI_UA_RE.test(ua);
  const wantsMarkdown = /\btext\/markdown\b/i.test(accept);

  if (!isCli && !wantsMarkdown) {
    return context.next();
  }

  try {
    if (isCli && !wantsMarkdown && (url.pathname === "/" || url.pathname === "")) {
      const atomRes = await context.env.ASSETS.fetch(new URL("/atom.xml", url));
      const entries = atomRes.ok ? parseAtomEntries(await atomRes.text(), 8) : [];
      const card = renderTerminalCard(entries);
      return new Response(request.method === "HEAD" ? null : card, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Vary": "User-Agent, Accept",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    const res = await context.next();
    const ct = res.headers.get("content-type") || "";
    if (res.status !== 200 || !ct.includes("text/html")) {
      return res;
    }

    const html = await res.text();
    const md = htmlToMarkdown(html, url.toString());
    return new Response(request.method === "HEAD" ? null : md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Vary": "Accept, User-Agent",
        "Cache-Control": "public, max-age=300",
        "x-markdown-tokens": String(Math.ceil(md.length / 4)),
      },
    });
  } catch {
    return context.next();
  }
}
