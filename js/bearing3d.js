const THREE_URL = 'https://esm.sh/three@0.160.1';
const ROOM_URL = 'https://esm.sh/three@0.160.1/examples/jsm/environments/RoomEnvironment.js';
const EXPO = t => 1 - Math.pow(2, -10 * t);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

const LABELS = [
  { key: 'outer', text: 'Outer race', side: 'right' },
  { key: 'ball', text: 'Ball element', side: 'left' },
  { key: 'cage', text: 'Cage', side: 'right' },
  { key: 'inner', text: 'Inner race', side: 'left' },
];

/* Resolve Three.js once and cache it. Returns null when the CDN is blocked,
   offline or otherwise unreachable, which lets callers keep the static
   fallback markup instead of pinning a section around an empty canvas. */
let _three = null;
export async function ensureThree() {
  if (_three) return _three;
  try {
    const c = document.createElement('canvas');
    if (!(c.getContext('webgl2') || c.getContext('webgl'))) return null;
  } catch (e) { return null; }
  try {
    const [THREE, roomMod] = await Promise.all([import(THREE_URL), import(ROOM_URL)]);
    _three = { THREE, roomMod };
    return _three;
  } catch (e) {
    return null;
  }
}

function cssFallback(container) {
  container.style.perspective = '1000px';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform-style:preserve-3d;animation:bslspin3d 18s linear infinite';
  const ring = (size, color, w, z) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;width:' + size + 'px;height:' + size + 'px;border:' + w + 'px solid ' + color + ';border-radius:50%;transform:translateZ(' + z + 'px)';
    return d;
  };
  stage.appendChild(ring(300, '#8FA8BC', 18, 0));
  stage.appendChild(ring(230, 'rgba(143,168,188,.6)', 3, 20));
  stage.appendChild(ring(150, '#8FA8BC', 16, 40));
  for (let i = 0; i < 8; i++) {
    const b = document.createElement('div');
    const a = (i / 8) * Math.PI * 2;
    b.style.cssText = 'position:absolute;width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff,#8FA8BC 55%,#405a72);transform:translate3d(' + (Math.cos(a) * 115) + 'px,' + (Math.sin(a) * 115) + 'px,25px)';
    stage.appendChild(b);
  }
  container.appendChild(stage);
  return { setProgress() {}, dispose() {}, fallback: true };
}

export async function createBearing(container, opts = {}) {
  const scrub = !!opts.scrub;
  /* The callout overlay is positioned against this element, so it has to be a
     containing block. Only promote it when it is genuinely static: writing an
     inline position unconditionally would beat the stylesheet, and the pinned
     scrub stage positions this host absolutely to fill the viewport. Losing
     that left the canvas at its default 2:1 aspect instead of full-bleed. */
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const loaded = await ensureThree();
  if (!loaded) return cssFallback(container); // no WebGL, offline or CDN blocked
  const { THREE, roomMod } = loaded;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, scrub ? 15 : 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  // A phone runs both bearings on the home page and often reports a ratio of 3.
  // Capping lower there keeps the pixel count sane without a visible drop.
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new roomMod.RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0x9ab4c8, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(5, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xC30001, 1.1); rim.position.set(-6, -3, -4); scene.add(rim);

  const steel = new THREE.MeshStandardMaterial({ color: 0xb8c6d2, metalness: 1, roughness: 0.22 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x8FA8BC, metalness: 1, roughness: 0.34 });
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ef, metalness: 1, roughness: 0.08 });

  const group = new THREE.Group();
  scene.add(group);

  const outer = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.42, 32, 128), steel);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.38, 32, 128), steel);
  const cage = new THREE.Group();
  const cageRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.1, 16, 128), steelDark);
  cage.add(cageRing);
  const balls = new THREE.Group();
  const ballMeshes = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 32), ballMat);
    m.userData.angle = a;
    m.position.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0);
    ballMeshes.push(m); balls.add(m);
    const post = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 12, 40), steelDark);
    post.position.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0);
    cage.add(post);
  }
  group.add(outer, inner, cage, balls);

  // callout overlay
  let overlay = null, svg = null, lines = {}, labelEls = {};
  if (scrub) {
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s ease';
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible');
    overlay.appendChild(svg);
    LABELS.forEach(l => {
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      ln.setAttribute('fill', 'none'); ln.setAttribute('stroke', '#C30001'); ln.setAttribute('stroke-width', '1.5');
      svg.appendChild(ln); lines[l.key] = ln;
      const el = document.createElement('div');
      el.className = 'scrub3d-callout';   // styled in css/style.css, incl. narrow screens
      el.textContent = l.text;
      overlay.appendChild(el); labelEls[l.key] = el;
    });
    container.appendChild(overlay);
  }

  /* Radius the exploded assembly needs in view, in world units: the ball ring
     at full separation plus a margin. Chosen so a landscape viewport still
     resolves to the original distance of 15 and desktop framing is unchanged. */
  const FIT = 4.7;

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // The hero keeps its width-based field of view. The scrub holds one field
    // of view everywhere and moves the camera instead, so the bearing has the
    // same perspective on a phone as on a desktop rather than a wider, more
    // distorted one.
    camera.fov = scrub ? 35 : (w < 700 ? 46 : 35);
    camera.updateProjectionMatrix();
    if (scrub) {
      /* Frame against whichever axis is tighter. A phone hands this canvas a
         roughly square band and a desktop hands it a wide one; fitting the
         narrow axis keeps the bearing whole on both instead of cropping it
         where there is no room. */
      const t = Math.tan(camera.fov * Math.PI / 360);
      camera.position.z = Math.max(15, Math.min(32, FIT / Math.min(t, t * camera.aspect)));
    }
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(container);

  /* Each bearing drives its own animation frame loop, and the home page has
     two. Keep the state updating but skip the draw while the canvas is off
     screen, which is most of the time on a phone. */
  let onScreen = true;
  const vo = new IntersectionObserver(entries => {
    entries.forEach(en => { onScreen = en.isIntersecting; });
  }, { rootMargin: '120px' });
  vo.observe(container);

  // pointer tilt
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  const allowTilt = !scrub && !reduced() && !isMobile();
  if (allowTilt) {
    addEventListener('pointermove', e => {
      const r = container.getBoundingClientRect();
      tilt.tx = ((e.clientY - (r.top + r.height / 2)) / innerHeight) * 0.42;
      tilt.ty = ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 0.42;
    }, { passive: true });
  }

  let progress = 0, target = 0;
  const t0 = performance.now();
  const v = new THREE.Vector3();

  function project(obj) {
    obj.getWorldPosition(v); v.project(camera);
    return { x: (v.x * .5 + .5) * container.clientWidth, y: (-v.y * .5 + .5) * container.clientHeight };
  }

  function applyScrub(p) {
    const phase1 = Math.min(1, p / 0.25);
    const ex = Math.max(0, Math.min(1, (p - 0.25) / 0.35));
    const back = Math.max(0, Math.min(1, (p - 0.6) / 0.4));
    const angle = phase1 * (1 - back);
    group.rotation.x = -0.55 * angle;
    group.rotation.y = 0.62 * angle;
    const e = ex * (1 - back);
    const s = e * (isMobile() ? 0.7 : 1);
    outer.position.y = 2.1 * s;
    inner.position.y = -2.1 * s;
    cage.position.z = -1.6 * s;
    ballMeshes.forEach(m => {
      const a = m.userData.angle;
      const r = 2.4 + 1.5 * s;
      m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    });
    if (overlay) {
      overlay.style.opacity = e > 0.12 ? '1' : '0';
      if (e > 0.12) {
        const W = container.clientWidth, H = container.clientHeight;
        // Leader geometry scales with the canvas. The desktop numbers would
        // run a label clean off a 375px screen, or leave its leader crossing
        // the whole bearing.
        const narrow = W < 560;
        const edge = narrow ? 8 : 12;    // gap from the canvas edge
        const tail = narrow ? 52 : 108;  // horizontal run into the label
        const step = narrow ? 26 : 60;   // how far the leader steps off the part
        const keep = narrow ? 74 : 130;  // keep the elbow clear of the label
        const map = { outer, inner, cage: cageRing, ball: ballMeshes[1] };
        LABELS.forEach((l, i) => {
          const pt = project(map[l.key]);
          const right = l.side === 'right';
          const lx = right ? W - edge : edge;
          // The ladder is kept inside the band between the status caption and
          // the copy block. It used to run to 0.82 of the height, which sat on
          // the heading once the canvas correctly filled the pinned stage. A
          // short canvas, meaning a phone held sideways, compresses it further:
          // there the copy still overlays the canvas and starts much higher up.
          const ly = H * (0.15 + i * (H < 480 ? 0.1 : 0.18));
          const mid = right ? Math.min(W - keep, pt.x + step) : Math.max(keep, pt.x - step);
          lines[l.key].setAttribute('points', pt.x + ',' + pt.y + ' ' + mid + ',' + ly + ' ' + (right ? lx - tail : lx + tail) + ',' + ly);
          labelEls[l.key].style.left = right ? 'auto' : lx + 'px';
          labelEls[l.key].style.right = right ? (W - lx) + 'px' : 'auto';
          labelEls[l.key].style.top = ly + 'px';
        });
      }
    }
  }

  let raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (scrub) {
      progress += (target - progress) * 0.12;
      applyScrub(progress);
    } else {
      const t = Math.min(1, (now - t0) / 1500);
      const e = reduced() ? 1 : EXPO(t);
      const introX = -0.85 * (1 - e), introY = 0.9 * (1 - e);
      const sc = 0.85 + 0.15 * e;
      group.scale.setScalar(sc);
      tilt.x += (tilt.tx - tilt.x) * 0.06;
      tilt.y += (tilt.ty - tilt.y) * 0.06;
      group.rotation.x = introX + tilt.x;
      group.rotation.y = introY + tilt.y;
      if (!reduced()) group.rotation.z += 0.0022;
    }
    if (onScreen) renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    fallback: false,
    setProgress(p) { target = Math.max(0, Math.min(1, p)); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); vo.disconnect(); renderer.dispose(); },
  };
}
