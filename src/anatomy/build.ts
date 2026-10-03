import * as THREE from "three";
import { metaFor, SYSTEM_BY_ID, type SystemId } from "./catalog";
import { V, type AddOpts, type Ctx, type V3 } from "./geo";
import { buildSkeleton } from "./skeleton";
import { buildOrgans } from "./organs";
import { buildMuscles } from "./muscles";

export interface MatRec {
  mat: THREE.MeshStandardMaterial;
  base: THREE.Color;
  baseOpacity: number;
}

export interface PartRec {
  id: string;
  base: string;
  side: "L" | "R" | null;
  system: SystemId;
  tags: string[];
  seg: string;
  obj: THREE.Group;
  /** posisi diam relatif terhadap segmen induk */
  rest: V3;
  /** pusat bagian dalam koordinat lokal obj */
  c: V3;
  mats: MatRec[];
  meshes: THREE.Mesh[];
  pick: boolean;
}

export interface JointDof {
  axis: "x" | "y" | "z";
  sign: number;
  min: number;
  max: number;
}
export interface JointDef {
  seg: string;
  dof: Record<string, JointDof>;
}

const SIDED = new Set(["arm", "forearm", "hand", "thigh", "shank", "foot"]);

function buildJoints(): Record<string, JointDef> {
  const j: Record<string, JointDef> = {};
  for (const s of [1, -1]) {
    const k = s > 0 ? "L" : "R";
    j[`shoulder.${k}`] = {
      seg: `arm.${k}`,
      dof: {
        flex: { axis: "x", sign: -1, min: -60, max: 180 },
        abd: { axis: "z", sign: s, min: -40, max: 180 },
        rot: { axis: "y", sign: s, min: -90, max: 90 },
      },
    };
    j[`elbow.${k}`] = { seg: `forearm.${k}`, dof: { flex: { axis: "x", sign: -1, min: 0, max: 150 } } };
    j[`wrist.${k}`] = {
      seg: `hand.${k}`,
      dof: { flex: { axis: "x", sign: -1, min: -70, max: 80 }, dev: { axis: "z", sign: s, min: -25, max: 25 } },
    };
    j[`hip.${k}`] = {
      seg: `thigh.${k}`,
      dof: {
        flex: { axis: "x", sign: -1, min: -30, max: 120 },
        abd: { axis: "z", sign: s, min: -30, max: 60 },
        rot: { axis: "y", sign: s, min: -45, max: 45 },
      },
    };
    j[`knee.${k}`] = { seg: `shank.${k}`, dof: { flex: { axis: "x", sign: 1, min: 0, max: 140 } } };
    j[`ankle.${k}`] = { seg: `foot.${k}`, dof: { flex: { axis: "x", sign: -1, min: -45, max: 25 } } };
  }
  j["neck"] = {
    seg: "head",
    dof: {
      flex: { axis: "x", sign: 1, min: -40, max: 60 },
      rot: { axis: "y", sign: 1, min: -80, max: 80 },
      tilt: { axis: "z", sign: -1, min: -40, max: 40 },
    },
  };
  j["jaw"] = { seg: "jaw", dof: { open: { axis: "x", sign: 1, min: 0, max: 30 } } };
  return j;
}

export const JOINTS = buildJoints();

export interface Anatomy {
  root: THREE.Group;
  parts: PartRec[];
  segs: Record<string, THREE.Group>;
}

export function buildAnatomy(): Anatomy {
  const root = new THREE.Group();
  const segs: Record<string, { g: THREE.Group; world: V3 }> = {};
  const parts: PartRec[] = [];

  function seg(name: string, parent: string | null, pos: V3) {
    const g = new THREE.Group();
    g.name = `seg:${name}`;
    const pw = parent ? segs[parent].world : V(0, 0, 0);
    g.position.copy(pos).sub(pw);
    (parent ? segs[parent].g : root).add(g);
    segs[name] = { g, world: pos.clone() };
  }

  seg("torso", null, V(0, 0, 0));
  seg("head", "torso", V(0, 1.57, -0.02));
  seg("jaw", "head", V(0, 1.615, -0.005));
  for (const s of [1, -1]) {
    const k = s > 0 ? "L" : "R";
    seg(`arm.${k}`, "torso", V(s * 0.185, 1.43, 0));
    seg(`forearm.${k}`, `arm.${k}`, V(s * 0.21, 1.13, -0.005));
    seg(`hand.${k}`, `forearm.${k}`, V(s * 0.235, 0.885, 0.012));
    seg(`thigh.${k}`, "torso", V(s * 0.085, 0.9, 0));
    seg(`shank.${k}`, `thigh.${k}`, V(s * 0.075, 0.495, 0.01));
    seg(`foot.${k}`, `shank.${k}`, V(s * 0.07, 0.085, -0.005));
  }

  const add: Ctx["add"] = (id, obj, segName, o: AddOpts = {}) => {
    const meta = metaFor(id);
    const g = new THREE.Group();
    g.add(obj);
    g.updateMatrixWorld(true);
    const center = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
    const sg = segs[segName];
    if (!sg) throw new Error(`segmen tidak dikenal: ${segName}`);
    const rest = sg.world.clone().negate();
    g.position.copy(rest);
    g.userData.partId = id;
    g.name = id;

    const baseColor = SYSTEM_BY_ID[meta.system].color;
    const matMap = new Map<string, MatRec>();
    const meshes: THREE.Mesh[] = [];
    g.traverse((ch) => {
      const m = ch as THREE.Mesh;
      if (!m.isMesh) return;
      const key = (m.userData.color as string | undefined) ?? o.color ?? baseColor;
      let rec = matMap.get(key);
      if (!rec) {
        const opacity = o.opacity ?? 1;
        rec = {
          mat: new THREE.MeshStandardMaterial({
            color: key,
            roughness: 0.62,
            metalness: 0,
            side: THREE.DoubleSide,
            transparent: opacity < 1,
            opacity,
            depthWrite: opacity >= 1,
          }),
          base: new THREE.Color(key),
          baseOpacity: opacity,
        };
        matMap.set(key, rec);
      }
      m.material = rec.mat;
      meshes.push(m);
    });

    const tags = new Set<string>([...(meta.tags ?? []), ...(o.tags ?? [])]);
    const sb = segName.split(".")[0];
    if (sb === "head" || sb === "jaw") tags.add("head");
    else if (sb === "arm" || sb === "forearm" || sb === "hand") tags.add("upper-limb");
    else if (sb === "thigh" || sb === "shank" || sb === "foot") tags.add("lower-limb");
    else if (center.y > 1.47) tags.add("neck");
    else if (center.y > 1.2) tags.add("thorax");
    else if (center.y > 0.88) tags.add("abdomen");
    else tags.add("pelvis");

    parts.push({
      id,
      base: meta.base,
      side: meta.side,
      system: meta.system,
      tags: [...tags],
      seg: segName,
      obj: g,
      rest,
      c: center.clone(),
      mats: [...matMap.values()],
      meshes,
      pick: o.pick !== false,
    });
    sg.g.add(g);
  };

  const pair: Ctx["pair"] = (id, segBase, build, o) => {
    for (const s of [1, -1]) {
      const k = s > 0 ? "L" : "R";
      const p = (x: number, y: number, z: number) => V(s * x, y, z);
      const sn = SIDED.has(segBase) ? `${segBase}.${k}` : segBase;
      add(`${id}.${k}`, build(s, p), sn, o);
    }
  };

  const ctx: Ctx = { add, pair };
  buildSkeleton(ctx);
  buildOrgans(ctx);
  buildMuscles(ctx);

  root.updateMatrixWorld(true);
  return { root, parts, segs: Object.fromEntries(Object.entries(segs).map(([k, v]) => [k, v.g])) };
}
