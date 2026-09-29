/* ==========================================================================
   motor3d.js — redni četverocilindraš u herou, pravi 3D.

   Zašto vlastiti model, a ne gotov s interneta: animirani modeli motora koji
   izgledaju kao ono što je klijent poslao prodaju se (40–50 $), a besplatni su
   pod CC BY i traže potpis autora na stranici. Ovaj je sastavljen od osnovnih
   tijela u kodu — nema licence, nema vanjskog zahtjeva, ide s naše domene i
   boje su iz palete stranice.

   Kinematika je stvarna, ista kao u 2D verziji:
       klip     y = r·cos θ + √(L² − (r·sin θ)²)
       rukavac  (r·sin θ, r·cos θ) u ravnini cilindra
   Klipovi 1 i 4 idu zajedno, 2 i 3 su im nasuprot. Ventili i paljenje idu po
   punom ciklusu od 720°, redom paljenja 1-3-4-2.

   Učitavanje: three.js (384 kB, MIT, self-hostan) povlači se **tek kad hero
   uđe u vidokrug**, i to dinamičkim importom. Do tada, i zauvijek ako WebGL
   ne radi ili je uključen prefers-reduced-motion, na stranici stoji SVG
   presjek iz _build/grafika.py. Ništa se ne gubi.

   Presjek je u CSS-u skriven dok 3D ne odluči (visibility, pa mjesto ostaje):
   inače bi pri svakom učitavanju na sekundu bljesnuo pa nestao. Ako 3D ne
   može, ovdje se postavlja data-motor3d="nema" i presjek se pokaže.
   ========================================================================== */

const OKVIR = document.querySelector("[data-motor3d]");

if (OKVIR) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wgl = (function () {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) { return false; }
  })();

  const nema = function () { OKVIR.setAttribute("data-motor3d", "nema"); };

  if (wgl && !reduced) {
    const io = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      io.disconnect();
      import("./lib/three.module.min.js").then(pokreni).catch(nema);
    }, { rootMargin: "200px" });
    io.observe(OKVIR);
  } else {
    nema();
  }
}

function pokreni(THREE) {
  /* --- mjere motora (1 jedinica ≈ 1 cm) --------------------------------- */
  const RAZMAK = 3.4;          // razmak između cilindara
  const BORE = 1.28;           // polumjer provrta
  const HOD = 1.15;            // polumjer koljena = pola hoda
  const OJN = 3.55;            // duljina ojnice
  const KLIP_H = 1.65;
  const CIL_X = [-1.5 * RAZMAK, -0.5 * RAZMAK, 0.5 * RAZMAK, 1.5 * RAZMAK];
  const FAZE = [0, Math.PI, Math.PI, 0];
  const CIKLUS = [0, 3, 1, 2];  // red paljenja 1-3-4-2, u polukrugovima
  const VRH = 5.4;              // visina dna glave iznad osi koljena

  const RALENTI = 1.1, PO_PIKSELU = 0.06, STROP = 16, PAD = 8;

  /* --- scena ------------------------------------------------------------- */
  const scena = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  kamera.position.set(9.5, 6.2, 12.5);
  kamera.lookAt(0, 2.1, 0);

  const crtac = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  crtac.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  crtac.setClearAlpha(0);
  crtac.outputColorSpace = THREE.SRGBColorSpace;
  crtac.toneMapping = THREE.ACESFilmicToneMapping;
  crtac.toneMappingExposure = 1.15;
  OKVIR.appendChild(crtac.domElement);
  crtac.domElement.className = "motor3d__platno";

  /* --- okoliš -------------------------------------------------------------
     Metal se vidi po onome što reflektira. Bez okoliša MeshStandardMaterial
     daje ravnu plohu koja izgleda kao plastika. Umjesto HDR mape (koja bi bila
     još jedna datoteka za skinuti) ovdje se okoliš slika u kodu: gradijent od
     svijetlog "stropa" prema tamnom "podu" plus dvije svijetle plohe koje rade
     odsjaje na bridovima. PMREM to pretvori u mapu koju metal može čitati. */
  function napraviOkolis() {
    const pom = new THREE.Scene();

    const c = document.createElement("canvas");
    c.width = 2; c.height = 256;
    const g = c.getContext("2d").createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.00, "#ffffff");
    g.addColorStop(0.42, "#9fb0c4");
    g.addColorStop(0.58, "#3a3f47");
    g.addColorStop(1.00, "#0d0d0c");
    const ctx = c.getContext("2d");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const kupola = new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })
    );
    pom.add(kupola);

    const softbox = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [[-14, 16, 10, 16, 10], [16, 10, -12, 12, 14]].forEach(function (p) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p[3], p[4]), softbox);
      m.position.set(p[0], p[1], p[2]);
      m.lookAt(0, 2, 0);
      pom.add(m);
    });

    const pmrem = new THREE.PMREMGenerator(crtac);
    const meta = pmrem.fromScene(pom, 0.04);
    pmrem.dispose();
    tex.dispose();
    return meta.texture;
  }
  scena.environment = napraviOkolis();
  scena.environmentIntensity = 1.0;

  /* --- svjetlo -----------------------------------------------------------
     Bez HDR mape: nebo/tlo daje osnovu, dva usmjerena svjetla oblik, a treće
     s leđa odvaja motor od tamne podloge. */
  scena.add(new THREE.HemisphereLight(0xe8eef6, 0x1a1715, 1.5));
  const glavno = new THREE.DirectionalLight(0xffffff, 2.1);
  glavno.position.set(7, 11, 8);
  scena.add(glavno);
  const dopuna = new THREE.DirectionalLight(0xbcd2ff, 0.7);
  dopuna.position.set(-9, 3, 5);
  scena.add(dopuna);
  const rub = new THREE.DirectionalLight(0xffb59a, 0.34);
  rub.position.set(-5, 2, -9);
  scena.add(rub);

  /* --- materijali -------------------------------------------------------- */
  const celik = new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 1.0, roughness: 0.22 });
  const lijev = new THREE.MeshStandardMaterial({ color: 0x74777b, metalness: 0.75, roughness: 0.55 });
  const tamno = new THREE.MeshStandardMaterial({ color: 0x3a3d41, metalness: 0.7, roughness: 0.48 });
  const akcent = new THREE.MeshStandardMaterial({ color: 0xdd291f, metalness: 0.4, roughness: 0.45 });
  const ljuska = new THREE.MeshStandardMaterial({
    color: 0x8a9099, metalness: 0.65, roughness: 0.3,
    transparent: true, opacity: 0.30, side: THREE.DoubleSide,
    depthWrite: false
  });
  const staklo = new THREE.MeshStandardMaterial({
    color: 0x9fb3c8, metalness: 0.2, roughness: 0.12,
    transparent: true, opacity: 0.14, side: THREE.DoubleSide
  });
  const zar = new THREE.MeshBasicMaterial({ color: 0xff5a2b, transparent: true, opacity: 0 });

  const motor = new THREE.Group();
  scena.add(motor);

  function mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    motor.add(m);
    return m;
  }

  /* --- blok, glava i korito -----------------------------------------------
     Namjerno bez prednjeg zida: ovo je presjek, a ne kutija. Ostaju samo
     korito ispod koljena, stražnji zid i glava — taman toliko da se vidi
     gdje mehanizam sjedi. */
  const sirina = 4 * RAZMAK + 1.4;

  const korito = mesh(new THREE.BoxGeometry(sirina, 1.35, 3.4), tamno, 0, -2.3, 0);
  korito.scale.set(1, 1, 0.95);
  mesh(new THREE.BoxGeometry(sirina + 0.3, 0.22, 3.7), lijev, 0, -1.55, 0);

  // deck ploča je puna, glava iznad nje poluprozirna — kroz nju se vide
  // ventili i bregasta vratila
  mesh(new THREE.BoxGeometry(sirina, 0.3, 3.4), lijev, 0, VRH + 0.15, 0);
  mesh(new THREE.BoxGeometry(sirina, 1.5, 3.3), ljuska, 0, VRH + 1.05, 0);
  // poklopci bregastih vratila kao dvije zaobljene cijevi
  [-0.62, 0.62].forEach(function (dz) {
    const cijev = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, sirina - 0.4, 24, 1, true), ljuska);
    cijev.rotation.z = Math.PI / 2;
    cijev.position.set(0, VRH + 1.75, dz);
    motor.add(cijev);
  });

  /* --- koljenasto vratilo ------------------------------------------------- */
  const koljeno = new THREE.Group();
  motor.add(koljeno);

  const glavniRukavac = new THREE.CylinderGeometry(0.52, 0.52, 0.85, 28);
  glavniRukavac.rotateZ(Math.PI / 2);
  for (let i = 0; i <= 4; i++) {
    const m = new THREE.Mesh(glavniRukavac, celik);
    m.position.x = (i - 2) * RAZMAK;
    koljeno.add(m);
  }
  const os = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, sirina + 2.2, 20), celik);
  os.rotation.z = Math.PI / 2;
  koljeno.add(os);

  const ramenoGeo = new THREE.BoxGeometry(0.42, HOD * 2 + 1.0, 1.5);
  const rukavacGeo = new THREE.CylinderGeometry(0.44, 0.44, 1.0, 24);
  rukavacGeo.rotateZ(Math.PI / 2);

  CIL_X.forEach(function (x, i) {
    const bacac = new THREE.Group();
    bacac.position.x = x;
    koljeno.add(bacac);
    [-0.72, 0.72].forEach(function (dx) {
      const r = new THREE.Mesh(ramenoGeo, celik);
      r.position.set(dx, HOD / 2, 0);
      bacac.add(r);
    });
    const ruk = new THREE.Mesh(rukavacGeo, i % 3 === 0 ? celik : celik);
    ruk.position.y = HOD;
    bacac.add(ruk);
    bacac.rotation.x = -FAZE[i];   /* rotacija oko osi X: y = r·cos, z = r·sin */
    bacac.userData.faza = FAZE[i];
  });

  // zamašnjak i remenica
  const zamasnjak = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.42, 48), tamno);
  zamasnjak.rotation.z = Math.PI / 2;
  zamasnjak.position.x = -sirina / 2 - 0.45;
  koljeno.add(zamasnjak);
  const zubi = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.12, 8, 56), celik);
  zubi.rotation.y = Math.PI / 2;
  zubi.position.x = -sirina / 2 - 0.45;
  koljeno.add(zubi);

  const remenica = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.55, 36), akcent);
  remenica.rotation.z = Math.PI / 2;
  remenica.position.x = sirina / 2 + 0.5;
  koljeno.add(remenica);

  /* --- cilindri, klipovi, ojnice, ventili --------------------------------- */
  const klipGeo = new THREE.CylinderGeometry(BORE - 0.06, BORE - 0.06, KLIP_H, 40);
  const karikaGeo = new THREE.TorusGeometry(BORE - 0.04, 0.045, 8, 44);
  const osovinicaGeo = new THREE.CylinderGeometry(0.26, 0.26, 1.5, 18);
  osovinicaGeo.rotateZ(Math.PI / 2);
  /* Ojnica: tijelo koje se sužava prema klipu, veliko oko na koljenu i malo
     oko na osovinici. Sve se slaže u grupu pa se grupa okreće i rasteže. */
  const ojnicaTijelo = new THREE.CylinderGeometry(0.15, 0.22, 1, 14);
  const okoVelikoGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.86, 26);
  okoVelikoGeo.rotateZ(Math.PI / 2);
  const okoMaloGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.8, 20);
  okoMaloGeo.rotateZ(Math.PI / 2);
  const sleeveGeo = new THREE.CylinderGeometry(BORE + 0.12, BORE + 0.12, VRH - 0.4, 40, 1, true);
  const ventilGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.5, 14);
  const tanjurGeo = new THREE.CylinderGeometry(0.46, 0.2, 0.26, 20);

  const dijelovi = [];

  CIL_X.forEach(function (x, i) {
    const sleeve = new THREE.Mesh(sleeveGeo, staklo);
    sleeve.position.set(x, (VRH - 0.4) / 2 + 0.3, 0);
    motor.add(sleeve);

    const klip = new THREE.Group();
    const tijelo = new THREE.Mesh(klipGeo, celik);
    klip.add(tijelo);
    for (let k = 0; k < 3; k++) {
      const kar = new THREE.Mesh(karikaGeo, tamno);
      kar.rotation.x = Math.PI / 2;
      kar.position.y = KLIP_H / 2 - 0.22 - k * 0.2;
      klip.add(kar);
    }
    const osov = new THREE.Mesh(osovinicaGeo, tamno);
    osov.position.y = -0.12;
    klip.add(osov);
    klip.position.x = x;
    motor.add(klip);

    const ojnica = new THREE.Group();
    const stablo = new THREE.Mesh(ojnicaTijelo, celik);
    ojnica.add(stablo);
    const okoV = new THREE.Mesh(okoVelikoGeo, celik);
    okoV.position.y = -0.5;
    ojnica.add(okoV);
    const okoM = new THREE.Mesh(okoMaloGeo, celik);
    okoM.position.y = 0.5;
    ojnica.add(okoM);
    ojnica.userData.stablo = stablo;
    ojnica.userData.okoV = okoV;
    ojnica.userData.okoM = okoM;
    motor.add(ojnica);

    const plamen = new THREE.Mesh(
      new THREE.SphereGeometry(BORE - 0.45, 20, 14), zar.clone());
    plamen.position.set(x, VRH - 0.45, 0);
    motor.add(plamen);

    const parVentila = [];
    [-0.62, 0.62].forEach(function (dz) {
      const v = new THREE.Group();
      const stap = new THREE.Mesh(ventilGeo, celik);
      stap.position.y = 0.75;
      v.add(stap);
      const tanj = new THREE.Mesh(tanjurGeo, celik);
      v.add(tanj);
      v.position.set(x, VRH - 0.1, dz);
      motor.add(v);
      parVentila.push(v);
    });

    dijelovi.push({ klip: klip, ojnica: ojnica, ventili: parVentila, plamen: plamen, x: x, i: i });
  });

  /* --- bregasta vratila ---------------------------------------------------- */
  const bregovi = [];
  [-0.62, 0.62].forEach(function (dz) {
    const g = new THREE.Group();
    const osB = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, sirina, 18), celik);
    osB.rotation.z = Math.PI / 2;
    g.add(osB);
    CIL_X.forEach(function (x) {
      const grba = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 22), celik);
      grba.rotation.z = Math.PI / 2;
      grba.position.set(x, 0, 0);
      grba.scale.set(1, 1, 0.55);
      g.add(grba);
    });
    g.position.set(0, VRH + 1.75, dz);
    motor.add(g);
    bregovi.push(g);
  });

  /* --- kinematika ---------------------------------------------------------- */
  function klipY(t) {
    const s = HOD * Math.sin(t);
    return HOD * Math.cos(t) + Math.sqrt(OJN * OJN - s * s);
  }

  function podizaj(psi, ispusni) {
    const od = ispusni ? Math.PI : 2 * Math.PI;
    const x = (psi - od) / Math.PI;
    if (x < 0 || x > 1) return 0;
    return Math.sin(x * Math.PI);
  }

  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const GORE = new THREE.Vector3(0, 1, 0);

  function postavi(theta) {
    koljeno.rotation.x = -theta;

    for (let i = 0; i < 4; i++) {
      const d = dijelovi[i];
      const t = theta + FAZE[i];
      const py = klipY(t);
      const ry = HOD * Math.cos(t);
      const rz = HOD * Math.sin(t);

      d.klip.position.y = py;

      /* ojnica: od rukavca do osovinice klipa, u ravnini cilindra */
      v1.set(d.x, ry, rz);
      v2.set(d.x, py - 0.12, 0);
      const duljina = v1.distanceTo(v2);
      d.ojnica.position.copy(v1).add(v2).multiplyScalar(0.5);
      /* razvuče se samo tijelo; oka ostaju okrugla */
      d.ojnica.userData.stablo.scale.y = duljina;
      d.ojnica.userData.okoV.position.y = -duljina / 2;
      d.ojnica.userData.okoM.position.y = duljina / 2;
      d.ojnica.quaternion.setFromUnitVectors(
        GORE, v2.clone().sub(v1).normalize());

      let psi = (theta + CIKLUS[i] * Math.PI) % (4 * Math.PI);
      if (psi < 0) psi += 4 * Math.PI;
      d.ventili[0].position.y = VRH - 0.1 - podizaj(psi, false) * 0.34;
      d.ventili[1].position.y = VRH - 0.1 - podizaj(psi, true) * 0.34;
      d.plamen.material.opacity = psi < 1.1 ? 0.55 * (1 - psi / 1.1) : 0;
    }

    bregovi.forEach(function (g) { g.rotation.x = -theta / 2; });
  }

  /* --- veličina i kadriranje ---------------------------------------------
     Kamera se postavlja iz stvarnih granica modela, pa promjena mjera motora
     ne traži ručno pomicanje kamere. */
  const SMJER = new THREE.Vector3(0.86, 0.44, 1.0).normalize();
  const granice = new THREE.Box3().setFromObject(motor);
  const srediste = granice.getCenter(new THREE.Vector3());
  const raspon = granice.getSize(new THREE.Vector3());

  function mjeri() {
    const w = OKVIR.clientWidth || 520;
    const h = Math.round(w * 0.88);
    crtac.setSize(w, h, false);
    crtac.domElement.style.width = w + "px";
    crtac.domElement.style.height = h + "px";
    kamera.aspect = w / h;

    const vFov = kamera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * kamera.aspect);
    const d = Math.max(
      (raspon.y * 1.25 / 2) / Math.tan(vFov / 2),
      (raspon.x * (kamera.aspect < 1.15 ? 0.98 : 0.78) / 2) / Math.tan(hFov / 2)
    ) * 1.06;

    kamera.position.copy(srediste).addScaledVector(SMJER, d);
    kamera.lookAt(srediste);
    kamera.updateProjectionMatrix();
  }
  mjeri();
  window.addEventListener("resize", mjeri);

  /* --- pokret --------------------------------------------------------------- */
  let theta = 0, visak = 0, zadnjiY = window.scrollY || 0, zadnjiT = 0, radi = false;
  let ciljOkret = 0, okret = 0;

  window.addEventListener("scroll", function () {
    const y = window.scrollY || 0;
    visak += Math.abs(y - zadnjiY) * PO_PIKSELU;
    zadnjiY = y;
    if (visak > STROP) visak = STROP;
  }, { passive: true });

  /* Pokazivač zakreće motor vrlo malo — objekt koji se vrti za mišem po cijelom
     rasponu izgleda kao igračka (isto pravilo kao tilt od 9 stupnjeva). */
  OKVIR.addEventListener("pointermove", function (e) {
    const r = OKVIR.getBoundingClientRect();
    ciljOkret = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
  });
  OKVIR.addEventListener("pointerleave", function () { ciljOkret = 0; });

  function petlja(t) {
    if (!radi) return;
    const dt = zadnjiT ? Math.min((t - zadnjiT) / 1000, 0.05) : 0.016;
    zadnjiT = t;

    visak = Math.max(0, visak - PAD * dt);
    theta = (theta + (RALENTI + visak) * dt) % (4 * Math.PI);
    okret += (ciljOkret - okret) * Math.min(1, dt * 4);
    motor.rotation.y = okret;

    postavi(theta);
    crtac.render(scena, kamera);
    requestAnimationFrame(petlja);
  }

  function upali() {
    if (radi) return;
    radi = true; zadnjiT = 0;
    requestAnimationFrame(petlja);
  }

  postavi(0);
  crtac.render(scena, kamera);
  OKVIR.setAttribute("data-motor3d", "radi");   /* CSS tada sakrije SVG */

  new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) upali(); else radi = false;
  }, { rootMargin: "120px" }).observe(OKVIR);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) radi = false; else upali();
  });
}
