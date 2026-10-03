"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { decodeModelResponse } from "./download";
import { createExplosionLayout } from "./layout";
import { PointerTap } from "./pointer";
import {
  BP3D_DEFAULT_VISIBLE,
  BP3D_SYSTEMS,
  type BP3DAtlas,
  type BP3DConcept,
  type BP3DPart,
  type BP3DSceneState,
  type BP3DSystemId,
  type BP3DView,
} from "./types";

interface BodyPartsViewerProps {
  isZen?: boolean;
  onToggleZen?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const initialSceneState: BP3DSceneState = {
  explode: 0,
  visible: BP3D_DEFAULT_VISIBLE,
  selected: [],
  isolate: false,
  view: "three-quarter",
  rotate: false,
  reset: 0,
};

export default function BodyPartsViewer({
  isZen = false,
  onToggleZen,
  isFullscreen = false,
  onToggleFullscreen,
}: BodyPartsViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [atlas, setAtlas] = useState<BP3DAtlas | null>(null);
  const [state, setState] = useState<BP3DSceneState>(initialSceneState);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showSystems, setShowSystems] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedConcept, setSelectedConcept] = useState<BP3DConcept | null>(null);

  // Muat atlas.json saat komponen pertama kali terpasang
  useEffect(() => {
    const abort = new AbortController();
    fetch("/models/atlas.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Katalog atlas.json tidak dapat dimuat.");
        return r.json();
      })
      .then((data: BP3DAtlas) => setAtlas(data))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => abort.abort();
  }, []);

  const partsMap = useMemo(() => new Map(atlas?.parts.map((p) => [p.id, p])), [atlas]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        BP3D_SYSTEMS.map((s) => [s.id, atlas?.parts.filter((p) => p.system === s.id).length ?? 0]),
      ) as Record<BP3DSystemId, number>,
    [atlas],
  );

  const selectedPart = state.selected[0] ? partsMap.get(state.selected[0]) : null;
  const selectedSystem = selectedPart ? BP3D_SYSTEMS.find((s) => s.id === selectedPart.system) : null;

  // Pencarian konsep FMA
  const searchResults = useMemo(() => {
    if (!atlas) return [];
    const q = query.trim().toLowerCase();
    if (!q) {
      return ["heart", "brain", "liver", "stomach", "spleen", "pancreas", "femur", "kidney", "trachea"]
        .map((name) => atlas.concepts.find((c) => c.name.toLowerCase() === name))
        .filter((c): c is BP3DConcept => !!c);
    }
    return atlas.concepts
      .filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, 50);
  }, [atlas, query]);

  // Scene rendering effect
  useEffect(() => {
    if (!host.current || !atlas) return;
    const el = host.current;
    let disposed = false;
    let frame = 0;
    let dirty = true;
    let ready = false;
    let lastView = "";
    let lastReset = -1;
    let layoutKey = "";
    let amount = 0;
    let lastState: BP3DSceneState | null = null;
    const abort = new AbortController();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setError("WebGL tidak didukung oleh browser Anda.");
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#fcfcfc");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, el.clientWidth / el.clientHeight, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(1.4, 1.05, 3.6);
    controls.target.set(0, 0.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.07;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.96;
    controls.addEventListener("change", () => {
      dirty = true;
    });

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xffffff, 0xa7acb2, 1.05));
    const keyLight = new THREE.DirectionalLight(0xfffaf4, 2.3);
    keyLight.position.set(-2, 4, 3);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xe9f0ff, 1.8);
    rimLight.position.set(2, 2, -3);
    scene.add(rimLight);

    // Platform bawah
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.7, 0.028, 64),
      new THREE.MeshStandardMaterial({ color: 0xf0f0ee, metalness: 0.1, roughness: 0.7 }),
    );
    platform.position.y = -0.016;
    scene.add(platform);

    const width = THREE.MathUtils.ceilPowerOfTwo(atlas.parts.length);
    const data = new Float32Array(width * 4);
    const partTexture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.FloatType);
    partTexture.needsUpdate = true;

    const selectedData = new Uint8Array(width * 4);
    const selectionTexture = new THREE.DataTexture(selectedData, width, 1);
    selectionTexture.needsUpdate = true;

    const pickers: (THREE.Mesh | undefined)[] = [];
    const centers = atlas.parts.map((p) =>
      new THREE.Vector3().fromArray(p.bounds[0]).add(new THREE.Vector3().fromArray(p.bounds[1])).multiplyScalar(0.5),
    );
    const offsets: THREE.Vector3[] = [];
    const bounds = atlas.parts.map(
      (p) => new THREE.Box3(new THREE.Vector3().fromArray(p.bounds[0]), new THREE.Vector3().fromArray(p.bounds[1])),
    );
    let packingWidth = 1;
    let packingHeight = 1;

    // Hover tooltip
    const hoverEl = document.createElement("div");
    hoverEl.className =
      "pointer-events-none absolute z-30 rounded border border-line-strong bg-white/95 px-2.5 py-1 text-[12px] font-medium text-ink shadow-sm backdrop-blur hidden";
    el.appendChild(hoverEl);

    const materialFor = (system: string) => {
      const color = BP3D_SYSTEMS.find((s) => s.id === system)?.color ?? "#aebbb8";
      const m = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.08,
        roughness: 0.53,
        side: THREE.DoubleSide,
        transparent: system === "integumentary",
        opacity: system === "integumentary" ? 0.1 : 1,
        depthWrite: system !== "integumentary",
      });
      m.onBeforeCompile = (shader) => {
        shader.uniforms.partState = { value: partTexture };
        shader.uniforms.selectionState = { value: selectionTexture };
        shader.uniforms.stateWidth = { value: width };
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
    };

    const mats = new Map(BP3D_SYSTEMS.map((s) => [s.id, materialFor(s.id)]));
    let loadedChunks = 0;

    const loadChunk = async (ci: number) => {
      const chunk = atlas.chunks[ci];
      const isCompressed = Boolean(chunk.gzip && typeof DecompressionStream !== "undefined");
      const url = isCompressed ? chunk.gzip! : chunk.url;
      const res = await fetch(url, { signal: abort.signal });
      const buffer = await decodeModelResponse(res, chunk.bytes, isCompressed);
      if (disposed) return;

      const groups = new Map<string, THREE.BufferGeometry[]>();
      atlas.parts.forEach((p, i) => {
        if (p.chunk !== ci) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3));
        g.setAttribute(
          "normal",
          new THREE.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true),
        );
        g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
        g.boundingBox = bounds[i].clone();
        g.computeBoundingSphere();
        const pick = new THREE.Mesh(g);
        pick.matrixAutoUpdate = false;
        pickers[i] = pick;
        g.setAttribute("partIndex", new THREE.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1));

        const list = groups.get(p.system) ?? [];
        list.push(g);
        groups.set(p.system, list);
      });

      groups.forEach((gs, system) => {
        const merged = mergeGeometries(gs, false);
        if (!merged) return;
        const mesh = new THREE.Mesh(merged, mats.get(system as BP3DSystemId));
        mesh.frustumCulled = false;
        scene.add(mesh);
      });

      loadedChunks++;
      setProgress(Math.round((loadedChunks / atlas.chunks.length) * 100));
      dirty = true;
    };

    // Muat 3 chunk paralel sekaligus
    (async () => {
      try {
        let cursor = 0;
        await Promise.all(
          Array.from({ length: 3 }, async () => {
            while (cursor < atlas.chunks.length) {
              const i = cursor++;
              await loadChunk(i);
            }
          }),
        );
        if (!disposed) {
          ready = true;
          dirty = true;
        }
      } catch (err: unknown) {
        if (!disposed) setError(err instanceof Error ? err.message : "Gagal memuat geometri anatomi.");
      }
    })();

    const fit = (viewName: string, extent = 0) => {
      const isMobile = el.clientWidth < 768;
      const normalDistance = isMobile ? 4.2 : 3.6;
      const direction =
        viewName === "front"
          ? new THREE.Vector3(0, 0.02, 1)
          : viewName === "back"
          ? new THREE.Vector3(0, 0.02, -1)
          : viewName === "side"
          ? new THREE.Vector3(1, 0.02, 0)
          : new THREE.Vector3(0.35, 0.06, 1).normalize();

      controls.target.set(0, 0.85, 0);
      camera.position.copy(controls.target).addScaledVector(direction, normalDistance);
      controls.update();
      dirty = true;
    };

    const resize = () => {
      layoutKey = "";
      lastState = null;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      fit(state.view, amount);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const tap = new PointerTap();
    const worldBox = new THREE.Box3();
    const hitPoint = new THREE.Vector3();

    const onPointerDown = (e: PointerEvent) => {
      hoverEl.style.display = "none";
      tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === "touch" ? 12 : 5);
    };

    const onPointerMove = (e: PointerEvent) => {
      tap.move(e.pointerId, e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      const validTap = tap.up(e.pointerId, e.clientX, e.clientY);
      if (!validTap || !ready) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);

      let nearest = Infinity;
      let found = -1;
      pickers.forEach((mesh, i) => {
        if (!mesh || data[i * 4 + 3] < 0.5) return;
        worldBox.copy(bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits[0] && hits[0].distance < nearest) {
          nearest = hits[0].distance;
          found = i;
        }
      });

      if (found >= 0) {
        const p = atlas.parts[found];
        setState((s) => ({ ...s, selected: [p.id], isolate: false }));
        setSelectedConcept({ id: p.conceptId, name: p.name, elements: [p.id] });
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const clock = new THREE.Clock();

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      if (state.rotate) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.8;
      } else {
        controls.autoRotate = false;
      }

      controls.update();

      const moving = Math.abs(amount - state.explode) > 0.0001;
      if (moving) {
        amount = THREE.MathUtils.damp(amount, state.explode, 8, dt);
        dirty = true;
      }

      const changed =
        lastState?.visible !== state.visible ||
        lastState?.selected !== state.selected ||
        lastState?.isolate !== state.isolate;

      if (changed || moving) {
        const visible = new Set(state.visible);
        const selection = new Set(state.selected);
        const visibleParts = atlas.parts.filter((p) =>
          state.isolate ? selection.has(p.id) : visible.has(p.system) || selection.has(p.id),
        );

        const nextLayoutKey = visibleParts.map((p) => p.id).join(",") + ":" + camera.aspect.toFixed(3);
        if (nextLayoutKey !== layoutKey) {
          const layout = createExplosionLayout(visibleParts, camera.aspect);
          packingWidth = layout.width;
          packingHeight = layout.height;
          atlas.parts.forEach((p, i) => {
            const cell = layout.cells.get(p.id);
            offsets[i] = cell ? new THREE.Vector3(cell.x, cell.y + 0.85, 0) : centers[i].clone();
          });
          layoutKey = nextLayoutKey;
        }

        atlas.parts.forEach((p, i) => {
          const c = centers[i];
          const dest = offsets[i];
          let dx = 0;
          let dy = 0;
          let dz = 0;

          if (amount <= 0.45) {
            const t = amount / 0.45;
            const group = BP3D_SYSTEMS.findIndex((sys) => sys.id === p.system);
            const angle = (group / BP3D_SYSTEMS.length) * Math.PI * 2;
            dx = Math.sin(angle) * t * 0.48;
            dy = (c.y - 0.85) * t * 0.28;
            dz = Math.cos(angle) * t * 0.48;
          } else {
            const t = (amount - 0.45) / 0.55;
            const group = BP3D_SYSTEMS.findIndex((sys) => sys.id === p.system);
            const angle = (group / BP3D_SYSTEMS.length) * Math.PI * 2;
            dx = THREE.MathUtils.lerp(Math.sin(angle) * 0.48, dest.x - c.x, t);
            dy = THREE.MathUtils.lerp((c.y - 0.85) * 0.28, dest.y - c.y, t);
            dz = THREE.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
          }

          const isSelected = selection.has(p.id);
          const isVis = state.isolate ? isSelected : visible.has(p.system) || isSelected;

          data.set([dx, dy, dz, isVis ? 1 : 0], i * 4);
          selectedData[i * 4] = isSelected ? 255 : 0;

          const mesh = pickers[i];
          if (mesh) {
            mesh.position.set(dx, dy, dz);
            mesh.updateMatrix();
            mesh.updateMatrixWorld(true);
          }
        });

        partTexture.needsUpdate = true;
        selectionTexture.needsUpdate = true;
        lastState = state;
        dirty = true;
      }

      if (state.view !== lastView || state.reset !== lastReset) {
        fit(state.view, amount);
        lastView = state.view;
        lastReset = state.reset;
      }

      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      abort.abort();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      if (hoverEl.parentElement) {
        hoverEl.parentElement.removeChild(hoverEl);
      }
    };
  }, [atlas, state]);

  const selectConcept = (c: BP3DConcept) => {
    setSelectedConcept(c);
    setState((s) => ({ ...s, selected: c.elements, isolate: false, rotate: false }));
    setShowSearch(false);
  };

  const toggleSystem = (id: BP3DSystemId) => {
    setState((s) => ({
      ...s,
      selected: [],
      isolate: false,
      visible: s.visible.includes(id) ? s.visible.filter((x) => x !== id) : [...s.visible, id],
    }));
  };

  const resetAll = () => {
    setState({
      ...initialSceneState,
      reset: state.reset + 1,
    });
    setSelectedConcept(null);
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-white">
      {/* Container Three.js Mount */}
      <div ref={host} className="absolute inset-0" />

      {/* Indikator Loading */}
      {progress < 100 && !error && (
        <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm z-30">
          <div className="text-center max-w-xs px-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            <h4 className="mt-3 text-[13.5px] font-semibold text-ink">Memuat Model Medis BodyParts3D 4.0</h4>
            <p className="mt-1 text-[11.5px] text-faint">
              Mengunduh 2.234 struktur & 15 sistem anatomi ({progress}%)
            </p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded bg-line">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center z-30">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Floating Toolbar Kanan Atas */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded border border-line-strong bg-white/95 p-1 shadow-sm backdrop-blur">
        {/* Tombol Pemilih Sistem */}
        <button
          className={`btn !h-7 !px-2.5 !text-[11.5px] ${showSystems ? "!border-accent !bg-wash" : ""}`}
          onClick={() => {
            setShowSystems((v) => !v);
            setShowSearch(false);
          }}
          title="Tampilkan Pemilih 15 Sistem Tubuh"
        >
          Sistem ({state.visible.length}/15)
        </button>

        {/* Tombol Pencarian Konsep */}
        <button
          className={`btn !h-7 !px-2.5 !text-[11.5px] ${showSearch ? "!border-accent !bg-wash" : ""}`}
          onClick={() => {
            setShowSearch((v) => !v);
            setShowSystems(false);
          }}
          title="Cari 3.432 Struktur Anatomi FMA"
        >
          Cari
        </button>

        <div className="h-4 w-px bg-line" />

        {/* Mode Zen */}
        {onToggleZen && (
          <button
            className={`flex h-7 items-center gap-1 px-2.5 text-[11.5px] font-medium transition-colors ${
              isZen ? "bg-accent-deep text-white" : "bg-wash text-ink hover:text-accent-deep"
            }`}
            onClick={onToggleZen}
            title="Layar Penuh / Sembunyikan Semua Panel ( Z )"
          >
            {isZen ? "Keluar Zen" : "Layar Penuh"}
          </button>
        )}

        {/* Fullscreen Browser */}
        {onToggleFullscreen && (
          <button
            className="flex h-7 w-7 items-center justify-center text-ink-soft hover:bg-wash hover:text-ink"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Keluar Layar Penuh ( F )" : "Layar Penuh Browser ( F )"}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              {isFullscreen ? (
                <path d="M4 10h4v4M12 10H8v4M4 6h4V2M12 6H8V2" />
              ) : (
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Drawer Pemilih 15 Sistem Tubuh */}
      {showSystems && (
        <div className="absolute right-3 top-12 z-30 w-72 rounded border border-line-strong bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5">
            <span className="text-[12.5px] font-semibold text-ink">15 Sistem Tubuh BodyParts3D</span>
            <button className="text-[11px] text-faint hover:text-ink" onClick={() => setShowSystems(false)}>
              ✕ Tutup
            </button>
          </div>

          <div className="mb-2 flex gap-1">
            <button
              className="btn !h-6 !px-2 !text-[11px] flex-1"
              onClick={() => setState((s) => ({ ...s, visible: BP3D_SYSTEMS.map((x) => x.id) }))}
            >
              Semua
            </button>
            <button
              className="btn !h-6 !px-2 !text-[11px] flex-1"
              onClick={() => setState((s) => ({ ...s, visible: ["skeletal"] }))}
            >
              Rangka
            </button>
            <button
              className="btn !h-6 !px-2 !text-[11px] flex-1"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  visible: ["cardiac", "respiratory", "digestive", "urinary", "endocrine"],
                }))
              }
            >
              Organ
            </button>
            <button
              className="btn !h-6 !px-2 !text-[11px] flex-1"
              onClick={() => setState((s) => ({ ...s, visible: ["arterial", "venous", "nervous"] }))}
            >
              Saraf & Darah
            </button>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto thin-scroll">
            {BP3D_SYSTEMS.map((s) => {
              const active = state.visible.includes(s.id);
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleSystem(s.id)}
                      className="cursor-pointer"
                    />
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className={active ? "text-ink font-medium" : "text-faint"}>{s.nameId}</span>
                  </label>
                  <span className="font-mono text-[10.5px] text-faint">{counts[s.id] ?? 0}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Panel Pencarian Struktur */}
      {showSearch && (
        <div className="absolute right-3 top-12 z-30 w-80 rounded border border-line-strong bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5">
            <span className="text-[12.5px] font-semibold text-ink">Cari Struktur Anatomi (3.432 Konsep)</span>
            <button className="text-[11px] text-faint hover:text-ink" onClick={() => setShowSearch(false)}>
              ✕ Tutup
            </button>
          </div>
          <input
            type="text"
            className="field !h-7 text-[12px] w-full mb-2"
            placeholder="Ketik nama organ atau tulang (Inggris / Latin)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="space-y-1 max-h-60 overflow-y-auto thin-scroll">
            {searchResults.map((c) => (
              <button
                key={c.id}
                className="w-full text-left px-2 py-1 rounded text-[12px] hover:bg-wash flex items-center justify-between"
                onClick={() => selectConcept(c)}
              >
                <span className="text-ink truncate">{c.name}</span>
                <span className="font-mono text-[10px] text-faint ml-2 shrink-0">{c.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kartu Detail Struktur yang Dipilih */}
      {selectedConcept && (
        <div className="absolute left-3 top-3 z-20 w-72 rounded border border-line-strong bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedSystem?.color ?? "#2f6fe0" }}
              />
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                {selectedSystem?.nameId ?? "Struktur"}
              </span>
            </div>
            <button
              className="text-[11px] text-faint hover:text-ink"
              onClick={() => {
                setSelectedConcept(null);
                setState((s) => ({ ...s, selected: [], isolate: false }));
              }}
            >
              ✕
            </button>
          </div>

          <h3 className="mt-1.5 text-[13.5px] font-bold text-ink leading-snug">{selectedConcept.name}</h3>
          <p className="mt-1 text-[11.5px] text-ink-soft leading-relaxed">
            {selectedSystem?.description ?? "Bagian dari anatomi referensi BodyParts3D."}
          </p>

          <div className="mt-2.5 flex gap-1.5">
            <button
              className={`btn !h-6 !px-2.5 !text-[11px] flex-1 ${state.isolate ? "btn-primary" : ""}`}
              onClick={() => setState((s) => ({ ...s, isolate: !s.isolate }))}
            >
              {state.isolate ? "Batalkan Isolasi" : "Isolasi Struktur"}
            </button>
          </div>
        </div>
      )}

      {/* Kontrol Bawah: Sudut Pandang, Explode, dan Reset */}
      <div className="absolute inset-x-0 bottom-3 z-20 flex flex-wrap items-center justify-center gap-2 px-3">
        {/* Sudut Kamera */}
        <div className="flex overflow-hidden rounded border border-line-strong bg-white/95 shadow-sm backdrop-blur">
          {(
            [
              ["three-quarter", "¾ Iso"],
              ["front", "Depan"],
              ["side", "Samping"],
              ["back", "Belakang"],
            ] as [BP3DView, string][]
          ).map(([v, label], idx) => (
            <button
              key={v}
              className={`h-7 px-2.5 text-[12px] font-medium text-ink-soft hover:bg-tint hover:text-ink ${
                idx > 0 ? "border-l border-line" : ""
              } ${state.view === v ? "!bg-wash !text-ink" : ""}`}
              onClick={() => setState((s) => ({ ...s, view: v, reset: s.reset + 1 }))}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Kontrol Penguraian (Explode Anatomy) */}
        <div className="flex items-center gap-2 rounded border border-line-strong bg-white/95 px-3 py-1 shadow-sm backdrop-blur">
          <span className="text-[11.5px] text-faint font-medium">Urai Model:</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={state.explode}
            onChange={(e) => setState((s) => ({ ...s, explode: Number(e.target.value) }))}
            className="w-24 cursor-pointer"
            title="Urai struktur anatomi ke dalam ruang spasial"
          />
          <span className="font-mono text-[11px] text-ink min-w-[32px]">
            {Math.round(state.explode * 100)}%
          </span>
        </div>

        {/* Tombol Reset */}
        <button className="btn" onClick={resetAll} title="Reset sudut pandang dan lapisan anatomi">
          Reset
        </button>
      </div>
    </div>
  );
}
