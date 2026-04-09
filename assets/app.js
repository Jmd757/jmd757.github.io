/* config/site.json: lines (phone only), meta, content, images; locales/messages.json: i18n */
(function () {
  "use strict";

  var LS_LANG = "security-page-lang";
  var siteJson = null;
  var iconDefaults = null;

  var PHONE_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

  function api() {
    return window.SecurityPageI18n;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function normalizeLine(o) {
    if (!o || !o.id) return null;
    var tel = String(o.tel || "").replace(/\s/g, "");
    return {
      id: String(o.id),
      name: o.name || String(o.id),
      tel: tel,
      display: o.display != null && String(o.display).trim() !== "" ? String(o.display).trim() : "",
      subtitle: o.subtitle != null && String(o.subtitle).trim() !== "" ? String(o.subtitle).trim() : "",
      content: o.content && typeof o.content === "object" ? o.content : null,
      contentLocales: o.contentLocales && typeof o.contentLocales === "object" ? o.contentLocales : null,
      images: o.images && typeof o.images === "object" ? o.images : null,
    };
  }

  function loadLinesFromSite() {
    if (!siteJson || !siteJson.lines || !siteJson.lines.length) return null;
    var out = [];
    for (var i = 0; i < siteJson.lines.length; i++) {
      var n = normalizeLine(siteJson.lines[i]);
      if (n) out.push(n);
    }
    return out.length ? out : null;
  }

  function getLines() {
    var fromFile = loadLinesFromSite();
    if (fromFile && fromFile.length) return fromFile;
    var w = window.SECURITY_LINES;
    if (w && w.length) {
      var alt = [];
      for (var j = 0; j < w.length; j++) {
        var n = normalizeLine(w[j]);
        if (n) alt.push(n);
      }
      return alt;
    }
    return [];
  }

  function formatNationalDisplay(tel) {
    var d = String(tel).replace(/\D/g, "");
    if (d.length >= 11 && d.indexOf("44") === 0) {
      var n = d.slice(2);
      if (n.length === 10 && n.charAt(0) === "7") {
        return "0" + n.slice(0, 4) + " " + n.slice(4, 7) + " " + n.slice(7);
      }
      if (n.length === 10 && n.charAt(0) === "2") {
        return "0" + n.slice(0, 4) + " " + n.slice(4);
      }
    }
    return tel;
  }

  function lineDescription(L, tapHint) {
    if (L.subtitle) return L.subtitle;
    if (L.display) return L.display;
    var fmt = formatNationalDisplay(L.tel);
    if (fmt && fmt !== L.tel) return fmt;
    return tapHint || L.tel || "";
  }

  function parseParams() {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function isValidLocale(code) {
    if (!code || !api()) return false;
    return !!api().I18N[code];
  }

  function resolveInitialLang() {
    var p = parseParams();
    var q = (p.get("lang") || "").trim().replace(/_/g, "-");
    if (q && q !== "auto" && isValidLocale(q)) {
      try {
        localStorage.setItem(LS_LANG, q);
      } catch (e) {}
      return q;
    }
    try {
      var stored = localStorage.getItem(LS_LANG);
      if (stored && isValidLocale(stored)) return stored;
    } catch (e) {}
    return api().pickLocaleFromBrowser();
  }

  var state = { lang: "en" };

  function syncUrl() {
    try {
      var u = new URL(window.location.href);
      u.searchParams.set("lang", state.lang);
      u.searchParams.delete("office");
      window.history.replaceState({}, "", u.toString());
    } catch (e) {}
  }

  function langNames() {
    return (api() && api().langNames) || {};
  }

  function buildLangSelect(current) {
    var sel = byId("lang-select");
    if (!sel || !api()) return;
    sel.innerHTML = "";
    var names = langNames();
    var keys = Object.keys(api().I18N).slice();
    keys.sort(function (a, b) {
      var na = names[a] || a;
      var nb = names[b] || b;
      return na.localeCompare(nb, "en");
    });
    for (var i = 0; i < keys.length; i++) {
      var c = keys[i];
      var o = document.createElement("option");
      o.value = c;
      o.textContent = names[c] || c;
      sel.appendChild(o);
    }
    sel.value = isValidLocale(current) ? current : "en";
  }

  function mergeContentLayers() {
    var site = siteJson || {};
    var base = {};
    function assign(obj) {
      if (!obj || typeof obj !== "object") return;
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) base[k] = obj[k];
      }
    }
    assign(site.content);
    var loc = state.lang;
    if (site.contentLocales && site.contentLocales[loc]) assign(site.contentLocales[loc]);
    return base;
  }

  function applyTextOverrides(merged) {
    if (!merged) return;
    for (var key in merged) {
      if (!Object.prototype.hasOwnProperty.call(merged, key)) continue;
      var val = merged[key];
      if (val == null) continue;
      var s = String(val);
      if (s.trim() === "") continue;
      var sel = '[data-i18n="' + key.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]';
      document.querySelectorAll(sel).forEach(function (el) {
        el.textContent = s;
      });
      if (key === "navLabel") {
        var nav = byId("contact-nav");
        if (nav) nav.setAttribute("aria-label", s);
      }
      if (key === "pageTitle") document.title = s;
    }
  }

  function applyMeta(meta) {
    if (!meta || typeof meta !== "object") return;
    var tc = meta.themeColor;
    if (tc != null && String(tc).trim() !== "") {
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", String(tc).trim());
    }
  }

  function applyFooterNote(merged) {
    var el = byId("foot-note");
    if (!el) return;
    var raw = merged && merged.footerNote;
    if (raw == null || String(raw).trim() === "") {
      el.textContent = "";
      el.hidden = true;
      return;
    }
    el.textContent = String(raw);
    el.hidden = false;
  }

  function cacheIconDefaults() {
    if (iconDefaults) return;
    var b = byId("brand-icon-root");
    iconDefaults = {
      brand: b ? b.innerHTML : "",
    };
  }

  function resolveAssetUrl(u) {
    if (!u || String(u).trim() === "") return "";
    try {
      return new URL(String(u).trim(), window.location.href).href;
    } catch (e) {
      return String(u).trim();
    }
  }

  function setIconSlot(elId, url, fallbackHtml) {
    var el = byId(elId);
    if (!el) return;
    var u = resolveAssetUrl(url);
    if (!u) {
      el.innerHTML = fallbackHtml || "";
      return;
    }
    el.innerHTML = "";
    var img = document.createElement("img");
    img.src = u;
    img.alt = "";
    img.decoding = "async";
    el.appendChild(img);
  }

  function applyBrandIcon() {
    cacheIconDefaults();
    var site = siteJson || {};
    var siteI = site.images && typeof site.images === "object" ? site.images : {};
    var url = siteI.brand ? String(siteI.brand).trim() : "";
    setIconSlot("brand-icon-root", url, iconDefaults.brand);
  }

  function tapToCallHint() {
    var t = api().I18N[state.lang] || {};
    var en = api().I18N.en || {};
    return t.tapToCall || en.tapToCall || "";
  }

  function renderLines() {
    var ul = byId("lines-list");
    if (!ul) return;
    ul.innerHTML = "";
    var lines = getLines();
    var hint = tapToCallHint();
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      var li = document.createElement("li");
      li.setAttribute("data-line-id", L.id);
      var a = document.createElement("a");
      a.className = "action action-call";
      a.href = "tel:" + L.tel;
      var iconWrap = document.createElement("span");
      iconWrap.className = "action-icon";
      iconWrap.setAttribute("aria-hidden", "true");
      iconWrap.innerHTML = PHONE_ICON_SVG;
      var body = document.createElement("span");
      body.className = "action-body";
      var title = document.createElement("span");
      title.className = "action-title";
      title.textContent = L.name;
      var desc = document.createElement("span");
      desc.className = "action-desc";
      desc.textContent = lineDescription(L, hint);
      body.appendChild(title);
      body.appendChild(desc);
      var arrow = document.createElement("span");
      arrow.className = "action-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "\u2192";
      a.appendChild(iconWrap);
      a.appendChild(body);
      a.appendChild(arrow);
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  function applyAll() {
    api().applyStrings(state.lang);
    if (siteJson) applyMeta(siteJson.meta);
    renderLines();
    var merged = mergeContentLayers();
    applyTextOverrides(merged);
    applyFooterNote(merged);
    applyBrandIcon();
    var lsel = byId("lang-select");
    if (lsel && isValidLocale(state.lang)) lsel.value = state.lang;
  }

  function init() {
    if (!api() || !Object.keys(api().I18N).length) {
      console.warn("security page: locales not loaded (locales/messages.json).");
      return;
    }
    var lines = getLines();
    if (!lines.length) {
      console.warn("security page: add lines in config/site.json (or window.SECURITY_LINES).");
      return;
    }
    cacheIconDefaults();
    state.lang = resolveInitialLang();
    buildLangSelect(state.lang);
    applyAll();
    syncUrl();

    var langSel = byId("lang-select");
    if (langSel) {
      langSel.addEventListener("change", function () {
        var v = langSel.value;
        if (isValidLocale(v)) {
          state.lang = v;
          try {
            localStorage.setItem(LS_LANG, v);
          } catch (e) {}
          applyAll();
          syncUrl();
        }
      });
    }
  }

  function siteAssetBase() {
    var lists = document.getElementsByTagName("script");
    for (var i = lists.length - 1; i >= 0; i--) {
      var src = lists[i].src || "";
      if (!src) continue;
      var lower = src.toLowerCase();
      if (lower.indexOf("/assets/app.js") === -1 && lower.indexOf("\\assets\\app.js") === -1) continue;
      try {
        var u = new URL(src);
        var path = u.pathname.replace(/\/?assets\/app\.js$/i, "/");
        if (!path.endsWith("/")) path += "/";
        return u.origin + path;
      } catch (err) {}
    }
    try {
      return new URL(".", window.location.href).href;
    } catch (e2) {
      return "";
    }
  }

  function fetchJson(relPath) {
    var base = siteAssetBase();
    var url = base ? new URL(relPath, base).href : relPath;
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }

  function bootstrap() {
    if (!window.SecurityPageI18n) {
      console.warn("security page: SecurityPageI18n missing (i18n.js).");
      return;
    }
    Promise.all([fetchJson("config/site.json"), fetchJson("locales/messages.json")])
      .then(function (pair) {
        siteJson = pair[0];
        SecurityPageI18n.install(pair[1]);
        init();
      })
      .catch(function (e) {
        console.warn("security page: failed to load config or locales", e);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
