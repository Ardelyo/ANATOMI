import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildAnatomy, JOINTS, type Anatomy, type PartRec } from "./build";
import { metaFor, SYSTEMS, type SystemId } from "./catalog";

export type Target = string | PartRec | Array<string | PartRec>;
export type Ease = "linear" | "easeIn" | "easeOut" | "easeInOut";
type AnyFn = (payload: never) => void;

export interface LayerState {
  visible: boolean;
  opacity: number;
}

export interface MarkerInput {
  id?: string;
  partId?: string;
  /** titik dalam koordinat lokal bagian (atau dunia bila partId kosong) */
  point?: [number, number, number];
  label: string;
  severity?: number;
  always?: boolean;
  persistedId?: number;
}

interface Marker {
  id: string;
  part: PartRec | null;
  local: THREE.Vector3;
  label: string;
  severity: number;
  always: boolean;
  persistedId?: number;
  el: HTMLElement;
  occluded: boolean;
}

interface Rt {
  offset: THREE.Vector3;
  rot: THREE.Euler;
  scale: THREE.Vector3;
}

interface Anim {
  key?: string;
  t: number;
  dur: number;
  ease: Ease;
  fn: (k: number) => void;
  loop: false | "repeat" | "pingpong";
  count: number;
  cycles: number;
  dir: 1 | -1;
  resolve: () => void;
}

interface Loop {
  fn: (time: number, dt: number) => void;
  onStop?: () => void;
}

const EASE: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

const ACCENT = new THREE.Color("#2f6fe0");
const DEG = Math.PI / 180;
const CENTER = new THREE.Vector3(0, 0.84, 0);

export const VIEWS: Record<string, { az: number; el: number }> = {
  front: { az: 0, el: 0.04 },
  back: { az: Math.PI, el: 0.04 },
  left: { az: Math.PI / 2, el: 0.04 },
  right: { az: -Math.PI / 2, el: 0.04 },
  top: { az: 0, el: 1.45 },
  bottom: { az: 0, el: -1.45 },
  iso: { az: 0.6, el: 0.2 },
};
const VIEW_ALIAS: Record<string, string> = {
  depan: "front",
  anterior: "front",
  belakang: "back",
  posterior: "back",
  kiri: "left",
  kanan: "right",
  atas: "top",
  superior: "top",
  bawah: "bottom",
  inferior: "bottom",
};

export const POSES: Record<string, Record<string, Record<string, number>>> = {
  rest: {},
  tpose: { "shoulder.L": { abd: 90 }, "shoulder.R": { abd: 90 } },
  "arms-up": { "shoulder.L": { abd: 165 }, "shoulder.R": { abd: 165 } },
  reach: { "shoulder.L": { flex: 90 }, "shoulder.R": { flex: 90 } },
  sit: {
    "hip.L": { flex: 90 },
    "hip.R": { flex: 90 },
    "knee.L": { flex: 90 },
    "knee.R": { flex: 90 },
    "shoulder.L": { flex: 10 },
    "shoulder.R": { flex: 10 },
  },
  stride: {
    "hip.L": { flex: 30 },
    "hip.R": { flex: -15 },
    "knee.R": { flex: 25 },
    "shoulder.L": { flex: -20 },
    "shoulder.R": { flex: 25 },
    "elbow.R": { flex: 15 },
  },
};

export class AnatomyEngine {
  readonly anatomy: Anatomy;
  readonly parts: PartRec[];
  readonly byId = new Map<string, PartRec[]>();
  private byKey = new Map<string, PartRec[]>();

  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private container: HTMLElement;
  private overlay: HTMLElement;
  private raf = 0;
  private ro: ResizeObserver;
  private last = performance.now();
  private elapsed = 0;
  private frame = 0;

  layers = {} as Record<SystemId, LayerState>;
  private hidden = new Set<PartRec>();
  private isolated: { set: Set<PartRec>; dim: boolean } | null = null;
  private highlights = new Map<PartRec, { color: THREE.Color; intensity: number }>();
  private dimOthers = false;
  private partOpacity = new Map<PartRec, number>();
  xrayOn = false;
  selectedId: string | null = null;
  private hoveredId: string | null = null;
  markMode = false;

  private rt = new Map<PartRec, Rt>();
  private dirty = new Set<PartRec>();
  private jointVals = new Map<string, Record<string, number>>();
  private anims = new Set<Anim>();
  private loops = new Map<string, Loop>();
  private pickables: THREE.Mesh[] = [];
  private markers = new Map<string, Marker>();
  private markerSeq = 0;
  private clip: THREE.Plane | null = null;
  private listeners = new Map<string, Set<AnyFn>>();
  private down: { x: number; y: number } | null = null;
  private hoverPending = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(container: HTMLElement, overlay: HTMLElement) {
    this.container = container;
    this.overlay = overlay;

    this.anatomy = buildAnatomy();
    this.parts = this.anatomy.parts;
    for (const p of this.parts) {
      this.rt.set(p, { offset: new THREE.Vector3(), rot: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) });
      const l = this.byId.get(p.id) ?? [];
      l.push(p);
      this.byId.set(p.id, l);
      const keys = new Set<string>([p.id, p.base, p.system, ...p.tags]);
      if (p.side) for (const k of [p.base, p.system, ...p.tags]) keys.add(`${k}.${p.side}`);
      for (const k of keys) {
        const lk = k.toLowerCase();
        const arr = this.byKey.get(lk) ?? [];
        arr.push(p);
        this.byKey.set(lk, arr);
      }
    }
    for (const s of SYSTEMS) this.layers[s.id] = { visible: s.visible, opacity: s.opacity };

    this.scene.add(this.anatomy.root);
    this.scene.add(this.buildFloor());

    const hemi = new THREE.HemisphereLight(0xffffff, 0xc9d8ee, 1.25);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2, 3.2, 3);
    const fill = new THREE.DirectionalLight(0xdfe9fb, 0.9);
    fill.position.set(-3, 1.5, -2);
    const back = new THREE.DirectionalLight(0xffffff, 0.8);
    back.position.set(0.5, 2, -3.5);
    this.scene.add(hemi, key, fill, back);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0xffffff, 0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 40);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.rotateSpeed = 0.8;
    this.controls.minDistance = 0.22;
    this.controls.maxDistance = 8;
    this.controls.screenSpacePanning = true;
    this.controls.target.copy(CENTER);
    this.placeCamera(0.55, 0.14, 3.1, CENTER);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerleave", this.onLeave);

    this.applyAll();
    this.loop();
  }

  // ───────────── Event emitter
  on<T = unknown>(ev: string, fn: (p: T) => void): () => void {
    const set = this.listeners.get(ev) ?? new Set();
    set.add(fn as unknown as AnyFn);
    this.listeners.set(ev, set);
    return () => set.delete(fn as unknown as AnyFn);
  }
  private emit(ev: string, payload?: unknown) {
    this.listeners.get(ev)?.forEach((fn) => (fn as (p: unknown) => void)(payload));
  }

  // ───────────── Scene extras
  private buildFloor() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.45, 72),
      new THREE.MeshBasicMaterial({ color: 0xe9f0fb, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.002;
    g.add(disc);
    const line = new THREE.LineBasicMaterial({ color: 0xa9c0e4, transparent: true, opacity: 0.9 });
    for (const r of [0.55, 1.0, 1.45]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) pts.push(new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * r, 0, Math.sin((i / 96) * Math.PI * 2) * r));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), line));
    }
    const ticks: THREE.Vector3[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r0 = 1.45;
      const r1 = i % 6 === 0 ? 1.58 : 1.51;
      ticks.push(new THREE.Vector3(Math.cos(a) * r0, 0, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * r1, 0, Math.sin(a) * r1));
    }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), line));
    const axis = new THREE.LineBasicMaterial({ color: 0x7ea2dc });
    const ax: THREE.Vector3[] = [new THREE.Vector3(0, 0, -1.45), new THREE.Vector3(0, 0, 1.45), new THREE.Vector3(-1.45, 0, 0), new THREE.Vector3(1.45, 0, 0)];
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ax), axis));
    return g;
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerleave", this.onLeave);
    this.controls.dispose();
    this.clearMarkers(true);
    this.renderer.dispose();
    el.remove();
  }

  // ───────────── Resolusi target
  resolve(t: Target | null | undefined): PartRec[] {
    if (t == null) return [];
    if (Array.isArray(t)) return [...new Set(t.flatMap((x) => this.resolve(x)))];
    if (typeof t !== "string") return [t];
    const q = t.trim().toLowerCase();
    if (!q) return [];
    if (q === "all" || q === "*") return this.parts.filter((p) => p.pick);
    const hit = this.byKey.get(q);
    if (hit) return hit;
    if (q.endsWith("*")) {
      const pre = q.slice(0, -1);
      return this.parts.filter((p) => p.id.toLowerCase().startsWith(pre));
    }
    return [];
  }

  find(query: string): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out = new Set<string>();
    for (const p of this.parts) {
      if (!p.pick) continue;
      const m = metaFor(p.id);
      if (p.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.latin.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q))) out.add(p.id);
    }
    return [...out];
  }

  uniqueIds(): string[] {
    return [...this.byId.keys()].filter((id) => this.byId.get(id)![0].pick);
  }

  // ───────────── Status tampilan
  private partVisible(p: PartRec) {
    if (!this.layers[p.system].visible) return false;
    if (this.hidden.has(p)) return false;
    if (this.isolated && !this.isolated.dim && !this.isolated.set.has(p)) return false;
    return true;
  }

  private applyPart(p: PartRec) {
    const vis = this.partVisible(p);
    p.obj.visible = vis;
    if (!vis) return;
    let k = this.partOpacity.get(p) ?? this.layers[p.system].opacity;
    if (this.xrayOn && p.system !== "integumentary") k *= 0.35;
    const hl = this.highlights.get(p);
    if (this.isolated?.dim && !this.isolated.set.has(p)) k *= 0.1;
    if (this.dimOthers && this.highlights.size > 0 && !hl && p.system !== "integumentary") k *= 0.12;
    const selected = this.selectedId === p.id;
    const hovered = this.hoveredId === p.id;
    for (const m of p.mats) {
      const o = k * m.baseOpacity;
      m.mat.opacity = o;
      const tr = o < 0.999;
      if (m.mat.transparent !== tr) {
        m.mat.transparent = tr;
        m.mat.needsUpdate = true;
      }
      m.mat.depthWrite = !tr;
      if (hl) m.mat.emissive.copy(hl.color).multiplyScalar(hl.intensity);
      else if (selected) m.mat.emissive.copy(ACCENT).multiplyScalar(0.55);
      else if (hovered) m.mat.emissive.copy(ACCENT).multiplyScalar(0.28);
      else m.mat.emissive.setRGB(0, 0, 0);
    }
  }

  private applyAll() {
    for (const p of this.parts) this.applyPart(p);
    this.pickables = [];
    for (const p of this.parts) if (p.pick && p.obj.visible) this.pickables.push(...p.meshes);
    this.emit("change");
  }

  // ───────────── Visibilitas & layer
  show(t: Target) {
    const ps = this.resolve(t);
    ps.forEach((p) => {
      this.hidden.delete(p);
      this.layers[p.system].visible = true;
    });
    this.applyAll();
  }
  hide(t: Target) {
    this.resolve(t).forEach((p) => this.hidden.add(p));
    this.applyAll();
  }
  isolate(t: Target | null, o: { dim?: boolean } = {}) {
    if (t == null) {
      this.isolated = null;
    } else {
      const set = new Set(this.resolve(t));
      set.forEach((p) => {
        this.layers[p.system].visible = true;
        this.hidden.delete(p);
      });
      this.isolated = { set, dim: !!o.dim };
    }
    this.applyAll();
  }
  layer(system: SystemId | string, o: { visible?: boolean; opacity?: number }) {
    const l = this.layers[system as SystemId];
    if (!l) return;
    if (o.visible !== undefined) l.visible = o.visible;
    if (o.opacity !== undefined) l.opacity = Math.min(1, Math.max(0, o.opacity));
    this.applyAll();
  }
  opacity(t: Target, value: number) {
    this.resolve(t).forEach((p) => this.partOpacity.set(p, Math.min(1, Math.max(0, value))));
    this.applyAll();
  }
  xray(on = true) {
    this.xrayOn = on;
    this.applyAll();
  }
  showAll() {
    this.hidden.clear();
    this.isolated = null;
    for (const s of SYSTEMS) this.layers[s.id].visible = true;
    this.applyAll();
  }

  /** Pastikan layer bagian tampil agar highlight terlihat. */
  reveal(t: Target) {
    for (const p of this.resolve(t)) {
      this.layers[p.system].visible = true;
      this.hidden.delete(p);
    }
  }

  // ───────────── Highlight & seleksi
  highlight(t: Target, o: { color?: string; intensity?: number; dim?: boolean; reveal?: boolean } = {}) {
    const ps = this.resolve(t);
    if (o.reveal !== false) this.reveal(ps);
    const color = new THREE.Color(o.color ?? "#e0605f");
    for (const p of ps) this.highlights.set(p, { color, intensity: o.intensity ?? 0.6 });
    if (o.dim !== undefined) this.dimOthers = o.dim;
    this.applyAll();
    return ps.map((p) => p.id);
  }
  unhighlight(t?: Target) {
    if (t === undefined) {
      this.highlights.clear();
      this.dimOthers = false;
    } else this.resolve(t).forEach((p) => this.highlights.delete(p));
    if (this.highlights.size === 0) this.dimOthers = false;
    this.applyAll();
  }
  highlighted(): string[] {
    return [...new Set([...this.highlights.keys()].map((p) => p.id))];
  }
  blink(t: Target, o: { color?: string; times?: number; period?: number } = {}) {
    const ps = this.resolve(t);
    this.reveal(ps);
    const color = new THREE.Color(o.color ?? "#e0605f");
    const period = (o.period ?? 700) / 1000;
    const times = o.times ?? 4;
    const key = `blink:${ps.map((p) => p.id).join(",")}`;
    return this.run(key, period * times * 1000, "linear", (k) => {
      const v = 0.5 - 0.5 * Math.cos(k * times * Math.PI * 2);
      for (const p of ps) this.highlights.set(p, { color, intensity: 0.15 + 0.7 * v });
      ps.forEach((p) => this.applyPart(p));
    }).then(() => {
      ps.forEach((p) => this.highlights.delete(p));
      this.applyAll();
    });
  }

  select(id: string | null) {
    const prev = this.selectedId;
    this.selectedId = id;
    for (const pid of [prev, id]) if (pid) this.byId.get(pid)?.forEach((p) => this.applyPart(p));
    this.emit("select", id);
    this.emit("change");
  }

  // ───────────── Transform bagian
  private rtOf(p: PartRec) {
    return this.rt.get(p)!;
  }
  private markDirty(p: PartRec) {
    this.dirty.add(p);
  }
  private flush() {
    if (this.dirty.size === 0) return;
    const tmp = new THREE.Vector3();
    for (const p of this.dirty) {
      const r = this.rtOf(p);
      p.obj.scale.copy(r.scale);
      p.obj.rotation.copy(r.rot);
      tmp.copy(p.c).multiply(r.scale).applyEuler(r.rot);
      p.obj.position.copy(p.rest).add(r.offset).add(p.c).sub(tmp);
    }
    this.dirty.clear();
  }

  resetTransforms() {
    for (const p of this.parts) {
      const r = this.rtOf(p);
      r.offset.set(0, 0, 0);
      r.rot.set(0, 0, 0);
      r.scale.set(1, 1, 1);
      this.markDirty(p);
    }
  }

  // ───────────── Sistem animasi
  private run(
    key: string | undefined,
    durationMs: number,
    ease: Ease,
    fn: (k: number) => void,
    o: { loop?: false | "repeat" | "pingpong"; count?: number; delay?: number } = {},
  ): Promise<void> {
    if (key) this.stop(key);
    return new Promise((resolve) => {
      this.anims.add({
        key,
        t: -(o.delay ?? 0) / 1000,
        dur: Math.max(0.001, durationMs / 1000),
        ease,
        fn,
        loop: o.loop ?? false,
        count: o.count ?? Infinity,
        cycles: 0,
        dir: 1,
        resolve,
      });
    });
  }

  private runLoop(key: string, fn: (time: number, dt: number) => void, onStop?: () => void) {
    this.stop(key);
    this.loops.set(key, { fn, onStop });
  }

  stop(key?: string) {
    if (key === undefined) {
      this.stopAll();
      return;
    }
    for (const a of [...this.anims]) {
      if (a.key === key) {
        this.anims.delete(a);
        a.resolve();
      }
    }
    const l = this.loops.get(key);
    if (l) {
      this.loops.delete(key);
      l.onStop?.();
    }
  }

  stopAll() {
    for (const a of [...this.anims]) {
      this.anims.delete(a);
      a.resolve();
    }
    for (const [k, l] of [...this.loops]) {
      this.loops.delete(k);
      l.onStop?.();
    }
    this.controls.autoRotate = false;
    this.emit("change");
  }

  activeAnimations(): string[] {
    return [...new Set([...this.anims].map((a) => a.key).filter((k): k is string => !!k).concat([...this.loops.keys()]))];
  }

  private stepAnims(dt: number) {
    for (const a of [...this.anims]) {
      a.t += dt;
      if (a.t < 0) continue;
      let k = Math.min(1, a.t / a.dur);
      const kk = a.dir > 0 ? k : 1 - k;
      a.fn(EASE[a.ease](kk));
      if (k >= 1) {
        if (a.loop) {
          a.cycles += a.loop === "pingpong" ? 0.5 : 1;
          if (a.cycles >= a.count) {
            this.anims.delete(a);
            a.resolve();
          } else {
            a.t -= a.dur;
            if (a.loop === "pingpong") a.dir = a.dir > 0 ? -1 : 1;
          }
        } else {
          this.anims.delete(a);
          a.resolve();
        }
      }
      k = 0;
    }
    for (const l of this.loops.values()) l.fn(this.elapsed, dt);
  }

  /** Animasi properti bagian: move [x,y,z] (m), rotate [x,y,z] (derajat), scale n|[x,y,z], opacity 0..1. */
  tween(
    t: Target,
    props: { move?: [number, number, number]; rotate?: [number, number, number]; scale?: number | [number, number, number]; opacity?: number },
    o: { duration?: number; ease?: Ease; loop?: false | "repeat" | "pingpong"; count?: number; delay?: number; key?: string } = {},
  ) {
    const ps = this.resolve(t);
    if (ps.length === 0) return Promise.resolve();
    this.reveal(ps);
    const toOff = props.move ? new THREE.Vector3(...props.move) : null;
    const toRot = props.rotate ? new THREE.Euler(props.rotate[0] * DEG, props.rotate[1] * DEG, props.rotate[2] * DEG) : null;
    const toSc = props.scale === undefined ? null : typeof props.scale === "number" ? new THREE.Vector3(props.scale, props.scale, props.scale) : new THREE.Vector3(...props.scale);
    const from = ps.map((p) => {
      const r = this.rtOf(p);
      return { p, r, off: r.offset.clone(), rot: r.rot.clone(), sc: r.scale.clone(), op: this.partOpacity.get(p) ?? this.layers[p.system].opacity };
    });
    const key = o.key ?? `tween:${ps[0].id}:${Object.keys(props).join("+")}`;
    return this.run(
      key,
      o.duration ?? 800,
      o.ease ?? "easeInOut",
      (k) => {
        for (const f of from) {
          if (toOff) f.r.offset.lerpVectors(f.off, toOff, k);
          if (toRot) f.r.rot.set(f.rot.x + (toRot.x - f.rot.x) * k, f.rot.y + (toRot.y - f.rot.y) * k, f.rot.z + (toRot.z - f.rot.z) * k);
          if (toSc) f.r.scale.lerpVectors(f.sc, toSc, k);
          if (props.opacity !== undefined) this.partOpacity.set(f.p, f.op + (props.opacity - f.op) * k);
          this.markDirty(f.p);
          if (props.opacity !== undefined) this.applyPart(f.p);
        }
      },
      { loop: o.loop, count: o.count, delay: o.delay },
    );
  }

  // ───────────── Animasi fisiologis
  heartbeat(on: boolean | number = true) {
    const key = "heartbeat";
    if (on === false) return this.stop(key);
    const bpm = typeof on === "number" ? on : 72;
    const vent = this.resolve(["left-ventricle", "right-ventricle"]);
    const atria = this.resolve(["left-atrium", "right-atrium"]);
    const art = this.resolve(["aorta", "pulmonary-trunk"]);
    this.reveal([...vent, ...atria, ...art]);
    const g = (x: number, c: number, w: number) => Math.exp(-Math.pow((x - c) / w, 2));
    const set = (ps: PartRec[], s: number) => {
      for (const p of ps) {
        this.rtOf(p).scale.setScalar(s);
        this.markDirty(p);
      }
    };
    this.runLoop(
      key,
      (time) => {
        const ph = (time * bpm / 60) % 1;
        const sys = g(ph, 0.2, 0.07) + 0.35 * g(ph, 0.4, 0.06);
        const atr = g(ph, 0.05, 0.05);
        set(vent, 1 - 0.09 * sys);
        set(atria, 1 - 0.08 * atr);
        set(art, 1 + 0.05 * g(ph, 0.27, 0.08));
      },
      () => {
        set(vent, 1);
        set(atria, 1);
        set(art, 1);
      },
    );
    this.emit("change");
  }

  breathe(on: boolean | number = true) {
    const key = "breathe";
    if (on === false) return this.stop(key);
    const rate = typeof on === "number" ? on : 14;
    const lungs = this.resolve("lung");
    const dia = this.resolve("diaphragm");
    const cage = this.resolve(["ribcage"]);
    this.reveal([...lungs, ...dia]);
    const apply = (b: number) => {
      for (const p of lungs) {
        this.rtOf(p).scale.set(1 + 0.05 * b, 1 + 0.07 * b, 1 + 0.06 * b);
        this.markDirty(p);
      }
      for (const p of dia) {
        const r = this.rtOf(p);
        r.scale.set(1, 1 - 0.3 * b, 1);
        r.offset.set(0, -0.014 * b, 0);
        this.markDirty(p);
      }
      for (const p of cage) {
        this.rtOf(p).offset.set(0, 0.005 * b, 0.007 * b);
        this.markDirty(p);
      }
    };
    this.runLoop(
      key,
      (time) => apply(0.5 - 0.5 * Math.cos((time * rate * Math.PI * 2) / 60)),
      () => apply(0),
    );
    this.emit("change");
  }

  pulse(t: Target, o: { bpm?: number; amount?: number } = {}) {
    const ps = this.resolve(t);
    if (ps.length === 0) return;
    this.reveal(ps);
    const bpm = o.bpm ?? 60;
    const amt = o.amount ?? 0.08;
    const key = `pulse:${ps[0].id}`;
    this.runLoop(
      key,
      (time) => {
        const s = 1 + amt * (0.5 - 0.5 * Math.cos((time * bpm * Math.PI * 2) / 60));
        for (const p of ps) {
          this.rtOf(p).scale.setScalar(s);
          this.markDirty(p);
        }
      },
      () => {
        for (const p of ps) {
          this.rtOf(p).scale.setScalar(1);
          this.markDirty(p);
        }
      },
    );
    this.emit("change");
  }

  explode(factor: number, o: { duration?: number } = {}) {
    const order: SystemId[] = ["muscular", "skeletal", "circulatory", "respiratory", "digestive", "nervous", "urinary", "endocrine"];
    const mid = (order.length - 1) / 2;
    const ps = this.parts.filter((p) => p.system !== "integumentary");
    const from = ps.map((p) => this.rtOf(p).offset.x);
    const to = ps.map((p) => (order.indexOf(p.system) - mid) * 0.5 * factor);
    if (factor > 0) for (const s of order) this.layers[s].visible = true;
    this.applyAll();
    return this.run("explode", o.duration ?? 1000, "easeInOut", (k) => {
      ps.forEach((p, i) => {
        this.rtOf(p).offset.x = from[i] + (to[i] - from[i]) * k;
        this.markDirty(p);
      });
    }).then(() => {
      if (factor > 0) this.focusAll();
    });
  }

  // ───────────── Sendi & pose
  jointNames(): string[] {
    return Object.keys(JOINTS);
  }
  jointInfo() {
    return Object.fromEntries(Object.entries(JOINTS).map(([k, v]) => [k, Object.fromEntries(Object.entries(v.dof).map(([d, x]) => [d, [x.min, x.max]]))]));
  }
  private applyJoint(name: string) {
    const def = JOINTS[name];
    const g = this.anatomy.segs[def.seg];
    const vals = this.jointVals.get(name) ?? {};
    const e = new THREE.Euler();
    for (const [k, d] of Object.entries(def.dof)) {
      const v = Math.min(d.max, Math.max(d.min, vals[k] ?? 0));
      e[d.axis] += v * d.sign * DEG;
    }
    g.rotation.copy(e);
  }
  jointValue(name: string): Record<string, number> {
    return { ...(this.jointVals.get(name) ?? {}) };
  }
  private expandJoint(name: string): string[] {
    if (JOINTS[name]) return [name];
    return [`${name}.L`, `${name}.R`].filter((n) => JOINTS[n]);
  }
  joint(name: string, angles: number | Record<string, number>, o: { duration?: number; ease?: Ease } = {}) {
    const names = this.expandJoint(name);
    if (names.length === 0) return Promise.reject(new Error(`sendi tidak dikenal: ${name}. Pilihan: ${this.jointNames().join(", ")}`));
    const jobs = names.map((n) => {
      const def = JOINTS[n];
      const target = typeof angles === "number" ? { [Object.keys(def.dof)[0]]: angles } : angles;
      const from = { ...(this.jointVals.get(n) ?? {}) };
      return { n, from, target };
    });
    const dur = o.duration ?? 700;
    if (dur <= 0) {
      jobs.forEach((j) => {
        this.jointVals.set(j.n, { ...j.from, ...j.target });
        this.applyJoint(j.n);
      });
      return Promise.resolve();
    }
    return this.run(`joint:${name}`, dur, o.ease ?? "easeInOut", (k) => {
      for (const j of jobs) {
        const v: Record<string, number> = { ...j.from };
        for (const [d, to] of Object.entries(j.target)) v[d] = (j.from[d] ?? 0) + (to - (j.from[d] ?? 0)) * k;
        this.jointVals.set(j.n, v);
        this.applyJoint(j.n);
      }
    });
  }
  pose(name: string, o: { duration?: number } = {}) {
    const pz = POSES[name];
    if (!pz) return Promise.reject(new Error(`pose tidak dikenal: ${name}. Pilihan: ${Object.keys(POSES).join(", ")}`));
    this.stop("walk");
    const dur = o.duration ?? 900;
    const jobs: Promise<void>[] = [];
    for (const n of Object.keys(JOINTS)) {
      const cur = this.jointVals.get(n) ?? {};
      const target: Record<string, number> = {};
      for (const d of Object.keys(JOINTS[n].dof)) target[d] = pz[n]?.[d] ?? 0;
      if (Object.keys(cur).length === 0 && Object.values(target).every((v) => v === 0)) continue;
      jobs.push(this.joint(n, target, { duration: dur }));
    }
    return Promise.all(jobs).then(() => undefined);
  }
  walk(on: boolean | number = true) {
    if (on === false) {
      this.stop("walk");
      return;
    }
    const speed = typeof on === "number" ? on : 1;
    this.runLoop(
      "walk",
      (time) => {
        const w = time * Math.PI * 2 * speed * 0.9;
        const leg = (ph: number, side: "L" | "R") => {
          const hip = 28 * Math.sin(w + ph);
          const knee = Math.max(0, 55 * Math.sin(w + ph - 1.1)) + 4;
          this.jointVals.set(`hip.${side}`, { flex: hip });
          this.jointVals.set(`knee.${side}`, { flex: knee });
          this.jointVals.set(`ankle.${side}`, { flex: -8 * Math.sin(w + ph) });
          this.applyJoint(`hip.${side}`);
          this.applyJoint(`knee.${side}`);
          this.applyJoint(`ankle.${side}`);
        };
        const arm = (ph: number, side: "L" | "R") => {
          this.jointVals.set(`shoulder.${side}`, { flex: 22 * Math.sin(w + ph + Math.PI) });
          this.jointVals.set(`elbow.${side}`, { flex: 14 + 10 * Math.max(0, Math.sin(w + ph + Math.PI)) });
          this.applyJoint(`shoulder.${side}`);
          this.applyJoint(`elbow.${side}`);
        };
        leg(0, "L");
        leg(Math.PI, "R");
        arm(0, "L");
        arm(Math.PI, "R");
      },
      () => void this.pose("rest", { duration: 500 }),
    );
    this.emit("change");
  }

  // ───────────── Kamera
  private camSpherical() {
    const off = this.camera.position.clone().sub(this.controls.target);
    const dist = off.length();
    return { az: Math.atan2(off.x, off.z), el: Math.asin(off.y / dist), dist };
  }
  private placeCamera(az: number, el: number, dist: number, target: THREE.Vector3) {
    this.controls.target.copy(target);
    this.camera.position.set(target.x + dist * Math.cos(el) * Math.sin(az), target.y + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az));
    this.camera.lookAt(target);
    this.controls.update();
  }
  cameraTo(az: number, el: number, dist: number, target: THREE.Vector3, durationMs = 900): Promise<void> {
    this.controls.autoRotate = false;
    const s = this.camSpherical();
    const t0 = this.controls.target.clone();
    let dAz = az - s.az;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    if (durationMs <= 0) {
      this.placeCamera(az, el, dist, target);
      return Promise.resolve();
    }
    return this.run("cam", durationMs, "easeInOut", (k) => {
      const tg = t0.clone().lerp(target, k);
      this.placeCamera(s.az + dAz * k, s.el + (el - s.el) * k, s.dist + (dist - s.dist) * k, tg);
    });
  }
  view(name: string, o: { duration?: number; distance?: number } = {}) {
    const key = VIEW_ALIAS[name.toLowerCase()] ?? name.toLowerCase();
    const v = VIEWS[key];
    if (!v) return Promise.reject(new Error(`tampilan tidak dikenal: ${name}. Pilihan: ${Object.keys(VIEWS).join(", ")}`));
    return this.cameraTo(v.az, v.el, o.distance ?? 3.1, CENTER, o.duration ?? 900);
  }
  orbit(azDeg: number, elDeg: number, o: { distance?: number; duration?: number } = {}) {
    const s = this.camSpherical();
    return this.cameraTo(azDeg * DEG, elDeg * DEG, o.distance ?? s.dist, this.controls.target.clone(), o.duration ?? 900);
  }
  boundsOf(t: Target): THREE.Box3 | null {
    const ps = this.resolve(t).filter((p) => p.obj.visible);
    const list = ps.length ? ps : this.resolve(t);
    if (list.length === 0) return null;
    const box = new THREE.Box3();
    for (const p of list) {
      p.obj.updateMatrixWorld(true);
      box.union(new THREE.Box3().setFromObject(p.obj));
    }
    return box;
  }
  focus(t: Target, o: { duration?: number; distance?: number; azimuth?: number; elevation?: number } = {}) {
    const box = this.boundsOf(t);
    if (!box) return Promise.resolve();
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = o.distance ?? Math.min(6, Math.max(0.35, (sphere.radius / Math.tan((this.camera.fov * DEG) / 2)) * 1.4));
    const s = this.camSpherical();
    return this.cameraTo(o.azimuth !== undefined ? o.azimuth * DEG : s.az, o.elevation !== undefined ? o.elevation * DEG : s.el, dist, sphere.center, o.duration ?? 900);
  }
  focusAll() {
    const s = this.camSpherical();
    return this.cameraTo(s.az, s.el, 3.1, CENTER, 700);
  }
  resetView() {
    return this.cameraTo(0.55, 0.14, 3.1, CENTER, 800);
  }
  spin(on: boolean | number = true) {
    this.controls.autoRotate = on !== false;
    this.controls.autoRotateSpeed = typeof on === "number" ? on : 1.6;
    this.emit("change");
  }
  get spinning() {
    return this.controls.autoRotate;
  }
  zoom(dist: number, o: { duration?: number } = {}) {
    const s = this.camSpherical();
    return this.cameraTo(s.az, s.el, dist, this.controls.target.clone(), o.duration ?? 600);
  }

  // ───────────── Potongan (clipping)
  setClip(axis: "x" | "y" | "z" | null, pos = 0, flip = false) {
    if (!axis) {
      this.clip = null;
      this.renderer.clippingPlanes = [];
      this.emit("change");
      return;
    }
    const n = new THREE.Vector3(axis === "x" ? -1 : 0, axis === "y" ? -1 : 0, axis === "z" ? -1 : 0);
    if (flip) n.negate();
    this.clip = new THREE.Plane(n, flip ? -pos : pos);
    this.renderer.clippingPlanes = [this.clip];
    this.emit("change");
  }

  // ───────────── Pick & input
  private ndc(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  pickAt(clientX: number, clientY: number): { part: PartRec; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (const h of hits) {
      if (this.clip && this.clip.distanceToPoint(h.point) < 0) continue;
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.partId) o = o.parent;
      if (!o) continue;
      const part = this.parts.find((p) => p.obj === o);
      if (part) return { part, point: h.point };
    }
    return null;
  }

  /** Identifikasi bagian pada koordinat layar ternormalisasi (0..1) relatif kanvas. */
  identify(nx: number, ny: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const hit = this.pickAt(r.left + nx * r.width, r.top + ny * r.height);
    if (!hit) return null;
    return this.describe(hit.part.id);
  }

  describe(id: string) {
    const m = metaFor(id);
    const ps = this.byId.get(id);
    return { id, name: m.name, latin: m.latin, system: m.system, description: m.desc, tags: ps ? ps[0].tags : m.tags ?? [] };
  }

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };
  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    const hit = this.pickAt(e.clientX, e.clientY);
    if (this.markMode) {
      if (hit) {
        const local = hit.part.obj.worldToLocal(hit.point.clone());
        this.emit("markpoint", { partId: hit.part.id, point: [local.x, local.y, local.z] as [number, number, number], x: e.clientX, y: e.clientY });
      }
      return;
    }
    this.select(hit ? hit.part.id : null);
  };
  private onMove = (e: PointerEvent) => {
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (this.down || this.hoverPending) return;
    this.hoverPending = true;
    requestAnimationFrame(() => {
      this.hoverPending = false;
      const hit = this.pickAt(this.lastPointer.x, this.lastPointer.y);
      const id = hit ? hit.part.id : null;
      if (id !== this.hoveredId) {
        const prev = this.hoveredId;
        this.hoveredId = id;
        for (const pid of [prev, id]) if (pid) this.byId.get(pid)?.forEach((p) => this.applyPart(p));
        this.renderer.domElement.style.cursor = id ? (this.markMode ? "crosshair" : "pointer") : this.markMode ? "crosshair" : "grab";
      }
      this.emit("hover", id ? { id, x: this.lastPointer.x, y: this.lastPointer.y } : null);
    });
  };
  private onLeave = () => {
    if (this.hoveredId) {
      const prev = this.hoveredId;
      this.hoveredId = null;
      this.byId.get(prev)?.forEach((p) => this.applyPart(p));
    }
    this.emit("hover", null);
  };

  setMarkMode(on: boolean) {
    this.markMode = on;
    this.renderer.domElement.style.cursor = on ? "crosshair" : "grab";
    this.emit("change");
  }

  // ───────────── Penanda (pin) pada model
  addMarker(m: MarkerInput): string {
    const id = m.id ?? `m${++this.markerSeq}`;
    this.removeMarker(id);
    const part = m.partId ? this.byId.get(m.partId)?.[0] ?? null : null;
    const local = new THREE.Vector3(...(m.point ?? [0, 0, 0]));
    if (!m.point && part) {
      const box = this.boundsOf(part.id);
      if (box) local.copy(part.obj.worldToLocal(box.getCenter(new THREE.Vector3())));
    }
    if (part) this.reveal(part);
    const el = document.createElement("div");
    el.className = "pin";
    el.dataset.sev = String(m.severity ?? 1);
    if (m.always) el.dataset.always = "1";
    el.innerHTML = `<span class="pin-dot"></span><span class="pin-label"></span>`;
    (el.querySelector(".pin-label") as HTMLElement).textContent = m.label;
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.emit("markerclick", id);
    });
    this.overlay.appendChild(el);
    this.markers.set(id, { id, part, local, label: m.label, severity: m.severity ?? 1, always: !!m.always, persistedId: m.persistedId, el, occluded: false });
    this.emit("change");
    return id;
  }
  removeMarker(id: string) {
    const m = this.markers.get(id);
    if (!m) return;
    m.el.remove();
    this.markers.delete(id);
    this.emit("change");
  }
  clearMarkers(includePersisted = false) {
    for (const m of [...this.markers.values()]) {
      if (m.persistedId !== undefined && !includePersisted) continue;
      m.el.remove();
      this.markers.delete(m.id);
    }
    this.emit("change");
  }
  listMarkers() {
    return [...this.markers.values()].map((m) => ({ id: m.id, partId: m.part?.id ?? null, label: m.label, severity: m.severity, persistedId: m.persistedId }));
  }
  markerWorld(id: string): THREE.Vector3 | null {
    const m = this.markers.get(id);
    if (!m) return null;
    return m.part ? m.part.obj.localToWorld(m.local.clone()) : m.local.clone();
  }
  focusMarker(id: string) {
    const w = this.markerWorld(id);
    if (!w) return Promise.resolve();
    const s = this.camSpherical();
    return this.cameraTo(s.az, s.el, Math.min(s.dist, 1.0), w, 800);
  }

  /**
   * PINPOINT HIGHLIGHT:
   * Menyorot target secara presisi mikro, mengarahkan kamera swoop-in close-up dramatis,
   * menancapkan pin 3D berdenyut, meredupkan struktur lain, dan menghasilkan visual diagnostik.
   */
  async pinpoint(
    t: Target,
    o: {
      point?: [number, number, number];
      label?: string;
      severity?: number;
      duration?: number;
      distance?: number;
      azimuth?: number;
      elevation?: number;
      color?: string;
    } = {},
  ) {
    const ps = this.resolve(t);
    if (ps.length === 0) return null;
    const p = ps[0];
    this.reveal(p);

    // Sorot pinpoint dengan dim struktur lain
    this.highlight(p.id, { color: o.color ?? "#e03030", dim: true, intensity: 0.8 });

    // Tambahkan marker visual
    const markerId = this.addMarker({
      partId: p.id,
      label: o.label ?? metaFor(p.id).name,
      severity: o.severity ?? 3,
      point: o.point,
      always: true,
    });

    // Kamera meluncur dramatis close-up ke pinpoint target
    await this.focus(p.id, {
      duration: o.duration ?? 1200,
      distance: o.distance,
      azimuth: o.azimuth,
      elevation: o.elevation,
    });

    return { id: markerId, partId: p.id };
  }

  private updateMarkers() {
    if (this.markers.size === 0) return;
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const test = this.frame % 6 === 0;
    const v = new THREE.Vector3();
    for (const m of this.markers.values()) {
      const world = m.part ? m.part.obj.localToWorld(m.local.clone()) : m.local.clone();
      v.copy(world).project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && (!m.part || m.part.obj.visible);
      m.el.style.display = visible ? "" : "none";
      if (!visible) continue;
      m.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      if (test) {
        const dir = world.clone().sub(this.camera.position);
        const dist = dir.length();
        this.raycaster.set(this.camera.position, dir.normalize());
        const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
        m.occluded = !!hit && hit.distance < dist - 0.03;
        m.el.dataset.occluded = m.occluded ? "1" : "0";
      }
    }
  }

  // ───────────── Loop render
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.elapsed += dt;
    this.frame++;
    this.stepAnims(dt);
    this.flush();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateMarkers();
    if (this.frame % 4 === 0) {
      const s = this.camSpherical();
      this.emit("camera", { az: s.az / DEG, el: s.el / DEG, dist: s.dist });
    }
  };

  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0);
    return c.toDataURL("image/png");
  }

  state() {
    const s = this.camSpherical();
    return {
      camera: { azimuth: Math.round(s.az / DEG), elevation: Math.round(s.el / DEG), distance: Number(s.dist.toFixed(2)) },
      selected: this.selectedId,
      layers: this.layers,
      highlighted: this.highlighted(),
      hidden: [...new Set([...this.hidden].map((p) => p.id))],
      isolated: this.isolated ? [...new Set([...this.isolated.set].map((p) => p.id))] : null,
      joints: Object.fromEntries([...this.jointVals.entries()]),
      markers: this.listMarkers(),
      animations: this.activeAnimations(),
      xray: this.xrayOn,
    };
  }

  /** Reset menyeluruh: layer, highlight, pose, penanda, kamera. */
  resetAll() {
    this.stopAll();
    this.hidden.clear();
    this.isolated = null;
    this.highlights.clear();
    this.dimOthers = false;
    this.partOpacity.clear();
    this.xrayOn = false;
    for (const s of SYSTEMS) this.layers[s.id] = { visible: s.visible, opacity: s.opacity };
    this.resetTransforms();
    for (const n of Object.keys(JOINTS)) {
      this.jointVals.set(n, {});
      this.applyJoint(n);
    }
    this.setClip(null);
    this.clearMarkers(false);
    this.select(null);
    this.applyAll();
    return this.resetView();
  }
}
