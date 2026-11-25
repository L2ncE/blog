#!/usr/bin/env python3
import glob
import os
import re
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = "static/images/og"
W, H = 1200, 630

FONT_SERIF_CANDS = [
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
]
FONT_MONO_CANDS = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/Courier.ttc",
]


def pick_font(cands, size):
    for p in cands:
        if os.path.exists(p):
            return ImageFont.truetype(p, size=size)
    raise RuntimeError(f"No font found in {cands}")


FONT_TITLE = pick_font(FONT_SERIF_CANDS, 54)
FONT_DESC = pick_font(FONT_SERIF_CANDS, 28)
FONT_MONO_SM = pick_font(FONT_MONO_CANDS, 22)
FONT_MONO_XS = pick_font(FONT_MONO_CANDS, 20)


def parse_frontmatter(path):
    raw = open(path, encoding="utf-8").read()
    m = re.match(r"^(\+\+\+|---)\r?\n(.*?)\r?\n\1", raw, re.S)
    if not m:
        return {}
    delim, body = m.group(1), m.group(2)
    meta = {}
    if delim == "---":
        for line in body.splitlines():
            km = re.match(r"^([a-zA-Z0-9_]+)\s*:\s*(.+?)\s*$", line)
            if km:
                k, v = km.group(1), km.group(2).strip().strip('"').strip("'")
                meta[k] = v
    else:
        for line in body.splitlines():
            km = re.match(r"^([a-zA-Z0-9_]+)\s*=\s*(.+?)\s*$", line)
            if km:
                k, v = km.group(1), km.group(2).strip().strip('"').strip("'")
                meta[k] = v
    return meta


def wrap_text(draw, text, font, max_width, max_lines):
    # Strip emoji chars unsupported by Songti so no tofu squares render
    clean = re.sub(r"[\U0001F1E6-\U0001FAFF\u2600-\u27BF\uFE0F]", "", text).strip()
    lines = []
    cur = ""
    for ch in clean:
        test = cur + ch
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            cur = test
        else:
            # avoid breaking mid ASCII word if possible
            sp = cur.rfind(" ")
            if sp > 0 and ch.isascii() and ch.isalnum() and cur[sp + 1 :].isascii():
                lines.append(cur[:sp].rstrip())
                cur = cur[sp + 1 :] + ch
            else:
                lines.append(cur.rstrip())
                cur = ch
            if len(lines) == max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur.rstrip())
    elif cur and len(lines) == max_lines:
        last = lines[-1]
        while last and draw.textbbox((0, 0), last + "...", font=font)[2] > max_width:
            last = last[:-1]
        lines[-1] = last.rstrip() + "..."
    return lines


def render_card(out_path, title, desc, date_str, url_path):
    im = Image.new("L", (W, H), 255)
    draw = ImageDraw.Draw(im)

    pad = 44
    draw.rectangle([pad, pad, W - pad, H - pad], outline=0, width=2)

    inner_x = pad + 44
    inner_w = W - 2 * inner_x

    # Top bar
    draw.text((inner_x, pad + 34), "LANLANCE.CN", font=FONT_MONO_SM, fill=85)
    right_lbl = date_str or "CODE IS CHEAP"
    rb = draw.textbbox((0, 0), right_lbl, font=FONT_MONO_SM)
    draw.text((W - inner_x - (rb[2] - rb[0]), pad + 34), right_lbl, font=FONT_MONO_SM, fill=85)

    draw.line([(inner_x, pad + 78), (W - inner_x, pad + 78)], fill=208, width=1)

    # Title
    y = pad + 122
    for line in wrap_text(draw, title, FONT_TITLE, inner_w, 3):
        draw.text((inner_x, y), line, font=FONT_TITLE, fill=0)
        y += 72

    # Description
    if desc:
        y += 18
        for line in wrap_text(draw, desc, FONT_DESC, inner_w, 2):
            draw.text((inner_x, y), line, font=FONT_DESC, fill=87)
            y += 42

    # Bottom bar
    draw.line([(inner_x, H - pad - 82), (W - inner_x, H - pad - 82)], fill=208, width=1)
    draw.text((inner_x, H - pad - 56), url_path, font=FONT_MONO_XS, fill=85)
    tag = "Code is Cheap"
    tb = draw.textbbox((0, 0), tag, font=FONT_MONO_XS)
    draw.text((W - inner_x - (tb[2] - tb[0]), H - pad - 56), tag, font=FONT_MONO_XS, fill=85)

    im.save(out_path, format="PNG", optimize=True)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    render_card(
        os.path.join(OUT_DIR, "default.png"),
        "LanLance's Blog",
        "Code is Cheap - 后端架构、开源实践、AI Coding 与年度记录。",
        "",
        "lanlance.cn",
    )
    count = 1
    for sec in ("posts", "books", "annual"):
        for path in sorted(glob.glob(f"content/{sec}/*.md")):
            if os.path.basename(path) == "_index.md":
                continue
            meta = parse_frontmatter(path)
            slug = meta.get("slug")
            title = meta.get("title")
            if not slug or not title:
                raise RuntimeError(f"Missing slug/title in {path}")
            desc = meta.get("description", "")
            date_str = meta.get("date", "")
            out_path = os.path.join(OUT_DIR, f"{slug}.png")
            render_card(out_path, title, desc, date_str, f"lanlance.cn/{sec}/{slug}/")
            count += 1
    print(f"Generated {count} OG cards in {OUT_DIR}/")


if __name__ == "__main__":
    main()
