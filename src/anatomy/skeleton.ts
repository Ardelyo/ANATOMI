import * as THREE from "three";
import { backPt, box, cyl, ell, env, grp, loft, patch, sph, spindle, torus, tube, V, varTube, type Ctx, type V3 } from "./geo";

// ───────────── Data tulang belakang (dipakai juga oleh organ: sumsum tulang belakang)
export interface Vert {
  id: string;
  kind: "C" | "T" | "L";
  n: number;
  y: number;
  z: number;
  r: number;
  h: number;
}

const CY = [1.565, 1.55, 1.535, 1.52, 1.505, 1.49, 1.475];
const CZ = [-0.022, -0.018, -0.016, -0.016, -0.019, -0.025, -0.034];
const TZ = [-0.046, -0.054, -0.062, -0.069, -0.074, -0.078, -0.08, -0.079, -0.076, -0.071, -0.065, -0.058];
const LY = [1.165, 1.134, 1.103, 1.072, 1.041];
const LZ = [-0.052, -0.044, -0.038, -0.036, -0.04];

export const VERTS: Vert[] = [];
for (let i = 0; i < 7; i++) VERTS.push({ id: `C${i + 1}`, kind: "C", n: i + 1, y: CY[i], z: CZ[i], r: 0.015, h: 0.014 });
for (let i = 0; i < 12; i++)
  VERTS.push({ id: `T${i + 1}`, kind: "T", n: i + 1, y: 1.455 - i * 0.0235, z: TZ[i], r: 0.016 + i * 0.0004, h: 0.0185 });
for (let i = 0; i < 5; i++) VERTS.push({ id: `L${i + 1}`, kind: "L", n: i + 1, y: LY[i], z: LZ[i], r: 0.026, h: 0.028 });

export const canalZ = (v: Vert) => v.z - 0.8 * v.r - 0.011;

function vertebra(v: Vert): THREE.Group {
  const cz = canalZ(v);
  const body = cyl(V(0, v.y - v.h * 0.45, v.z), V(0, v.y + v.h * 0.45, v.z), v.r, v.r * 1.04, undefined, 16);
  body.scale.set(1.05, 1, 0.82);
  const arch = torus(V(0, v.y, cz), 0.0125, 0.0046, [Math.PI / 2, 0, 0]);
  arch.scale.set(1.15, 1, 1);
  const len = v.kind === "C" ? 0.03 : v.kind === "T" ? 0.045 : 0.04;
  const drop = v.kind === "T" ? 0.016 : v.kind === "C" ? 0.004 : 0.002;
  const spine = cyl(V(0, v.y, cz - 0.009), V(0, v.y - drop, cz - 0.009 - len), 0.0045, 0.003, undefined, 6);
  const w = v.kind === "C" ? 0.03 : v.kind === "T" ? 0.044 : 0.05;
  const g = grp(body, arch, spine);
  for (const s of [1, -1]) g.add(cyl(V(s * 0.008, v.y, cz), V(s * w, v.y, cz - 0.004), 0.0038, 0.0034, undefined, 6));
  return g;
}

const zs = (y: number) => 0.045 + (1.4 - y) * 0.3;
const CART = "#d6e0ee";

export function buildSkeleton({ add, pair }: Ctx) {
  // ───── Tulang belakang
  for (const v of VERTS) add(`vertebra-${v.id}`, vertebra(v), "torso");
  const chain: Vert[] = [...VERTS, { id: "S1", kind: "L", n: 6, y: 1.02, z: -0.05, r: 0.026, h: 0.01 }];
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1];
    const b = chain[i];
    const h = Math.max(0.005, Math.abs(a.y - b.y) - (a.h + b.h) * 0.45 + 0.003);
    const mid = V(0, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const r = Math.max(a.r, b.r) * 0.98;
    const d = cyl(V(0, mid.y - h / 2, mid.z), V(0, mid.y + h / 2, mid.z), r, r, "#a7bedd", 16);
    d.scale.set(1.05, 1, 0.82);
    add(`disc-${a.id}-${b.id}`, d, "torso", { opacity: 0.95 });
  }
  add(
    "sacrum",
    loft(
      [
        { y: 1.02, rx: 0.04, rz: 0.021, cz: -0.048 },
        { y: 0.99, rx: 0.039, rz: 0.018, cz: -0.062 },
        { y: 0.94, rx: 0.032, rz: 0.013, cz: -0.082 },
        { y: 0.89, rx: 0.021, rz: 0.01, cz: -0.092 },
        { y: 0.855, rx: 0.01, rz: 0.007, cz: -0.092 },
      ],
      20,
    ),
    "torso",
  );
  add(
    "coccyx",
    loft(
      [
        { y: 0.855, rx: 0.008, rz: 0.008, cz: -0.092 },
        { y: 0.83, rx: 0.007, rz: 0.007, cz: -0.088 },
        { y: 0.805, rx: 0.004, rz: 0.004, cz: -0.078 },
        { y: 0.79, rx: 0.0015, rz: 0.0015, cz: -0.068 },
      ],
      10,
    ),
    "torso",
  );

  // ───── Iga & sternum
  const RA = [0.055, 0.08, 0.1, 0.115, 0.125, 0.133, 0.138, 0.14, 0.14, 0.138, 0.128, 0.115];
  const RB = [0.05, 0.07, 0.085, 0.095, 0.1, 0.105, 0.108, 0.108, 0.105, 0.1, 0.09, 0.08];
  const RZ = [-0.005, -0.005, -0.005, -0.005, -0.005, -0.005, -0.003, -0.003, -0.003, -0.005, -0.015, -0.025];
  const phiS = Math.PI - 0.13;
  const drop = (n: number) => (n <= 10 ? 0.03 + 0.01 * n : n === 11 ? 0.1 : 0.06);
  const phiE = (n: number) => (n <= 7 ? 0.5 : n <= 10 ? 0.6 : n === 11 ? 1.45 : 1.7);
  const yb = (n: number) => 1.455 - (n - 1) * 0.0235;
  const ribPt = (n: number, phi: number, s: number): V3 => {
    const t = Math.max(0, (phiS - phi) / (phiS - 0.1));
    return V(s * RA[n - 1] * Math.sin(phi), yb(n) - drop(n) * Math.pow(t, 1.3), RZ[n - 1] + RB[n - 1] * Math.cos(phi));
  };

  for (let n = 1; n <= 12; n++) {
    pair(`rib-${n}`, "torso", (s) => {
      const pts: V3[] = [];
      const steps = 14;
      for (let i = 0; i <= steps; i++) pts.push(ribPt(n, phiS + (phiE(n) - phiS) * (i / steps), s));
      return varTube(pts, [0.0049, 0.0042, 0.004], { radial: 6, segs: 44 });
    });
  }
  pair("costal-cartilage", "torso", (s) => {
    const g = new THREE.Group();
    for (let n = 1; n <= 10; n++) {
      const e = ribPt(n, phiE(n), s);
      let target: V3;
      if (n <= 7) {
        const y = yb(n) - drop(n);
        target = V(s * 0.016, y, zs(y));
      } else {
        const k = n - 8;
        target = V(s * (0.03 + 0.012 * k), 1.2 - 0.008 * k, zs(1.2) + 0.002);
      }
      const mid = e.clone().lerp(target, 0.5);
      mid.z += 0.004;
      g.add(tube([e, mid, target], 0.0042, CART, 6));
    }
    return g;
  });
  const tilt: [number, number, number] = [-0.29, 0, 0];
  add("manubrium", ell(V(0, 1.403, zs(1.403)), [0.027, 0.03, 0.0075], { rot: tilt }), "torso");
  add("sternal-body", ell(V(0, 1.295, zs(1.295)), [0.019, 0.088, 0.0065], { rot: tilt }), "torso");
  add("xiphoid-process", ell(V(0, 1.19, zs(1.19)), [0.008, 0.024, 0.004], { rot: tilt, color: CART }), "torso");

  // ───── Gelang bahu
  pair("clavicle", "torso", (s, p) =>
    varTube([p(0.012, 1.425, 0.045), p(0.05, 1.437, 0.055), p(0.1, 1.447, 0.04), p(0.14, 1.449, 0.015), p(0.17, 1.447, 0)], [0.006, 0.0055, 0.005, 0.0055, 0.007], { radial: 8 }),
  );
  pair("scapula", "torso", (s) => {
    const thB = (x: number, y: number) => Math.PI - Math.asin(Math.min(0.999, x / (env(y).rx - 0.02)));
    const y0 = 1.285;
    const y1 = 1.445;
    const { mesh } = patch({
      y0,
      y1,
      th0: (v) => thB(0.07 + 0.095 * Math.pow(v, 1.3), y0 + (y1 - y0) * v),
      th1: (v) => thB(0.052, y0 + (y1 - y0) * v),
      inset: 0.02,
      bulge: 0.004,
      s,
      nu: 8,
      nv: 10,
    });
    const bp = (x: number, y: number) => {
      const q = backPt(x, y, 0.018);
      return V(s * q.x, q.y, q.z);
    };
    const spineBone = varTube([bp(0.056, 1.395), bp(0.09, 1.41), bp(0.125, 1.43), V(s * 0.158, 1.447, -0.02), V(s * 0.172, 1.448, 0)], [0.003, 0.005, 0.006, 0.006, 0.006], { radial: 6 });
    return grp(mesh, spineBone, ell(V(s * 0.178, 1.428, -0.003), [0.008, 0.015, 0.011]));
  });

  // ───── Panggul
  pair("ilium", "torso", (s) => {
    const { mesh, at } = patch({
      y0: 0.9,
      y1: 1.07,
      th0: (v) => 1.25 - 0.3 * v,
      th1: (v) => 2.35 + 0.5 * v,
      inset: 0.025,
      bulge: 0.01,
      s,
      nu: 12,
      nv: 8,
    });
    const crest: V3[] = [];
    for (let i = 0; i <= 8; i++) crest.push(at(i / 8, 1));
    return grp(mesh, varTube(crest, [0.005], { radial: 6 }), torus(V(s * 0.1, 0.9, 0), 0.027, 0.005, [0, Math.PI / 2, 0]));
  });
  pair("ischium", "torso", (s, p) =>
    varTube([p(0.1, 0.895, 0), p(0.09, 0.845, -0.05), p(0.07, 0.815, -0.06), p(0.05, 0.81, -0.03), p(0.03, 0.82, 0.02), p(0.02, 0.828, 0.05)], [0.009, 0.008, 0.01, 0.007, 0.006, 0.006], { radial: 8 }),
  );
  pair("pubis", "torso", (s, p) =>
    grp(
      varTube([p(0.1, 0.895, 0), p(0.06, 0.86, 0.045), p(0.012, 0.835, 0.062)], [0.009, 0.007, 0.007], { radial: 8 }),
      ell(V(0, 0.835, 0.063), [0.012, 0.006, 0.005], { color: CART }),
    ),
  );

  // ───── Tengkorak (segmen kepala)
  add(
    "cranium",
    grp(ell(V(0, 1.672, -0.006), [0.076, 0.082, 0.094], { seg: 28 }), ell(V(0, 1.625, -0.025), [0.062, 0.04, 0.075])),
    "head",
    { opacity: 0.6 },
  );
  add("frontal-bone", ell(V(0, 1.685, 0.042), [0.064, 0.048, 0.042], { rot: [-0.22, 0, 0] }), "head");
  pair("parietal-bone", "head", (s, p) => ell(p(0.046, 1.705, -0.02), [0.038, 0.042, 0.052], { rot: [0.1, 0, s * 0.16] }));
  pair("temporal-bone", "head", (s, p) =>
    grp(
      ell(p(0.068, 1.635, -0.015), [0.016, 0.026, 0.032]),
      cyl(p(0.065, 1.615, -0.024), p(0.065, 1.595, -0.024), 0.006, 0.0035), // mastoid process
      cyl(p(0.062, 1.61, -0.005), p(0.058, 1.585, 0.002), 0.002, 0.001), // styloid process
    ),
  );
  add("occipital-bone", ell(V(0, 1.642, -0.068), [0.056, 0.046, 0.038], { rot: [0.36, 0, 0] }), "head");
  add("sphenoid-bone", ell(V(0, 1.638, 0.016), [0.052, 0.016, 0.025]), "head");
  add(
    "maxilla",
    grp(
      ell(V(0, 1.622, 0.066), [0.034, 0.024, 0.03]),
      torus(V(0.033, 1.668, 0.077), 0.0148, 0.003),
      torus(V(-0.033, 1.668, 0.077), 0.0148, 0.003),
    ),
    "head",
  );
  pair("zygomatic", "head", (s, p) =>
    grp(ell(p(0.062, 1.634, 0.052), [0.011, 0.011, 0.024]), varTube([p(0.058, 1.63, 0.075), p(0.075, 1.632, 0.02), p(0.075, 1.63, -0.01)], [0.004], { radial: 6 })),
  );
  add("nasal-bone", ell(V(0, 1.652, 0.092), [0.006, 0.016, 0.007], { rot: [0.3, 0, 0] }), "head");
  add("hyoid", torus(V(0, 1.538, 0.022), 0.018, 0.0032, [Math.PI / 2, 0, 0], undefined, Math.PI), "torso");

  const teethArc = (zc: number, zr: number, xr: number, y: number) => {
    const g = new THREE.Group();
    for (let k = -6; k <= 6; k++) {
      const phi = (k / 6) * 1.2;
      g.add(box(V(xr * Math.sin(phi), y, zc + zr * Math.cos(phi)), [0.0058, 0.012, 0.0045], [0, phi, 0], "#f1f4f8"));
    }
    return g;
  };
  add("teeth-upper", teethArc(0.012, 0.064, 0.032, 1.5895), "head");
  add("teeth-lower", teethArc(0.014, 0.062, 0.03, 1.5675), "jaw");

  const mand: V3[] = [V(0.068, 1.615, -0.005), V(0.066, 1.592, -0.004), V(0.058, 1.566, 0.002), V(0.045, 1.552, 0.04), V(0.022, 1.549, 0.075), V(0, 1.548, 0.088)];
  const mirror = mand.slice(0, 5).reverse().map((q) => V(-q.x, q.y, q.z));
  add(
    "mandible",
    grp(
      varTube([...mand, ...mirror], [0.0045, 0.005, 0.0065, 0.0065, 0.0065, 0.007, 0.0065, 0.0065, 0.0065, 0.005, 0.0045], { radial: 8, segs: 70 }),
      sph(V(0.068, 1.617, -0.005), 0.005),
      sph(V(-0.068, 1.617, -0.005), 0.005),
    ),
    "jaw",
  );

  // ───── Lengan
  pair("humerus", "arm", (s, p) =>
    grp(
      ell(p(0.188, 1.428, 0), [0.02, 0.02, 0.02]),
      spindle(p(0.192, 1.41, 0), p(0.208, 1.14, -0.005), [0.012, 0.014, 0.012, 0.012, 0.016, 0.02]),
      ell(p(0.208, 1.13, -0.005), [0.024, 0.012, 0.012]),
    ),
  );
  pair("radius", "forearm", (s, p) => spindle(p(0.215, 1.122, 0.012), p(0.243, 0.89, 0.014), [0.009, 0.006, 0.005, 0.006, 0.011, 0.012]));
  pair("ulna", "forearm", (s, p) =>
    grp(spindle(p(0.205, 1.135, -0.01), p(0.224, 0.895, 0), [0.012, 0.009, 0.006, 0.004, 0.006, 0.007]), ell(p(0.205, 1.142, -0.022), [0.011, 0.014, 0.01])),
  );

  // ───── Tangan
  pair("carpals", "hand", (s, p) => {
    const g = new THREE.Group();
    for (const dx of [-0.014, -0.005, 0.005, 0.014]) g.add(sph(p(0.235 + dx, 0.884, 0.006), 0.0068, undefined, 8));
    for (const dx of [-0.016, -0.006, 0.004, 0.014]) g.add(sph(p(0.235 + dx, 0.872, 0.009), 0.0066, undefined, 8));
    g.add(sph(p(0.255, 0.872, 0.016), 0.0068, undefined, 8));
    return g;
  });
  const fingers = [
    { dx: 0.014, mc: 0.8, p: [0.036, 0.022, 0.018] },
    { dx: 0.003, mc: 0.797, p: [0.04, 0.025, 0.019] },
    { dx: -0.008, mc: 0.8, p: [0.037, 0.023, 0.018] },
    { dx: -0.019, mc: 0.815, p: [0.03, 0.017, 0.015] },
  ];
  pair("metacarpals", "hand", (s, p) => {
    const g = new THREE.Group();
    for (const f of fingers) g.add(cyl(p(0.235 + f.dx, 0.868, 0.012), p(0.235 + f.dx, f.mc, 0.012), 0.0045, 0.0042, undefined, 7));
    g.add(cyl(p(0.248, 0.872, 0.02), p(0.262, 0.832, 0.03), 0.005, 0.0045, undefined, 7));
    return g;
  });
  pair("phalanges-hand", "hand", (s, p) => {
    const g = new THREE.Group();
    for (const f of fingers) {
      let y = f.mc;
      const x = 0.235 + f.dx;
      for (const len of f.p) {
        g.add(cyl(p(x, y - 0.002, 0.012), p(x, y - len + 0.001, 0.012), 0.0037, 0.0033, undefined, 7));
        g.add(sph(p(x, y - len, 0.012), 0.0038, undefined, 7));
        y -= len;
      }
    }
    g.add(cyl(p(0.262, 0.832, 0.03), p(0.268, 0.803, 0.036), 0.0042, 0.0038, undefined, 7));
    g.add(cyl(p(0.268, 0.803, 0.036), p(0.271, 0.78, 0.04), 0.0038, 0.0033, undefined, 7));
    g.add(sph(p(0.262, 0.832, 0.03), 0.0045, undefined, 7));
    g.add(sph(p(0.268, 0.803, 0.036), 0.004, undefined, 7));
    return g;
  });

  // ───── Tungkai
  pair("femur", "thigh", (s, p) =>
    grp(
      sph(p(0.085, 0.9, 0), 0.024, undefined, 16),
      cyl(p(0.085, 0.9, 0), p(0.105, 0.868, 0.003), 0.011, 0.013),
      ell(p(0.114, 0.865, -0.005), [0.016, 0.02, 0.018]),
      spindle(p(0.1, 0.865, 0.004), p(0.078, 0.51, 0.012), [0.013, 0.015, 0.014, 0.014, 0.016, 0.02]),
      ell(p(0.067, 0.505, 0), [0.018, 0.02, 0.025]),
      ell(p(0.09, 0.505, 0), [0.018, 0.02, 0.025]),
    ),
  );
  pair("patella", "shank", (s, p) => ell(p(0.077, 0.507, 0.05), [0.02, 0.024, 0.009]));
  pair("tibia", "shank", (s, p) =>
    grp(
      ell(p(0.075, 0.495, 0.012), [0.032, 0.008, 0.027]),
      spindle(p(0.075, 0.49, 0.015), p(0.07, 0.1, 0), [0.02, 0.017, 0.012, 0.011, 0.015, 0.02]),
      ell(p(0.077, 0.46, 0.033), [0.008, 0.012, 0.007]),
      ell(p(0.062, 0.09, 0), [0.008, 0.012, 0.01]),
    ),
  );
  pair("fibula", "shank", (s, p) =>
    grp(spindle(p(0.105, 0.465, -0.005), p(0.096, 0.09, -0.012), [0.008, 0.005, 0.004, 0.005, 0.007]), ell(p(0.093, 0.082, -0.012), [0.007, 0.014, 0.008])),
  );
  pair("calcaneus", "foot", (s, p) => ell(p(0.07, 0.04, -0.04), [0.017, 0.024, 0.032]));
  pair("tarsals", "foot", (s, p) =>
    grp(
      ell(p(0.07, 0.07, -0.012), [0.018, 0.014, 0.024]),
      ell(p(0.058, 0.052, 0.022), [0.012, 0.012, 0.01]),
      ell(p(0.085, 0.036, 0.012), [0.013, 0.012, 0.014]),
      ell(p(0.055, 0.04, 0.04), [0.009, 0.01, 0.01]),
      ell(p(0.07, 0.04, 0.042), [0.009, 0.01, 0.01]),
      ell(p(0.082, 0.038, 0.042), [0.009, 0.01, 0.01]),
    ),
  );
  const toeX = [0.052, 0.063, 0.074, 0.085, 0.095];
  pair("metatarsals", "foot", (s, p) => {
    const g = new THREE.Group();
    toeX.forEach((x, i) => g.add(cyl(p(x, 0.03, 0.05), p(x, 0.016, 0.115), i === 0 ? 0.0068 : 0.0046, i === 0 ? 0.0075 : 0.005, undefined, 7)));
    return g;
  });
  pair("phalanges-foot", "foot", (s, p) => {
    const g = new THREE.Group();
    toeX.forEach((x, i) => {
      const zs2 = i === 0 ? [0.115, 0.142, 0.162] : [0.115, 0.14, 0.153, 0.163];
      for (let k = 0; k < zs2.length - 1; k++) {
        g.add(cyl(p(x, 0.015, zs2[k] + 0.002), p(x, 0.014, zs2[k + 1]), i === 0 ? 0.006 : 0.0042, i === 0 ? 0.0055 : 0.0038, undefined, 7));
      }
    });
    return g;
  });
}
