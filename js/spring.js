/* spring.js — opruge bez biblioteke.  ~2kb, bez ovisnosti.
   =========================================================================
   Dvije stvari:

   1) spring(opcije)       — pokreće rAF simulaciju i zove onUpdate(vrijednost)
   2) springEasing(preset) — vraća CSS `linear(...)` string koji se može
                             zalijepiti u transition-timing-function, pa opruga
                             radi u CSS-u bez ijednog JS framea

   Presetovi su preuzeti iz react-springa (tension/friction), jer su ta dva
   broja industrijski standard i ljudi ih prepoznaju po osjećaju:

     gentle   120/14   meko, bez trzaja           — modali, paneli
     default  170/26   neutralno                  — sve ostalo
     wobbly   180/12   vidljiv odskok             — playful, rijetko
     stiff    210/20   brzo i kratko              — gumbi, toggle
     slow     280/60   teško, sporo               — veliki elementi
     molasses 280/120  gotovo bez odskoka         — full-screen prijelazi

   Fizika: m·a = -k·x - c·v,  k = tension, c = friction, m = mass.
   Integracija je fiksni korak od 1ms da rezultat ne ovisi o framerateu.
   ========================================================================= */
(function (root) {
  "use strict";

  var PRESETS = {
    gentle:   { tension: 120, friction: 14 },
    default:  { tension: 170, friction: 26 },
    wobbly:   { tension: 180, friction: 12 },
    stiff:    { tension: 210, friction: 20 },
    slow:     { tension: 280, friction: 60 },
    molasses: { tension: 280, friction: 120 }
  };

  function resolve(cfg) {
    var base = PRESETS[typeof cfg === "string" ? cfg : (cfg && cfg.preset) || "default"] || PRESETS.default;
    cfg = typeof cfg === "string" ? {} : (cfg || {});
    return {
      tension:   cfg.tension   != null ? cfg.tension   : base.tension,
      friction:  cfg.friction  != null ? cfg.friction  : base.friction,
      mass:      cfg.mass      != null ? cfg.mass      : 1,
      velocity:  cfg.velocity  != null ? cfg.velocity  : 0,
      clamp:     !!cfg.clamp,
      precision: cfg.precision != null ? cfg.precision : 0.005
    };
  }

  /* Simulira oprugu od 0 do 1 i vraća niz vrijednosti u koracima od 1ms.
     Koristi ga i spring() i springEasing(). */
  function simulate(c, maxMs) {
    var x = 0, v = c.velocity, out = [0], t = 0;
    var limit = maxMs || 4000;
    while (t < limit) {
      var a = (c.tension * (1 - x) - c.friction * v) / c.mass;
      v += a * 0.001;
      x += v * 0.001;
      t += 1;
      if (c.clamp && x > 1) { x = 1; v = 0; out.push(1); break; }
      out.push(x);
      if (Math.abs(1 - x) < c.precision && Math.abs(v) < c.precision * 10) { out.push(1); break; }
    }
    return out;
  }

  /* --- 1. JS opruga ------------------------------------------------------
     spring({ from, to, config, onUpdate, onRest })
     Vraća { stop() }. Poštuje prefers-reduced-motion: skoči na kraj.        */
  function spring(opts) {
    var from = opts.from != null ? opts.from : 0;
    var to   = opts.to   != null ? opts.to   : 1;
    var c = resolve(opts.config);
    var reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      opts.onUpdate && opts.onUpdate(to);
      opts.onRest && opts.onRest(to);
      return { stop: function () {} };
    }

    var x = 0, v = c.velocity, raf = null, last = null, dead = false;

    function frame(now) {
      if (dead) return;
      if (last == null) last = now;
      var dt = Math.min((now - last) / 1000, 0.064); // kap na 64ms: tab u pozadini
      last = now;
      /* fiksni pod-koraci od 1ms — isti rezultat na 60Hz i 144Hz */
      var steps = Math.max(1, Math.round(dt * 1000));
      for (var i = 0; i < steps; i++) {
        var a = (c.tension * (1 - x) - c.friction * v) / c.mass;
        v += a * 0.001;
        x += v * 0.001;
        if (c.clamp && x > 1) { x = 1; v = 0; break; }
      }
      opts.onUpdate && opts.onUpdate(from + (to - from) * x);
      if (Math.abs(1 - x) < c.precision && Math.abs(v) < c.precision * 10) {
        opts.onUpdate && opts.onUpdate(to);
        opts.onRest && opts.onRest(to);
        return;
      }
      raf = root.requestAnimationFrame(frame);
    }

    raf = root.requestAnimationFrame(frame);
    return { stop: function () { dead = true; if (raf) root.cancelAnimationFrame(raf); } };
  }

  /* --- 2. CSS opruga -----------------------------------------------------
     springEasing("wobbly") -> { easing: "linear(0, 0.0123, ...)", duration: 820 }

     Uzorkuje simulaciju na ~60 točaka i složi `linear()` funkciju. Animacija
     onda ide kroz CSS (kompozitor, bez JS-a po frameu), a i dalje se osjeća
     kao opruga. Podrška: svi današnji preglednici; stariji padnu na `ease`.  */
  function springEasing(config, samples) {
    var c = resolve(config);
    var series = simulate(c, 4000);
    var n = samples || 60;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var idx = Math.round((i / n) * (series.length - 1));
      pts.push(Math.round(series[idx] * 10000) / 10000);
    }
    return {
      easing: "linear(" + pts.join(", ") + ")",
      duration: series.length,               // ms — koliko opruga stvarno traje
      supported: !!(root.CSS && root.CSS.supports && root.CSS.supports("transition-timing-function", "linear(0, 1)"))
    };
  }

  /* Upiše presete kao CSS varijable na :root, pa se u stilovima piše
     `transition: transform var(--spring-stiff-t) var(--spring-stiff)`. */
  function installSpringVars(el) {
    var target = el || document.documentElement;
    Object.keys(PRESETS).forEach(function (name) {
      var s = springEasing(name);
      if (!s.supported) return;
      target.style.setProperty("--spring-" + name, s.easing);
      target.style.setProperty("--spring-" + name + "-t", s.duration + "ms");
    });
  }

  root.spring = spring;
  root.springEasing = springEasing;
  root.installSpringVars = installSpringVars;
  root.SPRING_PRESETS = PRESETS;
})(window);
