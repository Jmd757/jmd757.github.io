#!/usr/bin/env python3
"""Emit a single English index.html from config/site.json + locales/messages.json (strings.en only)."""
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_PATH = ROOT / "config" / "site.json"
MESSAGES_PATH = ROOT / "locales" / "messages.json"
LOG_DIR = ROOT / "logs"
LOG_PATH = LOG_DIR / "render-static-pages.log"


def log(msg: str) -> None:
    line = f"{datetime.now(timezone.utc).isoformat()} {msg}\n"
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        pass
    print(msg)


def format_national_display(tel: str) -> str:
    d = re.sub(r"\D", "", tel)
    if len(d) >= 11 and d.startswith("44"):
        n = d[2:]
        if len(n) == 10 and n[0] == "7":
            return "0" + n[:4] + " " + n[4:7] + " " + n[7:]
        if len(n) == 10 and n[0] == "2":
            return "0" + n[:4] + " " + n[4:]
    return ""


def default_icon_for_line_id(line_id: str) -> str:
    if line_id == "security":
        return "assets/icons/security.svg"
    if line_id == "medical-emergency":
        return "assets/icons/medical.svg"
    return ""


def normalize_line(raw: object) -> dict | None:
    if not isinstance(raw, dict):
        return None
    line_id = str(raw.get("id") or "").strip()
    if not line_id:
        return None
    tel = re.sub(r"\s+", "", str(raw.get("tel") or ""))
    if not tel:
        return None
    icon_raw = str(raw.get("icon") or "").strip()
    icon = icon_raw or default_icon_for_line_id(line_id)
    name = str(raw.get("name") or "").strip() or line_id
    display = str(raw.get("display") or "").strip()
    subtitle = str(raw.get("subtitle") or "").strip()
    accent = str(raw.get("accent") or "").strip()
    return {
        "id": line_id,
        "name": name,
        "tel": tel,
        "display": display,
        "subtitle": subtitle,
        "icon": icon,
        "accent": accent,
    }


def accent_variant(line: dict) -> str:
    a = (line.get("accent") or "").strip()
    if a in ("security", "medical-emergency", "other"):
        return a
    lid = line["id"]
    if lid == "security":
        return "security"
    if lid == "medical-emergency":
        return "medical-emergency"
    return "other"


def merge_english_strings(site: dict, strings_root: dict) -> dict:
    merged = dict(strings_root.get("en") or {})
    content = site.get("content")
    if isinstance(content, dict):
        for k, v in content.items():
            if v is None:
                continue
            s = str(v).strip()
            if s:
                merged[k] = s
    cl = site.get("contentLocales")
    if isinstance(cl, dict):
        block = cl.get("en")
        if isinstance(block, dict):
            for k, v in block.items():
                if v is None:
                    continue
                s = str(v).strip()
                if s:
                    merged[k] = s
    return merged


INLINE_CSS = r"""
    :root {
      color-scheme: dark;
      --bg: #0f1218;
      --bg-elev: #161b24;
      --surface: #1a202c;
      --border: rgba(255, 255, 255, 0.1);
      --text: #f1f5f9;
      --muted: #94a3b8;
      --security: #2dd4bf;
      --security-bg: rgba(45, 212, 191, 0.12);
      --emergency: #fb7185;
      --emergency-bg: rgba(251, 113, 133, 0.12);
      --neutral-accent: #64748b;
      --focus: #fbbf24;
      --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      --radius: 1rem;
    }
    @media (prefers-color-scheme: light) {
      :root {
        color-scheme: light;
        --bg: #f8fafc;
        --bg-elev: #f1f5f9;
        --surface: #ffffff;
        --border: rgba(15, 23, 42, 0.12);
        --text: #0f172a;
        --muted: #64748b;
        --security: #0d9488;
        --security-bg: rgba(13, 148, 136, 0.1);
        --emergency: #e11d48;
        --emergency-bg: rgba(225, 29, 72, 0.08);
        --neutral-accent: #64748b;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      font-family: var(--font);
      font-size: 1rem;
      line-height: 1.5;
      color: var(--text);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }
    .page {
      max-width: 26rem;
      margin: 0 auto;
      padding: 1.25rem 1.1rem 2.5rem;
    }
    .intro-kicker {
      margin: 0 0 0.35rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .intro-title {
      margin: 0 0 0.6rem;
      font-size: clamp(1.45rem, 5.5vw, 1.85rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .intro-lead {
      margin: 0;
      font-size: 0.92rem;
      color: var(--muted);
      line-height: 1.5;
      max-width: 38ch;
    }
    .line-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1.75rem;
    }
    .dial-card {
      display: flex;
      align-items: stretch;
      gap: 0;
      text-decoration: none;
      color: inherit;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      overflow: hidden;
      min-height: 5.5rem;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .dial-card:hover {
      border-color: var(--muted);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    }
    @media (prefers-color-scheme: light) {
      .dial-card:hover {
        box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
      }
    }
    .dial-card:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 3px;
    }
    .dial-card__icon {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 4rem;
      min-width: 4rem;
      padding: 0.75rem 0.5rem 0.75rem 0.85rem;
      background: var(--bg-elev);
    }
    .dial-card__icon img {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: contain;
      display: block;
    }
    .dial-card__main {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.85rem 0.75rem 0.85rem 0.35rem;
      min-width: 0;
    }
    .dial-card__title {
      margin: 0;
      font-size: clamp(1.05rem, 4.2vw, 1.35rem);
      font-weight: 700;
      line-height: 1.25;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dial-card__phone {
      margin: 0;
      font-size: 0.78rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      color: var(--muted);
      line-height: 1.35;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dial-card__hint {
      margin: 0.15rem 0 0;
      font-size: 0.72rem;
      font-weight: 500;
      color: var(--muted);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .dial-card--security {
      border-left: 3px solid var(--security);
    }
    .dial-card--medical-emergency {
      border-left: 3px solid var(--emergency);
    }
    .dial-card--other {
      border-left: 3px solid var(--neutral-accent);
    }
    .foot {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
    }
    .foot-note {
      margin: 0;
      font-size: 0.78rem;
      color: var(--muted);
      line-height: 1.45;
    }
"""


def render_page(*, site: dict, lines: list[dict], merged: dict) -> str:
    theme = merged.get("pageTitle") or "Site resources"
    theme_color = "#13161d"
    meta = site.get("meta")
    if isinstance(meta, dict):
        tc = meta.get("themeColor")
        if tc is not None and str(tc).strip():
            theme_color = html.escape(str(tc).strip(), quote=True)

    eyebrow = html.escape(merged.get("eyebrow") or "", quote=False)
    heading = html.escape(merged.get("heading") or "", quote=False)
    lead = html.escape(merged.get("lead") or "", quote=False)
    nav_label = html.escape(merged.get("navLabel") or "Phone lines", quote=True)
    tap = html.escape(merged.get("tapToCall") or "Tap to call", quote=False)

    foot_raw = merged.get("footerNote")
    foot_html = ""
    if foot_raw is not None and str(foot_raw).strip():
        foot_html = (
            '<footer class="foot"><p class="foot-note">'
            + html.escape(str(foot_raw).strip(), quote=False)
            + "</p></footer>"
        )

    cards: list[str] = []
    for L in lines:
        variant = accent_variant(L)
        card_class = "dial-card dial-card--" + html.escape(variant, quote=False)
        tel_href = html.escape("tel:" + L["tel"], quote=True)
        title = html.escape(L["name"], quote=False)
        display = L["display"] or format_national_display(L["tel"]) or L["tel"]
        phone_text = html.escape(display, quote=False)
        sub = (L.get("subtitle") or "").strip()
        if sub:
            hint = html.escape(sub, quote=False)
        else:
            hint = tap
        icon = L["icon"]
        icon_esc = html.escape(icon, quote=True)
        cards.append(
            f"""<article class="line-slot" data-line-id="{html.escape(L["id"], quote=True)}">
  <a class="{card_class}" href="{tel_href}">
    <div class="dial-card__icon" aria-hidden="true">
      <img src="{icon_esc}" alt="" width="40" height="40" decoding="async">
    </div>
    <div class="dial-card__main">
      <p class="dial-card__title">{title}</p>
      <p class="dial-card__phone">{phone_text}</p>
      <p class="dial-card__hint">{hint}</p>
    </div>
  </a>
</article>"""
        )

    cards_block = "\n".join(cards)

    return f"""<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="{theme_color}">
  <title>{html.escape(theme, quote=False)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
  <style>
    :root {{ --font: "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }}
    body {{ font-family: var(--font); }}
{INLINE_CSS}
  </style>
</head>
<body>
  <div class="page">
    <header class="intro">
      <p class="intro-kicker">{eyebrow}</p>
      <h1 class="intro-title">{heading}</h1>
      <p class="intro-lead">{lead}</p>
    </header>
    <main>
      <nav class="line-grid" aria-label="{nav_label}">
{cards_block}
      </nav>
    </main>
{foot_html}
  </div>
</body>
</html>
"""


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def remove_stale_locale_html() -> int:
    removed = 0
    for p in ROOT.glob("*.html"):
        if p.name != "index.html":
            try:
                p.unlink()
                removed += 1
            except OSError as e:
                log(f"warning: could not remove {p.name}: {e}")
    return removed


def main() -> int:
    site = load_json(SITE_PATH)
    bundle = load_json(MESSAGES_PATH)
    strings_root = bundle.get("strings")
    if not isinstance(strings_root, dict):
        strings_root = {}

    merged = merge_english_strings(site, strings_root)
    if not merged.get("heading"):
        merged.setdefault("pageTitle", "Site resources")
        merged.setdefault("heading", "Access site resources")
        merged.setdefault("lead", "")
        merged.setdefault("navLabel", "Phone lines")
        merged.setdefault("tapToCall", "Tap to call")
        merged.setdefault("eyebrow", "This site")
    if not strings_root.get("en"):
        log("warning: locales/messages.json has no strings.en; using site content and fallbacks only")

    raw_lines = site.get("lines")
    lines: list[dict] = []
    if isinstance(raw_lines, list):
        for item in raw_lines:
            n = normalize_line(item)
            if n:
                lines.append(n)
    if not lines:
        log("error: no dial lines in config/site.json")
        return 1

    body = render_page(site=site, lines=lines, merged=merged)
    out_path = ROOT / "index.html"
    out_path.write_text(body, encoding="utf-8", newline="\n")

    n_removed = remove_stale_locale_html()
    if n_removed:
        log(f"removed {n_removed} stale locale *.html files")

    log("wrote index.html (English only)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
