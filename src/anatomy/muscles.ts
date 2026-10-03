import { ell, env, grp, loft, patch, spindle, V, varTube, type Ctx, type Ring } from "./geo";

const PI = Math.PI;
const TENDON = "#e7e0d4";

export function buildMuscles({ add, pair }: Ctx) {
  // ═════════ KEPALA & LEHER ═════════
  pair("masseter", "head", (s, p) => spindle(p(0.064, 1.62, 0.03), p(0.058, 1.572, 0.015), [0.004, 0.011, 0.011, 0.005], { flat: [0.55, 1] }));
  pair("temporalis", "head", (s, p) => ell(p(0.068, 1.68, 0.01), [0.008, 0.035, 0.045]));
  pair("sternocleidomastoid", "torso", (s, p) => spindle(p(0.06, 1.568, -0.035), p(0.015, 1.43, 0.04), [0.003, 0.009, 0.008, 0.005], { flat: [1, 0.6] }));

  // ═════════ BATANG TUBUH ═════════
  pair("trapezius", "torso", (s) =>
    patch({
      y0: 1.2,
      y1: 1.47,
      th0: (v) => PI - (0.2 + 1.4 * Math.pow(v, 1.5)),
      th1: () => PI - 0.05,
      bulge: 0.008,
      s,
      nu: 10,
      nv: 14,
    }).mesh,
  );
  pair("latissimus-dorsi", "torso", (s) =>
    patch({
      y0: 1.0,
      y1: 1.35,
      th0: (v) => PI - (1.05 + 0.5 * v),
      th1: (v) => PI - 0.1 - 0.9 * Math.pow(v, 1.2),
      bulge: 0.006,
      s,
      nu: 10,
      nv: 12,
    }).mesh,
  );
  pair("erector-spinae", "torso", (s) =>
    patch({ y0: 0.98, y1: 1.4, th0: () => PI - 0.36, th1: () => PI - 0.12, bulge: 0.014, s, nu: 4, nv: 14 }).mesh,
  );
  pair("pectoralis-major", "torso", (s) =>
    patch({ y0: 1.22, y1: 1.42, th0: () => 0.1, th1: (v) => 0.45 + 1.0 * v, bulge: 0.012, s, nu: 10, nv: 10 }).mesh,
  );
  pair("pectoralis-minor", "torso", (s, p) =>
    grp(
      varTube([p(0.06, 1.35, 0.075), p(0.1, 1.39, 0.05), p(0.14, 1.42, 0.02)], [0.005, 0.004, 0.003], { color: "#c58f93", radial: 6 }),
      varTube([p(0.065, 1.32, 0.075), p(0.105, 1.38, 0.048), p(0.14, 1.42, 0.02)], [0.005, 0.004, 0.003], { color: "#c58f93", radial: 6 }),
      varTube([p(0.07, 1.29, 0.072), p(0.11, 1.37, 0.046), p(0.14, 1.42, 0.02)], [0.005, 0.004, 0.003], { color: "#c58f93", radial: 6 }),
    ),
  );
  pair("intercostals", "torso", (s) => {
    const g = grp();
    for (let k = 0; k < 6; k++) {
      const y0 = 1.22 + k * 0.028;
      const y1 = y0 + 0.018;
      g.add(patch({ y0, y1, th0: () => 0.35, th1: () => 1.8, bulge: 0.003, s, nu: 8, nv: 3, color: "#b97b80" }).mesh);
    }
    return g;
  });
  pair("rectus-abdominis", "torso", (s) => {
    const g = grp();
    for (let k = 0; k < 4; k++) {
      const y0 = 0.92 + 0.07 * k + 0.003;
      const y1 = 0.92 + 0.07 * (k + 1) - 0.003;
      const rx = env((y0 + y1) / 2).rx;
      g.add(
        patch({
          y0,
          y1,
          th0: () => Math.asin(0.006 / rx),
          th1: () => Math.asin(0.048 / rx),
          bulge: 0.007,
          s,
          nu: 5,
          nv: 6,
        }).mesh,
      );
    }
    return g;
  });
  pair("external-oblique", "torso", (s) =>
    patch({ y0: 0.98, y1: 1.27, th0: () => 0.36, th1: (v) => 1.55 + 0.35 * (1 - v), bulge: 0.01, s, nu: 10, nv: 10 }).mesh,
  );
  pair("gluteus-maximus", "torso", (s) => {
    const sv = (v: number) => Math.pow(Math.max(0, Math.sin(PI * v)), 0.6);
    return patch({ y0: 0.8, y1: 1.02, th0: (v) => PI - (0.12 + 1.05 * sv(v)), th1: () => PI - 0.1, bulge: 0.028, s, nu: 10, nv: 12 }).mesh;
  });

  // ═════════ LENGAN ═════════
  pair("deltoid", "arm", (s, p) => ell(p(0.205, 1.395, 0), [0.034, 0.062, 0.045], { rot: [0, 0, s * 0.1] }));
  pair("biceps-brachii", "arm", (s, p) => spindle(p(0.19, 1.38, 0.03), p(0.205, 1.17, 0.02), [0.008, 0.022, 0.024, 0.014, 0.006]));
  pair("triceps-brachii", "arm", (s, p) => spindle(p(0.2, 1.39, -0.03), p(0.212, 1.16, -0.03), [0.008, 0.022, 0.024, 0.014, 0.006], { flat: [1.1, 0.9] }));
  pair("forearm-flexors", "forearm", (s, p) => spindle(p(0.212, 1.14, 0.02), p(0.23, 0.93, 0.018), [0.006, 0.022, 0.018, 0.008, 0.003]));
  pair("forearm-extensors", "forearm", (s, p) => spindle(p(0.215, 1.14, -0.018), p(0.235, 0.93, -0.012), [0.006, 0.02, 0.016, 0.007, 0.003]));

  // ═════════ TUNGKAI ═════════
  pair("rectus-femoris", "thigh", (s, p) => spindle(p(0.088, 0.88, 0.05), p(0.08, 0.56, 0.045), [0.01, 0.032, 0.036, 0.022, 0.008]));
  pair("vastus-lateralis", "thigh", (s, p) => spindle(p(0.115, 0.86, 0.01), p(0.1, 0.56, 0.035), [0.008, 0.032, 0.036, 0.022, 0.008]));
  pair("vastus-medialis", "thigh", (s, p) => spindle(p(0.06, 0.72, 0.03), p(0.07, 0.54, 0.04), [0.006, 0.028, 0.028, 0.012, 0.004]));
  pair("sartorius", "thigh", (s, p) =>
    varTube([p(0.115, 0.92, 0.04), p(0.095, 0.78, 0.06), p(0.07, 0.62, 0.05), p(0.06, 0.5, 0.025)], [0.007], { radial: 8 }),
  );
  pair("iliotibial-tract", "thigh", (s, p) =>
    varTube([p(0.125, 0.94, 0.01), p(0.12, 0.78, 0.008), p(0.112, 0.62, 0.012), p(0.098, 0.51, 0.025)], [0.007, 0.008, 0.0075, 0.006], { color: TENDON, radial: 8 }),
  );
  pair("adductors", "thigh", (s, p) => spindle(p(0.045, 0.87, 0.015), p(0.065, 0.6, 0.01), [0.01, 0.025, 0.022, 0.008]));
  pair("biceps-femoris", "thigh", (s, p) => spindle(p(0.09, 0.86, -0.05), p(0.1, 0.55, -0.035), [0.008, 0.026, 0.028, 0.012, 0.005]));
  pair("semitendinosus", "thigh", (s, p) => spindle(p(0.075, 0.86, -0.055), p(0.065, 0.55, -0.03), [0.008, 0.022, 0.022, 0.01, 0.004]));
  pair("gastrocnemius", "shank", (s, p) =>
    grp(
      spindle(p(0.082, 0.48, -0.03), p(0.072, 0.22, -0.025), [0.01, 0.034, 0.032, 0.015, 0.004]),
      spindle(p(0.062, 0.48, -0.03), p(0.068, 0.22, -0.025), [0.01, 0.032, 0.03, 0.014, 0.004]),
    ),
  );
  pair("soleus", "shank", (s, p) => spindle(p(0.075, 0.44, -0.022), p(0.07, 0.18, -0.02), [0.008, 0.028, 0.026, 0.016, 0.005], { flat: [1.2, 0.7] }));
  pair("tibialis-anterior", "shank", (s, p) => spindle(p(0.087, 0.46, 0.04), p(0.075, 0.14, 0.028), [0.006, 0.018, 0.016, 0.007, 0.003]));
  pair("achilles-tendon", "shank", (s, p) =>
    varTube([p(0.07, 0.22, -0.025), p(0.07, 0.1, -0.035), p(0.07, 0.075, -0.04)], [0.007, 0.0045, 0.0045], { color: TENDON, radial: 8 }),
  );
  pair("patellar-ligament", "shank", (s, p) =>
    varTube([p(0.077, 0.495, 0.048), p(0.076, 0.475, 0.042), p(0.076, 0.46, 0.034)], [0.006, 0.0055, 0.005], { color: TENDON, radial: 6 }),
  );

  // ═════════ KULIT (transparan, sebagai konteks bentuk tubuh) ═════════
  const rings: Ring[] = [0.84, 0.87, 0.95, 1.05, 1.15, 1.22, 1.3, 1.38, 1.44, 1.47].map((y) => {
    const e = env(y);
    return { y, rx: e.rx + 0.016, rz: e.rz + 0.016, cz: e.zc };
  });
  const sk = { pick: false };
  add("skin-torso", loft(rings, 32), "torso", sk);
  add(
    "skin-neck",
    loft(
      [
        { y: 1.46, rx: 0.058, rz: 0.058, cz: 0 },
        { y: 1.55, rx: 0.052, rz: 0.054, cz: 0.005 },
        { y: 1.6, rx: 0.05, rz: 0.055, cz: 0.005 },
      ],
      24,
    ),
    "torso",
    sk,
  );
  add(
    "skin-head",
    grp(
      ell(V(0, 1.662, 0.004), [0.088, 0.098, 0.104], { seg: 28 }),
      ell(V(0, 1.635, 0.1), [0.011, 0.018, 0.014]),
      ell(V(0, 1.585, 0.03), [0.075, 0.05, 0.085], { seg: 24 }),
    ),
    "head",
    sk,
  );
  pair("skin-arm", "arm", (s, p) =>
    grp(ell(p(0.195, 1.425, 0), [0.046, 0.046, 0.046]), varTube([p(0.19, 1.43, 0), p(0.2, 1.28, 0), p(0.208, 1.13, -0.005)], [0.042, 0.037, 0.031, 0.029])),
  );
  pair("skin-forearm", "forearm", (s, p) => varTube([p(0.21, 1.13, -0.005), p(0.222, 1.0, 0.008), p(0.235, 0.885, 0.012)], [0.03, 0.028, 0.02, 0.017]));
  pair("skin-hand", "hand", (s, p) => ell(p(0.24, 0.8, 0.014), [0.03, 0.08, 0.015]));
  pair("skin-thigh", "thigh", (s, p) => varTube([p(0.088, 0.92, 0), p(0.082, 0.7, 0.015), p(0.075, 0.495, 0.01)], [0.082, 0.07, 0.05, 0.045], { radial: 16 }));
  pair("skin-shank", "shank", (s, p) => varTube([p(0.075, 0.495, 0.01), p(0.072, 0.3, -0.01), p(0.07, 0.085, 0)], [0.047, 0.045, 0.033, 0.026], { radial: 14 }));
  pair("skin-foot", "foot", (s, p) => varTube([p(0.07, 0.04, -0.05), p(0.07, 0.04, 0.05), p(0.07, 0.025, 0.17)], [0.034, 0.036, 0.03, 0.012], { radial: 12 }));
}
