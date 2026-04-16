/**
 * NexusAI Landing Page — main.js
 * Handles: Three.js 3D scene, GSAP hero animations,
 *          scroll reveals, particle canvas, counter animations,
 *          nav scroll behavior, mobile menu.
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   1. UTILITIES
──────────────────────────────────────────────────────────────── */
const IS_LOW_END = navigator.hardwareConcurrency <= 2 || window.devicePixelRatio < 1.5;
const IS_MOBILE  = window.innerWidth < 768;


function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/* ─────────────────────────────────────────────────────────────
   2. GSAP REGISTRATION
──────────────────────────────────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────────────────────────
   3. THREE.JS — HERO 3D SCENE
──────────────────────────────────────────────────────────────── */
(function initThreeScene() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  /* Renderer */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !IS_LOW_END,
    alpha: true,
    powerPreference: IS_LOW_END ? 'low-power' : 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_LOW_END ? 1 : 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = !IS_LOW_END;

  /* Scene & Camera */
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 5);

  /* ── Lighting ── */
  const ambientLight = new THREE.AmbientLight(0x080820, 1);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x00f5c4, IS_LOW_END ? 2 : 4, 12);
  pointLight1.position.set(3, 3, 3);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x7b2ff7, IS_LOW_END ? 1.5 : 3, 12);
  pointLight2.position.set(-3, -2, 2);
  scene.add(pointLight2);

  const rimLight = new THREE.DirectionalLight(0x5b8cf7, 0.8);
  rimLight.position.set(0, 5, -3);
  scene.add(rimLight);

  /* ── Geometry: Icosahedron ── */
  const segments  = IS_LOW_END ? 1 : 2;
  const icoGeo    = new THREE.IcosahedronGeometry(1.4, segments);

  // Distort geometry vertices slightly for an organic look
  const posArr = icoGeo.attributes.position.array;
  for (let i = 0; i < posArr.length; i += 3) {
    const noise = (Math.random() - 0.5) * 0.08;
    posArr[i]   += noise;
    posArr[i+1] += noise;
    posArr[i+2] += noise;
  }
  icoGeo.attributes.position.needsUpdate = true;
  icoGeo.computeVertexNormals();

  /* Wireframe overlay */
  const wireGeo  = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.42, 1));
  const wireMat  = new THREE.LineBasicMaterial({
    color: 0x00f5c4,
    transparent: true,
    opacity: 0.12,
  });
  const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
  scene.add(wireMesh);

  /* Main mesh with custom shader material */
  const icoMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x0c0b18),
    metalness: 0.9,
    roughness: 0.15,
    envMapIntensity: 1,
    transparent: true,
    opacity: 0.95,
  });

  const icoMesh = new THREE.Mesh(icoGeo, icoMat);
  icoMesh.position.set(IS_MOBILE ? 0 : 2.2, IS_MOBILE ? -0.3 : -0.2, 0);
  scene.add(icoMesh);

  /* Inner glowing core */
  const coreGeo = new THREE.IcosahedronGeometry(0.7, 1);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x00f5c4,
    transparent: true,
    opacity: 0.06,
    wireframe: false,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  icoMesh.add(coreMesh);

  /* Inner ring orbit */
  const ringGeo  = new THREE.TorusGeometry(1.8, 0.006, 6, IS_LOW_END ? 40 : 80);
  const ringMat  = new THREE.MeshBasicMaterial({ color: 0x00f5c4, transparent: true, opacity: 0.18 });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI * 0.35;
  icoMesh.add(ringMesh);

  const ring2Geo  = new THREE.TorusGeometry(2.0, 0.004, 6, IS_LOW_END ? 40 : 80);
  const ring2Mat  = new THREE.MeshBasicMaterial({ color: 0x7b2ff7, transparent: true, opacity: 0.12 });
  const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2Mesh.rotation.x = Math.PI * 0.55;
  ring2Mesh.rotation.z = Math.PI * 0.2;
  icoMesh.add(ring2Mesh);

  /* ── Floating satellite spheres ── */
  const satellites = [];
  if (!IS_LOW_END) {
    const satData = [
      { r: 0.08, dist: 2.6, speed: 0.4, phase: 0,    color: 0x00f5c4 },
      { r: 0.05, dist: 3.1, speed: 0.25, phase: 2.1, color: 0x7b2ff7 },
      { r: 0.06, dist: 2.8, speed: 0.55, phase: 4.2, color: 0x5b8cf7 },
    ];
    satData.forEach(d => {
      const g = new THREE.SphereGeometry(d.r, 8, 8);
      const m = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(g, m);
      scene.add(mesh);
      satellites.push({ mesh, ...d, angle: d.phase });
    });
  }

  /* ── Mouse interaction ── */
  let targetRotX = 0, targetRotY = 0;
  let currentRotX = 0, currentRotY = 0;

  window.addEventListener('mousemove', e => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    targetRotY = ((e.clientX - cx) / cx) * 0.35;
    targetRotX = ((e.clientY - cy) / cy) * -0.2;
  });

  /* Device tilt for mobile */
  window.addEventListener('deviceorientation', e => {
    if (e.gamma !== null) {
      targetRotY = clamp(e.gamma / 40, -0.4, 0.4);
      targetRotX = clamp(e.beta  / 60, -0.2, 0.2);
    }
  });

  /* ── Resize handler ── */
  function onResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    icoMesh.position.set(window.innerWidth < 768 ? 0 : 2.2, window.innerWidth < 768 ? -0.3 : -0.2, 0);
  }
  const resizeObs = new ResizeObserver(onResize);
  resizeObs.observe(canvas);

  /* ── Animation loop ── */
  let frame = 0;
  function animate() {
    window.requestAnimationFrame(animate);
    frame++;

    const t = performance.now() * 0.001;

    /* Smooth mouse follow */
    currentRotX = lerp(currentRotX, targetRotX, 0.05);
    currentRotY = lerp(currentRotY, targetRotY, 0.05);

    /* Rotate icosahedron */
    icoMesh.rotation.x = currentRotX + Math.sin(t * 0.3) * 0.05;
    icoMesh.rotation.y = currentRotY + t * 0.12;
    icoMesh.rotation.z = Math.cos(t * 0.2) * 0.04;

    /* Wireframe counter-rotate slightly */
    wireMesh.rotation.x = icoMesh.rotation.x - 0.01;
    wireMesh.rotation.y = icoMesh.rotation.y - 0.015;

    /* Satellites orbit */
    satellites.forEach(s => {
      s.angle += s.speed * 0.01;
      s.mesh.position.set(
        icoMesh.position.x + Math.cos(s.angle) * s.dist,
        icoMesh.position.y + Math.sin(s.angle * 0.6) * 0.4,
        Math.sin(s.angle) * s.dist
      );
    });

    /* Light animation */
    pointLight1.position.x = Math.sin(t * 0.5) * 4;
    pointLight1.position.y = Math.cos(t * 0.4) * 3;
    pointLight2.position.x = Math.cos(t * 0.3) * -4;

    /* Core glow pulse */
    coreMesh.material.opacity = 0.04 + Math.sin(t * 1.5) * 0.03;

    renderer.render(scene, camera);
  }
  animate();
})();

/* ─────────────────────────────────────────────────────────────
   4. PARTICLE CANVAS
──────────────────────────────────────────────────────────────── */
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');

  const COUNT  = IS_LOW_END ? 30 : IS_MOBILE ? 50 : 80;
  let W, H, particles = [];

  class Particle {
    constructor() { this.reset(true); }
    reset(random = false) {
      this.x    = Math.random() * W;
      this.y    = random ? Math.random() * H : H + 10;
      this.size = Math.random() * 1.5 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = -(Math.random() * 0.4 + 0.1);
      this.opacity = Math.random() * 0.5 + 0.1;
      this.color   = Math.random() > 0.5 ? '#00f5c4' : '#7b2ff7';
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.opacity -= 0.0008;
      if (this.y < -10 || this.opacity <= 0) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity;
      ctx.fill();
    }
  }

  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width  = W;
    canvas.height = H;
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, () => new Particle());
  }

  function loop() {
    window.requestAnimationFrame(loop);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    particles.forEach(p => { p.update(); p.draw(); });
    ctx.globalAlpha = 1;
  }

  window.addEventListener('resize', resize);
  init();
  loop();
})();

/* ─────────────────────────────────────────────────────────────
   5. GSAP HERO ENTRY ANIMATION
──────────────────────────────────────────────────────────────── */
(function heroEntryAnimation() {
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

  tl
    .to('.hero-badge', { opacity: 1, y: 0, duration: 0.8 }, 0.3)
    .fromTo('#heroLine1',
      { opacity: 0, y: 60, clipPath: 'inset(100% 0 0 0)' },
      { opacity: 1, y: 0, clipPath: 'inset(0% 0 0 0)', duration: 1 },
      0.55)
    .fromTo('#heroLine2',
      { opacity: 0, y: 60, clipPath: 'inset(100% 0 0 0)' },
      { opacity: 1, y: 0, clipPath: 'inset(0% 0 0 0)', duration: 1 },
      0.75)
    .to('#heroSub',    { opacity: 1, duration: 0.9 }, 1.0)
    .to('#heroActions',{ opacity: 1, duration: 0.9 }, 1.15)
    .to('#heroStats',  { opacity: 1, duration: 0.9 }, 1.3);
})();

/* ─────────────────────────────────────────────────────────────
   6. COUNTER ANIMATION
──────────────────────────────────────────────────────────────── */
(function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  counters.forEach(el => {
    const target = parseFloat(el.dataset.count);
    const isFloat = String(target).includes('.');
    const decimals = isFloat ? 1 : 0;

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.fromTo(
          { val: 0 },
          { val: target, duration: 2, ease: 'power2.out',
            onUpdate: function() {
              el.textContent = this.targets()[0].val.toFixed(decimals);
            }
          }
        );
      }
    });
  });
})();

/* ─────────────────────────────────────────────────────────────
   7. SCROLL REVEALS (GSAP ScrollTrigger)
──────────────────────────────────────────────────────────────── */
(function initScrollReveals() {
  /* Generic fade-up reveals */
  document.querySelectorAll('.reveal-fade').forEach(el => {
    const delay = parseFloat(el.dataset.delay || 0) / 1000;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(el, { opacity: 1, y: 0, duration: 0.7, delay, ease: 'power3.out' });
        el.classList.add('visible');
      }
    });
  });

  /* Scale-in reveals */
  document.querySelectorAll('.reveal-scale').forEach(el => {
    const delay = parseFloat(el.dataset.delay || 0) / 1000;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1, scale: 1, y: 0,
          duration: 0.75, delay,
          ease: 'power3.out'
        });
        el.classList.add('visible');
      }
    });
  });

  /* Stagger for features grid */
  const featureCards = document.querySelectorAll('.feature-card');
  if (featureCards.length) {
    ScrollTrigger.create({
      trigger: '.features-grid',
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(featureCards, {
          opacity: 1, scale: 1, y: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: 'power3.out'
        });
      }
    });
  }

  /* Parallax on hero orbs */
  gsap.to('.hero-orb-1', {
    y: -80,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.5
    }
  });
  gsap.to('.hero-orb-2', {
    y: -50,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 2
    }
  });
})();

/* ─────────────────────────────────────────────────────────────
   8. NAVIGATION — scroll state + mobile menu
──────────────────────────────────────────────────────────────── */
(function initNav() {
  const header    = document.getElementById('nav');
  const toggle    = document.getElementById('navToggle');
  const mobileNav = document.getElementById('navMobile');
  let menuOpen    = false;

  /* Scroll-based glass effect */
  ScrollTrigger.create({
    start: 60,
    onUpdate: self => {
      if (self.progress > 0) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  /* Mobile menu toggle */
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      menuOpen = !menuOpen;
      toggle.setAttribute('aria-expanded', menuOpen);
      mobileNav.setAttribute('aria-hidden', !menuOpen);
      if (menuOpen) {
        mobileNav.classList.add('open');
        // Animate hamburger to X
        const spans = toggle.querySelectorAll('span');
        gsap.to(spans[0], { rotation: 45, y: 7, duration: 0.3 });
        gsap.to(spans[1], { opacity: 0, duration: 0.2 });
        gsap.to(spans[2], { rotation: -45, y: -7, duration: 0.3 });
      } else {
        mobileNav.classList.remove('open');
        const spans = toggle.querySelectorAll('span');
        gsap.to(spans[0], { rotation: 0, y: 0, duration: 0.3 });
        gsap.to(spans[1], { opacity: 1, duration: 0.2 });
        gsap.to(spans[2], { rotation: 0, y: 0, duration: 0.3 });
      }
    });

    /* Close mobile menu on link click */
    mobileNav.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('click', () => {
        if (!menuOpen) return;
        toggle.click();
      });
    });
  }
})();

/* ─────────────────────────────────────────────────────────────
   9. BUTTON MICRO-INTERACTION — ripple effect
──────────────────────────────────────────────────────────────── */
(function initRipple() {
  document.querySelectorAll('.btn-primary, .btn-outline').forEach(btn => {
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';

    btn.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ripple = document.createElement('span');
      Object.assign(ripple.style, {
        position: 'absolute',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        transform: 'scale(0)',
        pointerEvents: 'none',
        width:  '120px',
        height: '120px',
        left:   `${x - 60}px`,
        top:    `${y - 60}px`,
      });
      this.appendChild(ripple);

      gsap.to(ripple, {
        scale: 3,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: () => ripple.remove()
      });
    });
  });
})();

/* ─────────────────────────────────────────────────────────────
   10. LUCIDE ICONS — initialize after DOM ready
──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

/* ─────────────────────────────────────────────────────────────
   11. ABOUT SECTION — parallax rings on scroll
──────────────────────────────────────────────────────────────── */
(function initAboutParallax() {
  gsap.to('.ring-1', {
    rotation: 360,
    ease: 'none',
    scrollTrigger: {
      trigger: '.about',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 2
    }
  });
  gsap.to('.ring-2', {
    rotation: -360,
    ease: 'none',
    scrollTrigger: {
      trigger: '.about',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 3
    }
  });
})();

/* ─────────────────────────────────────────────────────────────
   12. FEATURE CARDS — tilt on mouse hover (desktop only)
──────────────────────────────────────────────────────────────── */
(function initCardTilt() {
  if (IS_MOBILE) return;

  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', function(e) {
      const rect = this.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dx   = (e.clientX - cx) / (rect.width  / 2);
      const dy   = (e.clientY - cy) / (rect.height / 2);

      gsap.to(this, {
        rotateY: dx * 6,
        rotateX: -dy * 4,
        duration: 0.4,
        ease: 'power2.out',
        transformPerspective: 800,
        transformOrigin: 'center center'
      });
    });

    card.addEventListener('mouseleave', function() {
      gsap.to(this, {
        rotateY: 0, rotateX: 0,
        duration: 0.5,
        ease: 'power2.out'
      });
    });
  });
})();

/* ─────────────────────────────────────────────────────────────
   13. SMOOTH ANCHOR SCROLL
──────────────────────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});