"""Bootstrap only: if assets/i18n.js still contains `var I18N = { ... }`, writes locales/messages.json.
    Day-to-day: edit locales/messages.json directly (i18n.js no longer embeds strings)."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
text = (root / "assets" / "i18n.js").read_text(encoding="utf-8")
marker = "var I18N = "
start = text.index(marker) + len(marker)
rest = text[start:].lstrip()
if rest.startswith("{}"):
    print("Skip: i18n.js has no embedded locale table (use locales/messages.json).")
    raise SystemExit(0)
i = text.index(marker) + len(marker)
while i < len(text) and text[i] in " \t\n\r":
    i += 1
depth = 0
j = i
while j < len(text):
    c = text[j]
    if c == "{":
        depth += 1
    elif c == "}":
        depth -= 1
        if depth == 0:
            j += 1
            break
    j += 1
chunk = text[i:j]
# JS object uses unquoted keys in places? No, keys are quoted. Uses single quotes? No double for strings in values
# Actually the file uses double quotes for strings. Trailing commas? Check cy block - `},` between entries, last `}` before `};`
# chunk ends with `}` closing object - might have trailing comma before last key - JSON doesn't allow - need to fix
chunk = chunk.strip()
if chunk.endswith(","):
    chunk = chunk[:-1]
# Unquoted JS keys (e.g. en:, pageTitle:) -> JSON
chunk = re.sub(
    r"(?m)^([ \t]*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:",
    r'\1"\2":',
    chunk,
)
# Remove trailing commas before } or ] for JSON
chunk = re.sub(r",(\s*[}\]])", r"\1", chunk)
obj = json.loads(chunk)

lang_names = {
    "en": "English",
    "ar": "العربية",
    "cy": "Cymraeg",
    "da": "Dansk",
    "de": "Deutsch",
    "el": "Ελληνικά",
    "es": "Español",
    "fa": "فارسی",
    "fi": "Suomi",
    "fr": "Français",
    "he": "עברית",
    "hi": "हिन्दी",
    "hu": "Magyar",
    "id": "Bahasa Indonesia",
    "it": "Italiano",
    "ja": "日本語",
    "ko": "한국어",
    "ms": "Bahasa Melayu",
    "nl": "Nederlands",
    "no": "Norsk",
    "pl": "Polski",
    "pt": "Português",
    "ro": "Română",
    "ru": "Русский",
    "sv": "Svenska",
    "th": "ไทย",
    "tr": "Türkçe",
    "uk": "Українська",
    "vi": "Tiếng Việt",
    "cs": "Čeština",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
}

bundle = {
    "rtlLocales": ["ar", "he", "fa", "ur"],
    "langNames": lang_names,
    "strings": obj,
}
out = root / "locales" / "messages.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
print("Wrote", out)
