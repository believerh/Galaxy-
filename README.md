# Orbiting Ring

A hollow, circular ring formation — glowing particle nebula + orbiting
photo planes, both traced along the same circle with a dark hollow center
(accretion-disk style) — set inside a starfield with periodic shooting
stars and soft purple bokeh circles. Cinematic camera intro, then
drag/pinch controls, plus autoplay-safe background music.

## Files

```
index.html   HTML boilerplate, audio element, sound-toggle button, imports
style.css    Fullscreen canvas + floating UI styling
main.js      All scene logic (formation, stars, bokeh, camera, audio, resize)
audio/       Put your background track here as theme.mp3 (or edit the <source> path)
```

No build step — plain ES modules loaded via an import map from a CDN
(three.js r160 + GSAP). Serve the folder over http(s); browsers block ES
module imports from `file://`.

```bash
npx serve .
# or
python3 -m http.server
```

## How the ring + moon work

Both the particle nebula and the photo planes sample points from a
circle (`ringCurve` in main.js). Instead of filling the disc all the way
in, each point is pushed outward from the center by a random fraction
between `formation.bandInner` and `formation.bandOuter` — so everything
clusters in a band that traces the circle's outline. The whole formation
is tilted (`formation.tiltX/tiltZ`) and viewed from a near-equatorial
camera angle so it reads as an oblique ellipse, exactly like the
screenshots.

Rather than leaving that inner gap empty, a **moon** — a solid-looking
particle sphere (`buildMoon` in main.js) — fills most of it, spinning
slowly on its own independent of the ring's rotation. It's sized as a
fraction of the ring's inner radius (`moon.radiusMult`) so there's a
thin dark gap between the moon's edge and the start of the bright band,
matching the reference.

## Swapping in your own images

Edit `CONFIG.orbitImages.urls` — the ring reuses this list across
`photoCount` planes (420 by default) to get the dense, reference-style
swarm, so a handful of URLs is enough. Photos fray slightly wider than the
nebula band (`bandInnerMult`/`bandOuterMult`).

## Adding your own music

Drop an mp3 at `audio/theme.mp3`, or change the `<source src="...">` in
`index.html`. Playback starts on the user's first tap/click (browser
autoplay policy); the corner button toggles mute.

## Key tunables (all in `CONFIG` at the top of main.js)

| Section | What it controls |
|---|---|
| `formation.scale` | overall size of the ring |
| `formation.bandInner/bandOuter` | how thick the ring band is / how big the hollow center is |
| `formation.tiltX/tiltZ` | viewing tilt of the whole ring |
| `formation.spinSpeed` | how fast the whole formation rotates as one piece |
| `nebula.particleCount` | density of the glowing particle ring |
| `nebula.pulseAmount/pulseSpeed` | breathing/pulse animation |
| `moon.particleCount` | density of the moon's particle surface |
| `moon.radiusMult` | how much of the ring's hollow center the moon fills |
| `moon.spinSpeed` | the moon's own independent rotation speed |
| `orbitImages.photoCount` | how many photo planes populate the ring |
| `orbitImages.bandInnerMult/bandOuterMult` | how much wider the photo scatter is than the nebula band |
| `starfield.count/radius` | background star density and spread |
| `shootingStars.spawnIntervalRange/speed` | how often & how fast shooting stars cross the sky |
| `shootingStars.trailLength/headSize/haloSize` | length and glow size of each shooting star's comet trail |
| `bokeh.count/minSize/maxSize` | density and size of the background glow circles |
| `camera.introDuration` | length of the opening fly-through, seconds |
| `camera.restRadius/restPolarDeg` | resting camera distance/angle once the user has control |

## Performance notes

- The nebula and starfield are each a single `THREE.Points` draw call —
  cheap regardless of particle count.
- Photo planes reuse a small pool of loaded textures across hundreds of
  meshes rather than loading each one individually.
- `devicePixelRatio` is capped at 2 to protect frame rate on high-DPI phones.
- `disposeScene()` at the bottom of `main.js` tears everything down —
  call it if this is ever mounted/unmounted inside a larger app.
