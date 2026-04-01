/* UI strings load from locales/messages.json via SecurityPageI18n.install(bundle) */
(function () {
  "use strict";

  var I18N = {};
  var RTL_BASE = {};
  var LANG_NAMES = {};

  function pickLocale() {
    var keys = Object.keys(I18N);
    var list =
      navigator.languages && navigator.languages.length
        ? Array.prototype.slice.call(navigator.languages)
        : [navigator.language || "en"];
    for (var i = 0; i < list.length; i++) {
      var raw = list[i];
      var tag = String(raw)
        .toLowerCase()
        .replace(/_/g, "-");
      if (keys.indexOf(tag) !== -1) return tag;
      if (tag === "zh" || tag.indexOf("zh-") === 0) {
        if (/tw|hk|hant|mo/.test(tag)) return keys.indexOf("zh-TW") !== -1 ? "zh-TW" : "en";
        return keys.indexOf("zh-CN") !== -1 ? "zh-CN" : "en";
      }
      if (tag.indexOf("pt") === 0) return keys.indexOf("pt") !== -1 ? "pt" : "en";
      if (/^nb|^nn|^no$|^no-/.test(tag)) return keys.indexOf("no") !== -1 ? "no" : "en";
      var base = tag.split("-")[0];
      if (keys.indexOf(base) !== -1) return base;
    }
    return "en";
  }

  function applyStrings(loc) {
    var t = I18N[loc] || I18N.en;
    var te = I18N[loc] || {};
    var tEn = I18N.en;
    var base = loc.split("-")[0];
    document.documentElement.lang = loc;
    document.documentElement.dir = RTL_BASE[base] ? "rtl" : "ltr";
    document.title = t.pageTitle;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (!k) return;
      var val = te[k] || tEn[k];
      if (val) el.textContent = val;
    });
    var nav = document.getElementById("contact-nav");
    if (nav) {
      var navLab = te.navLabel || t.navLabel;
      if (navLab) nav.setAttribute("aria-label", navLab);
    }
  }

  function install(bundle) {
    I18N = bundle && bundle.strings ? bundle.strings : {};
    LANG_NAMES = bundle && bundle.langNames ? bundle.langNames : {};
    RTL_BASE = {};
    var rtl = (bundle && bundle.rtlLocales) || [];
    for (var r = 0; r < rtl.length; r++) {
      RTL_BASE[String(rtl[r]).split("-")[0]] = 1;
    }
    SecurityPageI18n.I18N = I18N;
    SecurityPageI18n.langNames = LANG_NAMES;
  }

  var SecurityPageI18n = {
    I18N: I18N,
    langNames: LANG_NAMES,
    install: install,
    pickLocaleFromBrowser: pickLocale,
    applyStrings: applyStrings,
    isRTLBase: function (loc) {
      return RTL_BASE[loc.split("-")[0]];
    },
  };

  window.SecurityPageI18n = SecurityPageI18n;
})();
