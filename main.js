/* =========================================================================
   ORBITING RING — main.js

   Reference-matched structure: a single hollow, circular ring
   formation (glowing particle nebula + orbiting photo planes, both
   following a circular band with a dark hollow center — an accretion-
   disk look — set inside a
   starfield with periodic shooting stars and soft purple bokeh circles.
   Camera does a cinematic intro fly-through, then hands control to the
   user (drag = rotate, wheel/pinch = zoom). Music autoplays on first
   interaction with a mute toggle.

   Everything you're likely to want to tweak is grouped in CONFIG below.
   ========================================================================= */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";

/* ------------------------------------------------------------------------
   0. CONFIG — tune the look & feel here without touching the logic below
   ------------------------------------------------------------------------ */
const CONFIG = {
  // Shared shape of the ring formation that both the particle nebula and
  // the photos are scattered along. This is what makes it read as a
  // ring: everything sits near the circle's outline, with a hollow
  // gap in the middle rather than a filled-in blob.
  formation: {
    scale: 9.5,          // overall size (radial reach) of the ring
    bandInner: 0.62,      // inner edge of the ring band, fraction of scale (bigger = smaller hollow)
    bandOuter: 1.02,      // outer edge of the dense band
    tiltX: -0.36,         // tilt so the ring is viewed obliquely, like the reference
    tiltZ: 0.05,
    spinSpeed: 0.018,      // slow rigid rotation of the whole formation
  },

  nebula: {
    particleCount: 16000,     // more = denser glowing ring, costs more GPU/CPU
    jitter: 0.85,              // perpendicular/depth fluffiness of the band
    color: 0x8f6dff,           // outer glow color (soft violet)
    hotColor: 0xffffff,        // inner-rim hot color
    size: 0.05,
    opacity: 0.85,
    pulseSpeed: 1.0,           // heartbeat animation speed
    pulseAmount: 0.035,        // how much the nebula grows/shrinks
  },

  starfield: {
    count: 3200,
    radius: 110,
    minRadius: 40,
    size: 0.14,
    color: 0xffffff,
  },

  moon: {
    particleCount: 7000,        // density of the moon's particle surface
    radiusMult: 0.8,             // fraction of the ring's hollow radius the moon fills
    color: 0xb9b3cf,              // base grey-lavender "moon rock" color
    hotColor: 0xffffff,           // bright highlight color mixed in
    size: 0.045,
    opacity: 0.95,
    spinSpeed: 0.05,               // independent slow rotation, radians/sec
  },

  shootingStars: {
    maxActive: 4,
    spawnIntervalRange: [1.0, 3.0],
    speed: 34,
    trailLength: 14,        // number of glow sprites making up the fading trail
    headSize: 0.5,           // size of the brightest sprite at the front
    haloSize: 1.3,           // size of the soft outer glow behind the head
    color: 0xffffff,
  },

  orbitImages: {
    // Swap these with your own image URLs (any aspect ratio works —
    // planes are sized from each texture's natural width/height). The
    // ring reuses this list many times over (see `photoCount`) so a
    // handful of URLs is enough to fill it out densely, like the reference.
    urls: [
      "https://picsum.photos/seed/heart1/300/400",
      "https://picsum.photos/seed/heart2/300/400",
      "https://picsum.photos/seed/heart3/400/300",
      "https://picsum.photos/seed/heart4/300/400",
      "https://picsum.photos/seed/heart5/300/300",
      "https://picsum.photos/seed/heart6/400/300",
      "https://picsum.photos/seed/heart7/300/400",
      "https://picsum.photos/seed/heart8/300/400",
      "https://picsum.photos/seed/heart9/400/300",
      "https://picsum.photos/seed/heart10/300/400",
      "https://picsum.photos/seed/heart11/300/300",
      "https://picsum.photos/seed/heart12/300/400",
    ],
    photoCount: 420,             // total planes scattered along the ring band (reference-style density)
    planeHeight: 0.5,             // base plane height in world units (width follows aspect)
    bandInnerMult: 0.88,           // photos fray a bit wider than the nebula band itself
    bandOuterMult: 1.28,
    bobAmount: 0.04,               // tiny per-photo twinkle/drift
    bobSpeed: 0.6,
    billboard: true,               // true = always face camera; false = stay flat in the ring plane
  },

  bokeh: {
    count: 90,
    minSize: 0.15,
    maxSize: 1.6,
    color: 0x9a7bff,
    spreadRadius: 34,
    minRadius: 6,
  },

  camera: {
    fov: 50,
    near: 0.1,
    far: 250,
    restRadius: 24,
    restPolarDeg: 78,
    introDuration: 6.5,
  },

  audio: {
    startMuted: false,
  },
};

/* ------------------------------------------------------------------------
   1. RENDERER / SCENE / CAMERA
   ------------------------------------------------------------------------ */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  CONFIG.camera.near,
  CONFIG.camera.far
);
camera.position.set(0, 4, 22);

/* ------------------------------------------------------------------------
   1b. SHARED GLOW TEXTURE
   A soft radial-gradient sprite texture reused by shooting stars and the
   bokeh circles — cheap to generate once, avoids duplicate canvases.
   ------------------------------------------------------------------------ */
function makeGlowTexture(innerColor = "255,255,255", outerColor = "150,120,255") {
  const size = 128;
  const canvasEl = document.createElement("canvas");
  canvasEl.width = canvasEl.height = size;
  const ctx = canvasEl.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${innerColor},1)`);
  gradient.addColorStop(0.4, `rgba(${outerColor},0.8)`);
  gradient.addColorStop(1, `rgba(${outerColor},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const glowTextureWhite = makeGlowTexture("255,255,255", "255,255,255");
const glowTexturePurple = makeGlowTexture("255,255,255", "150,120,255");


/* ------------------------------------------------------------------------
   2. THE RING FORMATION
   Both the nebula (glow particles) and the photo planes are scattered
   along the same circle, offset radially within a band
   (bandInner..bandOuter) rather than filled all the way to the center.
   That's what produces the hollow, ring-like look — same structure as the
   circular "galaxy" look from the reference.
   ------------------------------------------------------------------------ */
function ringCurve(t) {
  // Plain circle — the reference's formation is a circular/elliptical
  // ring (like Saturn's rings around a hollow center).
  return { x: Math.cos(t), y: Math.sin(t) };
}

const formationGroup = new THREE.Group();
formationGroup.rotation.set(CONFIG.formation.tiltX, 0, CONFIG.formation.tiltZ);
scene.add(formationGroup);

/* --- 2a. Nebula: glowing particle cloud tracing the ring band --- */
function buildNebula() {
  const { particleCount, jitter, color, hotColor, size, opacity } = CONFIG.nebula;
  const { scale, bandInner, bandOuter } = CONFIG.formation;

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const baseColor = new THREE.Color(color);
  const hot = new THREE.Color(hotColor);

  for (let i = 0; i < particleCount; i++) {
    const t = Math.random() * Math.PI * 2;
    const { x, y } = ringCurve(t);

    // Slight bias toward the inner edge so the rim reads brighter/denser,
    // fading outward — matches the reference's bright-inner, soft-outer glow.
    const frac = THREE.MathUtils.lerp(
      bandInner,
      bandOuter,
      Math.pow(Math.random(), 1.6)
    );

    let px = x * frac * scale;
    let pz = y * frac * scale;
    let py = 0;

    // Fluffy jitter in all three axes so it reads as a soft particle cloud,
    // not a hard line.
    px += (Math.random() - 0.5) * jitter;
    pz += (Math.random() - 0.5) * jitter;
    py += (Math.random() - 0.5) * jitter * 0.6;

    const idx = i * 3;
    positions[idx] = px;
    positions[idx + 1] = py;
    positions[idx + 2] = pz;

    const mixT = THREE.MathUtils.clamp(
      1 - (frac - bandInner) / (bandOuter - bandInner),
      0,
      1
    );
    const c = baseColor.clone().lerp(hot, mixT * 0.75);
    colors[idx] = c.r;
    colors[idx + 1] = c.g;
    colors[idx + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  return points;
}

const nebula = buildNebula();
formationGroup.add(nebula);

const coreLight = new THREE.PointLight(0xb79cff, 2.2, 20, 2);
coreLight.position.set(0, 0, 0);
formationGroup.add(coreLight);

/* --- 2a-2. Moon: a solid-looking particle sphere filling the ring's
   hollow center, instead of leaving it empty. --- */
function buildMoon() {
  const { particleCount, radiusMult, color, hotColor, size, opacity } = CONFIG.moon;
  const { scale, bandInner } = CONFIG.formation;
  const radius = scale * bandInner * radiusMult;

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const baseColor = new THREE.Color(color);
  const hot = new THREE.Color(hotColor);

  for (let i = 0; i < particleCount; i++) {
    // Uniform sampling within a sphere volume (cube-root of a uniform
    // random radius) so the moon looks solid/filled rather than a shell.
    const r = radius * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

    const idx = i * 3;
    positions[idx] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[idx + 2] = r * Math.cos(phi);

    // Mostly grey-white with a bit of random highlight variation so it
    // reads as a textured/cratered surface rather than a flat color.
    const c = baseColor.clone().lerp(hot, Math.pow(Math.random(), 3) * 0.6);
    colors[idx] = c.r;
    colors[idx + 1] = c.g;
    colors[idx + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: true,
    sizeAttenuation: true,
  });

  return new THREE.Points(geometry, material);
}

const moon = buildMoon();
formationGroup.add(moon);

/* --- 2b. Photos: planes scattered along the same ring band --- */
function createOrbitImages() {
  const {
    urls,
    photoCount,
    planeHeight,
    bandInnerMult,
    bandOuterMult,
    bobSpeed,
    bobAmount,
  } = CONFIG.orbitImages;
  const { scale, bandInner, bandOuter } = CONFIG.formation;
  const loader = new THREE.TextureLoader();
  const meshes = [];

  // Load each unique texture once, then reuse it across many planes —
  // keeps this cheap even with a few hundred photos on screen.
  const textureCache = urls.map((url) => loader.load(url));

  const innerFrac = bandInner * bandInnerMult;
  const outerFrac = bandOuter * bandOuterMult;

  for (let i = 0; i < photoCount; i++) {
    const urlIndex = i % urls.length;
    const texture = textureCache[urlIndex];

    const geometry = new THREE.PlaneGeometry(planeHeight, planeHeight);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const t = Math.random() * Math.PI * 2;
    const frac = THREE.MathUtils.lerp(innerFrac, outerFrac, Math.random());

    mesh.userData.t = t;
    mesh.userData.frac = frac;
    mesh.userData.jitterY = (Math.random() - 0.5) * 1.1;
    mesh.userData.bobPhase = Math.random() * Math.PI * 2;
    mesh.userData.bobSpeed = bobSpeed * THREE.MathUtils.randFloat(0.7, 1.3);
    mesh.userData.bobAmount = bobAmount * THREE.MathUtils.randFloat(0.6, 1.4);
    mesh.userData.spin = THREE.MathUtils.randFloatSpread(0.5);
    mesh.userData.urlIndex = urlIndex;

    formationGroup.add(mesh);
    meshes.push(mesh);

    gsap.to(material, {
      opacity: 1,
      duration: 1,
      delay: Math.random() * 1.5,
      ease: "power1.out",
    });
  }

  // Once each texture finishes loading, correct that image's aspect ratio
  // across every plane using it (they all start as squares).
  textureCache.forEach((texture, urlIndex) => {
    const applyAspect = () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const aspect = texture.image.width / texture.image.height;
      meshes
        .filter((m) => m.userData.urlIndex === urlIndex)
        .forEach((mesh) => {
          mesh.geometry.dispose();
          mesh.geometry = new THREE.PlaneGeometry(planeHeight * aspect, planeHeight);
        });
    };
    if (texture.image) applyAspect();
    else texture.addEventListener?.("load", applyAspect);
  });

  return meshes;
}

const orbitMeshes = createOrbitImages();

/* --- 2c. Per-frame update for the whole formation --- */
function updateFormation(elapsed, dt) {
  const { scale, spinSpeed } = CONFIG.formation;
  formationGroup.rotation.y = elapsed * spinSpeed;

  // Nebula heartbeat pulse.
  const pulse =
    1 + Math.sin(elapsed * CONFIG.nebula.pulseSpeed) * CONFIG.nebula.pulseAmount;
  nebula.scale.setScalar(pulse);

  // Moon spins slowly and independently of the ring's own rotation.
  moon.rotation.y += CONFIG.moon.spinSpeed * dt;

  orbitMeshes.forEach((mesh) => {
    const { t, frac, jitterY, bobPhase, bobSpeed, bobAmount } = mesh.userData;
    const { x, y } = ringCurve(t);
    const bob = Math.sin(elapsed * bobSpeed + bobPhase) * bobAmount;

    mesh.position.set(
      x * frac * scale,
      jitterY + bob,
      y * frac * scale
    );

    if (CONFIG.orbitImages.billboard) {
      mesh.quaternion.copy(camera.quaternion);
      mesh.rotateZ(mesh.userData.spin * 0.15);
    }
  });
}

/* ------------------------------------------------------------------------
   3. STARFIELD (distant, subtle background depth)
   ------------------------------------------------------------------------ */
function buildStarfield() {
  const { count, radius, minRadius, size, color } = CONFIG.starfield;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = THREE.MathUtils.randFloat(minRadius, radius);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const idx = i * 3;
    positions[idx] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[idx + 2] = r * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size,
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new THREE.Points(geometry, material);
}

const starfield = buildStarfield();
scene.add(starfield);

/* ------------------------------------------------------------------------
   4. SHOOTING STARS
   ------------------------------------------------------------------------ */
class ShootingStar {
  constructor() {
    const { trailLength, color, headSize, haloSize } = CONFIG.shootingStars;

    this.group = new THREE.Group();

    // Soft wide halo sitting behind/around the head for a glowing look.
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTextureWhite,
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.halo.scale.set(haloSize, haloSize, 1);
    this.group.add(this.halo);

    // Bright point at the very front of the trail.
    this.head = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTextureWhite,
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.head.scale.set(headSize, headSize, 1);
    this.group.add(this.head);

    // Tapering trail of glow sprites behind the head.
    this.trailSprites = [];
    for (let i = 0; i < trailLength; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTextureWhite,
          color,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      this.group.add(sprite);
      this.trailSprites.push(sprite);
    }

    this.group.visible = false;
    scene.add(this.group);

    this.active = false;
    this.history = [];
  }

  spawn() {
    const r = 60;
    const start = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(r),
      THREE.MathUtils.randFloat(20, 50),
      THREE.MathUtils.randFloatSpread(r) - 15
    );
    this.direction = new THREE.Vector3(
      THREE.MathUtils.randFloat(-1, -0.4),
      THREE.MathUtils.randFloat(-1, -0.5),
      THREE.MathUtils.randFloat(-0.2, 0.2)
    ).normalize();

    this.position = start.clone();
    this.history = new Array(this.trailSprites.length).fill(start.clone());
    this.life = 0;
    this.maxLife = THREE.MathUtils.randFloat(1.3, 2.2);
    this.active = true;
    this.group.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    const { headSize, haloSize } = CONFIG.shootingStars;

    this.life += dt;
    this.position.addScaledVector(this.direction, CONFIG.shootingStars.speed * dt);
    this.history.pop();
    this.history.unshift(this.position.clone());

    // Fade in quickly, then fade out over the back half of its life so it
    // doesn't just vanish mid-screen.
    const fadeIn = Math.min(this.life / 0.25, 1);
    const fadeOut = 1 - Math.max(this.life / this.maxLife - 0.5, 0) * 2;
    const fade = Math.min(fadeIn, fadeOut);

    this.head.position.copy(this.position);
    this.head.material.opacity = fade;

    this.halo.position.copy(this.position);
    this.halo.material.opacity = fade * 0.45;
    this.halo.scale.set(haloSize * (0.9 + fade * 0.2), haloSize * (0.9 + fade * 0.2), 1);

    const n = this.trailSprites.length;
    for (let i = 0; i < n; i++) {
      const sprite = this.trailSprites[i];
      const p = this.history[i];
      sprite.position.copy(p);

      const t = 1 - i / (n - 1); // 1 near the head, 0 at the tail end
      const size = THREE.MathUtils.lerp(0.08, headSize * 0.85, t);
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = t * t * fade * 0.8;
    }

    if (this.life >= this.maxLife) {
      this.active = false;
      this.group.visible = false;
    }
  }
}

const shootingStarPool = Array.from(
  { length: CONFIG.shootingStars.maxActive },
  () => new ShootingStar()
);
let nextSpawnTimer = THREE.MathUtils.randFloat(...CONFIG.shootingStars.spawnIntervalRange);

function updateShootingStars(dt) {
  nextSpawnTimer -= dt;
  if (nextSpawnTimer <= 0) {
    const idle = shootingStarPool.find((s) => !s.active);
    if (idle) idle.spawn();
    nextSpawnTimer = THREE.MathUtils.randFloat(...CONFIG.shootingStars.spawnIntervalRange);
  }
  shootingStarPool.forEach((s) => s.update(dt));
}

/* ------------------------------------------------------------------------
   5. BOKEH — soft translucent purple circles scattered through the scene
   ------------------------------------------------------------------------ */
function buildBokeh() {
  const { count, minSize, maxSize, color, spreadRadius, minRadius } = CONFIG.bokeh;
  const texture = glowTexturePurple;
  const group = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: THREE.MathUtils.randFloat(0.15, 0.55),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);

    const r = THREE.MathUtils.randFloat(minRadius, spreadRadius);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    sprite.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.6,
      r * Math.cos(phi)
    );

    const s = THREE.MathUtils.randFloat(minSize, maxSize);
    sprite.scale.set(s, s, 1);

    group.add(sprite);
  }

  return group;
}

const bokeh = buildBokeh();
scene.add(bokeh);

/* ------------------------------------------------------------------------
   6. CONTROLS (drag to rotate, wheel/pinch to zoom, with damping)
   ------------------------------------------------------------------------ */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 60;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.target.set(0, 0, 0);
controls.enabled = false; // turned on after the intro finishes

/* ------------------------------------------------------------------------
   7. INTRO CAMERA FLY-THROUGH
   ------------------------------------------------------------------------ */
function playIntro() {
  const path = { t: 0 };
  const startRadius = 46;
  const endRadius = CONFIG.camera.restRadius;
  const restPolar = THREE.MathUtils.degToRad(CONFIG.camera.restPolarDeg);

  gsap.to(path, {
    t: 1,
    duration: CONFIG.camera.introDuration,
    ease: "power2.inOut",
    onUpdate: () => {
      const azimuth = path.t * Math.PI * 3;
      const polar = THREE.MathUtils.lerp(
        THREE.MathUtils.degToRad(35),
        restPolar,
        path.t
      );
      const radius = THREE.MathUtils.lerp(startRadius, endRadius, path.t);

      camera.position.setFromSphericalCoords(radius, polar, azimuth);
      camera.lookAt(0, 0, 0);
    },
    onComplete: () => {
      controls.target.set(0, 0, 0);
      controls.update();
      controls.enabled = true;
      document.getElementById("hint").classList.remove("hidden");
      setTimeout(() => {
        document.getElementById("hint").classList.add("hidden");
      }, 4500);
    },
  });
}

/* ------------------------------------------------------------------------
   8. AUDIO — autoplay-safe background music with a mute toggle
   ------------------------------------------------------------------------ */
const audioEl = document.getElementById("bg-audio");
audioEl.volume = 0.55;
audioEl.muted = CONFIG.audio.startMuted;

const soundToggle = document.getElementById("sound-toggle");
const iconOn = document.getElementById("icon-on");
const iconOff = document.getElementById("icon-off");

function setMuted(muted) {
  audioEl.muted = muted;
  iconOn.style.display = muted ? "none" : "block";
  iconOff.style.display = muted ? "block" : "none";
}
setMuted(CONFIG.audio.startMuted);

let hasStartedAudio = false;
function tryStartAudio() {
  if (hasStartedAudio) return;
  hasStartedAudio = true;
  audioEl.play().catch(() => {
    hasStartedAudio = false;
  });
}

["pointerdown", "touchstart", "click"].forEach((evt) => {
  window.addEventListener(evt, tryStartAudio, { once: true, passive: true });
});

soundToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  tryStartAudio();
  setMuted(!audioEl.muted);
});

/* ------------------------------------------------------------------------
   9. RESIZE HANDLING
   ------------------------------------------------------------------------ */
function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
}
window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", () => setTimeout(handleResize, 200));

/* ------------------------------------------------------------------------
   10. RENDER LOOP
   ------------------------------------------------------------------------ */
const clock = new THREE.Clock();
let rafId = null;

function animate() {
  rafId = requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  starfield.rotation.y += 0.002 * dt;

  updateShootingStars(dt);
  updateFormation(elapsed, dt);

  if (controls.enabled) controls.update();

  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------------
   11. CLEANUP
   ------------------------------------------------------------------------ */
function disposeScene() {
  cancelAnimationFrame(rafId);
  window.removeEventListener("resize", handleResize);
  controls.dispose();

  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });

  renderer.dispose();
  audioEl.pause();
}
window.addEventListener("beforeunload", disposeScene);

/* ------------------------------------------------------------------------
   12. BOOT
   ------------------------------------------------------------------------ */
handleResize();
animate();
playIntro();
