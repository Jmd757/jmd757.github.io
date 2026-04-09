/* Loads config/site.json + locales; falls back to #site-bootstrap and static HTML in #contact-nav */
(function () {
  "use strict";

  var LS_LANG = "emergency-lines-lang";
  var siteJson = null;

  function api() {
    return window.SecurityPageI18n;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function loadEmbeddedSite() {
    var el = byId("site-bootstrap");
    if (!el) return null;
    try {
      return JSON.parse(el.textContent.trim());
    } catch (e) {
      return null;
    }
  }

  function defaultIconForLineId(lineId) {
    var id = String(lineId || "");
    if (id === "security") return "assets/icons/security.svg";
    if (id === "medical-emergency") return "assets/icons/medical.svg";
    return "";
  }

  function normalizeLine(o) {
    if (!o || !o.id) return null;
    var tel = String(o.tel || "").replace(/\s/g, "");
    if (!tel) return null;
    var id = String(o.id);
    var iconRaw = o.icon != null ? String(o.icon).trim() : "";
    var icon = iconRaw !== "" ? iconRaw : defaultIconForLineId(id);
    return {
      id: id,
      name: (o.name && String(o.name).trim()) || id,
      tel: tel,
      display: o.display != null && String(o.display).trim() !== "" ? String(o.display).trim() : "",
      subtitle: o.subtitle != null && String(o.subtitle).trim() !== "" ? String(o.subtitle).trim() : "",
      icon: icon,
    };
  }

  function loadLinesFromSiteJson() {
    if (!siteJson || !siteJson.lines || !siteJson.lines.length) return null;
    var out = [];
    for (var i = 0; i < siteJson.lines.length; i++) {
      var n = normalizeLine(siteJson.lines[i]);
      if (n) out.push(n);
    }
    return out.length ? out : null;
  }

  function getLinesFromDom() {
    var grid = byId("contact-nav");
    if (!grid) return [];
    var slots = grid.querySelectorAll(".line-slot[data-line-id]");
    var out = [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var id = slot.getAttribute("data-line-id");
      var a = slot.querySelector("a[href^=\"tel:\"]");
      if (!id || !a) continue;
      var href = a.getAttribute("href") || "";
      var tel = href.indexOf("tel:") === 0 ? href.slice(4).replace(/\s/g, "") : "";
      var label = slot.querySelector(".dial-card__label");
      var num = slot.querySelector(".dial-card__num");
      var iconImg = slot.querySelector(".dial-card__icon img");
      var icon = "";
      if (iconImg) {
        icon = (iconImg.getAttribute("src") || "").trim();
      }
      var n = normalizeLine({
        id: id,
        name: label ? label.textContent.trim() : id,
        tel: tel,
        display: num ? num.textContent.trim() : "",
        icon: icon || undefined,
      });
      if (n) out.push(n);
    }
    return out;
  }

  function getLines() {
    var fromFile = loadLinesFromSiteJson();
    if (fromFile && fromFile.length) return fromFile;
    if (window.SECURITY_LINES && window.SECURITY_LINES.length) {
      var alt = [];
      for (var j = 0; j < window.SECURITY_LINES.length; j++) {
        var n = normalizeLine(window.SECURITY_LINES[j]);
        if (n) alt.push(n);
      }
      if (alt.length) return alt;
    }
    return getLinesFromDom();
  }

  function dialCardClassForId(lineId) {
    var id = String(lineId || "");
    if (id === "security") return "dial-card dial-card--security";
    if (id === "medical-emergency") return "dial-card dial-card--medical-emergency";
    return "dial-card dial-card--other";
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
    return "";
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

  function buildLangSelect(current) {
    var sel = byId("lang-select");
    if (!sel || !api()) return;
    sel.innerHTML = "";
    var names = api().langNames || {};
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

  function tapToCallHint() {
    var t = api().I18N[state.lang] || {};
    var en = api().I18N.en || {};
    return t.tapToCall || en.tapToCall || "";
  }

  function renderLines() {
    var grid = byId("contact-nav");
    if (!grid) return;
    var lines = getLines();
    if (!lines.length) return;
    grid.innerHTML = "";
    var hint = tapToCallHint();
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      var art = document.createElement("article");
      art.className = "line-slot";
      art.setAttribute("data-line-id", L.id);
      var a = document.createElement("a");
      a.className = dialCardClassForId(L.id);
      a.href = "tel:" + L.tel;
      var lab = document.createElement("span");
      lab.className = "dial-card__label";
      lab.textContent = L.name;
      var big =
        L.display ||
        formatNationalDisplay(L.tel) ||
        L.tel;
      var num = document.createElement("span");
      num.className = "dial-card__num";
      num.textContent = big;
      var sub = document.createElement("span");
      sub.className = "dial-card__hint";
      if (L.subtitle) {
        sub.textContent = L.subtitle;
      } else {
        sub.setAttribute("data-i18n", "tapToCall");
        sub.textContent = hint || "Tap to call";
      }
      var main = document.createElement("div");
      main.className = "dial-card__main";
      main.appendChild(lab);
      main.appendChild(num);
      main.appendChild(sub);
      var chev = document.createElement("span");
      chev.className = "dial-card__chevron";
      chev.setAttribute("aria-hidden", "true");
      chev.textContent = "›";
      if (L.icon) {
        var iconWrap = document.createElement("div");
        iconWrap.className = "dial-card__icon";
        iconWrap.setAttribute("aria-hidden", "true");
        var img = document.createElement("img");
        img.src = L.icon;
        img.alt = "";
        img.width = 40;
        img.height = 40;
        img.decoding = "async";
        iconWrap.appendChild(img);
        a.appendChild(iconWrap);
      }
      a.appendChild(main);
      a.appendChild(chev);
      art.appendChild(a);
      grid.appendChild(art);
    }
  }

  function applyAll() {
    if (siteJson) applyMeta(siteJson.meta);
    renderLines();
    if (api()) {
      api().applyStrings(state.lang);
    }
    var merged = mergeContentLayers();
    applyTextOverrides(merged);
    applyFooterNote(merged);
    var lsel = byId("lang-select");
    if (lsel && api() && isValidLocale(state.lang)) lsel.value = state.lang;
  }

  function init() {
    if (!api() || !Object.keys(api().I18N).length) {
      return;
    }
    if (!getLines().length) {
      console.warn("emergency-lines: no lines (check config/site.json and #site-bootstrap)");
      return;
    }
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

  function installFallbackLocales() {
    SecurityPageI18n.install({
      strings: {
        en: {
          pageTitle: "Site resources · Phone lines",
          eyebrow: "This site",
          heading: "Access site resources",
          lead: "Use the numbers below for on-site help and services—security, medical emergencies, and other needs. Tap to place a call from your phone.",
          navLabel: "Site resource phone lines",
          labelLanguage: "Language",
          tapToCall: "Tap to call",
        },
      },
      langNames: { en: "English" },
      rtlLocales: ["ar", "he", "fa", "ur"],
    });
  }

  function bootstrap() {
    var embedded = loadEmbeddedSite();
    siteJson = embedded && embedded.lines && embedded.lines.length ? embedded : { lines: [] };

    if (!window.SecurityPageI18n) {
      return;
    }

    var siteP = fetchJson("config/site.json")
      .then(function (j) {
        if (j && j.lines && j.lines.length) {
          siteJson = j;
        }
        return siteJson;
      })
      .catch(function () {
        return siteJson;
      });

    var msgP = fetchJson("locales/messages.json")
      .then(function (j) {
        SecurityPageI18n.install(j);
      })
      .catch(function (e) {
        console.warn("emergency-lines: locales/messages.json failed, using English fallback", e);
        installFallbackLocales();
      });

    Promise.all([siteP, msgP]).then(function () {
      init();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
