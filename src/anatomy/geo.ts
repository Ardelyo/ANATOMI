import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type V3 = THREE.Vector3;
export const V = (x: number, y: number, z: number): V3 => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const PH = new THREE.MeshStandardMaterial();

export interface AddOpts {
  color?: string;
  opacity?: number;
  pick?: boolean;
  tags?: string[];
}

export interface Ctx {
  add: (id: string, obj: THREE.Object3D, seg: string, o?: AddOpts) => void;
  pair: (
    id: string,
    segBase: string,
    build: (s: number, p: (x: number, y: number, z: number) => V3) => THREE.Object3D,
    o?: AddOpts,
  ) => void;
}

// ───────────── Selubung tubuh (dipakai otot, kulit, tulang pipih)
const ENV_Y = [0.8, 0.85, 0.95, 1.05, 1.15, 1.22, 1.3, 1.38, 1.45, 1.5];
const ENV_RX = [0.14, 0.145, 0.165, 0.15, 0.138, 0.15, 0.165, 0.17, 0.15, 0.07];
const ENV_RZ = [0.085, 0.09, 0.11, 0.115, 0.115, 0.12, 0.125, 0.115, 0.09, 0.06];
const ENV_ZC = [-0.03, -0.03, -0.025, -0.02, -0.015, -0.01, -0.008, -0.005, -0.01, -0.005];

function tab(t: number[], y: number): number {
  if (y <= ENV_Y[0]) return t[0];
  for (let i = 1; i < ENV_Y.length; i++) {
    if (y <= ENV_Y[i]) {
      const f = (y - ENV_Y[i - 1]) / (ENV_Y[i] - ENV_Y[i - 1]);
      return t[i - 1] + (t[i] - t[i - 1]) * f;
    }
  }
  return t[t.length - 1];
}

export const env = (y: number) => ({ rx: tab(ENV_RX, y), rz: tab(ENV_RZ, y), zc: tab(ENV_ZC, y) });

/** Titik pada permukaan punggung (z negatif) untuk x tertentu. */
export function backPt(x: number, y: number, inset = 0): V3 {
  const e = env(y);
  const rx = e.rx - inset;
  const rz = e.rz - inset;
  const k = Math.sqrt(Math.max(0, 1 - Math.min(0.999, (x * x) / (rx * rx))));
  return V(x, y, e.zc - rz * k);
}

// ───────────── Interpolasi radius
export function sample(r: number[], t: number): number {
  if (r.length === 1) return r[0];
  const p = Math.min(Math.max(t, 0), 1) * (r.length - 1);
  const i = Math.min(Math.floor(p), r.length - 2);
  const f = p - i;
  const s = f * f * (3 - 2 * f);
  return r[i] + (r[i + 1] - r[i]) * s;
}

// ───────────── Mesh helpers
export function mk(geom: THREE.BufferGeometry, color?: string): THREE.Mesh {
  const m = new THREE.Mesh(geom, PH);
  if (color) m.userData.color = color;
  return m;
}

export function grp(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

export function sph(c: V3, r: number, color?: string, seg = 14): THREE.Mesh {
  const m = mk(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), color);
  m.position.copy(c);
  return m;
}

export interface EllOpts {
  rot?: [number, number, number];
  warp?: (p: V3) => void;
  color?: string;
  seg?: number;
}

/** Elipsoid dengan transformasi dipanggang ke dalam geometri (koordinat dunia). */
export function ell(c: V3, r: [number, number, number], o: EllOpts = {}): THREE.Mesh {
  const seg = o.seg ?? 20;
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.72));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0])));
  g.applyMatrix4(new THREE.Matrix4().compose(c, q, V(r[0], r[1], r[2])));
  if (o.warp) {
    const pos = g.attributes.position;
    const p = V(0, 0, 0);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      o.warp(p);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    g = mergeVertices(g, 1e-5);
    g.computeVertexNormals();
  }
  return mk(g, o.color);
}

export function cyl(a: V3, b: V3, ra: number, rb = ra, color?: string, seg = 10): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = mk(new THREE.CylinderGeometry(rb, ra, len, seg, 1), color);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

export function box(c: V3, size: [number, number, number], rot: [number, number, number] = [0, 0, 0], color?: string) {
  const m = mk(new THREE.BoxGeometry(size[0], size[1], size[2]), color);
  m.position.copy(c);
  m.rotation.set(rot[0], rot[1], rot[2]);
  return m;
}

export function torus(c: V3, r: number, tube: number, rot: [number, number, number] = [0, 0, 0], color?: string, arc = Math.PI * 2) {
  const m = mk(new THREE.TorusGeometry(r, tube, 8, 24, arc), color);
  m.position.copy(c);
  m.rotation.set(rot[0], rot[1], rot[2]);
  return m;
}

/** Tabung dengan radius konstan melalui titik-titik. */
export function tube(points: V3[], r: number, color?: string, radial = 8): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  return mk(new THREE.TubeGeometry(curve, Math.max(6, points.length * 6), r, radial, false), color);
}

/** Tabung dengan radius berubah sepanjang lintasan + penutup bulat. */
export function varTube(
  points: V3[],
  radii: number[],
  o: { color?: string; radial?: number; segs?: number; caps?: boolean } = {},
): THREE.Group {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  const segs = o.segs ?? Math.max(8, points.length * 6);
  const radial = o.radial ?? 10;
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position;
  const p = V(0, 0, 0);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = sample(radii, t);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, p.x, p.y, p.z);
    }
  }
  pos.needsUpdate = true;
  const out = grp(mk(g, o.color));
  if (o.caps !== false) {
    out.add(sph(points[0], radii[0], o.color, 10));
    out.add(sph(points[points.length - 1], radii[radii.length - 1], o.color, 10));
  }
  return out;
}

/** Gelondong otot / tulang panjang (lathe) dari titik a ke b. */
export function spindle(
  a: V3,
  b: V3,
  radii: number[],
  o: { seg?: number; flat?: [number, number]; color?: string } = {},
): THREE.Mesh {
  const len = a.distanceTo(b);
  const n = 18;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, 0)];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector2(Math.max(0.0005, sample(radii, t)), t * len));
  }
  pts.push(new THREE.Vector2(0.0001, len));
  const g = new THREE.LatheGeometry(pts, o.seg ?? 14);
  if (o.flat) g.scale(o.flat[0], 1, o.flat[1]);
  const m = mk(g, o.color);
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return m;
}

export interface Ring {
  y: number;
  rx: number;
  rz: number;
  cx?: number;
  cz?: number;
}

/** Loft cincin elips horizontal (badan, sakrum, kulit). */
export function loft(rings: Ring[], seg = 28, color?: string): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) {
    for (let j = 0; j <= seg; j++) {
      const f = (j / seg) * Math.PI * 2;
      pos.push((r.cx ?? 0) + r.rx * Math.cos(f), r.y, (r.cz ?? 0) + r.rz * Math.sin(f));
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j;
      const b = a + 1;
      const d = (i + 1) * (seg + 1) + j;
      const c = d + 1;
      idx.push(a, c, b, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mk(g, color);
}

export interface PatchOpts {
  y0: number;
  y1: number;
  th0: (v: number) => number;
  th1: (v: number) => number;
  inset?: number;
  bulge?: number;
  s?: number;
  nu?: number;
  nv?: number;
  color?: string;
}

/**
 * Lembaran yang mengikuti permukaan badan: theta=0 depan, PI/2 samping, PI belakang.
 * Dipakai untuk otot lebar (trapezius, pektoralis...) dan tulang pipih (belikat, usus).
 */
export function patch(o: PatchOpts): { mesh: THREE.Mesh; at: (u: number, v: number) => V3 } {
  const nu = o.nu ?? 10;
  const nv = o.nv ?? 12;
  const s = o.s ?? 1;
  const at = (u: number, v: number): V3 => {
    const y = o.y0 + (o.y1 - o.y0) * v;
    const e = env(y);
    const th = o.th0(v) + (o.th1(v) - o.th0(v)) * u;
    const bl = (o.bulge ?? 0) * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.6) * Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.6);
    const rx = e.rx - (o.inset ?? 0) + bl;
    const rz = e.rz - (o.inset ?? 0) + bl;
    return V(s * rx * Math.sin(th), y, e.zc + rz * Math.cos(th));
  };
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= nv; i++) {
    for (let j = 0; j <= nu; j++) {
      const p = at(j / nu, i / nv);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < nv; i++) {
    for (let j = 0; j < nu; j++) {
      const a = i * (nu + 1) + j;
      const b = a + 1;
      const d = (i + 1) * (nu + 1) + j;
      const c = d + 1;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { mesh: mk(g, o.color), at };
}
