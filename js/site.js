/* ==========================================================================
   site.js — Auto servis RPM
   Samo ono što stranica stvarno treba: izbornik na mobitelu i stanja obrasca.
   Stranica je potpuno čitljiva i bez ove skripte.
   ========================================================================== */
(function () {
  "use strict";

  /* --- 0. opruge kao CSS varijable ----------------------------------------
     spring.js jednom simulira fiziku i upiše linear() krivulje na :root.
     Nakon toga prijelazi idu kroz kompozitor, bez JS-a po frameu. */

  if (typeof window.installSpringVars === "function") window.installSpringVars();

  /* --- 1. izbornik na mobitelu -------------------------------------------- */

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("glavni-izbornik");

  if (toggle && nav) {
    var setOpen = function (open) {
      if (open) {
        nav.setAttribute("data-open", "");
      } else {
        nav.removeAttribute("data-open");
      }
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    toggle.addEventListener("click", function () {
      setOpen(!nav.hasAttribute("data-open"));
    });

    /* Klik na stavku zatvara ladicu; inače ostane otvorena preko sadržaja. */
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.hasAttribute("data-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* --- 2. obrazac ---------------------------------------------------------
     Šalje preko Web3Forms na autoservisrpm@gmail.com, istim ključem i istim
     nazivima polja kao stara stranica — klijent dobiva poštu u istom obliku
     kao prije. Ključ je javni po dizajnu Web3Formsa (vezan uz primatelja).
     Ništa se ne učitava prije slanja: zahtjev ide tek na klik.
     -------------------------------------------------------------------- */

  var form = document.getElementById("upit");
  var status = document.getElementById("upit-status");

  if (form && status) {
    var gumb = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.getAttribute("aria-busy") === "true") return;

      if (!form.checkValidity()) {
        status.textContent = "Nedostaje ime, telefon, opis kvara ili privola. Dopunite označeno polje.";
        status.setAttribute("data-state", "error");
        var prvo = form.querySelector(":invalid");
        if (prvo) prvo.focus();
        return;
      }

      var d = new FormData();
      d.append("access_key", "52231398-70ba-48c4-be7e-4c6a4e311297");
      d.append("email", "autoservisrpm@gmail.com");
      d.append("subject", "Novi upit — Auto Servis RPM");
      d.append("from_name", "RPM Web Kontakt Forma");
      d.append("name", form.elements.ime.value.trim());
      d.append("phone", form.elements.telefon.value.trim());
      d.append("vehicle", form.elements.vozilo.value.trim());
      d.append("message", form.elements.opis.value.trim());

      form.setAttribute("aria-busy", "true");
      if (gumb) gumb.disabled = true;
      status.textContent = "Šaljem…";
      status.removeAttribute("data-state");

      fetch("https://api.web3forms.com/submit", { method: "POST", body: d })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.success) throw new Error("web3forms");
          status.textContent = "Hvala, upit je poslan. Javljamo se što prije.";
          status.setAttribute("data-state", "ok");
          form.reset();
        })
        .catch(function () {
          status.textContent = "Upit nije poslan. Nazovite nas na 092 389 4126.";
          status.setAttribute("data-state", "error");
        })
        .then(function () {
          form.removeAttribute("aria-busy");
          if (gumb) gumb.disabled = false;
        });
    });
  }
})();
