# Orbiting Heart

A 3D particle heart core with photo planes orbiting it, a starfield with
periodic shooting stars, a cinematic camera intro, drag/pinch controls, and
autoplay-safe background music.

## Files

```
index.html   HTML boilerplate, audio element, sound-toggle button, imports
style.css    Fullscreen canvas + floating UI styling
main.js      All scene logic (heart, stars, orbits, camera, audio, resize)
audio/       Put your background track here as theme.mp3 (or edit the <source> path)
```

No build step — it's plain ES modules loaded via an import map from a CDN
(three.js r160 + GSAP). Just serve the folder over http(s); browsers block
ES module imports from `file://`.

```bash
# any static server works, e.g.:
npx serve .
# or
python3 -m http.server
```

## Swapping in your own images

Edit `CONFIG.orbitImages.urls` near the top of `main.js` — it's a flat array
of image URLs. Any aspect ratio works; each plane resizes to match its
image once loaded. Add/remove entries freely; orbit radius/speed/tilt are
auto-distributed and randomized per image.

## Adding your own music

Drop an mp3 at `audio/theme.mp3`, or change the `<source src="...">` in
`index.html` to point anywhere else. Playback starts on the user's first
tap/click (browser autoplay policy), and the corner button toggles mute.

## Key tunables (all in `CONFIG` at the top of main.js)

| Section | What it controls |
|---|---|
| `heart.particleCount` | density of the heart's particle shell |
| `heart.scale` / `pulseAmount` / `pulseSpeed` | heart size and heartbeat animation |
| `starfield.count` / `radius` | background star density and spread |
| `shootingStars.spawnIntervalRange` / `speed` | how often & how fast shooting stars cross the sky |
| `orbitImages.minRadius/maxRadius` | how close/far the orbit rings sit from the heart |
| `orbitImages.minSpeed/maxSpeed` | orbit speed range |
| `orbitImages.maxTilt` | how steeply orbital planes can tilt (planetary look) |
| `camera.introDuration` | length of the opening fly-through, seconds |
| `camera.restRadius` / `restPolarDeg` | resting camera distance/angle once the user has control |

## Notes on the heart math

The core uses the classic parametric heart curve:

```
x(t) = 16 sin³(t)
y(t) = 13 cos(t) − 5 cos(2t) − 2 cos(3t) − cos(4t)
```

Each particle samples a random `t`, is pulled toward the center by a random
`fill` factor (so the heart reads as a filled volume, not just an outline),
then gets a bit of jitter and z-depth (`heart.shellJitter`) to look like a
soft 3D particle cloud instead of a flat curve.

## Performance notes

- Particle systems (heart + starfield) use `THREE.Points` with a single
  draw call each — cheap regardless of count.
- Orbiting images are `MeshBasicMaterial` planes (unlit) with additive-free
  blending, texture-loaded once and reused every frame.
- `devicePixelRatio` is capped at 2 to avoid killing frame rate on high-DPI
  phones.
- `disposeScene()` at the bottom of `main.js` tears down geometries,
  materials, textures, the renderer, and listeners — call it if you ever
  mount/unmount this inside a larger app (e.g. an SPA route change).
# Galaxy-
