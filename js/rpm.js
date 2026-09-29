/* ==========================================================================
   rpm.js — brojilo obrtaja u zaglavlju stranice.

   Servis se zove RPM i u znaku ima brojilo, pa je brojilo na stranici jedini
   ukras koji nešto znači. Ponaša se kao pravo:

     1. pri učitavanju kazaljka odradi kontrolni zamah do crvene i padne na
        rale — isto što napravi svaka ploča s instrumentima kad okreneš ključ;
     2. na ralentiju lagano titra, jer motor nikad ne stoji na okruglom broju;
     3. kad skrolaš, obrtaji rastu s brzinom skrola i padaju natrag kad staneš.

   Traži spring.js (isti direktorij) za zamah. Ako spring.js nema, kazaljka
   samo sjedne na ralenti — stranica se zbog toga ne ruši.

   prefers-reduced-motion: kazaljka odmah stoji na ralentiju i ne miče se.
   ========================================================================== */
(function () {
  "use strict";

  var RALENTI = 0.85;        // x1000 o/min
  var MAX = 8;               // kraj skale
  var RASPON = 240;          // stupnjeva od nule do kraja skale
  var KONTROLNI_ZAMAH = 7.4; // dokle ide kazaljka pri paljenju
  var PO_PIKSELU = 0.010;    // koliko obrtaja donese jedan piksel skrola
  var STROP = 6.6;           // dalje od ovoga skrol ne gura
  var PAD = 2.6;             // koliko obrtaja padne u sekundi kad staneš

  var svg = document.querySelector("[data-rpm]");
  if (!svg) return;

  var kazaljka = svg.querySelector(".rpm__kazaljka-grupa");
  var ocitanje = svg.querySelector("[data-rpm-readout]");
  if (!kazaljka) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Hrvatski format: točka razdvaja tisućice. 1250 -> "1.250" */
  function hrBroj(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function postavi(v) {
    if (v < 0) v = 0;
    if (v > MAX) v = MAX;
    kazaljka.style.transform = "rotate(" + (v / MAX * RASPON).toFixed(2) + "deg)";
    if (ocitanje) ocitanje.textContent = hrBroj(v * 1000);
    svg.classList.toggle("je-crvena", v >= 6);
  }

  if (reduced) {
    postavi(RALENTI);
    return;
  }

  /* --- stanje ------------------------------------------------------------ */

  var v = 0;               // prikazana vrijednost
  var cilj = 0;            // kamo kazaljka teži
  var visak = 0;           // koliko je skrol dodao iznad ralentija
  var upaljeno = false;
  var zadnjiY = window.scrollY || 0;
  var zadnjiT = 0;
  var radi = false;

  function petlja(t) {
    if (!radi) return;
    var dt = zadnjiT ? Math.min((t - zadnjiT) / 1000, 0.05) : 0.016;
    zadnjiT = t;

    visak -= PAD * dt;
    if (visak < 0) visak = 0;

    cilj = RALENTI + visak;
    /* Titranje na ralentiju — bez njega igla izgleda kao slika, ne kao instrument. */
    if (visak < 0.05) cilj += Math.sin(t / 190) * 0.05 + Math.sin(t / 77) * 0.025;

    /* Igla ima masu: prati cilj, ne skače na njega. */
    v += (cilj - v) * Math.min(1, dt * 9);
    postavi(v);

    requestAnimationFrame(petlja);
  }

  function pokreni() {
    if (radi) return;
    radi = true;
    zadnjiT = 0;
    requestAnimationFrame(petlja);
  }

  function stani() {
    radi = false;
  }

  /* --- kontrolni zamah pri paljenju -------------------------------------- */

  function upali() {
    if (upaljeno) return;
    upaljeno = true;

    if (typeof window.spring !== "function") {
      v = RALENTI;
      postavi(v);
      pokreni();
      return;
    }

    window.spring({
      from: 0, to: KONTROLNI_ZAMAH, config: { preset: "stiff", friction: 26 },
      onUpdate: function (x) { v = x; postavi(x); },
      onRest: function () {
        window.spring({
          from: KONTROLNI_ZAMAH, to: RALENTI, config: "gentle",
          onUpdate: function (x) { v = x; postavi(x); },
          onRest: pokreni
        });
      }
    });
  }

  /* --- skrol diže obrtaje ------------------------------------------------ */

  window.addEventListener("scroll", function () {
    var y = window.scrollY || 0;
    var d = Math.abs(y - zadnjiY);
    zadnjiY = y;
    if (!upaljeno) return;
    visak += d * PO_PIKSELU;
    if (visak > STROP - RALENTI) visak = STROP - RALENTI;
  }, { passive: true });

  /* Petlja radi samo dok je brojilo na ekranu i dok je kartica u prvom planu. */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) {
        upali();
        pokreni();
      } else {
        stani();
      }
    }, { rootMargin: "80px" }).observe(svg);
  } else {
    upali();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stani();
    else if (upaljeno) pokreni();
  });
})();
