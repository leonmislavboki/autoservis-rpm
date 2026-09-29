/* ==========================================================================
   interactions.js — pointer mikro-interakcije, bez ovisnosti (~4kb)
   Pair s interactions.css. Efekti koji su čisti CSS (shimmer, flip, accent
   line, slide-text, press) ne trebaju ovaj file.

     <script src="interactions.js" defer></script>

   Markup API
   ----------
   data-ix="tilt"            3D nagib prema pokazivaču (max 9 stupnjeva)
     data-ix-tilt="6"        vlastiti maksimum u stupnjevima
   data-ix="glow"            radijalni sjaj prati pokazivač (traži tilt ili sam)
   data-ix="magnetic"        element se privlači prema pokazivaču
     data-ix-pull="0.25"     jačina, 0-1 (default 0.3)
     data-ix-radius="90"     doseg u px izvan elementa (default 80)
   data-ix="hold"            drži za potvrdu
     data-ix-duration="1.2"  sekunde držanja (default 1.5)
     dispatcha `ix:hold` event na elementu kad se ispuni
   data-ix="typewriter"      tipka i briše niz poruka
     data-ix-words="Servis|Dijagnostika|Popravak"
     data-ix-speed="55"      ms po znaku
   data-ix="scroll-text"     aktivni redak dobiva punu boju dok skrolaš
   data-ix-group="dim"       na roditelju mreže: ostale kartice se povuku

   Sve se gasi pod prefers-reduced-motion i na uređajima bez hovera.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var num = function (v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; };
  var has = function (el, name) {
    var v = el.getAttribute("data-ix") || "";
    return v.split(/\s+/).indexOf(name) > -1;
  };
  var pick = function (name) {
    return Array.prototype.filter.call(
      document.querySelectorAll("[data-ix]"),
      function (el) { return has(el, name); }
    );
  };

  /* ---------- tilt + glow -------------------------------------------------
     Konstante iz Kokonut spotlight-cards: max 9 stupnjeva, perspektiva 900.
     Umjesto motion springa koristimo kratku linearnu tranziciju dok je
     pokazivač unutra, pa dužu s ease-outom pri izlasku — isti dojam, 0kb.
     ---------------------------------------------------------------------- */
  if (fine && !reduced) {
    pick("tilt").concat(pick("glow")).forEach(function (el) {
      if (el.__ixPointer) return;
      el.__ixPointer = true;
      var max = num(el.getAttribute("data-ix-tilt"), 9);
      var tilt = has(el, "tilt");

      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width;
        var ny = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ix-mx", (nx * 100).toFixed(1) + "%");
        el.style.setProperty("--ix-my", (ny * 100).toFixed(1) + "%");
        if (tilt) {
          el.setAttribute("data-ix-active", "");
          el.style.setProperty("--ix-rx", ((0.5 - ny) * 2 * max).toFixed(2) + "deg");
          el.style.setProperty("--ix-ry", ((nx - 0.5) * 2 * max).toFixed(2) + "deg");
        }
      });

      el.addEventListener("pointerleave", function () {
        el.removeAttribute("data-ix-active");
        el.style.setProperty("--ix-rx", "0deg");
        el.style.setProperty("--ix-ry", "0deg");
        el.style.setProperty("--ix-mx", "50%");
        el.style.setProperty("--ix-my", "50%");
      });
    });
  }

  /* ---------- focus dimming ------------------------------------------------ */
  if (fine && !reduced) {
    each(document.querySelectorAll('[data-ix-group="dim"]'), function (group) {
      var kids = Array.prototype.slice.call(group.children);
      kids.forEach(function (kid) {
        kid.addEventListener("pointerenter", function () {
          kids.forEach(function (o) { if (o !== kid) o.classList.add("ix-dim"); });
        });
      });
      group.addEventListener("pointerleave", function () {
        kids.forEach(function (o) { o.classList.remove("ix-dim"); });
      });
    });
  }

  /* ---------- magnetic ------------------------------------------------------ */
  if (fine && !reduced) {
    pick("magnetic").forEach(function (el) {
      var pull = num(el.getAttribute("data-ix-pull"), 0.3);
      var radius = num(el.getAttribute("data-ix-radius"), 80);
      el.style.transition = "transform 320ms cubic-bezier(0.22,1,0.36,1)";
      el.style.willChange = "transform";

      function move(e) {
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.hypot(dx, dy);
        var reach = Math.max(r.width, r.height) / 2 + radius;
        if (dist > reach) {
          el.style.transform = "";
          return;
        }
        el.style.transition = "transform 120ms linear";
        el.style.transform =
          "translate3d(" + (dx * pull).toFixed(1) + "px," + (dy * pull).toFixed(1) + "px,0)";
      }

      function reset() {
        el.style.transition = "transform 420ms cubic-bezier(0.22,1,0.36,1)";
        el.style.transform = "";
      }

      window.addEventListener("pointermove", move, { passive: true });
      el.addEventListener("pointerleave", reset);
    });
  }

  /* ---------- hold to confirm ----------------------------------------------
     Radi i pod reduced motion — progres je informacija, ne ukras.
     ---------------------------------------------------------------------- */
  pick("hold").forEach(function (el) {
    var dur = num(el.getAttribute("data-ix-duration"), 1.5) * 1000;
    var raf = null;
    var start = 0;

    function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      el.style.setProperty("--ix-hold", p.toFixed(3));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
        el.dispatchEvent(new CustomEvent("ix:hold", { bubbles: true }));
      }
    }

    function begin(e) {
      if (e.button != null && e.button !== 0) return;
      start = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function end() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      el.style.setProperty("--ix-hold", "0");
    }

    el.addEventListener("pointerdown", begin);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointerleave", end);
    el.addEventListener("pointercancel", end);
    // Tipkovnica: razmak/enter drži jednako dugo.
    el.addEventListener("keydown", function (e) {
      if ((e.key === " " || e.key === "Enter") && !raf) { e.preventDefault(); begin(e); }
    });
    el.addEventListener("keyup", end);
    el.addEventListener("blur", end);
  });

  /* ---------- typewriter ---------------------------------------------------- */
  pick("typewriter").forEach(function (el) {
    var words = (el.getAttribute("data-ix-words") || "").split("|")
      .map(function (w) { return w.trim(); }).filter(Boolean);
    if (!words.length) return;
    if (reduced) { el.textContent = words[0]; return; }

    var speed = num(el.getAttribute("data-ix-speed"), 55);
    var i = 0, j = 0, deleting = false;
    el.textContent = "";
    el.setAttribute("aria-live", "polite");

    (function step() {
      var word = words[i];
      j += deleting ? -1 : 1;
      el.textContent = word.slice(0, j);
      var wait = deleting ? speed * 0.5 : speed;
      if (!deleting && j === word.length) { deleting = true; wait = 1400; }
      else if (deleting && j === 0) { deleting = false; i = (i + 1) % words.length; wait = 240; }
      setTimeout(step, wait);
    })();
  });

  /* ---------- scroll-text ---------------------------------------------------
     Aktivan je element najbliži sredini ekrana. Ne koristi IntersectionObserver
     jer nam treba "najbliži", ne "vidljiv".
     ---------------------------------------------------------------------- */
  var lists = pick("scroll-text");
  if (lists.length) {
    var ticking = false;
    function update() {
      ticking = false;
      var mid = window.innerHeight / 2;
      lists.forEach(function (list) {
        var kids = list.children;
        var best = null, bestD = Infinity;
        each(kids, function (kid) {
          var r = kid.getBoundingClientRect();
          var d = Math.abs(r.top + r.height / 2 - mid);
          if (d < bestD) { bestD = d; best = kid; }
        });
        each(kids, function (kid) { kid.classList.toggle("ix-active", kid === best); });
      });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }
})();
