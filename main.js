/* Auto Servis RPM — main.js */


/* ── Header scroll state ── */
const header = document.getElementById('header');
const backToTop = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY > 40;
  header.classList.toggle('scrolled', scrolled);
  backToTop.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

/* ── Mobile nav ── */
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');

hamburger.addEventListener('click', () => {
  const open = hamburger.getAttribute('aria-expanded') === 'true';
  hamburger.setAttribute('aria-expanded', String(!open));
  mobileNav.hidden = open;
});

mobileNav.querySelectorAll('.mobile-nav__link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.setAttribute('aria-expanded', 'false');
    mobileNav.hidden = true;
  });
});

/* ── Animated stat counters ── */
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1400;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }

  requestAnimationFrame(step);
}

const counters = document.querySelectorAll('.hero__stat-number[data-target]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

counters.forEach(c => counterObserver.observe(c));

/* ── Scroll-reveal for review cards ── */

/* ── Scroll-reveal ── */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  const revealEls = document.querySelectorAll(
    '.service-card, .trust-card, .process__step, .why-us__item, .contact__item, .hours, .review-card'
  );

  const revealStyle = document.createElement('style');
  revealStyle.textContent = `
    .reveal { opacity: 0; transform: translateY(24px); transition: opacity 500ms ease, transform 500ms ease; }
    .reveal.visible { opacity: 1; transform: none; }
  `;
  document.head.appendChild(revealStyle);

  revealEls.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 4) * 60}ms`;
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => revealObserver.observe(el));
}

/* ── Contact form ── */
const form = document.getElementById('contact-form');
const submitBtn = document.getElementById('submit-btn');
const formSuccess = document.getElementById('form-success');

function validateField(input) {
  const errorEl = input.parentElement.querySelector('.form-error');
  if (!errorEl) return true;

  let msg = '';
  if (input.required && !input.value.trim()) {
    msg = 'Ovo polje je obavezno.';
  } else if (input.type === 'tel' && input.value && !/^[\d\s\+\-\(\)]{6,}$/.test(input.value)) {
    msg = 'Unesite valjani broj telefona.';
  }

  errorEl.textContent = msg;
  input.classList.toggle('invalid', !!msg);
  input.setAttribute('aria-invalid', String(!!msg));
  return !msg;
}

form.querySelectorAll('input, textarea').forEach(input => {
  input.addEventListener('blur', () => validateField(input));
  input.addEventListener('input', () => {
    if (input.classList.contains('invalid')) validateField(input);
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fields = form.querySelectorAll('input[required], textarea[required]');
  let valid = true;
  fields.forEach(f => { if (!validateField(f)) valid = false; });
  if (!valid) {
    form.querySelector('.invalid')?.focus();
    return;
  }

  submitBtn.classList.add('btn--loading');
  submitBtn.disabled = true;

  const data = new FormData(form);
  data.append('access_key', '52231398-70ba-48c4-be7e-4c6a4e311297');
  data.append('email', 'autoservisrpm@gmail.com');
  data.append('subject', 'Novi upit — Auto Servis RPM');
  data.append('from_name', 'RPM Web Kontakt Forma');

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: data
    });
    const json = await res.json();
    if (!json.success) throw new Error();
  } catch {
    submitBtn.classList.remove('btn--loading');
    submitBtn.disabled = false;
    alert('Greška pri slanju. Molimo nazovite nas na 092 389 4126.');
    return;
  }

  submitBtn.classList.remove('btn--loading');
  submitBtn.disabled = false;
  form.reset();
  formSuccess.hidden = false;
  formSuccess.focus();

  setTimeout(() => { formSuccess.hidden = true; }, 6000);
});

/* ── Gallery lightbox ── */
const lightbox     = document.getElementById('lightbox');
const lbImg        = document.getElementById('lightbox-img');
const lbClose      = document.getElementById('lightbox-close');
const lbPrev       = document.getElementById('lightbox-prev');
const lbNext       = document.getElementById('lightbox-next');
const lbCounter    = document.getElementById('lightbox-counter');
const galleryItems = [...document.querySelectorAll('.gallery__item[data-index]')];

let currentIndex = 0;
let lastFocused  = null;

function getImgData(item) {
  const img = item.querySelector('img');
  return { src: img.src, alt: img.alt };
}

function openLightbox(index) {
  currentIndex = index;
  const { src, alt } = getImgData(galleryItems[index]);
  lbImg.src = src;
  lbImg.alt = alt;
  lbCounter.textContent = `${index + 1} / ${galleryItems.length}`;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  lbClose.focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}

function showImage(index) {
  currentIndex = (index + galleryItems.length) % galleryItems.length;
  const { src, alt } = getImgData(galleryItems[currentIndex]);
  lbImg.style.animation = 'none';
  lbImg.offsetHeight; // reflow
  lbImg.style.animation = '';
  lbImg.src = src;
  lbImg.alt = alt;
  lbCounter.textContent = `${currentIndex + 1} / ${galleryItems.length}`;
}

galleryItems.forEach((item, i) => {
  item.addEventListener('click', () => {
    lastFocused = item;
    openLightbox(i);
  });
});

lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => showImage(currentIndex - 1));
lbNext.addEventListener('click', () => showImage(currentIndex + 1));

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowLeft')   showImage(currentIndex - 1);
  if (e.key === 'ArrowRight')  showImage(currentIndex + 1);
});

/* ── Smooth scroll for anchor links ── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href');
    if (id === '#') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 72;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
