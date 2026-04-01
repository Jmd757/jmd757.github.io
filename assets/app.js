/* Language + office pickers, URL (?lang= & ?office=), localStorage, contact link sync */
(function () {
  "use strict";

  var LS_LANG = "security-page-lang";
  var LS_OFFICE = "security-page-office";

  var LANG_NAMES = {
    en: "English",
    ar: "العربية",
    cy: "Cymraeg",
    da: "Dansk",
    de: "Deutsch",
    el: "Ελληνικά",
    es: "Español",
    fa: "فارسی",
    fi: "Suomi",
    fr: "Français",
    he: "עברית",
    hi: "हिन्दी",
    hu: "Magyar",
    id: "Bahasa Indonesia",
    it: "Italiano",
    ja: "日本語",
    ko: "한국어",
    ms: "Bahasa Melayu",
    nl: "Nederlands",
    no: "Norsk",
    pl: "Polski",
    pt: "Português",
    ro: "Română",
    ru: "Русский",
    sv: "Svenska",
    th: "ไทย",
    tr: "Türkçe",
    uk: "Українська",
    vi: "Tiếng Việt",
    cs: "Čeština",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
  };

  function api() {
    return window.SecurityPageI18n;
  }

  function getOffices() {
    return window.SECURITY_OFFICES || [];
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
    return first ? first.id : "main";
  }

  function setContactLinks(office) {
    if (!office) return;
    var tel = String(office.tel || "").replace(/\s/g, "");
    var wa = String(office.wa || "").replace(/\D/g, "");
    var call = document.getElementById("link-call");
    var sms = document.getElementById("link-sms");
    var waLink = document.getElementById("link-wa");
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
    var nat = document.getElementById("foot-national");
    var e164el = document.getElementById("foot-e164");
    if (nat) nat.textContent = formatUKishNational(tel);
    if (e164el) e164el.textContent = tel;
  }

  function buildLangSelect(current) {
    var sel = document.getElementById("lang-select");
    if (!sel || !api()) return;
    sel.innerHTML = "";
    var keys = Object.keys(api().I18N);
    var rest = keys.filter(function (k) {
      return k !== "en";
    });
    rest.sort(function (a, b) {
      var na = LANG_NAMES[a] || a;
      var nb = LANG_NAMES[b] || b;
      return na.localeCompare(nb, "en");
    });
    var o0 = document.createElement("option");
    o0.value = "en";
    o0.textContent = LANG_NAMES.en || "English";
    o0.className = "lang-opt-en";
    sel.appendChild(o0);
    for (var i = 0; i < rest.length; i++) {
      var c = rest[i];
      var o = document.createElement("option");
      o.value = c;
      o.textContent = LANG_NAMES[c] || c;
      sel.appendChild(o);
    }
    sel.value = isValidLocale(current) ? current : "en";
  }

  function buildOfficeSelect(currentId) {
    var sel = document.getElementById("office-select");
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

  var state = { lang: "en", officeId: "main" };

  function syncUrl() {
    try {
      var u = new URL(window.location.href);
      u.searchParams.set("lang", state.lang);
      u.searchParams.set("office", state.officeId);
      window.history.replaceState({}, "", u.toString());
    } catch (e) {}
  }

  function toggleOfficeRow() {
    var row = document.getElementById("picker-office-row");
    if (!row) return;
    row.hidden = getOffices().length < 2;
  }

  function applyAll() {
    api().applyStrings(state.lang);
    var off = officeById(state.officeId);
    if (off) {
      state.officeId = off.id;
      setContactLinks(off);
      updateFooter(off);
    }
    var lsel = document.getElementById("lang-select");
    if (lsel && isValidLocale(state.lang)) lsel.value = state.lang;
    var osel = document.getElementById("office-select");
    if (osel && officeById(state.officeId)) osel.value = officeById(state.officeId).id;
  }

  function init() {
    if (!window.SecurityPageI18n || !window.SECURITY_OFFICES || !window.SECURITY_OFFICES.length) {
      return;
    }
    state.lang = resolveInitialLang();
    state.officeId = resolveInitialOfficeId();
    toggleOfficeRow();
    buildLangSelect(state.lang);
    buildOfficeSelect(state.officeId);
    applyAll();
    syncUrl();

    var langSel = document.getElementById("lang-select");
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

    var offSel = document.getElementById("office-select");
    if (offSel) {
      offSel.addEventListener("change", function () {
        var v = offSel.value;
        var o = officeById(v);
        if (o) {
          state.officeId = o.id;
          try {
            localStorage.setItem(LS_OFFICE, o.id);
          } catch (e) {}
          setContactLinks(o);
          updateFooter(o);
          syncUrl();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
