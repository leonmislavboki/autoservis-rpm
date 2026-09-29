/* ==========================================================================
   scroll-motion.js — reveal + scroll-linked motion, zero dependencies (~4kb)
   Pair with scroll-motion.css. Drop in with:
     <script src="scroll-motion.js" defer></script>

   Markup API
   ----------
   Reveal (IntersectionObserver, runs once by default):
     data-sm="up|down|left|right|fade|scale|scale-up|blur|rise|tilt|wipe-up|wipe-down|wipe-left"
     data-sm-delay="0.15"        delay in seconds
     data-sm-amount="0.4"        how much must be visible (0-1), default 0.2
     data-sm-repeat              re-hide on exit, replay on re-entry
     data-sm-stagger="0.08"      on a PARENT: staggers its [data-sm] children

   Split text (reveal per unit, masked slide-up):
     data-sm-split="words|lines|chars"   (same element as data-sm)
     data-sm-split-step="0.04"           seconds between units

   Scroll-linked (updated in one rAF loop, only while in view):
     data-sm-parallax="0.2"      positive = moves slower than the scroll
     data-sm-scrub               exposes --sm-progress (0-1) over its viewport pass
     data-sm-y="40,-40"          from,to in px, driven by that progress
     data-sm-x / data-sm-scale / data-sm-rotate / data-sm-opacity   same from,to form
     data-sm-scrub-offset="1,0"  where progress hits 0 and 1, in viewport heights
     data-sm-progress            page reading progress into --sm-progress
     data-sm-count="1240"        counts up on first view
     data-sm-count-suffix="+"

   Everything is disabled under prefers-reduced-motion except progress bars and
   counters, which snap straight to their final value.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var num = function (v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; };
  var pair = function (v, d0, d1) {
    if (!v) return [d0, d1];
    var p = String(v).split(",");
    return [num(p[0], d0), num(p.length > 1 ? p[1] : p[0], d1)];
  };
  var clamp = function (n) { return n < 0 ? 0 : n > 1 ? 1 : n; };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  root.classList.add("sm-ready");

  /* ---------- 1. split text ---------------------------------------------- */
  function split(el) {
    var mode = el.getAttribute("data-sm-split");
    var step = el.getAttribute("data-sm-split-step");
    if (step) el.style.setProperty("--sm-split-step", step + "s");
    var source = el.textContent.trim();
    var units =
      mode === "chars" ? source.split("") :
      mode === "lines" ? source.split(/\n+/) :
                         source.split(/\s+/);
    el.textContent = "";
    units.forEach(function (unit, i) {
      var outer = document.createElement("span");
      outer.className = "sm-split-unit";
      outer.style.setProperty("--sm-i", i);
      var inner = document.createElement("span");
      inner.className = "sm-split-inner";
      inner.textContent = unit;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (mode !== "chars" && i < units.length - 1) {
        el.appendChild(document.createTextNode(" "));
      }
    });
    // The wrapper must not fade or move — the units carry all the motion.
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.filter = "none";
  }

  /* ---------- 2. stagger -------------------------------------------------- */
  each(document.querySelectorAll("[data-sm-stagger]"), function (parent) {
    var step = num(parent.getAttribute("data-sm-stagger"), 0.08);
    var base = num(parent.getAttribute("data-sm-delay"), 0);
    each(parent.querySelectorAll("[data-sm]"), function (kid, i) {
      if (kid.hasAttribute("data-sm-delay")) return; // an explicit delay wins
      kid.style.setProperty("--sm-delay", (base + i * step).toFixed(3) + "s");
    });
  });

  /* ---------- 3. reveal --------------------------------------------------- */
  var reveals = document.querySelectorAll("[data-sm]");
  each(reveals, function (el) {
    var d = el.getAttribute("data-sm-delay");
    if (d) el.style.setProperty("--sm-delay", num(d, 0) + "s");
    if (el.hasAttribute("data-sm-split")) split(el);
  });

  function markIn(el, on) {
    el.classList.toggle("sm-in", on);
    each(el.querySelectorAll(".sm-split-unit"), function (u) {
      u.classList.toggle("sm-in", on);
    });
  }

  if (reduced) {
    each(reveals, function (el) { markIn(el, true); el.classList.add("sm-done"); });
  } else {
    var groups = {};
    each(reveals, function (el) {
      var amount = num(el.getAttribute("data-sm-amount"), 0.2);
      (groups[amount] = groups[amount] || []).push(el);
    });
    Object.keys(groups).forEach(function (amount) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var el = entry.target;
          if (entry.isIntersecting) {
            markIn(el, true);
            if (!el.hasAttribute("data-sm-repeat")) {
              io.unobserve(el);
              setTimeout(function () { el.classList.add("sm-done"); }, 1600);
            }
          } else if (el.hasAttribute("data-sm-repeat")) {
            markIn(el, false);
          }
        });
      }, {
        threshold: Math.min(parseFloat(amount), 0.99),
        rootMargin: "0px 0px -5% 0px"
      });
      groups[amount].forEach(function (el) { io.observe(el); });
    });
  }

  /* ---------- 4. counters -------------------------------------------------- */
  each(document.querySelectorAll("[data-sm-count]"), function (el) {
    var target = num(el.getAttribute("data-sm-count"), 0);
    var suffix = el.getAttribute("data-sm-count-suffix") || "";
    var dur = num(el.getAttribute("data-sm-count-duration"), 1.6) * 1000;
    var fmt = function (n) { return Math.round(n).toLocaleString("hr-HR") + suffix; };
    if (reduced) { el.textContent = fmt(target); return; }
    el.textContent = fmt(0);
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now();
      (function tick(now) {
        var p = clamp((now - t0) / dur);
        el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.4 });
    io.observe(el);
  });

  /* ---------- 5. scroll-linked loop ---------------------------------------- */
  var linked = [];
  each(document.querySelectorAll("[data-sm-parallax],[data-sm-scrub]"), function (el) {
    var off = pair(el.getAttribute("data-sm-scrub-offset"), 1, 0);
    var read = function (name, d0, d1) {
      return el.hasAttribute(name) ? pair(el.getAttribute(name), d0, d1) : null;
    };
    linked.push({
      el: el,
      parallax: num(el.getAttribute("data-sm-parallax"), 0),
      enter: off[0],
      exit: off[1],
      y: read("data-sm-y", 0, 0),
      x: read("data-sm-x", 0, 0),
      scale: read("data-sm-scale", 1, 1),
      rotate: read("data-sm-rotate", 0, 0),
      opacity: read("data-sm-opacity", 1, 1),
      visible: false
    });
    el.style.willChange = "transform";
  });

  var bars = [].slice.call(document.querySelectorAll("[data-sm-progress]"));

  if (linked.length) {
    var vis = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        for (var i = 0; i < linked.length; i++) {
          if (linked[i].el === entry.target) linked[i].visible = entry.isIntersecting;
        }
      });
    }, { rootMargin: "25% 0px 25% 0px" });
    linked.forEach(function (item) { vis.observe(item.el); });
  }

  var ticking = false;

  function frame() {
    ticking = false;
    var vh = window.innerHeight;

    if (bars.length) {
      var max = root.scrollHeight - vh;
      var page = max > 0 ? clamp(root.scrollTop / max) : 0;
      bars.forEach(function (bar) { bar.style.setProperty("--sm-progress", page.toFixed(4)); });
    }

    if (reduced) return;

    for (var i = 0; i < linked.length; i++) {
      var it = linked[i];
      if (!it.visible) continue;
      var r = it.el.getBoundingClientRect();
      // progress 0 when the top sits `enter` viewports down the screen,
      // 1 once the bottom has travelled `exit` viewports past the top edge.
      var start = vh * it.enter;
      var end = -r.height - vh * it.exit;
      var p = end === start ? 0 : clamp((r.top - start) / (end - start));
      it.el.style.setProperty("--sm-progress", p.toFixed(4));

      var t = "";
      if (it.parallax) {
        t += " translate3d(0," + (-(r.top + r.height / 2 - vh / 2) * it.parallax).toFixed(2) + "px,0)";
      }
      if (it.y) t += " translate3d(0," + (it.y[0] + (it.y[1] - it.y[0]) * p).toFixed(2) + "px,0)";
      if (it.x) t += " translate3d(" + (it.x[0] + (it.x[1] - it.x[0]) * p).toFixed(2) + "px,0,0)";
      if (it.scale) t += " scale(" + (it.scale[0] + (it.scale[1] - it.scale[0]) * p).toFixed(4) + ")";
      if (it.rotate) t += " rotate(" + (it.rotate[0] + (it.rotate[1] - it.rotate[0]) * p).toFixed(3) + "deg)";
      if (t) it.el.style.transform = t.slice(1);
      if (it.opacity) it.el.style.opacity = (it.opacity[0] + (it.opacity[1] - it.opacity[0]) * p).toFixed(3);
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  if (linked.length || bars.length) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();
  }
})();
