/* config/site.json: offices, meta, content, images; locales/messages.json: i18n */
(function () {
  "use strict";

  var LS_LANG = "security-page-lang";
  var LS_OFFICE = "security-page-office";
  var siteJson = null;
  var iconDefaults = null;

  function api() {
    return window.SecurityPageI18n;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function normalizeOffice(o) {
    if (!o || !o.id) return null;
    var ch = o.channels || {};
    var tel = String(o.tel || "").replace(/\s/g, "");
    var waDigits = String(o.wa || "").replace(/\D/g, "");
    if (!waDigits && tel) waDigits = tel.replace(/\D/g, "");
    return {
      id: String(o.id),
      name: o.name || String(o.id),
      tel: tel,
      wa: waDigits,
      channels: {
        call: ch.call !== false,
        sms: ch.sms !== false,
        whatsapp: ch.whatsapp !== false,
      },
      content: o.content && typeof o.content === "object" ? o.content : null,
      contentLocales: o.contentLocales && typeof o.contentLocales === "object" ? o.contentLocales : null,
      images: o.images && typeof o.images === "object" ? o.images : null,
    };
  }

  function loadOfficesFromSiteFile() {
    if (!siteJson || !siteJson.offices || !siteJson.offices.length) return null;
    var out = [];
    for (var i = 0; i < siteJson.offices.length; i++) {
      var n = normalizeOffice(siteJson.offices[i]);
      if (n) out.push(n);
    }
    return out.length ? out : null;
  }

  function getOffices() {
    var fromFile = loadOfficesFromSiteFile();
    if (fromFile && fromFile.length) return fromFile;
    var w = window.SECURITY_OFFICES;
    if (w && w.length) {
      var alt = [];
      for (var j = 0; j < w.length; j++) {
        var n = normalizeOffice(w[j]);
        if (n) alt.push(n);
      }
      return alt;
    }
    return [];
  }

  function officeById(id) {
    var list = getOffices();
    var want = String(id || "").toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id).toLowerCase() === want) return list[i];
    }
    return list[0] || null;
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

  function resolveInitialOfficeId() {
    var p = parseParams();
    var oid = (p.get("office") || "").trim();
    var oUrl = officeById(oid);
    if (oUrl) {
      try {
        localStorage.setItem(LS_OFFICE, oUrl.id);
      } catch (e) {}
      return oUrl.id;
    }
    try {
      var s = localStorage.getItem(LS_OFFICE);
      if (s && officeById(s)) return officeById(s).id;
    } catch (e) {}
    var first = getOffices()[0];
    return first ? first.id : "";
  }

  function setContactLinks(office) {
    if (!office) return;
    var tel = String(office.tel || "").replace(/\s/g, "");
    var wa = String(office.wa || "").replace(/\D/g, "");
    var call = byId("link-call");
    var sms = byId("link-sms");
    var waLink = byId("link-wa");
    if (call) call.href = "tel:" + tel;
    if (sms) sms.href = "sms:" + tel;
    if (waLink) waLink.href = "https://wa.me/" + wa;
  }

  function formatUKishNational(e164) {
    var d = String(e164).replace(/\D/g, "");
    if (d.length >= 11 && d.indexOf("44") === 0) {
      var n = d.slice(2);
      if (n.length === 10 && n.charAt(0) === "7") {
        return "0" + n.slice(0, 4) + " " + n.slice(4, 7) + " " + n.slice(7);
      }
    }
    return e164;
  }

  function updateFooter(office) {
    if (!office) return;
    var tel = String(office.tel || "").replace(/\s/g, "");
    var nat = byId("foot-national");
    var e164el = byId("foot-e164");
    if (nat) nat.textContent = formatUKishNational(tel);
    if (e164el) e164el.textContent = tel;
  }

  function updateChannelVisibility(office) {
    if (!office || !office.channels) return;
    var ch = office.channels;
    var keys = ["call", "sms", "whatsapp"];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var li = document.querySelector('li[data-channel="' + k + '"]');
      if (li) li.hidden = !ch[k];
    }
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

  function buildOfficeSelect(currentId) {
    var sel = byId("office-select");
    if (!sel) return;
    sel.innerHTML = "";
    var list = getOffices();
    for (var i = 0; i < list.length; i++) {
      var off = list[i];
      var o = document.createElement("option");
      o.value = off.id;
      o.textContent = off.name || off.id;
      sel.appendChild(o);
    }
    var resolved = officeById(currentId);
    if (resolved) sel.value = resolved.id;
    else if (list[0]) sel.value = list[0].id;
  }

  var state = { lang: "en", officeId: "" };

  function syncUrl() {
    try {
      var u = new URL(window.location.href);
      u.searchParams.set("lang", state.lang);
      if (state.officeId) u.searchParams.set("office", state.officeId);
      window.history.replaceState({}, "", u.toString());
    } catch (e) {}
  }

  function toggleOfficeRow() {
    var row = byId("picker-office-row");
    if (!row) return;
    row.hidden = getOffices().length < 2;
  }

  function mergeContentLayers(office) {
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
    if (office && office.content) assign(office.content);
    if (office && office.contentLocales && office.contentLocales[loc]) assign(office.contentLocales[loc]);
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
    var c = byId("action-icon-call");
    var s = byId("action-icon-sms");
    var w = byId("action-icon-whatsapp");
    iconDefaults = {
      brand: b ? b.innerHTML : "",
      call: c ? c.innerHTML : "",
      sms: s ? s.innerHTML : "",
      whatsapp: w ? w.innerHTML : "",
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

  function mergeImageMap(siteI, officeI) {
    var keys = ["brand", "call", "sms", "whatsapp"];
    var out = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = (officeI && officeI[k]) || (siteI && siteI[k]) || "";
      out[k] = String(v || "").trim();
    }
    return out;
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

  function applyIcons(office) {
    cacheIconDefaults();
    var site = siteJson || {};
    var siteI = site.images && typeof site.images === "object" ? site.images : {};
    var offI = office && office.images ? office.images : null;
    var m = mergeImageMap(siteI, offI);
    setIconSlot("brand-icon-root", m.brand, iconDefaults.brand);
    setIconSlot("action-icon-call", m.call, iconDefaults.call);
    setIconSlot("action-icon-sms", m.sms, iconDefaults.sms);
    setIconSlot("action-icon-whatsapp", m.whatsapp, iconDefaults.whatsapp);
  }

  function applyAll() {
    api().applyStrings(state.lang);
    var off = officeById(state.officeId);
    if (siteJson) applyMeta(siteJson.meta);
    if (off) {
      state.officeId = off.id;
      setContactLinks(off);
      updateFooter(off);
      updateChannelVisibility(off);
    }
    var merged = mergeContentLayers(off);
    applyTextOverrides(merged);
    applyFooterNote(merged);
    applyIcons(off);
    var lsel = byId("lang-select");
    if (lsel && isValidLocale(state.lang)) lsel.value = state.lang;
    var osel = byId("office-select");
    if (osel && officeById(state.officeId)) osel.value = officeById(state.officeId).id;
  }

  function init() {
    if (!api() || !Object.keys(api().I18N).length) {
      console.warn("security page: locales not loaded (locales/messages.json).");
      return;
    }
    var offices = getOffices();
    if (!offices.length) {
      console.warn("security page: add offices in config/site.json (or window.SECURITY_OFFICES).");
      return;
    }
    cacheIconDefaults();
    state.lang = resolveInitialLang();
    state.officeId = resolveInitialOfficeId();
    toggleOfficeRow();
    buildLangSelect(state.lang);
    buildOfficeSelect(state.officeId);
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

    var offSel = byId("office-select");
    if (offSel) {
      offSel.addEventListener("change", function () {
        var v = offSel.value;
        var o = officeById(v);
        if (o) {
          state.officeId = o.id;
          try {
            localStorage.setItem(LS_OFFICE, o.id);
          } catch (e) {}
          applyAll();
          syncUrl();
        }
      });
    }
  }

  /**
   * Directory URL where index + config/ + locales/ live. Derived from this script so fetches work on
   * GitHub Pages (any subpath), with odd pathname shapes, and when opened as /folder vs /folder/.
   */
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
