// Renderer, sky, lighting, day/night, asset loading.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- sky dome (procedural gradient, sun disc, stars) ----------
const skyUniforms = {
  topColor:    { value: new THREE.Color(0x3a7bd5) },
  midColor:    { value: new THREE.Color(0xa8c8e8) },
  botColor:    { value: new THREE.Color(0xf4e3c0) },
  sunDir:      { value: new THREE.Vector3(0.4, 0.6, 0.2) },
  sunColor:    { value: new THREE.Color(0xfff2cc) },
  starAmt:     { value: 0.0 },
  moonAmt:     { value: 0.0 },
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: skyUniforms,
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
  fragmentShader: `
    varying vec3 vDir;
    uniform vec3 topColor, midColor, botColor, sunDir, sunColor;
    uniform float starAmt, moonAmt;
    float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
    void main(){
      float h = clamp(vDir.y, -1.0, 1.0);
      vec3 col = h > 0.15 ? mix(midColor, topColor, smoothstep(0.15,0.75,h))
                          : mix(botColor, midColor, smoothstep(-0.1,0.15,h));
      float sd = max(dot(normalize(vDir), normalize(sunDir)), 0.0); // re-normalise: interpolation shortens vDir mid-triangle
      // moonAmt damps the sun bloom so the night sky shows a disc, not a glow spot
      col += sunColor * (pow(sd, 350.0)*1.4 + pow(sd, 24.0)*0.28 + pow(sd, 4.0)*0.10) * (1.0 - 0.75*moonAmt);
      // at night the light source is the moon: draw a crisp pale disc
      if (moonAmt > 0.01) {
        float disc = smoothstep(0.99760, 0.99800, sd);
        col = mix(col, vec3(0.93, 0.95, 0.99), disc * moonAmt);
      }
      if (starAmt > 0.01) {
        vec3 g = floor(vDir * 160.0);
        float s = hash(g);
        float star = step(0.992, s) * starAmt * smoothstep(0.0, 0.25, h);
        col += vec3(star) * (0.5 + 0.5*hash(g+1.7));
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat);
skyMesh.frustumCulled = false;
scene.add(skyMesh);

// ---------- lights ----------
export const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
const S = 70;
sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

export const hemi = new THREE.HemisphereLight(0xbdd8ff, 0x8a7a55, 0.7);
scene.add(hemi);
export const amb = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(amb);

scene.fog = new THREE.Fog(0xcfe0ee, 60, 420);

// ---------- day/night presets ----------
// t: phase name -> palette. lerped over transitions by setDaylight.
export const DAYLIGHT = {
  day:       { top: 0x3a7bd5, mid: 0xa8c8e8, bot: 0xf4e3c0, sun: 0xfff2d8, sunI: 2.4, hemiI: 0.82, fog: 0xcfe0ee, el: 0.85, az: 0.5, stars: 0, amb: 0.16, moon: 0 },
  morning:   { top: 0x5a8fd0, mid: 0xf3c98d, bot: 0xffdfae, sun: 0xffd9a0, sunI: 2.0, hemiI: 0.55, fog: 0xf0dcc0, el: 0.3, az: 1.1, stars: 0, amb: 0.1, moon: 0 },
  golden:    { top: 0x46609c, mid: 0xe8a06a, bot: 0xffca87, sun: 0xffbe78, sunI: 1.8, hemiI: 0.45, fog: 0xe8c9a4, el: 0.18, az: -1.2, stars: 0, amb: 0.1, moon: 0 },
  dusk:      { top: 0x1d2547, mid: 0x6a5a8a, bot: 0xd88a5c, sun: 0xff9a55, sunI: 0.9, hemiI: 0.3, fog: 0x584d6a, el: 0.06, az: -1.4, stars: 0.35, amb: 0.09, moon: 0.35 },
  night:     { top: 0x0d1630, mid: 0x223460, bot: 0x344270, sun: 0xc4d4ff, sunI: 1.05, hemiI: 0.45, fog: 0x1a2542, el: 0.55, az: 2.2, stars: 1, amb: 0.16, moon: 1 },
  heaven:    { top: 0xffd9ec, mid: 0xffe9c9, bot: 0xfff6e0, sun: 0xfff0d0, sunI: 1.9, hemiI: 0.9, fog: 0xffe7cd, el: 0.6, az: 0.3, stars: 0.15, amb: 0.25, moon: 0 },
  radiance:  { top: 0xf7e8ff, mid: 0xffe2b8, bot: 0xfff4d8, sun: 0xfff6e0, sunI: 2.6, hemiI: 1.0, fog: 0xffeccc, el: 0.5, az: 0.0, stars: 0, amb: 0.3, moon: 0 },
};

const cur = JSON.parse(JSON.stringify(DAYLIGHT.day));
let from = null, to = null, blend = 1, blendDur = 1;
const _c1 = new THREE.Color(), _c2 = new THREE.Color();

export function setDaylight(name, dur = 3) {
  from = JSON.parse(JSON.stringify(cur));
  to = DAYLIGHT[name];
  blend = 0; blendDur = Math.max(0.01, dur);
}
export function snapDaylight(name) { setDaylight(name, 0.01); }

function lerpC(key, a, b, t) {
  _c1.setHex(a[key]); _c2.setHex(b[key]); _c1.lerp(_c2, t);
  cur[key] = _c1.getHex(); return _c1;
}
export function updateDaylight(dt, playerPos) {
  if (to) {
    blend = Math.min(1, blend + dt / blendDur);
    const t = blend * blend * (3 - 2 * blend);
    skyUniforms.topColor.value.copy(lerpC('top', from, to, t));
    skyUniforms.midColor.value.copy(lerpC('mid', from, to, t));
    skyUniforms.botColor.value.copy(lerpC('bot', from, to, t));
    sun.color.copy(lerpC('sun', from, to, t));
    scene.fog.color.copy(lerpC('fog', from, to, t));
    skyUniforms.sunColor.value.copy(sun.color);
    cur.sunI = from.sunI + (to.sunI - from.sunI) * t; sun.intensity = cur.sunI;
    cur.hemiI = from.hemiI + (to.hemiI - from.hemiI) * t; hemi.intensity = cur.hemiI;
    cur.amb = from.amb + (to.amb - from.amb) * t; amb.intensity = cur.amb;
    cur.stars = from.stars + (to.stars - from.stars) * t; skyUniforms.starAmt.value = cur.stars;
    cur.moon = (from.moon||0) + ((to.moon||0) - (from.moon||0)) * t; skyUniforms.moonAmt.value = cur.moon;
    cur.el = from.el + (to.el - from.el) * t;
    cur.az = from.az + (to.az - from.az) * t;
    if (blend >= 1) { to = null; }
  }
  const el = cur.el, az = cur.az;
  const sx = Math.cos(el) * Math.cos(az), sy = Math.sin(el), sz = Math.cos(el) * Math.sin(az);
  skyUniforms.sunDir.value.set(sx, sy, sz);
  if (playerPos) {
    sun.position.set(playerPos.x + sx * 120, playerPos.y + sy * 120, playerPos.z + sz * 120);
    sun.target.position.copy(playerPos);
    skyMesh.position.copy(playerPos);
  }
}

export function setFogRange(near, far) { scene.fog.near = near; scene.fog.far = far; }

// ---------- asset loading ----------
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = {};

export function loadModel(name) {
  if (!cache[name]) {
    cache[name] = new Promise((res, rej) =>
      loader.load(`assets/models/${name}.glb`, g => res(g.scene), undefined, rej));
  }
  return cache[name];
}

// Clone a loaded model, scale so its height = h, base sitting at y=0.
export function instantiate(src, h, opts = {}) {
  const m = src.clone(true);
  const box = new THREE.Box3().setFromObject(m);
  const size = box.getSize(new THREE.Vector3());
  const s = h / Math.max(size.y, 1e-4);
  m.scale.setScalar(s);
  box.setFromObject(m);
  const c = box.getCenter(new THREE.Vector3());
  m.position.x -= c.x; m.position.z -= c.z; m.position.y -= box.min.y;
  m.traverse(o => {
    if (o.isMesh) {
      o.castShadow = opts.shadow !== false;
      o.receiveShadow = true;
      // glTF default / palette materials are often fully metallic -> black without an envmap
      if (o.material?.isMeshStandardMaterial) {
        o.material.metalness = 0;
        o.material.roughness = Math.max(o.material.roughness, 0.75);
      }
      if (opts.tint) { o.material = o.material.clone(); o.material.color.multiply(opts.tint); }
    }
  });
  const g = new THREE.Group();
  g.add(m);
  return g;
}

// Preload a list, with progress callback.
export async function preload(names, onProgress) {
  let done = 0;
  await Promise.all(names.map(async n => {
    try { await loadModel(n); } catch (e) { console.warn('model failed:', n, e); cache[n] = Promise.resolve(new THREE.Group()); }
    onProgress && onProgress(++done, names.length);
  }));
}
