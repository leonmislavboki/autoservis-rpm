/* ==========================================================================
   consent.js — GDPR pristanak za kolačiće, bez ovisnosti (~6kb)
   Pair with consent.css. Ide u <head> BEZ defer-a (mora postaviti zastavice
   prije nego se išta treće učita):

     <script src="consent.js"></script>

   Konfiguracija (opcionalno, prije skripte):
     <script>
       window.CONSENT = {
         categories: ["analitika", "marketing"],  // nuzni su uvijek unutra
         policyUrl: "pravila-privatnosti.html",
         cookieUrl: "kolacici.html",
         days: 180,     // koliko dugo vrijedi odluka prije ponovnog pitanja
         version: 1,    // povećaj kad se popis kolačića promijeni
         lead: "…",     // uvodna rečenica bannera; zadana spominje analitiku
                        // i kartu, pa je prepiši ako stranica nema obje
         gtag: false,   // true = šalje Google Consent Mode v2 signale
         strings: {…},  // prijevod sučelja, npr. za /en/ (ključevi u var S niže)
         categoryText: { marketing: { naziv: "…", opis: "…" } }
       };
     </script>

   Markup API
   ----------
   Blokirani embed (iframe se NE učitava dok nema pristanka):
     <iframe data-consent="marketing" data-consent-src="https://…"
             data-consent-label="Google Maps karta" title="…"></iframe>

   Blokirana skripta (ne izvršava se dok nema pristanka):
     <script type="text/plain" data-consent="analitika"
             data-consent-src="https://…"></script>
     <script type="text/plain" data-consent="analitika"> …inline kod… </script>

   Ponovno otvaranje postavki (obavezno u podnožju svake stranice):
     <button type="button" data-consent-open>Postavke kolačića</button>
     ili bilo koji <a href="#kolacici-postavke">

   JS API
   ------
     Consent.has("analitika")   -> true/false
     Consent.get()              -> { nuzni:true, analitika:false, … } ili null
     Consent.open()             -> otvara postavke
     Consent.withdraw()         -> briše odluku i vraća banner
     document.addEventListener("consent:change", function (e) { e.detail })

   Pravila koja se ne diraju:
   - ništa iz ne-nužnih kategorija ne učitava se prije klika,
   - "Odbij sve" je isti gumb, iste veličine i težine, kao "Prihvati sve",
   - ništa nije unaprijed označeno osim nužnih,
   - zatvaranje, ESC ili scroll NIJE pristanak — banner samo ostaje.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.CONSENT || {};
  /* Uvodna rečenica bannera. Zadana spominje analitiku i vanjski sadržaj; ako
     stranica nema obje kategorije, prepiši je preko window.CONSENT.lead —
     banner koji nabraja ono što stranica ne radi odmah se vidi kao prepisan. */
  var LEAD = CFG.lead ||
    "Nužne kolačiće koristimo da stranica radi. Sve ostalo &mdash; statistiku posjeta " +
    "i vanjski sadržaj poput karte &mdash; učitavamo samo ako pristanete.";
  var ALL = ["nuzni"].concat(CFG.categories || ["analitika", "marketing"]);
  var KEY = "consent.v" + (CFG.version || 1);
  var DAYS = CFG.days || 180;
  var doc = document;

  /* Sučelje na drugom jeziku (npr. /en/ stranice): window.CONSENT.strings
     prepisuje samo ključeve koje navedete, window.CONSENT.categoryText
     prepisuje naziv i opis kategorije ({ marketing: { naziv, opis } }). */
  var S = {
    bannerTitle: "Kolačići na ovoj stranici",
    settingsTitle: "Postavke kolačića",
    settingsLead: "Odaberite što dopuštate. Odluku možete promijeniti u svakom trenutku putem poveznice u podnožju stranice.",
    acceptAll: "Prihvati sve",
    rejectAll: "Odbij sve",
    settings: "Postavke",
    save: "Spremi odabir",
    always: "uvijek uključeno",
    policy: "Pravila privatnosti",
    cookies: "Politika kolačića",
    blockedTitle: " nije učitan",
    blockedText: "Za prikaz je potreban pristanak na kategoriju &bdquo;{cat}&ldquo;, jer se sadržaj učitava s vanjskog poslužitelja.",
    blockedAllow: "Prikaži i prihvati",
    external: "Vanjski sadržaj"
  };
  if (CFG.strings) for (var sk in CFG.strings) S[sk] = CFG.strings[sk];

  var TEXT = {
    nuzni: {
      naziv: "Nužni kolačići",
      opis: "Potrebni su za osnovni rad stranice i za pamćenje ove odluke. Ne mogu se isključiti."
    },
    analitika: {
      naziv: "Analitika",
      opis: "Anonimna statistika posjeta — koje se stranice čitaju i koliko dugo. Pomaže nam poboljšati sadržaj."
    },
    marketing: {
      naziv: "Marketing i vanjski sadržaj",
      opis: "Karte, video i oglasni kolačići. Bez ovoga se vanjski sadržaj ne učitava."
    },
    personalizacija: {
      naziv: "Personalizacija",
      opis: "Pamti vaše postavke na stranici, primjerice odabranu lokaciju ili jezik."
    }
  };
  if (CFG.categoryText) for (var ck in CFG.categoryText) TEXT[ck] = CFG.categoryText[ck];

  /* --- pohrana ------------------------------------------------------------ */
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !d.t || !d.c) return null;
      if (Date.now() - d.t > DAYS * 864e5) { localStorage.removeItem(KEY); return null; }
      var out = { nuzni: true };
      ALL.forEach(function (c) { out[c] = c === "nuzni" ? true : !!d.c[c]; });
      return out;
    } catch (e) { return null; }
  }

  function write(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v: CFG.version || 1, c: s }));
    } catch (e) {}
  }

  var state = read();

  /* --- Google Consent Mode v2 (samo ako je uključen) ---------------------- */
  function signal(s) {
    if (!CFG.gtag) return;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    var a = s && s.analitika ? "granted" : "denied";
    var m = s && s.marketing ? "granted" : "denied";
    window.gtag("consent", s ? "update" : "default", {
      ad_storage: m,
      ad_user_data: m,
      ad_personalization: m,
      analytics_storage: a,
      functionality_storage: "granted",
      security_storage: "granted"
    });
  }
  signal(state);

  /* --- otključavanje blokiranog sadržaja ---------------------------------- */
  function unlock(cat) {
    var frames = doc.querySelectorAll('iframe[data-consent="' + cat + '"][data-consent-src]');
    Array.prototype.forEach.call(frames, function (f) {
      f.removeAttribute("hidden");
      f.src = f.getAttribute("data-consent-src");
      f.removeAttribute("data-consent-src");
    });
    var tags = doc.querySelectorAll('script[type="text/plain"][data-consent="' + cat + '"]');
    Array.prototype.forEach.call(tags, function (s) {
      var n = doc.createElement("script");
      Array.prototype.forEach.call(s.attributes, function (a) {
        if (a.name === "type" || a.name === "data-consent" || a.name === "data-consent-src") return;
        n.setAttribute(a.name, a.value);
      });
      var src = s.getAttribute("data-consent-src");
      if (src) n.src = src; else n.text = s.textContent;
      s.parentNode.replaceChild(n, s);
    });
  }

  function apply(s) {
    ALL.forEach(function (c) { if (c !== "nuzni" && s[c]) unlock(c); });
    doc.documentElement.setAttribute("data-consent-set", "");
    doc.dispatchEvent(new CustomEvent("consent:change", { detail: s }));
  }

  /* --- placeholderi umjesto blokiranih iframeova -------------------------- */
  function placeholders() {
    Array.prototype.forEach.call(doc.querySelectorAll("iframe[data-consent-src]"), function (f) {
      var cat = f.getAttribute("data-consent") || "marketing";
      if (state && state[cat]) return;
      var prev = f.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains("ck-block")) return;
      f.setAttribute("hidden", "");
      var label = f.getAttribute("data-consent-label") || S.external;
      var ime = TEXT[cat] ? TEXT[cat].naziv.toLowerCase() : cat;
      var box = doc.createElement("div");
      box.className = "ck-block";
      box.innerHTML =
        '<p class="ck-block-title">' + label + S.blockedTitle + "</p>" +
        '<p class="ck-block-text">' + S.blockedText.replace("{cat}", ime) + "</p>" +
        '<div class="ck-block-actions">' +
        '<button type="button" class="ck-btn ck-btn-solid" data-ck-allow="' + cat + '">' + S.blockedAllow + '</button>' +
        '<button type="button" class="ck-btn" data-consent-open>' + S.settings + '</button>' +
        "</div>";
      f.parentNode.insertBefore(box, f);
    });
  }

  function clearPlaceholders() {
    Array.prototype.forEach.call(doc.querySelectorAll(".ck-block"), function (b) {
      var f = b.nextElementSibling;
      if (!f || !f.hasAttribute || f.hasAttribute("data-consent-src")) return;
      b.remove();
    });
  }

  /* --- UI ----------------------------------------------------------------- */
  var ui = null;
  var lastFocus = null;

  function links() {
    var out = [];
    if (CFG.policyUrl) out.push('<a href="' + CFG.policyUrl + '">' + S.policy + '</a>');
    if (CFG.cookieUrl) out.push('<a href="' + CFG.cookieUrl + '">' + S.cookies + '</a>');
    return out.join(" &middot; ");
  }

  function rows(cur) {
    return ALL.map(function (c) {
      var t = TEXT[c] || { naziv: c, opis: "" };
      var fixed = c === "nuzni";
      var checked = fixed ? " checked disabled" : (cur && cur[c] ? " checked" : "");
      return '<div class="ck-row">' +
        '<label class="ck-switch"><input type="checkbox" name="' + c + '"' + checked +
        ' aria-label="' + t.naziv + '"><span aria-hidden="true"></span></label>' +
        '<div><p class="ck-row-title">' + t.naziv +
        (fixed ? ' <em class="ck-always">' + S.always + '</em>' : "") + "</p>" +
        '<p class="ck-row-text">' + t.opis + "</p></div></div>";
    }).join("");
  }

  function render(mode) {
    destroy();
    lastFocus = doc.activeElement;
    ui = doc.createElement("div");
    ui.className = mode === "settings" ? "ck ck-modal" : "ck ck-banner";
    ui.id = "kolacici-postavke";
    ui.setAttribute("role", "dialog");
    ui.setAttribute("aria-modal", mode === "settings" ? "true" : "false");
    ui.setAttribute("aria-labelledby", "ck-title");

    if (mode === "settings") {
      ui.innerHTML =
        '<div class="ck-panel">' +
        '<h2 class="ck-title" id="ck-title">' + S.settingsTitle + '</h2>' +
        '<p class="ck-lead">' + S.settingsLead + '</p>' +
        '<div class="ck-rows">' + rows(state) + "</div>" +
        '<div class="ck-actions">' +
        '<button type="button" class="ck-btn ck-btn-solid" data-ck="save">' + S.save + '</button>' +
        '<button type="button" class="ck-btn" data-ck="none">' + S.rejectAll + '</button>' +
        '<button type="button" class="ck-btn" data-ck="all">' + S.acceptAll + '</button>' +
        "</div>" +
        '<p class="ck-links">' + links() + "</p>" +
        "</div>";
    } else {
      ui.innerHTML =
        '<div class="ck-panel">' +
        '<h2 class="ck-title" id="ck-title">' + S.bannerTitle + '</h2>' +
        '<p class="ck-lead">' + LEAD + "</p>" +
        '<div class="ck-actions">' +
        '<button type="button" class="ck-btn ck-btn-solid" data-ck="all">' + S.acceptAll + '</button>' +
        '<button type="button" class="ck-btn ck-btn-solid" data-ck="none">' + S.rejectAll + '</button>' +
        '<button type="button" class="ck-btn" data-ck="settings">' + S.settings + '</button>' +
        "</div>" +
        '<p class="ck-links">' + links() + "</p>" +
        "</div>";
    }

    doc.body.appendChild(ui);
    ui.addEventListener("click", onClick);
    ui.addEventListener("keydown", onKey);
    var first = ui.querySelector("button, input:not([disabled])");
    if (first) first.focus();
  }

  function destroy() {
    if (!ui) return;
    ui.remove();
    ui = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function decide(next) {
    state = { nuzni: true };
    ALL.forEach(function (c) { state[c] = c === "nuzni" ? true : !!next[c]; });
    write(state);
    signal(state);
    destroy();
    apply(state);
    clearPlaceholders();
    placeholders();
  }

  function closest(el, sel) {
    while (el && el.nodeType === 1) {
      if (el.matches && el.matches(sel)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function onClick(e) {
    var allow = closest(e.target, "[data-ck-allow]");
    if (allow) {
      var n = {};
      if (state) ALL.forEach(function (c) { if (state[c]) n[c] = true; });
      n[allow.getAttribute("data-ck-allow")] = true;
      return decide(n);
    }
    var b = closest(e.target, "[data-ck]");
    if (!b) return;
    var act = b.getAttribute("data-ck");
    if (act === "settings") return render("settings");
    if (act === "all") {
      var all = {};
      ALL.forEach(function (c) { all[c] = true; });
      return decide(all);
    }
    if (act === "none") return decide({});
    if (act === "save") {
      var picked = {};
      Array.prototype.forEach.call(ui.querySelectorAll(".ck-rows input"), function (i) {
        picked[i.name] = i.checked;
      });
      return decide(picked);
    }
  }

  // ESC zatvara samo naknadno otvorene postavke; banner bez odluke ostaje.
  function onKey(e) {
    if (e.key === "Escape" && state) { destroy(); return; }
    // Fokus se zadržava samo u modalu; banner ne smije zarobiti tipkovnicu.
    if (e.key !== "Tab" || !ui.classList.contains("ck-modal")) return;
    var f = ui.querySelectorAll("button, input:not([disabled]), a[href]");
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  doc.addEventListener("click", function (e) {
    var t = closest(e.target, '[data-consent-open], a[href="#kolacici-postavke"]');
    if (!t || (ui && ui.contains(t) && !t.hasAttribute("data-consent-open"))) return;
    e.preventDefault();
    render("settings");
  });

  function boot() {
    placeholders();
    if (state) apply(state);
    else render("banner");
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.Consent = {
    has: function (c) { return !!(state && state[c]); },
    get: function () { return state ? JSON.parse(JSON.stringify(state)) : null; },
    open: function () { render("settings"); },
    withdraw: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      state = null;
      location.reload();
    }
  };
})();
