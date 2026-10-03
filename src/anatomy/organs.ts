import * as THREE from "three";
import { box, cyl, ell, grp, mk, sph, torus, tube, V, varTube, type Ctx, type V3 } from "./geo";
import { VERTS, canalZ } from "./skeleton";

const ARTERY = "#c4636e";
const VEIN = "#5f84bd";
const NERVE = "#d9cd96";

function coil(
  n: number,
  c: [number, number, number],
  a: [number, number, number],
  f: [number, number, number],
  ph: [number, number, number],
): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(V(c[0] + a[0] * Math.sin(f[0] * t + ph[0]), c[1] + a[1] * Math.sin(f[1] * t + ph[1]), c[2] + a[2] * Math.sin(f[2] * t + ph[2])));
  }
  return pts;
}

export function buildOrgans({ add, pair }: Ctx) {
  // ═════════ SARAF ═════════
  const gyri = (c: V3, s: number) => (p: V3) => {
    const d = p.clone().sub(c);
    const n = (Math.sin(p.x * 180 + p.y * 90) + Math.sin(p.y * 170 + p.z * 110) + Math.sin(p.z * 190 + p.x * 70)) / 3;
    d.multiplyScalar(1 + 0.03 * n);
    p.copy(c).add(d);
    if (p.x * s < 0.003) p.x = s * 0.003;
  };
  pair("cerebrum", "head", (s, p) => {
    const c = p(0.028, 1.675, 0);
    return ell(c, [0.045, 0.063, 0.082], { seg: 44, warp: gyri(c, s), color: "#d8bcb6" });
  });
  add(
    "cerebellum",
    ell(V(0, 1.612, -0.062), [0.05, 0.028, 0.034], {
      seg: 36,
      color: "#c9a8a4",
      warp: (p) => {
        p.y += Math.sin(p.y * 520 + p.z * 90) * 0.0013;
      },
    }),
    "head",
  );
  add("brainstem", varTube([V(0, 1.64, -0.012), V(0, 1.6, -0.02), V(0, 1.576, -0.034)], [0.012, 0.0105, 0.0085], { color: "#d8c9a6" }), "head");

  pair("optic-nerve", "head", (s, p) =>
    grp(
      tube([p(0.033, 1.668, 0.064), p(0.022, 1.658, 0.046), p(0.004, 1.652, 0.035), V(0, 1.652, 0.035)], 0.0025, NERVE, 6),
      tube([V(0, 1.652, 0.035), p(0.012, 1.646, 0.022), p(0.018, 1.64, 0.008)], 0.002, NERVE, 5),
    ),
  );
  pair("olfactory-bulb", "head", (s, p) =>
    tube([p(0.009, 1.654, 0.062), p(0.008, 1.652, 0.042), p(0.007, 1.648, 0.026)], 0.002, NERVE, 5),
  );
  pair("trigeminal-nerve", "head", (s, p) =>
    grp(
      tube([p(0.012, 1.615, -0.012), p(0.028, 1.618, 0.008), p(0.045, 1.62, 0.022)], 0.0028, NERVE, 6),
      tube([p(0.045, 1.62, 0.022), p(0.04, 1.645, 0.045)], 0.0016, NERVE, 4), // V1 ophthalmic
      tube([p(0.045, 1.62, 0.022), p(0.05, 1.625, 0.048)], 0.0016, NERVE, 4), // V2 maxillary
      tube([p(0.045, 1.62, 0.022), p(0.048, 1.58, 0.032)], 0.0018, NERVE, 4), // V3 mandibular
    ),
  );

  const cordPts: V3[] = [V(0, 1.575, -0.04)];
  for (const v of VERTS.slice(0, 20)) cordPts.push(V(0, v.y, canalZ(v)));
  const cord = varTube(cordPts, [0.0068, 0.0068, 0.006, 0.0055, 0.004, 0.0025], { color: "#e4dab0", segs: 120 });
  const l1 = VERTS[19];
  const l3 = VERTS[21];
  const l5 = VERTS[23];
  for (const dx of [-0.007, -0.0025, 0.0025, 0.007]) {
    cord.add(tube([V(0, l1.y, canalZ(l1)), V(dx, l3.y, canalZ(l3)), V(dx * 1.6, l5.y - 0.012, canalZ(l5) - 0.004)], 0.0014, "#e4dab0", 5));
  }
  add("spinal-cord", cord, "torso");

  // Kauda ekuina (berkas saraf spinal L2 - sakral)
  const cauda = grp();
  for (let k = -3; k <= 3; k++) {
    const fx = k * 0.0035;
    cauda.add(
      tube(
        [
          V(fx * 0.5, l1.y - 0.01, canalZ(l1)),
          V(fx * 0.8, l3.y, canalZ(l3) - 0.002),
          V(fx * 1.1, l5.y, canalZ(l5) - 0.004),
          V(fx * 1.3, 0.94, -0.065),
          V(fx * 0.9, 0.88, -0.08),
        ],
        0.0015,
        "#ebdcae",
        6,
      ),
    );
  }
  add("cauda-equina", cauda, "torso");

  pair("brachial-plexus", "torso", (s, p) =>
    grp(
      varTube([p(0.008, 1.48, -0.04), p(0.05, 1.465, -0.03), p(0.1, 1.445, -0.005), p(0.15, 1.43, 0), p(0.18, 1.415, 0)], [0.0035], { color: NERVE, radial: 6 }),
      tube([p(0.008, 1.47, -0.045), p(0.06, 1.455, -0.03), p(0.12, 1.437, -0.005), p(0.18, 1.41, 0.002)], 0.0022, NERVE, 5),
      tube([p(0.008, 1.458, -0.042), p(0.06, 1.448, -0.025), p(0.12, 1.43, -0.002), p(0.18, 1.418, -0.003)], 0.0022, NERVE, 5),
    ),
  );
  pair("radial-nerve", "arm", (s, p) =>
    tube([p(0.188, 1.415, -0.005), p(0.2, 1.32, -0.018), p(0.208, 1.19, -0.012), p(0.214, 1.14, 0.005)], 0.003, NERVE, 6),
  );
  pair("median-nerve", "arm", (s, p) => tube([p(0.19, 1.41, 0), p(0.2, 1.3, 0.005), p(0.208, 1.16, 0.005)], 0.0032, NERVE, 6));
  pair("median-nerve", "forearm", (s, p) => tube([p(0.208, 1.16, 0.005), p(0.225, 1.0, 0.012), p(0.232, 0.9, 0.014), p(0.235, 0.88, 0.02)], 0.0032, NERVE, 6));
  pair("ulnar-nerve", "arm", (s, p) =>
    tube([p(0.185, 1.41, 0.002), p(0.195, 1.28, -0.008), p(0.202, 1.15, -0.018)], 0.003, NERVE, 6),
  );
  pair("ulnar-nerve", "forearm", (s, p) =>
    tube([p(0.202, 1.15, -0.018), p(0.216, 1.02, -0.008), p(0.225, 0.91, 0.004), p(0.232, 0.88, 0.01)], 0.0028, NERVE, 6),
  );
  pair("femoral-nerve", "thigh", (s, p) =>
    grp(
      tube([p(0.065, 0.92, 0.03), p(0.07, 0.82, 0.038), p(0.074, 0.7, 0.035), p(0.075, 0.58, 0.025)], 0.0038, NERVE, 6),
      tube([p(0.07, 0.82, 0.038), p(0.062, 0.72, 0.028), p(0.06, 0.6, 0.018)], 0.0022, NERVE, 5),
    ),
  );
  pair("sciatic-nerve", "torso", (s, p) => tube([p(0.03, 0.95, -0.09), p(0.06, 0.91, -0.098), p(0.078, 0.87, -0.075)], 0.0055, NERVE, 6));
  pair("sciatic-nerve", "thigh", (s, p) => tube([p(0.078, 0.87, -0.072), p(0.082, 0.7, -0.05), p(0.078, 0.55, -0.035)], 0.0055, NERVE, 6));
  pair("common-fibular-nerve", "shank", (s, p) =>
    tube([p(0.08, 0.52, -0.025), p(0.096, 0.47, -0.01), p(0.094, 0.42, 0.015), p(0.086, 0.32, 0.022), p(0.078, 0.18, 0.018)], 0.0028, NERVE, 6),
  );
  pair("tibial-nerve", "shank", (s, p) => tube([p(0.078, 0.52, -0.035), p(0.072, 0.3, -0.025), p(0.07, 0.1, -0.015)], 0.003, NERVE, 6));
  pair("vagus-nerve", "torso", (s, p) =>
    tube([p(0.03, 1.575, -0.018), p(0.036, 1.5, 0.008), p(0.034, 1.43, 0.015), p(0.022, 1.36, -0.01), p(0.012, 1.25, -0.042)], 0.0026, NERVE, 6),
  );
  pair("eye", "head", (s, p) =>
    grp(
      sph(p(0.033, 1.668, 0.064), 0.0105, "#eef2f7", 16),
      sph(p(0.033, 1.668, 0.0715), 0.0058, "#6f8fb8", 12),
      sph(p(0.033, 1.668, 0.0765), 0.0027, "#1b2430", 8),
    ),
  );

  // ═════════ PERNAPASAN ═════════
  add(
    "larynx",
    grp(
      cyl(V(0, 1.525, 0.026), V(0, 1.495, 0.026), 0.016, 0.014, undefined, 14),
      box(V(0, 1.512, 0.04), [0.022, 0.026, 0.012]),
      torus(V(0, 1.495, 0.028), 0.012, 0.003, [Math.PI / 2, 0, 0]),
    ),
    "torso",
  );
  add("cricoid-cartilage", cyl(V(0, 1.492, 0.027), V(0, 1.48, 0.027), 0.0135, 0.013, "#cfd8dc", 14), "torso");
  add("epiglottis", ell(V(0, 1.545, 0.016), [0.012, 0.016, 0.004], { rot: [-0.3, 0, 0], color: "#e3cbaf" }), "torso");
  const trachPts = [V(0, 1.48, 0.027), V(0, 1.45, 0.02), V(0, 1.415, 0.01), V(0, 1.375, 0)];
  const trach = varTube(trachPts, [0.0105], { radial: 14, caps: false });
  const tc = new THREE.CatmullRomCurve3(trachPts);
  for (let i = 0; i < 13; i++) {
    const q = tc.getPointAt((i + 0.5) / 13);
    trach.add(torus(q, 0.0108, 0.0016, [Math.PI / 2, 0, 0], "#efe2e2"));
  }
  add("trachea", trach, "torso");
  add("carina", sph(V(0, 1.375, 0), 0.009, "#efe2e2"), "torso");
  pair("bronchus", "torso", (s, p) =>
    grp(
      varTube([p(0, 1.375, 0), p(0.02, 1.362, -0.002), p(0.045, 1.345, -0.006), p(0.068, 1.325, -0.008)], [0.0078, 0.007, 0.006], { radial: 8 }),
      tube([p(0.05, 1.343, -0.006), p(0.07, 1.362, -0.01), p(0.08, 1.385, -0.012)], 0.0038, undefined, 6),
      tube([p(0.055, 1.337, -0.007), p(0.075, 1.3, -0.012), p(0.08, 1.27, -0.02)], 0.0038, undefined, 6),
    ),
  );

  const clear = (s: number) => (p: V3) => {
    const lim = s > 0 ? 0.075 : 0.06;
    if (p.y < 1.345 && p.y > 1.2 && p.z > -0.025 && Math.abs(p.x) < lim) p.x = s * lim;
  };
  const LUNG = "#d6a9ae";
  pair("lobe-superior", "torso", (s, p) => {
    const c = s > 0 ? p(0.07, 1.36, -0.003) : p(0.066, 1.375, -0.005);
    const r: [number, number, number] = s > 0 ? [0.046, 0.082, 0.075] : [0.046, 0.068, 0.075];
    return ell(c, r, { seg: 28, warp: clear(s), color: LUNG });
  });
  pair("lobe-inferior", "torso", (s, p) => {
    const c = s > 0 ? p(0.072, 1.255, -0.022) : p(0.07, 1.262, -0.025);
    const r: [number, number, number] = s > 0 ? [0.05, 0.058, 0.068] : [0.05, 0.06, 0.068];
    return ell(c, r, { seg: 28, warp: clear(s), color: "#cf9ea5" });
  });
  add("lobe-middle.R", ell(V(-0.074, 1.282, 0.028), [0.043, 0.038, 0.05], { seg: 24, warp: clear(-1), color: "#dbb0b5" }), "torso");

  const dome = (cx: number, cy: number, r: [number, number, number]) => {
    const m = mk(new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    m.position.set(cx, cy, -0.005);
    m.scale.set(r[0], r[1], r[2]);
    return m;
  };
  add("diaphragm", grp(dome(-0.068, 1.175, [0.078, 0.06, 0.1]), dome(0.068, 1.165, [0.078, 0.055, 0.1])), "torso", { color: "#c98b8c", opacity: 0.6 });

  // ═════════ JANTUNG & PEMBULUH ═════════
  const HEART_A = "#c47b82";
  add("right-atrium", ell(V(-0.032, 1.305, 0.032), [0.022, 0.03, 0.022], { color: HEART_A }), "torso");
  add("right-ventricle", ell(V(-0.003, 1.268, 0.048), [0.034, 0.04, 0.028], { rot: [0, 0, 0.25], color: "#c0646b" }), "torso");
  add("left-atrium", ell(V(0.022, 1.315, 0.006), [0.03, 0.02, 0.022], { color: HEART_A }), "torso");
  add("left-ventricle", ell(V(0.035, 1.262, 0.035), [0.034, 0.052, 0.03], { rot: [0, 0, 0.45], color: "#b5535c" }), "torso");

  // Arteri koroner & sirkulasi jantung
  add(
    "left-coronary-artery",
    varTube([V(0.015, 1.332, 0.025), V(0.022, 1.32, 0.035)], [0.0032, 0.0028], { color: "#d94b58", radial: 6 }),
    "torso",
  );
  add(
    "anterior-interventricular-artery",
    varTube(
      [V(0.022, 1.32, 0.035), V(0.026, 1.285, 0.048), V(0.036, 1.25, 0.046), V(0.048, 1.225, 0.038)],
      [0.0028, 0.0024, 0.002, 0.0016],
      { color: "#e23b4b", radial: 6 },
    ),
    "torso",
  );
  add(
    "circumflex-artery",
    varTube(
      [V(0.022, 1.32, 0.035), V(0.036, 1.31, 0.025), V(0.045, 1.295, 0.01), V(0.044, 1.275, -0.005)],
      [0.0026, 0.0022, 0.002],
      { color: "#d94b58", radial: 6 },
    ),
    "torso",
  );
  add(
    "right-coronary-artery",
    varTube(
      [V(-0.01, 1.33, 0.035), V(-0.022, 1.305, 0.042), V(-0.028, 1.275, 0.038), V(-0.02, 1.25, 0.025)],
      [0.0028, 0.0025, 0.0022, 0.0018],
      { color: "#d94b58", radial: 6 },
    ),
    "torso",
  );
  add(
    "cardiac-vein",
    varTube(
      [V(0.045, 1.228, 0.038), V(0.032, 1.27, 0.046), V(0.025, 1.31, 0.034), V(0.038, 1.3, 0.005), V(0.01, 1.29, -0.01)],
      [0.0022, 0.0028, 0.0034, 0.0042],
      { color: "#547cb0", radial: 6 },
    ),
    "torso",
  );

  add(
    "aorta",
    varTube(
      [
        V(0.012, 1.325, 0.03), V(0.01, 1.375, 0.03), V(0, 1.42, 0.015), V(0.012, 1.442, -0.005), V(0.03, 1.43, -0.032),
        V(0.036, 1.39, -0.05), V(0.036, 1.3, -0.052), V(0.03, 1.21, -0.033), V(0.026, 1.165, -0.016), V(0.02, 1.11, -0.005),
        V(0.012, 1.05, 0), V(0.005, 1.025, 0),
      ],
      [0.0125, 0.012, 0.0115, 0.01, 0.0085, 0.007],
      { color: ARTERY, radial: 12, segs: 120 },
    ),
    "torso",
  );

  // Cabang arteri abdominalis
  add(
    "celiac-trunk",
    grp(
      varTube([V(0.025, 1.17, -0.018), V(0.022, 1.168, 0), V(0.015, 1.165, 0.015)], [0.0052, 0.0045], { color: ARTERY, radial: 6 }),
      tube([V(0.015, 1.165, 0.015), V(0.05, 1.16, -0.025)], 0.0032, ARTERY, 6), // a. splenica
      tube([V(0.015, 1.165, 0.015), V(-0.02, 1.162, 0.025)], 0.0035, ARTERY, 6), // a. hepatica communis
    ),
    "torso",
  );
  add(
    "superior-mesenteric-artery",
    varTube([V(0.02, 1.145, -0.012), V(0.018, 1.11, 0.01), V(0.012, 1.06, 0.025), V(0.008, 1.0, 0.035)], [0.0055, 0.0048, 0.004, 0.0035], { color: ARTERY, radial: 6 }),
    "torso",
  );
  add(
    "inferior-mesenteric-artery",
    varTube([V(0.014, 1.06, 0), V(0.026, 1.025, 0.015), V(0.045, 0.98, 0.022)], [0.0038, 0.0032], { color: ARTERY, radial: 6 }),
    "torso",
  );

  add(
    "pulmonary-trunk",
    grp(
      varTube([V(0, 1.3, 0.058), V(0.005, 1.345, 0.045), V(0.01, 1.37, 0.015)], [0.011], { color: "#6d8fc4", radial: 10 }),
      varTube([V(0.01, 1.37, 0.015), V(0.04, 1.365, 0), V(0.065, 1.345, -0.008)], [0.008, 0.006], { color: "#6d8fc4", radial: 8 }),
      varTube([V(0.01, 1.37, 0.015), V(-0.02, 1.368, 0.005), V(-0.06, 1.345, -0.004)], [0.008, 0.006], { color: "#6d8fc4", radial: 8 }),
    ),
    "torso",
  );
  add("vena-cava-superior", varTube([V(-0.03, 1.455, 0.008), V(-0.03, 1.42, 0.016), V(-0.03, 1.36, 0.026), V(-0.031, 1.325, 0.032)], [0.009], { color: VEIN }), "torso");
  add(
    "vena-cava-inferior",
    varTube([V(-0.02, 1.03, 0), V(-0.02, 1.1, -0.02), V(-0.025, 1.2, -0.028), V(-0.03, 1.26, -0.015), V(-0.032, 1.292, 0.022)], [0.011], { color: VEIN }),
    "torso",
  );
  pair("carotid-artery", "torso", (s, p) => varTube([p(0.01, 1.435, 0.01), p(0.035, 1.5, 0.012), p(0.04, 1.55, 0), p(0.04, 1.575, -0.01)], [0.0048], { color: ARTERY, radial: 8 }));
  pair("jugular-vein", "torso", (s, p) => varTube([p(0.045, 1.575, -0.015), p(0.05, 1.52, 0), p(0.04, 1.46, 0.015), p(0.025, 1.43, 0.025)], [0.0065], { color: VEIN, radial: 8 }));
  pair("subclavian-artery", "torso", (s, p) => varTube([p(0.015, 1.43, 0.01), p(0.08, 1.445, 0.02), p(0.15, 1.44, 0.015), p(0.19, 1.42, 0)], [0.0055], { color: ARTERY, radial: 8 }));
  pair("brachial-artery", "arm", (s, p) => varTube([p(0.19, 1.42, 0.005), p(0.2, 1.3, 0.015), p(0.208, 1.16, 0.015)], [0.0045, 0.0038], { color: ARTERY, radial: 8 }));
  pair("iliac-artery", "torso", (s, p) => varTube([p(0.005, 1.025, 0), p(0.03, 1.0, 0.005), p(0.055, 0.96, 0.015), p(0.078, 0.925, 0.028)], [0.0068], { color: ARTERY, radial: 8 }));
  pair("common-iliac-vein", "torso", (s, p) =>
    varTube([p(0.07, 0.925, 0.024), p(0.045, 0.965, 0.01), p(0.01, 1.005, -0.005), V(-0.02, 1.03, 0)], [0.0075, 0.0085], { color: VEIN, radial: 8 }),
  );
  pair("femoral-artery", "thigh", (s, p) => varTube([p(0.078, 0.925, 0.03), p(0.072, 0.8, 0.045), p(0.064, 0.65, 0.036), p(0.06, 0.52, -0.01)], [0.0056, 0.0046], { color: ARTERY, radial: 8 }));
  pair("femoral-vein", "thigh", (s, p) => varTube([p(0.07, 0.925, 0.026), p(0.065, 0.8, 0.036), p(0.057, 0.65, 0.026), p(0.054, 0.52, -0.018)], [0.0066, 0.0056], { color: VEIN, radial: 8 }));
  pair("tibial-artery", "shank", (s, p) => varTube([p(0.06, 0.52, -0.012), p(0.064, 0.4, -0.01), p(0.068, 0.25, 0), p(0.07, 0.1, 0)], [0.0038, 0.003], { color: ARTERY, radial: 6 }));
  pair("renal-artery", "torso", (s, p) => varTube([p(0.015, 1.14, -0.025), p(0.035, 1.14, -0.04), p(0.052, 1.14, -0.05)], [0.0045], { color: ARTERY, radial: 6 }));
  pair("renal-vein", "torso", (s, p) =>
    varTube(
      s > 0
        ? [p(0.052, 1.14, -0.045), p(0.025, 1.14, -0.02), V(-0.022, 1.14, -0.025)]
        : [p(0.052, 1.14, -0.045), V(-0.022, 1.14, -0.025)],
      [0.006, 0.007],
      { color: VEIN, radial: 7 },
    ),
  );
  add("portal-vein", varTube([V(-0.035, 1.14, 0.03), V(-0.015, 1.12, 0.02), V(0, 1.09, 0)], [0.007, 0.008], { color: "#7a7fb8" }), "torso");

  // Kelenjar getah bening (limfatik)
  pair("lymph-nodes", "torso", (s, p) =>
    grp(
      sph(p(0.048, 1.51, 0.012), 0.0045, "#7ebc89", 8), // servikal
      sph(p(0.044, 1.47, 0.018), 0.0045, "#7ebc89", 8),
      sph(p(0.145, 1.41, 0.01), 0.0055, "#7ebc89", 8), // aksila
      sph(p(0.155, 1.39, 0.005), 0.005, "#7ebc89", 8),
      sph(p(0.065, 0.91, 0.042), 0.0055, "#7ebc89", 8), // inguinal
      sph(p(0.052, 0.89, 0.048), 0.005, "#7ebc89", 8),
    ),
  );

  add("spleen", ell(V(0.118, 1.16, -0.052), [0.017, 0.045, 0.03], { rot: [0, 0, 0.15], color: "#8a5d7a" }), "torso");

  // ═════════ PENCERNAAN ═════════
  add("tongue", ell(V(0, 1.578, 0.036), [0.017, 0.012, 0.027], { rot: [-0.1, 0, 0], color: "#c6686e" }), "head");
  add("pharynx", varTube([V(0, 1.63, 0.012), V(0, 1.57, 0.006), V(0, 1.51, 0.006)], [0.015, 0.013, 0.011], { color: "#ba786f", radial: 8 }), "head");

  const flatBottom = (cy: number) => (p: V3) => {
    if (p.y < cy - 0.03) p.y = cy - 0.03 + (p.y - (cy - 0.03)) * 0.4;
  };
  add("liver-right-lobe", ell(V(-0.07, 1.165, 0.02), [0.07, 0.055, 0.075], { seg: 28, color: "#8c4a45", warp: flatBottom(1.165) }), "torso");
  add("liver-left-lobe", ell(V(0.022, 1.172, 0.055), [0.048, 0.033, 0.044], { seg: 24, color: "#93504a" }), "torso");
  add("gallbladder", ell(V(-0.05, 1.108, 0.07), [0.011, 0.024, 0.012], { rot: [0.5, 0, 0.3], color: "#6d8f68" }), "torso");
  add("bile-duct", varTube([V(-0.048, 1.11, 0.06), V(-0.038, 1.085, 0.038), V(-0.026, 1.055, 0.022)], [0.003, 0.0026], { color: "#749b65", radial: 6 }), "torso");
  add(
    "esophagus",
    varTube([V(0, 1.5, 0.005), V(0, 1.45, -0.012), V(0, 1.37, -0.03), V(0, 1.29, -0.048), V(0, 1.22, -0.038), V(0.012, 1.2, -0.02), V(0.04, 1.185, -0.008)], [0.0095, 0.009, 0.009, 0.009, 0.0095], {
      color: "#c98f7f",
      radial: 10,
      segs: 70,
    }),
    "torso",
  );
  add(
    "stomach",
    varTube([V(0.07, 1.2, -0.012), V(0.075, 1.17, 0), V(0.068, 1.13, 0.03), V(0.04, 1.1, 0.055), V(0, 1.095, 0.055), V(-0.03, 1.105, 0.048)], [0.026, 0.04, 0.04, 0.034, 0.024, 0.014], {
      color: "#d79b86",
      radial: 16,
      segs: 60,
    }),
    "torso",
  );
  add("pancreas", varTube([V(-0.04, 1.07, 0.015), V(0, 1.095, 0.02), V(0.04, 1.115, 0), V(0.09, 1.14, -0.03)], [0.02, 0.014, 0.012, 0.011, 0.009], { color: "#d6b98a", radial: 10 }), "torso");
  add("pancreatic-duct", varTube([V(0.082, 1.135, -0.025), V(0.038, 1.11, 0.006), V(-0.005, 1.09, 0.02), V(-0.026, 1.065, 0.022)], [0.0022, 0.0024], { color: "#e8d8b2", radial: 6 }), "torso");
  add("duodenum", varTube([V(-0.03, 1.105, 0.048), V(-0.05, 1.09, 0.03), V(-0.058, 1.065, 0.012), V(-0.048, 1.04, 0.005), V(-0.02, 1.03, 0), V(0.01, 1.04, 0)], [0.011], { color: "#d99f88", radial: 10 }), "torso");
  add("jejunum", varTube(coil(260, [0.018, 0.995, 0.04], [0.058, 0.028, 0.022], [9, 13, 7], [0, 1, 2]), [0.0085], { color: "#d99a86", radial: 6, segs: 520, caps: false }), "torso");
  add("ileum", varTube(coil(220, [-0.01, 0.945, 0.04], [0.058, 0.02, 0.02], [7, 11, 5], [1, 0, 3]), [0.0085], { color: "#c98c7a", radial: 6, segs: 440, caps: false }), "torso");
  add("cecum", ell(V(-0.085, 0.945, 0.04), [0.024, 0.026, 0.024], { color: "#c79a8c" }), "torso");
  add("appendix", varTube([V(-0.078, 0.93, 0.045), V(-0.07, 0.905, 0.05), V(-0.058, 0.89, 0.045)], [0.0045, 0.0035], { color: "#b98578", radial: 6 }), "torso");
  add("ascending-colon", varTube([V(-0.09, 0.96, 0.035), V(-0.098, 1.03, 0.03), V(-0.1, 1.1, 0.028)], [0.019], { color: "#c79a8c", radial: 12 }), "torso");
  add(
    "transverse-colon",
    varTube([V(-0.1, 1.1, 0.028), V(-0.07, 1.05, 0.065), V(-0.02, 1.035, 0.07), V(0.04, 1.04, 0.068), V(0.09, 1.07, 0.04), V(0.108, 1.115, 0)], [0.018], {
      color: "#c79a8c",
      radial: 12,
      segs: 50,
    }),
    "torso",
  );
  add("descending-colon", varTube([V(0.108, 1.115, 0), V(0.105, 1.05, -0.005), V(0.1, 0.98, 0), V(0.09, 0.93, 0.01)], [0.016], { color: "#c79a8c", radial: 12 }), "torso");
  add(
    "sigmoid-colon",
    varTube([V(0.09, 0.93, 0.01), V(0.07, 0.9, 0.03), V(0.04, 0.895, 0.04), V(0.02, 0.91, 0.03), V(0.01, 0.89, 0.005)], [0.014], { color: "#c79a8c", radial: 10, segs: 40 }),
    "torso",
  );
  add("rectum", varTube([V(0.01, 0.89, 0.005), V(0, 0.87, -0.02), V(0, 0.82, -0.045), V(0, 0.775, -0.045)], [0.014, 0.016, 0.015, 0.011], { color: "#b98578", radial: 12 }), "torso");

  // ═════════ KEMIH & ENDOKRIN ═════════
  add("pituitary-gland", sph(V(0, 1.642, 0.008), 0.0055, "#d6985a", 10), "head");
  add(
    "thymus",
    grp(
      ell(V(0.009, 1.395, 0.034), [0.01, 0.022, 0.008], { color: "#dbb591" }),
      ell(V(-0.009, 1.395, 0.034), [0.01, 0.022, 0.008], { color: "#dbb591" }),
    ),
    "torso",
  );

  const cyK = (s: number) => (s > 0 ? 1.145 : 1.125);
  pair("kidney", "torso", (s, p) => ell(p(0.065, cyK(s), -0.065), [0.025, 0.055, 0.022], { rot: [0, 0, s * 0.2], color: "#9a5a54", seg: 24 }));
  pair("adrenal-gland", "torso", (s, p) => ell(p(0.05, cyK(s) + 0.06, -0.066), [0.014, 0.007, 0.01], { rot: [0, 0, s * 0.3] }));
  pair("ureter", "torso", (s, p) =>
    varTube([p(0.052, cyK(s) - 0.04, -0.058), p(0.05, 1.05, -0.06), p(0.046, 0.98, -0.055), p(0.04, 0.92, -0.04), p(0.03, 0.875, -0.01), p(0.02, 0.86, 0.018)], [0.0036], {
      color: "#d1a590",
      radial: 6,
    }),
  );
  add("bladder", ell(V(0, 0.85, 0.03), [0.036, 0.032, 0.03], { color: "#c58c7e" }), "torso");
  add(
    "thyroid",
    grp(
      ell(V(0.017, 1.488, 0.03), [0.011, 0.02, 0.01], { rot: [0, 0, 0.12] }),
      ell(V(-0.017, 1.488, 0.03), [0.011, 0.02, 0.01], { rot: [0, 0, -0.12] }),
      ell(V(0, 1.48, 0.04), [0.012, 0.005, 0.006]),
    ),
    "torso",
    { color: "#c98f5e" },
  );
}
