import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { decodeModelResponse } from "./download";
import { createExplosionLayout } from "./layout";
import { FreeFlyControls } from "./freecam";
import {
  BP3D_DEFAULT_VISIBLE,
  BP3D_SYSTEMS,
  type BP3DAtlas,
  type BP3DConcept,
  type BP3DPart,
  type BP3DSystemId,
  type BP3DView,
} from "./types";

export interface BP3DMarker {
  id: string;
  partId: string;
  point: [number, number, number];
  label: string;
  note?: string;
  severity: number;
  persistedId?: number;
}

export type BP3DCameraMode = "orbit" | "free";

export class BodyPartsEngine {
  public mount: HTMLElement;
  public overlay: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public orbitControls: OrbitControls;
  public freeControls: FreeFlyControls;

  public atlas: BP3DAtlas | null = null;
  public cameraMode: BP3DCameraMode = "orbit";
  public spinning = false;
  public markMode = false;
  public xrayOn = false;
  public explode = 0;

  public selectedId: string | null = null;
  public highlightedIds = new Set<string>();
  public isolatedId: string | null = null;
  public layers: Record<BP3DSystemId, { visible: boolean; opacity: number }>;
  public markers = new Map<string, BP3DMarker>();

  // Clipping plane
  private clipPlane: THREE.Plane;
  private clipAxis: "x" | "y" | "z" | null = null;

  // GPU Data textures
  private partTexture!: THREE.DataTexture;
  private selectionTexture!: THREE.DataTexture;
  private partData!: Float32Array;
  private selectionData!: Uint8Array;
  private stateWidth = 1;

  // Geometry data
  private pickers: (THREE.Mesh | undefined)[] = [];
  private bounds: THREE.Box3[] = [];
  private centers: THREE.Vector3[] = [];
  private offsets: THREE.Vector3[] = [];
  private mats = new Map<BP3DSystemId, THREE.MeshStandardMaterial>();
  private markerMeshes = new Map<string, THREE.Mesh>();

  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private animFrame = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private dirty = true;
  private layoutKey = "";
  private packingWidth = 1;
  private packingHeight = 1;
  private currentAmount = 0;

  constructor(mount: HTMLElement, overlay: HTMLElement) {
    this.mount = mount;
    this.overlay = overlay;

    // Inisialisasi layer
    this.layers = Object.fromEntries(
      BP3D_SYSTEMS.map((s) => [s.id, { visible: BP3D_DEFAULT_VISIBLE.includes(s.id), opacity: 1 }]),
    ) as Record<BP3DSystemId, { visible: boolean; opacity: number }>;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(mount.clientWidth, mount.clientHeight);
    this.renderer.setClearColor("#fcfcfc");
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.localClippingEnabled = true;
    mount.appendChild(this.renderer.domElement);

    // Scene & Environment
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, mount.clientWidth / mount.clientHeight, 0.005, 100);
    this.camera.position.set(1.4, 1.05, 3.6);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    this.scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();

    // Lighting
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xa7acb2, 1.1));
    const key = new THREE.DirectionalLight(0xfffaf4, 2.3);
    key.position.set(-2, 4, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xe9f0ff, 1.8);
    rim.position.set(2, 2, -3);
    this.scene.add(rim);

    // Platform
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.7, 0.028, 64),
      new THREE.MeshStandardMaterial({ color: 0xefefed, metalness: 0.1, roughness: 0.7 }),
    );
    platform.position.y = -0.016;
    this.scene.add(platform);

    // Controls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.target.set(0, 0.85, 0);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.085;
    this.orbitControls.minDistance = 0.05;
    this.orbitControls.maxDistance = 50;
    this.orbitControls.addEventListener("change", () => {
      this.dirty = true;
      this.emitCamera();
    });

    this.freeControls = new FreeFlyControls(this.camera, this.renderer.domElement);

    // Clipping plane default (mati)
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);

    // Pasang input listeners
    this.setupInteractions();

    // Resize observer
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(mount);

    // Render loop
    this.startLoop();
  }

  // ───────────── EVENT SYSTEM ─────────────
  public on<T = unknown>(ev: string, fn: (data: T) => void): () => void {
    let s = this.listeners.get(ev);
    if (!s) {
      s = new Set();
      this.listeners.set(ev, s);
    }
    s.add(fn as (data: unknown) => void);
    return () => s?.delete(fn as (data: unknown) => void);
  }

  private emit(ev: string, data?: unknown) {
    this.listeners.get(ev)?.forEach((fn) => fn(data));
  }

  private emitCamera() {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const az = THREE.MathUtils.radToDeg(Math.atan2(forward.x, forward.z));
    const el = THREE.MathUtils.radToDeg(Math.asin(forward.y));
    const dist = this.camera.position.distanceTo(this.orbitControls.target);
    this.emit("camera", { az, el, dist, mode: this.cameraMode });
  }

  // ───────────── GEOMETRY & ATLAS LOADING ─────────────
  public async loadAtlas(atlasUrl = "/models/atlas.json") {
    const res = await fetch(atlasUrl);
    if (!res.ok) throw new Error("Gagal mengambil atlas.json");
    this.atlas = (await res.json()) as BP3DAtlas;

    this.stateWidth = THREE.MathUtils.ceilPowerOfTwo(this.atlas.parts.length);
    this.partData = new Float32Array(this.stateWidth * 4);
    this.partTexture = new THREE.DataTexture(this.partData, this.stateWidth, 1, THREE.RGBAFormat, THREE.FloatType);
    this.partTexture.needsUpdate = true;

    this.selectionData = new Uint8Array(this.stateWidth * 4);
    this.selectionTexture = new THREE.DataTexture(this.selectionData, this.stateWidth, 1);
    this.selectionTexture.needsUpdate = true;

    this.centers = this.atlas.parts.map((p) =>
      new THREE.Vector3().fromArray(p.bounds[0]).add(new THREE.Vector3().fromArray(p.bounds[1])).multiplyScalar(0.5),
    );
    this.bounds = this.atlas.parts.map(
      (p) => new THREE.Box3(new THREE.Vector3().fromArray(p.bounds[0]), new THREE.Vector3().fromArray(p.bounds[1])),
    );

    // Buat material shader per sistem
    for (const sys of BP3D_SYSTEMS) {
      this.mats.set(sys.id, this.createSystemMaterial(sys.id));
    }

    // Unduh semua chunk secara paralel (3 stream)
    let cursor = 0;
    let loaded = 0;
    const totalChunks = this.atlas.chunks.length;

    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (cursor < totalChunks && !this.disposed) {
          const ci = cursor++;
          await this.loadChunk(ci);
          loaded++;
          this.emit("progress", Math.round((loaded / totalChunks) * 100));
        }
      }),
    );

    this.updateVisibilityTexture();
    this.dirty = true;
    this.emit("change");
  }

  private createSystemMaterial(systemId: BP3DSystemId): THREE.MeshStandardMaterial {
    const sys = BP3D_SYSTEMS.find((s) => s.id === systemId);
    const color = sys?.color ?? "#aebbb8";
    const isSkin = systemId === "integumentary";

    const m = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.08,
      roughness: 0.53,
      side: THREE.DoubleSide,
      transparent: isSkin,
      opacity: isSkin ? 0.1 : 1,
      depthWrite: !isSkin,
      clippingPlanes: this.clipAxis ? [this.clipPlane] : [],
    });

    m.onBeforeCompile = (shader) => {
      shader.uniforms.partState = { value: this.partTexture };
      shader.uniforms.selectionState = { value: this.selectionTexture };
      shader.uniforms.stateWidth = { value: this.stateWidth };

      shader.vertexShader =
        "attribute float partIndex;\nuniform sampler2D partState;\nuniform sampler2D selectionState;\nuniform float stateWidth;\nvarying float partVisible;\nvarying float partSelected;\n" +
        shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);\nvec4 state = texture2D(partState, stateUv);\ntransformed += state.xyz;\npartVisible = state.w;\npartSelected = texture2D(selectionState, stateUv).r;",
      );

      shader.fragmentShader =
        "varying float partVisible;\nvarying float partSelected;\n" + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;",
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18, 0.44, 0.88), partSelected * 0.75);",
      );
    };

    return m;
  }

  private async loadChunk(ci: number) {
    if (!this.atlas) return;
    const chunk = this.atlas.chunks[ci];
    const isGzip = Boolean(chunk.gzip && typeof DecompressionStream !== "undefined");
    const res = await fetch(isGzip ? chunk.gzip! : chunk.url);
    const buffer = await decodeModelResponse(res, chunk.bytes, isGzip);
    if (this.disposed) return;

    const groups = new Map<string, THREE.BufferGeometry[]>();
    this.atlas.parts.forEach((p, i) => {
      if (p.chunk !== ci) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
      g.boundingBox = this.bounds[i].clone();
      g.computeBoundingSphere();

      const pick = new THREE.Mesh(g);
      pick.matrixAutoUpdate = false;
      this.pickers[i] = pick;
      g.setAttribute("partIndex", new THREE.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1));

      const list = groups.get(p.system) ?? [];
      list.push(g);
      groups.set(p.system, list);
    });

    groups.forEach((geoms, system) => {
      const merged = mergeGeometries(geoms, false);
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, this.mats.get(system as BP3DSystemId));
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    });

    this.dirty = true;
  }

  // ───────────── INTERAKSI, RAYCASTING & PROYEKSI ─────────────
  private setupInteractions() {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const worldBox = new THREE.Box3();
    const hitPoint = new THREE.Vector3();

    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (!this.atlas || this.cameraMode === "free") return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, this.camera);

      let nearest = Infinity;
      let foundIndex = -1;
      let exactPoint: [number, number, number] | null = null;

      this.pickers.forEach((mesh, i) => {
        if (!mesh || this.partData[i * 4 + 3] < 0.5) return;
        worldBox.copy(this.bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits[0] && hits[0].distance < nearest) {
          nearest = hits[0].distance;
          foundIndex = i;
          exactPoint = [hits[0].point.x, hits[0].point.y, hits[0].point.z];
        }
      });

      if (foundIndex >= 0 && exactPoint && this.atlas) {
        const p = this.atlas.parts[foundIndex];
        const pt = exactPoint;

        if (this.markMode) {
          this.emit("markpoint", { partId: p.id, point: pt });
        } else {
          this.select(p.id);
        }
      }
    });

    // Hover tooltip tracking
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      if (!this.atlas || this.cameraMode === "free" || this.markMode) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, this.camera);

      let nearest = Infinity;
      let foundIndex = -1;

      this.pickers.forEach((mesh, i) => {
        if (!mesh || this.partData[i * 4 + 3] < 0.5) return;
        worldBox.copy(this.bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits[0] && hits[0].distance < nearest) {
          nearest = hits[0].distance;
          foundIndex = i;
        }
      });

      if (foundIndex >= 0) {
        const p = this.atlas.parts[foundIndex];
        this.emit("hover", { id: p.id, name: p.name, x: e.clientX, y: e.clientY });
      } else {
        this.emit("hover", null);
      }
    });
  }

  /**
   * PROYEKSI 3D -> 2D (Sangat berguna untuk Smartboard Trido, overlay pin, dan sistem proyeksi eksternal)
   */
  public projectPoint(point: [number, number, number] | THREE.Vector3): {
    x: number;
    y: number;
    inFront: boolean;
    visible: boolean;
  } {
    const v = point instanceof THREE.Vector3 ? point.clone() : new THREE.Vector3(...point);
    v.project(this.camera);

    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((v.x + 1) * rect.width) / 2;
    const y = ((-v.y + 1) * rect.height) / 2;
    const inFront = v.z < 1;
    const visible = inFront && x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;

    return { x, y, inFront, visible };
  }

  /**
   * UNPROYEKSI 2D -> 3D (Raycasting dari titik layar 0..1 atau koordinat piksel)
   */
  public unprojectPoint(screenX: number, screenY: number, isNormalized = false): {
    point: [number, number, number];
    partId: string;
    partName: string;
  } | null {
    if (!this.atlas) return null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const rect = this.renderer.domElement.getBoundingClientRect();

    if (isNormalized) {
      pointer.set(screenX * 2 - 1, -(screenY * 2 - 1));
    } else {
      pointer.set(((screenX - rect.left) / rect.width) * 2 - 1, -((screenY - rect.top) / rect.height) * 2 + 1);
    }

    raycaster.setFromCamera(pointer, this.camera);
    let nearest = Infinity;
    let foundIndex = -1;
    let exactPoint: [number, number, number] | null = null;
    const worldBox = new THREE.Box3();
    const hitPoint = new THREE.Vector3();

    this.pickers.forEach((mesh, i) => {
      if (!mesh || this.partData[i * 4 + 3] < 0.5) return;
      worldBox.copy(this.bounds[i]).translate(mesh.position);
      if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
      const hits = raycaster.intersectObject(mesh, false);
      if (hits[0] && hits[0].distance < nearest) {
        nearest = hits[0].distance;
        foundIndex = i;
        exactPoint = [hits[0].point.x, hits[0].point.y, hits[0].point.z];
      }
    });

    if (foundIndex >= 0 && exactPoint && this.atlas) {
      const p = this.atlas.parts[foundIndex];
      return {
        point: exactPoint,
        partId: p.id,
        partName: p.name,
      };
    }
    return null;
  }

  // ───────────── KONTROL KAMERA ─────────────
  public setCameraMode(mode: BP3DCameraMode) {
    if (this.cameraMode === mode) return;
    this.cameraMode = mode;

    if (mode === "free") {
      this.orbitControls.enabled = false;
      this.freeControls.activate();
    } else {
      this.freeControls.deactivate();
      this.orbitControls.enabled = true;
      this.orbitControls.target.set(0, 0.85, 0);
    }
    this.dirty = true;
    this.emit("change");
  }

  public view(name: BP3DView | string) {
    if (this.cameraMode === "free") this.setCameraMode("orbit");
    const target = this.orbitControls.target;
    const distance = this.camera.position.distanceTo(target) || 3.6;

    const dir = new THREE.Vector3();
    switch (name) {
      case "front":
      case "depan":
        dir.set(0, 0.02, 1);
        break;
      case "back":
      case "belakang":
        dir.set(0, 0.02, -1);
        break;
      case "left":
      case "kiri":
        dir.set(-1, 0.02, 0);
        break;
      case "right":
      case "side":
      case "kanan":
        dir.set(1, 0.02, 0);
        break;
      case "top":
      case "atas":
        dir.set(0, 1, 0.01);
        break;
      case "bottom":
      case "bawah":
        dir.set(0, -1, 0.01);
        break;
      case "three-quarter":
      case "iso":
      default:
        dir.set(0.35, 0.06, 1).normalize();
        break;
    }

    this.camera.position.copy(target).addScaledVector(dir.normalize(), distance);
    this.orbitControls.update();
    this.dirty = true;
    this.emitCamera();
  }

  public focus(idOrName: string) {
    if (!this.atlas) return;
    const p = this.atlas.parts.find(
      (part) => part.id === idOrName || part.conceptId === idOrName || part.name.toLowerCase().includes(idOrName.toLowerCase()),
    );
    if (!p) return;

    const center = new THREE.Vector3().fromArray(p.bounds[0]).add(new THREE.Vector3().fromArray(p.bounds[1])).multiplyScalar(0.5);
    const size = new THREE.Vector3().fromArray(p.bounds[1]).sub(new THREE.Vector3().fromArray(p.bounds[0])).length();
    const dist = Math.max(0.3, size * 2.2);

    this.orbitControls.target.copy(center);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
    this.camera.position.copy(center).addScaledVector(forward, dist);
    this.orbitControls.update();
    this.dirty = true;
    this.emitCamera();
  }

  public spin(on = true) {
    this.spinning = on;
    this.orbitControls.autoRotate = on;
    this.orbitControls.autoRotateSpeed = 2.0;
    this.dirty = true;
    this.emit("change");
  }

  // ───────────── STRUKTUR, HIGHLIGHT & ISOLASI ─────────────
  public select(id: string | null) {
    this.selectedId = id;
    if (id) {
      this.highlightedIds.clear();
      this.highlightedIds.add(id);
    }
    this.updateVisibilityTexture();
    this.dirty = true;
    this.emit("change");
  }

  public highlight(ids: string | string[], opts?: { color?: string; dim?: boolean }) {
    const list = Array.isArray(ids) ? ids : [ids];
    for (const id of list) this.highlightedIds.add(id);
    this.updateVisibilityTexture();
    this.dirty = true;
    this.emit("change");
  }

  public unhighlight() {
    this.highlightedIds.clear();
    this.updateVisibilityTexture();
    this.dirty = true;
    this.emit("change");
  }

  public isolate(id: string | null) {
    this.isolatedId = id;
    if (id) {
      this.selectedId = id;
      this.highlightedIds.add(id);
    }
    this.updateVisibilityTexture();
    this.dirty = true;
    this.emit("change");
  }

  public setLayer(system: BP3DSystemId, o: { visible?: boolean; opacity?: number }) {
    const l = this.layers[system];
    if (!l) return;
    if (o.visible !== undefined) l.visible = o.visible;
    if (o.opacity !== undefined) {
      l.opacity = o.opacity;
      const mat = this.mats.get(system);
      if (mat) {
        mat.opacity = o.opacity;
        mat.transparent = o.opacity < 1;
        mat.depthWrite = o.opacity >= 0.99;
      }
    }
    this.updateVisibilityTexture();
    this.dirty = true;
    this.emit("change");
  }

  public setExplode(factor: number) {
    this.explode = Math.max(0, Math.min(1, factor));
    this.dirty = true;
    this.emit("change");
  }

  public setXray(on: boolean) {
    this.xrayOn = on;
    for (const [sysId, mat] of this.mats.entries()) {
      if (sysId === "integumentary") continue;
      mat.transparent = on;
      mat.opacity = on ? 0.35 : (this.layers[sysId]?.opacity ?? 1);
      mat.depthWrite = !on;
    }
    this.dirty = true;
    this.emit("change");
  }

  // ───────────── CLIPPING PLANES (POTONGAN AKSIS) ─────────────
  public setClip(axis: "x" | "y" | "z" | null, pos = 0, flip = false) {
    this.clipAxis = axis;
    if (!axis) {
      for (const mat of this.mats.values()) mat.clippingPlanes = [];
    } else {
      const normal = new THREE.Vector3();
      if (axis === "x") normal.set(flip ? -1 : 1, 0, 0);
      else if (axis === "y") normal.set(0, flip ? -1 : 1, 0);
      else if (axis === "z") normal.set(0, 0, flip ? -1 : 1);

      this.clipPlane.set(normal, -pos * (flip ? -1 : 1));
      for (const mat of this.mats.values()) mat.clippingPlanes = [this.clipPlane];
    }
    this.dirty = true;
    this.emit("change");
  }

  // ───────────── MARKER & PENANDAAN ─────────────
  public setMarkMode(on: boolean) {
    this.markMode = on;
    this.emit("change");
  }

  public addMarker(m: BP3DMarker) {
    this.markers.set(m.id, m);

    // Buat visual pin 3D di koordinat
    const col = m.severity === 3 ? 0xe03030 : m.severity === 2 ? 0xe08020 : 0x2f6fe0;
    const geom = new THREE.SphereGeometry(0.008, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...m.point);
    mesh.renderOrder = 20;
    this.scene.add(mesh);
    this.markerMeshes.set(m.id, mesh);

    this.dirty = true;
    this.emit("change");
  }

  public removeMarker(id: string) {
    this.markers.delete(id);
    const mesh = this.markerMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.markerMeshes.delete(id);
    }
    this.dirty = true;
    this.emit("change");
  }

  public clearMarkers() {
    this.markers.clear();
    for (const mesh of this.markerMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.markerMeshes.clear();
    this.dirty = true;
    this.emit("change");
  }

  public focusMarker(id: string) {
    const m = this.markers.get(id);
    if (!m) return;
    this.orbitControls.target.set(...m.point);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
    this.camera.position.set(...m.point).addScaledVector(forward, 0.45);
    this.orbitControls.update();
    this.dirty = true;
    this.emitCamera();
  }

  // ───────────── TEXTURE & MESH DISPLACEMENT UPDATE ─────────────
  private updateVisibilityTexture() {
    if (!this.atlas || !this.partData) return;

    this.atlas.parts.forEach((p, i) => {
      const isSelected = this.highlightedIds.has(p.id) || this.selectedId === p.id;
      const sysVisible = this.layers[p.system]?.visible ?? true;
      const isVisible = this.isolatedId ? isSelected : sysVisible || isSelected;

      this.partData[i * 4 + 3] = isVisible ? 1 : 0;
      this.selectionData[i * 4] = isSelected ? 255 : 0;
    });

    this.partTexture.needsUpdate = true;
    this.selectionTexture.needsUpdate = true;
  }

  // ───────────── RENDER LOOP & CLEANUP ─────────────
  private startLoop() {
    const render = () => {
      if (this.disposed) return;
      this.animFrame = requestAnimationFrame(render);
      const dt = Math.min(this.clock.getDelta(), 0.05);

      if (this.cameraMode === "free") {
        this.freeControls.update(dt);
        this.dirty = true;
      } else {
        this.orbitControls.update();
      }

      // Animasikan explode secara halus
      const moving = Math.abs(this.currentAmount - this.explode) > 0.0001;
      if (moving && this.atlas) {
        this.currentAmount = THREE.MathUtils.damp(this.currentAmount, this.explode, 8, dt);
        this.dirty = true;

        const visibleParts = this.atlas.parts.filter((p, i) => this.partData[i * 4 + 3] > 0.5);
        const nextLayoutKey = visibleParts.map((p) => p.id).join(",") + ":" + this.camera.aspect.toFixed(3);

        if (nextLayoutKey !== this.layoutKey) {
          const layout = createExplosionLayout(visibleParts, this.camera.aspect);
          this.packingWidth = layout.width;
          this.packingHeight = layout.height;
          this.atlas.parts.forEach((p, i) => {
            const cell = layout.cells.get(p.id);
            this.offsets[i] = cell ? new THREE.Vector3(cell.x, cell.y + 0.85, 0) : this.centers[i].clone();
          });
          this.layoutKey = nextLayoutKey;
        }

        this.atlas.parts.forEach((p, i) => {
          const c = this.centers[i];
          const dest = this.offsets[i];
          let dx = 0;
          let dy = 0;
          let dz = 0;

          if (this.currentAmount <= 0.45) {
            const t = this.currentAmount / 0.45;
            const group = BP3D_SYSTEMS.findIndex((sys) => sys.id === p.system);
            const angle = (group / BP3D_SYSTEMS.length) * Math.PI * 2;
            dx = Math.sin(angle) * t * 0.48;
            dy = (c.y - 0.85) * t * 0.28;
            dz = Math.cos(angle) * t * 0.48;
          } else {
            const t = (this.currentAmount - 0.45) / 0.55;
            const group = BP3D_SYSTEMS.findIndex((sys) => sys.id === p.system);
            const angle = (group / BP3D_SYSTEMS.length) * Math.PI * 2;
            dx = THREE.MathUtils.lerp(Math.sin(angle) * 0.48, dest.x - c.x, t);
            dy = THREE.MathUtils.lerp((c.y - 0.85) * 0.28, dest.y - c.y, t);
            dz = THREE.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
          }

          this.partData[i * 4 + 0] = dx;
          this.partData[i * 4 + 1] = dy;
          this.partData[i * 4 + 2] = dz;

          const mesh = this.pickers[i];
          if (mesh) {
            mesh.position.set(dx, dy, dz);
            mesh.updateMatrix();
            mesh.updateMatrixWorld(true);
          }
        });

        this.partTexture.needsUpdate = true;
      }

      if (this.dirty || this.cameraMode === "free" || this.spinning || moving) {
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
      }
    };
    render();
  }

  public resize() {
    if (!this.mount) return;
    this.camera.aspect = this.mount.clientWidth / this.mount.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.mount.clientWidth, this.mount.clientHeight);
    this.dirty = true;
  }

  public snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animFrame);
    this.orbitControls.dispose();
    this.freeControls.dispose();
    this.renderer.dispose();
  }
}
