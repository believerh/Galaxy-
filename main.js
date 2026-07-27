/* =========================================================================
   ORBITING HEART — main.js
   A particle-built heart core, orbited by floating photo planes, set inside
   a starfield with periodic shooting stars. Camera does a cinematic intro
   fly-through, then hands control to the user (drag = rotate, wheel/pinch =
   zoom). Music autoplays on first interaction with a mute toggle.

   Everything you're likely to want to tweak is grouped in CONFIG below.
   ========================================================================= */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";

/* ------------------------------------------------------------------------
   0. CONFIG — tune the look & feel here without touching the logic below
   ------------------------------------------------------------------------ */
const CONFIG = {
  heart: {
    particleCount: 9000,      // more = denser heart, costs more GPU/CPU
    scale: 1.35,               // overall size of the heart
    shellJitter: 0.55,         // how "fluffy"/volumetric the shell looks
    color: 0xb79cff,           // base particle color (soft violet)
    coreColor: 0xffffff,       // hot core color mixed in near center
    size: 0.045,               // point sprite size
    pulseSpeed: 1.1,           // heartbeat animation speed
    pulseAmount: 0.06,         // how much it grows/shrinks (fraction of scale)
    rotationSpeed: 0.06,       // slow idle spin, radians/sec
  },

  starfield: {
    count: 3200,
    radius: 60,                // spawn stars within this radius shell
    minRadius: 18,              // ...but no closer than this
    size: 0.09,
    color: 0xffffff,
  },

  shootingStars: {
    maxActive: 3,               // how many can be on-screen at once
    spawnIntervalRange: [1.2, 3.5], // seconds between spawns (min, max)
    speed: 26,                  // units/sec
    trailLength: 9,
    color: 0xffffff,
  },

  orbitImages: {
    // Swap these with your own image URLs (any aspect ratio works —
    // planes are sized from each texture's natural width/height).
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
    planeHeight: 1.9,           // base plane height in world units (width follows aspect)
    minRadius: 3.4,             // closest orbit ring to the heart
    maxRadius: 8.5,             // furthest orbit ring
    minSpeed: 0.035,             // slowest orbit angular speed (rad/sec)
    maxSpeed: 0.11,              // fastest orbit angular speed
    maxTilt: 0.9,                // max orbital-plane tilt, radians (~51deg)
    billboard: true,             // true = always face camera; false = face orbit direction
  },

  camera: {
    fov: 55,
    near: 0.1,
    far: 200,
    restRadius: 11,             // distance from heart once user has control
    restPolarDeg: 68,           // resting vertical angle (90 = equator)
    introDuration: 6.5,          // seconds for the intro fly-through
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap DPR for perf
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  CONFIG.camera.near,
  CONFIG.camera.far
);
// Start the camera off-axis for the intro sweep.
camera.position.set(0, 4, 22);

/* ------------------------------------------------------------------------
   2. HEART PARTICLE SYSTEM
   Built from the classic parametric heart curve, extruded into a soft
   volumetric shell (each particle gets a randomized inward offset and a
   little z-depth so it reads as a 3D blob, not a flat outline).
   ------------------------------------------------------------------------ */
function heartCurve(t) {
  // Classic parametric heart. t in [0, 2*PI].
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);
  return { x: x / 16, y: y / 16 }; // normalize to roughly [-1, 1]
}

function buildHeart() {
  const { particleCount, scale, shellJitter, color, coreColor, size } =
    CONFIG.heart;

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const baseColor = new THREE.Color(color);
  const hotColor = new THREE.Color(coreColor);

  for (let i = 0; i < particleCount; i++) {
    const t = Math.random() * Math.PI * 2;
    const { x, y } = heartCurve(t);

    // Pull each point inward by a random amount so the heart fills in
    // as a volume rather than sitting only on the outline.
    const fill = Math.pow(Math.random(), 0.5); // bias toward the edge slightly
    let px = x * fill;
    let py = y * fill;

    // Add soft jitter for a fluffy/particle-cloud edge, plus depth on z.
    px += (Math.random() - 0.5) * shellJitter * 0.15;
    py += (Math.random() - 0.5) * shellJitter * 0.15;
    const pz = (Math.random() - 0.5) * shellJitter;

    const idx = i * 3;
    positions[idx] = px * scale;
    positions[idx + 1] = py * scale;
    positions[idx + 2] = pz * scale;

    // Blend toward the hot core color near the center for a glowing heart.
    const distFromCenter = Math.sqrt(px * px + py * py);
    const mixT = THREE.MathUtils.clamp(1 - distFromCenter, 0, 1);
    const c = baseColor.clone().lerp(hotColor, mixT * 0.5);
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
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  // Heart curve's "up" is +y with the curve as authored; flip so the point
  // of the heart faces down naturally.
  points.rotation.z = Math.PI;
  return points;
}

const heart = buildHeart();
scene.add(heart);

// Soft point light near the core to add a subtle glow tint to nearby objects.
const coreLight = new THREE.PointLight(0xb79cff, 2.2, 15, 2);
coreLight.position.set(0, 0, 0);
scene.add(coreLight);

/* ------------------------------------------------------------------------
   3. STARFIELD (distant, subtle background depth)
   ------------------------------------------------------------------------ */
function buildStarfield() {
  const { count, radius, minRadius, size, color } = CONFIG.starfield;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Random point in a spherical shell so stars don't clump at center.
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
   Each one is a small glowing head with a fading trail, spawned at a
   random position/direction just outside view and animated across the sky.
   Pooled/recycled rather than recreated to stay cheap.
   ------------------------------------------------------------------------ */
class ShootingStar {
  constructor() {
    const { trailLength, color } = CONFIG.shootingStars;

    const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const headMat = new THREE.MeshBasicMaterial({ color });
    this.head = new THREE.Mesh(headGeo, headMat);

    // Trail is a thin line stretching behind the head, faded via vertex alpha.
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(trailLength * 3);
    trailGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(trailPositions, 3)
    );
    const trailMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
    });
    this.trail = new THREE.Line(trailGeo, trailMat);

    this.group = new THREE.Group();
    this.group.add(this.head);
    this.group.add(this.trail);
    this.group.visible = false;
    scene.add(this.group);

    this.active = false;
    this.history = [];
  }

  spawn() {
    const r = 40;
    const start = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(r),
      THREE.MathUtils.randFloat(10, 30),
      THREE.MathUtils.randFloatSpread(r) - 10
    );
    this.direction = new THREE.Vector3(
      THREE.MathUtils.randFloat(-1, -0.4),
      THREE.MathUtils.randFloat(-1, -0.5),
      THREE.MathUtils.randFloat(-0.2, 0.2)
    ).normalize();

    this.position = start.clone();
    this.history = new Array(CONFIG.shootingStars.trailLength).fill(
      start.clone()
    );
    this.life = 0;
    this.maxLife = THREE.MathUtils.randFloat(1.4, 2.4);
    this.active = true;
    this.group.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.life += dt;
    this.position.addScaledVector(this.direction, CONFIG.shootingStars.speed * dt);
    this.history.pop();
    this.history.unshift(this.position.clone());

    this.head.position.copy(this.position);

    const posAttr = this.trail.geometry.attributes.position;
    for (let i = 0; i < this.history.length; i++) {
      const p = this.history[i];
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
    posAttr.needsUpdate = true;

    const fade = 1 - this.life / this.maxLife;
    this.head.material.opacity = fade;
    this.trail.material.opacity = 0.5 * fade;

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
let nextSpawnTimer = THREE.MathUtils.randFloat(
  ...CONFIG.shootingStars.spawnIntervalRange
);

function updateShootingStars(dt) {
  nextSpawnTimer -= dt;
  if (nextSpawnTimer <= 0) {
    const idle = shootingStarPool.find((s) => !s.active);
    if (idle) idle.spawn();
    nextSpawnTimer = THREE.MathUtils.randFloat(
      ...CONFIG.shootingStars.spawnIntervalRange
    );
  }
  shootingStarPool.forEach((s) => s.update(dt));
}

/* ------------------------------------------------------------------------
   5. ORBITING IMAGE PLANES
   Each photo orbits the heart on its own randomized ring/speed/tilt and
   billboards to face the camera every frame.
   ------------------------------------------------------------------------ */
const orbitGroup = new THREE.Group();
scene.add(orbitGroup);

function createOrbitImages() {
  const { urls, planeHeight, minRadius, maxRadius, minSpeed, maxSpeed, maxTilt } =
    CONFIG.orbitImages;
  const loader = new THREE.TextureLoader();
  const meshes = [];

  urls.forEach((url, i) => {
    // Placeholder plane until the texture loads, sized as a square; it's
    // resized to the image's real aspect ratio once loaded.
    const geometry = new THREE.PlaneGeometry(planeHeight, planeHeight);
    const material = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);

    // Orbit parameters — randomized per image for a natural spread.
    mesh.userData.orbitRadius = THREE.MathUtils.lerp(
      minRadius,
      maxRadius,
      i / Math.max(urls.length - 1, 1)
    ) + THREE.MathUtils.randFloatSpread(0.6);
    mesh.userData.orbitSpeed =
      THREE.MathUtils.randFloat(minSpeed, maxSpeed) *
      (Math.random() < 0.5 ? 1 : -1); // mixed direction
    mesh.userData.orbitAngle = Math.random() * Math.PI * 2;
    mesh.userData.tiltX = THREE.MathUtils.randFloatSpread(maxTilt);
    mesh.userData.tiltZ = THREE.MathUtils.randFloatSpread(maxTilt * 0.4);
    mesh.userData.bobSpeed = THREE.MathUtils.randFloat(0.4, 1.1);
    mesh.userData.bobAmount = THREE.MathUtils.randFloat(0.15, 0.45);
    mesh.userData.bobPhase = Math.random() * Math.PI * 2;

    orbitGroup.add(mesh);
    meshes.push(mesh);

    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const aspect = texture.image.width / texture.image.height;
        mesh.geometry.dispose();
        mesh.geometry = new THREE.PlaneGeometry(
          planeHeight * aspect,
          planeHeight
        );
        mesh.material.map = texture;
        mesh.material.color.set(0xffffff);
        gsap.to(mesh.material, { opacity: 1, duration: 0.8, ease: "power1.out" });
      },
      undefined,
      () => {
        // On error, just leave the placeholder subtly visible instead of blank.
        gsap.to(mesh.material, { opacity: 0.25, duration: 0.5 });
      }
    );
  });

  return meshes;
}

const orbitMeshes = createOrbitImages();

function updateOrbitImages(elapsed) {
  orbitMeshes.forEach((mesh) => {
    const {
      orbitRadius,
      orbitSpeed,
      orbitAngle: baseAngle,
      tiltX,
      tiltZ,
      bobSpeed,
      bobAmount,
      bobPhase,
    } = mesh.userData;

    const angle = baseAngle + elapsed * orbitSpeed;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = Math.sin(elapsed * bobSpeed + bobPhase) * bobAmount;

    // Apply orbital-plane tilt by rotating the (x, y, z) point around
    // the origin on the X and Z axes.
    const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;

    const cosZ = Math.cos(tiltZ), sinZ = Math.sin(tiltZ);
    const x2 = x * cosZ - y1 * sinZ;
    const y2 = x * sinZ + y1 * cosZ;

    mesh.position.set(x2, y2, z1);

    if (CONFIG.orbitImages.billboard) {
      mesh.quaternion.copy(camera.quaternion);
    }
  });
}

/* ------------------------------------------------------------------------
   6. CONTROLS (drag to rotate, wheel/pinch to zoom, with damping)
   Disabled during the intro fly-through, enabled once it completes.
   ------------------------------------------------------------------------ */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 4.5;
controls.maxDistance = 30;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.target.set(0, 0, 0);
controls.enabled = false; // turned on after the intro finishes

/* ------------------------------------------------------------------------
   7. INTRO CAMERA FLY-THROUGH
   A smooth sweep around the heart from an angled offset, using GSAP to
   interpolate a spherical path, then handing off to OrbitControls.
   ------------------------------------------------------------------------ */
function playIntro() {
  const path = { t: 0 };
  const startRadius = 22;
  const endRadius = CONFIG.camera.restRadius;
  const restPolar = THREE.MathUtils.degToRad(CONFIG.camera.restPolarDeg);

  gsap.to(path, {
    t: 1,
    duration: CONFIG.camera.introDuration,
    ease: "power2.inOut",
    onUpdate: () => {
      // Spiral inward while sweeping azimuth ~1.5 turns and easing the
      // polar angle down to the resting viewing angle.
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
   Browsers block audio before user interaction, so playback is attempted
   on the first pointerdown/click/touch on the canvas.
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
    // Autoplay was blocked; the user can still tap the sound toggle.
    hasStartedAudio = false;
  });
}

// First interaction anywhere on the canvas kicks off playback.
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
// Handle mobile browser UI show/hide (address bar) which fires orientationchange.
window.addEventListener("orientationchange", () =>
  setTimeout(handleResize, 200)
);

/* ------------------------------------------------------------------------
   10. RENDER LOOP
   ------------------------------------------------------------------------ */
const clock = new THREE.Clock();
let rafId = null;

function animate() {
  rafId = requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05); // clamp to avoid big jumps on tab-switch
  const elapsed = clock.getElapsedTime();

  // Heart: gentle pulse + slow idle rotation.
  const pulse =
    1 + Math.sin(elapsed * CONFIG.heart.pulseSpeed) * CONFIG.heart.pulseAmount;
  heart.scale.setScalar(pulse);
  heart.rotation.y += CONFIG.heart.rotationSpeed * dt;

  // Slow starfield drift for subtle parallax life.
  starfield.rotation.y += 0.002 * dt;

  updateShootingStars(dt);
  updateOrbitImages(elapsed);

  if (controls.enabled) controls.update();

  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------------
   11. CLEANUP
   Call disposeScene() if this app is ever torn down (e.g. removed from a
   SPA route) to free GPU memory and detach listeners.
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
