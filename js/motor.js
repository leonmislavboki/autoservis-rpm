/* ==========================================================================
   motor.js — presjek rednog četverocilindraša u herou.

   Kinematika je stvarna, ne petlja ključnih kadrova:

     put klipa    y = KOLJ_Y − ( r·cos θ + √(L² − (r·sin θ)²) )
     rukavac      (cx + r·sin θ,  KOLJ_Y − r·cos θ)

   Klipovi 1 i 4 idu zajedno, 2 i 3 su im nasuprot — kao na pravom rednom
   četverocilindrašu. Ventili i paljenje idu po punom ciklusu od 720°, redom
   paljenja 1-3-4-2.

   Motor radi na ralentiju, a skrol ga zavrti: brzina raste s brzinom skrola i
   pada natrag kad staneš. Klipovi se pritom spuštaju — to je ono što se
   "kreće prema dolje kako skrolaš".

   Geometrija mora biti ista kao u _build/grafika.py; ako se tamo promijeni,
   promijeni se i ovdje.

   prefers-reduced-motion: motor stoji u položaju iz markupa i ne miče se.
   Bez JS-a: isto, jer generator klipove i ojnice već postavlja na pravo mjesto.
   ========================================================================== */
(function () {
  "use strict";

  var KOLJ_Y = 452, KOLJ_R = 56, OJN_L = 168, KLIP_H = 58;
  var CIL_X = [96, 224, 352, 480];
  var FAZE = [0, Math.PI, Math.PI, 0];            /* položaj koljena */
  var CIKLUS = [0, 3, 1, 2];                      /* red paljenja 1-3-4-2, u polukrugovima */

  var RALENTI = 1.05;      /* rad/s na ralentiju */
  var PO_PIKSELU = 0.055;  /* koliko skrol od jednog piksela doda brzini */
  var STROP = 15.0;        /* najveća brzina */
  var PAD = 7.5;           /* koliko brzine padne u sekundi kad staneš */

  var svg = document.querySelector("[data-motor]");
  if (!svg) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  var q = function (sel) { return Array.prototype.slice.call(svg.querySelectorAll(sel)); };
  var klipovi = q("[data-motor-klip]");
  var ojnice = q("[data-motor-ojnica]");
  var koljena = q("[data-motor-koljeno]");
  var ventili = q("[data-motor-ventil]");
  var paljenja = q("[data-motor-paljenje]");
  var bregovi = q("[data-motor-breg]");
  if (!klipovi.length) return;

  var theta = 0, visak = 0, zadnjiY = window.scrollY || 0, zadnjiT = 0, radi = false;

  function klipY(t) {
    var s = KOLJ_R * Math.sin(t);
    return KOLJ_Y - (KOLJ_R * Math.cos(t) + Math.sqrt(OJN_L * OJN_L - s * s));
  }

  /* Podizaj ventila. Ciklus traje 720°: 0–180 radni takt, 180–360 ispuh,
     360–540 usis, 540–720 kompresija. */
  function podizaj(psi, ispusni) {
    var od = ispusni ? Math.PI : 2 * Math.PI;
    var x = (psi - od) / Math.PI;
    if (x < 0 || x > 1) return 0;
    return Math.sin(x * Math.PI);
  }

  function crtaj() {
    for (var i = 0; i < 4; i++) {
      var t = theta + FAZE[i];
      var py = klipY(t);
      var rx = CIL_X[i] + KOLJ_R * Math.sin(t);
      var ry = KOLJ_Y - KOLJ_R * Math.cos(t);

      klipovi[i].setAttribute("transform", "translate(0 " + (py - KLIP_H * 0.68).toFixed(2) + ")");
      ojnice[i].setAttribute("x1", rx.toFixed(2));
      ojnice[i].setAttribute("y1", ry.toFixed(2));
      ojnice[i].setAttribute("y2", py.toFixed(2));
      koljena[i].setAttribute("transform",
        "rotate(" + (t * 180 / Math.PI).toFixed(2) + " " + CIL_X[i] + " " + KOLJ_Y + ")");

      /* položaj u punom ciklusu od 720° */
      var psi = (theta + CIKLUS[i] * Math.PI) % (4 * Math.PI);
      if (psi < 0) psi += 4 * Math.PI;

      var usis = podizaj(psi, false);
      var ispuh = podizaj(psi, true);
      ventili[i * 2].setAttribute("transform", "translate(0 " + (usis * 11).toFixed(2) + ")");
      ventili[i * 2 + 1].setAttribute("transform", "translate(0 " + (ispuh * 11).toFixed(2) + ")");

      /* paljenje: najjače na početku radnog takta, gasi se kroz ~70° */
      var jacina = psi < 1.2 ? 1 - psi / 1.2 : 0;
      paljenja[i].style.opacity = jacina.toFixed(3);
    }

    /* bregasta vratila idu upola sporije od koljenastog */
    var bregKut = (theta / 2 * 180 / Math.PI).toFixed(2);
    for (var b = 0; b < bregovi.length; b++) {
      bregovi[b].style.transform = "rotate(" + bregKut + "deg)";
    }
  }

  function petlja(t) {
    if (!radi) return;
    var dt = zadnjiT ? Math.min((t - zadnjiT) / 1000, 0.05) : 0.016;
    zadnjiT = t;

    visak -= PAD * dt;
    if (visak < 0) visak = 0;

    theta = (theta + (RALENTI + visak) * dt) % (4 * Math.PI);
    crtaj();
    requestAnimationFrame(petlja);
  }

  function pokreni() {
    if (radi) return;
    radi = true;
    zadnjiT = 0;
    requestAnimationFrame(petlja);
  }

  window.addEventListener("scroll", function () {
    var y = window.scrollY || 0;
    visak += Math.abs(y - zadnjiY) * PO_PIKSELU;
    zadnjiY = y;
    if (visak > STROP) visak = STROP;
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) pokreni();
      else radi = false;
    }, { rootMargin: "120px" }).observe(svg);
  } else {
    pokreni();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) radi = false;
    else pokreni();
  });
})();
