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
  return { setProgress() {}, dispose() {} };
}

export async function createBearing(container, opts = {}) {
  const scrub = !!opts.scrub;
  container.style.position = container.style.position || 'relative';

  let gl = null;
  try {
    const c = document.createElement('canvas');
    gl = c.getContext('webgl2') || c.getContext('webgl');
  } catch (e) { gl = null; }
  if (!gl) return cssFallback(container);

  let THREE, roomMod;
  try {
    [THREE, roomMod] = await Promise.all([import(THREE_URL), import(ROOM_URL)]);
  } catch (e) {
    return cssFallback(container); // offline / CDN blocked
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, scrub ? 15 : 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new roomMod.RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0x9ab4c8, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(5, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xEF4A23, 1.1); rim.position.set(-6, -3, -4); scene.add(rim);

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
      ln.setAttribute('fill', 'none'); ln.setAttribute('stroke', '#EF4A23'); ln.setAttribute('stroke-width', '1.5');
      svg.appendChild(ln); lines[l.key] = ln;
      const el = document.createElement('div');
      el.textContent = l.text;
      el.style.cssText = "position:absolute;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#fff;white-space:nowrap;transform:translateY(-50%);padding-bottom:6px;border-bottom:1px solid #EF4A23";
      overlay.appendChild(el); labelEls[l.key] = el;
    });
    container.appendChild(overlay);
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 46 : 35;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(container);

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
        const map = { outer, inner, cage: cageRing, ball: ballMeshes[1] };
        LABELS.forEach((l, i) => {
          const pt = project(map[l.key]);
          const right = l.side === 'right';
          const lx = right ? W - 12 : 12;
          const ly = H * (0.16 + i * 0.22);
          const mid = right ? Math.min(W - 130, pt.x + 60) : Math.max(130, pt.x - 60);
          lines[l.key].setAttribute('points', pt.x + ',' + pt.y + ' ' + mid + ',' + ly + ' ' + (right ? lx - 108 : lx + 108) + ',' + ly);
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
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p) { target = Math.max(0, Math.min(1, p)); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
  };
}
