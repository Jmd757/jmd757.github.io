#!/usr/bin/env python3
"""Emit static HTML (no runtime JS) from config/site.json + locales/messages.json."""
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


def merge_strings(site: dict, loc: str, strings_root: dict) -> dict:
    en = dict(strings_root.get("en") or {})
    loc_block = dict(strings_root.get(loc) or {})
    merged = {**en, **loc_block}
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
        block = cl.get(loc)
        if isinstance(block, dict):
            for k, v in block.items():
                if v is None:
                    continue
                s = str(v).strip()
                if s:
                    merged[k] = s
    return merged


def page_basename(locale: str, default_locale: str) -> str:
    return "index.html" if locale == default_locale else f"{locale}.html"


def is_rtl_locale(loc: str, rtl_locales: list[str]) -> bool:
    base = loc.split("-")[0]
    rtl = set(rtl_locales or [])
    return base in rtl


def safe_locale_filename(locale: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9-]+", locale))


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
    .top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem 0.65rem;
      margin-bottom: 1.25rem;
    }
    html[dir="rtl"] .top {
      justify-content: flex-start;
    }
    .top-label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .lang-select-wrap {
      min-width: 0;
      max-width: 100%;
    }
    .lang-select {
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.45rem 2rem 0.45rem 0.85rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      max-width: min(100%, 14rem);
      width: auto;
      min-width: 8.5rem;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M1 1.5L6 6l5-4.5' stroke='%2394a3b8' stroke-width='1.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.65rem center;
      background-size: 0.65rem auto;
    }
    @media (prefers-color-scheme: light) {
      .lang-select {
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2364748b' d='M1 1.5L6 6l5-4.5' stroke='%2364748b' stroke-width='1.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      }
    }
    html[dir="rtl"] .lang-select {
      padding: 0.45rem 0.85rem 0.45rem 2rem;
      background-position: left 0.65rem center;
    }
    .lang-select:hover {
      border-color: var(--muted);
    }
    .lang-select:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 3px;
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
    html[dir="rtl"] .dial-card__icon {
      padding: 0.75rem 0.85rem 0.75rem 0.5rem;
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
    html[dir="rtl"] .dial-card__main {
      padding: 0.85rem 0.35rem 0.85rem 0.75rem;
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
    html[dir="rtl"] .dial-card--security {
      border-left: none;
      border-right: 3px solid var(--security);
    }
    html[dir="rtl"] .dial-card--medical-emergency {
      border-left: none;
      border-right: 3px solid var(--emergency);
    }
    html[dir="rtl"] .dial-card--other {
      border-left: none;
      border-right: 3px solid var(--neutral-accent);
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


def render_page(
    *,
    site: dict,
    lines: list[dict],
    loc: str,
    default_locale: str,
    locale_codes: list[str],
    lang_names: dict[str, str],
    rtl_locales: list[str],
    merged: dict,
) -> str:
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
    label_lang_text = html.escape(merged.get("labelLanguage") or "Language", quote=False)
    label_lang_attr = html.escape(merged.get("labelLanguage") or "Language", quote=True)
    tap = html.escape(merged.get("tapToCall") or "Tap to call", quote=False)

    foot_raw = merged.get("footerNote")
    foot_html = ""
    if foot_raw is not None and str(foot_raw).strip():
        foot_html = (
            '<footer class="foot"><p class="foot-note">'
            + html.escape(str(foot_raw).strip(), quote=False)
            + "</p></footer>"
        )

    dir_attr = "rtl" if is_rtl_locale(loc, rtl_locales) else "ltr"
    lang_attr = html.escape(loc, quote=True)

    lang_options: list[str] = []
    sorted_codes = sorted(locale_codes, key=lambda c: (lang_names.get(c) or c).lower())
    for code in sorted_codes:
        href = page_basename(code, default_locale)
        label = html.escape(lang_names.get(code) or code, quote=False)
        val = html.escape(href, quote=True)
        sel = " selected" if code == loc else ""
        lang_options.append(f'        <option value="{val}"{sel}>{label}</option>')
    lang_options_html = "\n".join(lang_options)

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
<html lang="{lang_attr}" dir="{dir_attr}">
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
    <header class="top">
      <div class="lang-select-wrap">
        <label class="top-label" for="lang-select">{label_lang_text}</label>
        <select id="lang-select" class="lang-select" name="lang" autocomplete="off" aria-label="{label_lang_attr}" onchange="var v=this.value;if(v)window.location.href=v;">
{lang_options_html}
        </select>
      </div>
    </header>
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


def main() -> int:
    site = load_json(SITE_PATH)
    bundle = load_json(MESSAGES_PATH)
    strings_root = bundle.get("strings")
    if not isinstance(strings_root, dict) or not strings_root:
        log("error: locales/messages.json missing strings")
        return 1

    lang_names_raw = bundle.get("langNames")
    lang_names: dict[str, str] = (
        {str(k): str(v) for k, v in lang_names_raw.items()}
        if isinstance(lang_names_raw, dict)
        else {}
    )
    rtl_raw = bundle.get("rtlLocales")
    rtl_locales: list[str] = [str(x) for x in rtl_raw] if isinstance(rtl_raw, list) else []

    locale_codes: list[str] = []
    for k in strings_root.keys():
        ks = str(k)
        if not safe_locale_filename(ks):
            log(f"skip unsafe locale code: {ks!r}")
            continue
        locale_codes.append(ks)

    if not locale_codes:
        log("error: no valid locale codes")
        return 1

    default_raw = site.get("defaultLocale")
    default_locale = str(default_raw).strip() if default_raw is not None else ""
    if not default_locale or default_locale not in strings_root:
        default_locale = "en" if "en" in strings_root else sorted(locale_codes)[0]

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

    written: list[str] = []
    for loc in locale_codes:
        merged = merge_strings(site, loc, strings_root)
        out_name = page_basename(loc, default_locale)
        body = render_page(
            site=site,
            lines=lines,
            loc=loc,
            default_locale=default_locale,
            locale_codes=locale_codes,
            lang_names=lang_names,
            rtl_locales=rtl_locales,
            merged=merged,
        )
        out_path = ROOT / out_name
        out_path.write_text(body, encoding="utf-8", newline="\n")
        written.append(out_name)

    log(f"wrote {len(written)} pages: {', '.join(sorted(set(written)))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
