"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import { createApi, type AnatomyApi } from "@/anatomy/script";
import type { BodyPartsEngine } from "@/anatomy/bodyparts3d/engine";
import { createBP3DApi } from "@/anatomy/bodyparts3d/script";
import Viewport from "./Viewport";
import BodyPartsViewer from "@/anatomy/bodyparts3d/BodyPartsViewer";
import LeftPanel from "./LeftPanel";
import InfoTab from "./InfoTab";
import SymptomTab, { type PendingMark } from "./SymptomTab";
import ScriptTab from "./ScriptTab";
import type { Annotation, Condition, Symptom, Tab, ViewMode } from "./types";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    anatomy?: any;
  }
}

const TABS: [Tab, string][] = [
  ["info", "Info"],
  ["symptoms", "Gejala"],
  ["script", "Skrip"],
];

export default function AtlasApp() {
  const [engine, setEngine] = useState<AnatomyEngine | null>(null);
  const [bp3dEngine, setBp3dEngine] = useState<BodyPartsEngine | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [tab, setTab] = useState<Tab>("info");
  const [viewMode, setViewMode] = useState<ViewMode>("simulation");

  // Panel visibility & Fullscreen / Zen states
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [leftMobileOpen, setLeftMobileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pending, setPending] = useState<PendingMark | null>(null);

  const labels = useMemo(() => new Map(symptoms.map((s) => [s.slug, s.label])), [symptoms]);
  const isZen = !leftVisible && !rightVisible && !headerVisible;

  const toggleZen = useCallback(() => {
    if (isZen) {
      setLeftVisible(true);
      setRightVisible(true);
      setHeaderVisible(true);
    } else {
      setLeftVisible(false);
      setRightVisible(false);
      setHeaderVisible(false);
      setLeftMobileOpen(false);
    }
  }, [isZen]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    fetch("/api/symptoms")
      .then((r) => r.json())
      .then((rows: Symptom[]) => setSymptoms(rows))
      .catch(() => undefined);
  }, []);

  // Sambungkan Simulation Engine ↔ React
  useEffect(() => {
    if (!engine) return;
    const offs = [
      engine.on("change", () => rerender()),
      engine.on<{ partId: string; point: [number, number, number] }>("markpoint", (p) => {
        setPending({ partId: p.partId, point: p.point });
        setRightVisible(true);
        setTab("symptoms");
        engine.setMarkMode(false);
      }),
      engine.on<string>("markerclick", (id) => void engine.focusMarker(id)),
    ];

    if (viewMode === "simulation") {
      window.anatomy = createApi(
        engine,
        { aborted: false, cbs: new Set() },
        (level, ...a) => console[level === "ok" ? "log" : level]("[ANATOMI]", ...a),
      );
    }

    return () => {
      offs.forEach((o) => o());
    };
  }, [engine, viewMode]);

  // Sambungkan BodyParts3D Engine ↔ React
  useEffect(() => {
    if (!bp3dEngine) return;
    const offs = [
      bp3dEngine.on("change", () => rerender()),
      bp3dEngine.on<{ partId: string; point: [number, number, number] }>("markpoint", (p) => {
        setPending({ partId: p.partId, point: p.point });
        setRightVisible(true);
        setTab("symptoms");
        bp3dEngine.setMarkMode(false);
      }),
      bp3dEngine.on<string>("markerclick", (id) => bp3dEngine.focusMarker(id)),
    ];

    if (viewMode === "bodyparts3d") {
      window.anatomy = createBP3DApi(
        bp3dEngine,
        { aborted: false, cbs: new Set() },
        (level, ...a) => console[level === "ok" ? "log" : level]("[ANATOMI BP3D]", ...a),
      );
    }

    // Sinkronisasi marker yang ada ke bp3dEngine
    for (const a of annotations) {
      bp3dEngine.addMarker({
        id: `a${a.id}`,
        partId: a.partId,
        point: a.point,
        label: a.label,
        severity: a.severity,
        persistedId: a.id,
      });
    }

    return () => {
      offs.forEach((o) => o());
    };
  }, [bp3dEngine, viewMode, annotations]);

  // Muat anotasi awal dari API
  useEffect(() => {
    fetch("/api/annotations")
      .then((r) => r.json())
      .then((rows: Annotation[]) => {
        setAnnotations(rows);
        for (const a of rows) {
          engine?.addMarker({
            id: `a${a.id}`,
            partId: a.partId,
            point: a.point,
            label: a.label,
            severity: a.severity,
            persistedId: a.id,
          });
          bp3dEngine?.addMarker({
            id: `a${a.id}`,
            partId: a.partId,
            point: a.point,
            label: a.label,
            severity: a.severity,
            persistedId: a.id,
          });
        }
      })
      .catch(() => undefined);
  }, [engine, bp3dEngine]);

  // Pantau status browser fullscreen
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Keyboard shortcuts untuk kendali cepat layar penuh & navigasi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        toggleZen();
      } else if (e.key === "[") {
        e.preventDefault();
        setLeftVisible((v) => !v);
      } else if (e.key === "]") {
        e.preventDefault();
        setRightVisible((v) => !v);
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setHeaderVisible((v) => !v);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape") {
        if (isZen) {
          setLeftVisible(true);
          setRightVisible(true);
          setHeaderVisible(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZen, toggleZen, toggleFullscreen]);

  const onShow = useCallback(
    (c: Condition) => {
      if (viewMode === "simulation" && engine) {
        engine.unhighlight();
        engine.highlight(c.structures, { dim: true, intensity: 0.6 });
        void engine.focus(c.structures);
      } else if (viewMode === "bodyparts3d" && bp3dEngine) {
        bp3dEngine.unhighlight();
        bp3dEngine.highlight(c.structures);
        if (c.structures[0]) bp3dEngine.focus(c.structures[0]);
      }
    },
    [viewMode, engine, bp3dEngine],
  );

  const onFocus = useCallback(
    (s: string) => {
      if (viewMode === "simulation" && engine) {
        engine.reveal(s);
        void engine.focus(s);
      } else if (viewMode === "bodyparts3d" && bp3dEngine) {
        bp3dEngine.focus(s);
      }
    },
    [viewMode, engine, bp3dEngine],
  );

  const savePending = async (f: { label: string; note: string; severity: number }) => {
    if (!pending) return;
    const res = await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pending, ...f }),
    });
    if (!res.ok) return;
    const row = (await res.json()) as Annotation;

    if (viewMode === "simulation" && engine) {
      engine.addMarker({
        id: `a${row.id}`,
        partId: row.partId,
        point: row.point,
        label: row.label,
        severity: row.severity,
        persistedId: row.id,
      });
    } else if (viewMode === "bodyparts3d" && bp3dEngine) {
      bp3dEngine.addMarker({
        id: `a${row.id}`,
        partId: row.partId,
        point: row.point,
        label: row.label,
        severity: row.severity,
        persistedId: row.id,
      });
    }
    setAnnotations((a) => [...a, row]);
    setPending(null);
  };

  const deleteAnnotation = async (a: Annotation) => {
    await fetch(`/api/annotations?id=${a.id}`, { method: "DELETE" });
    engine?.removeMarker(`a${a.id}`);
    bp3dEngine?.removeMarker(`a${a.id}`);
    setAnnotations((list) => list.filter((x) => x.id !== a.id));
  };

  const hasHighlight =
    viewMode === "simulation"
      ? (engine?.highlighted().length ?? 0) > 0
      : (bp3dEngine?.highlightedIds.size ?? 0) > 0;

  // Penentuan grid kolom dinamis berdasarkan visibilitas panel
  const gridLayoutClass = useMemo(() => {
    if (leftVisible && rightVisible) {
      return "lg:grid-cols-[290px_minmax(0,1fr)_400px]";
    } else if (leftVisible && !rightVisible) {
      return "lg:grid-cols-[290px_minmax(0,1fr)]";
    } else if (!leftVisible && rightVisible) {
      return "lg:grid-cols-[minmax(0,1fr)_400px]";
    } else {
      return "lg:grid-cols-[1fr]";
    }
  }, [leftVisible, rightVisible]);

  return (
    <div ref={containerRef} className="flex h-dvh flex-col bg-white">
      {/* Header Utama */}
      {headerVisible && (
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 transition-all">
          <div className="flex items-center gap-3">
            {/* Tombol menu mobile */}
            <button
              className="btn lg:!hidden"
              onClick={() => setLeftMobileOpen((v) => !v)}
              aria-expanded={leftMobileOpen}
            >
              Struktur
            </button>

            {/* Ikon logo anatomi */}
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="#2f6fe0" strokeWidth="1.5" aria-hidden>
              <rect x="2.5" y="2.5" width="15" height="15" rx="2" />
              <path d="M10 5.5v9M6.5 8.5h7M7.5 14.5h5" />
            </svg>

            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-[14.5px] font-bold tracking-tight text-ink">ANATOMI</h1>
                <span className="rounded bg-tint px-1.5 py-0.5 text-[10.5px] font-medium text-accent-deep">
                  buatan Ardellio Satria Anindito
                </span>
              </div>
              <p className="hidden font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint sm:block">
                Visualisasi 3D Interaktif · Rangka, Otot, Organ, Koroner & Saraf
              </p>
            </div>

            {/* Pemilih Mode Tampilan */}
            <div className="hidden sm:flex items-center rounded border border-line-strong bg-wash p-0.5 text-[11.5px] ml-2">
              <button
                className={`h-6 rounded px-2.5 font-medium transition-colors ${
                  viewMode === "simulation" ? "bg-white text-ink shadow-xs font-semibold" : "text-mute hover:text-ink"
                }`}
                onClick={() => setViewMode("simulation")}
                title="Mode Simulasi Dinamis & Pergerakan Sendi"
              >
                Simulasi & Kinematik
              </button>
              <button
                className={`h-6 rounded px-2.5 font-medium transition-colors ${
                  viewMode === "bodyparts3d" ? "bg-white text-ink shadow-xs font-semibold" : "text-mute hover:text-ink"
                }`}
                onClick={() => setViewMode("bodyparts3d")}
                title="Mode Scan Medis Nyata BodyParts3D (2.234 Meshes)"
              >
                Scan Medis (2.234 Model)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasHighlight && (
              <button
                className="btn !h-7 !text-[12px]"
                onClick={() => {
                  engine?.unhighlight();
                  bp3dEngine?.unhighlight();
                }}
              >
                Hapus sorotan
              </button>
            )}

            {/* Tombol toggle panel pada header */}
            <div className="hidden items-center gap-1 sm:flex">
              <button
                className={`btn !h-7 !px-2.5 !text-[12px] ${leftVisible ? "bg-wash text-ink" : "text-faint"}`}
                onClick={() => setLeftVisible((v) => !v)}
                title="Sembunyikan/Tampilkan Panel Struktur ( [ )"
              >
                Struktur
              </button>
              <button
                className={`btn !h-7 !px-2.5 !text-[12px] ${rightVisible ? "bg-wash text-ink" : "text-faint"}`}
                onClick={() => setRightVisible((v) => !v)}
                title="Sembunyikan/Tampilkan Panel Info ( ] )"
              >
                Info
              </button>
              <button
                className="btn !h-7 !px-2.5 !text-[12px] font-medium text-accent-deep hover:bg-wash"
                onClick={toggleZen}
                title="Mode Layar Penuh 3D / Zen Mode ( Z )"
              >
                Layar Penuh (Z)
              </button>
            </div>

            <span className="hidden font-mono text-[10.5px] text-faint xl:inline">
              Untuk edukasi — bukan alat diagnosis
            </span>
          </div>
        </header>
      )}

      {/* Konten Utama: 3-Kolom Sempurna pada Kedua Mode */}
      <div className={`relative flex min-h-0 flex-1 flex-col lg:grid ${gridLayoutClass}`}>
        {/* Panel Kiri: Struktur Anatomi & Pencarian */}
        {(leftVisible || leftMobileOpen) && (
          <aside
            className={`${
              leftMobileOpen
                ? "fixed inset-y-12 left-0 z-30 block w-[300px] border-r shadow-lg lg:shadow-none"
                : leftVisible
                ? "hidden lg:static lg:block lg:w-auto lg:border-r"
                : "hidden"
            } min-h-0 border-line bg-white`}
          >
            <LeftPanel engine={engine} bp3dEngine={bp3dEngine} mode={viewMode} />
          </aside>
        )}

        {/* Viewport 3D Canvas */}
        <main
          className={`relative min-h-0 shrink-0 border-line ${
            rightVisible ? "h-[54svh] border-b lg:h-auto lg:border-b-0" : "h-full flex-1 border-b-0"
          }`}
        >
          {viewMode === "simulation" ? (
            <Viewport
              engine={engine}
              onReady={setEngine}
              leftVisible={leftVisible}
              onToggleLeft={() => setLeftVisible((v) => !v)}
              rightVisible={rightVisible}
              onToggleRight={() => setRightVisible((v) => !v)}
              headerVisible={headerVisible}
              onToggleHeader={() => setHeaderVisible((v) => !v)}
              isZen={isZen}
              onToggleZen={toggleZen}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          ) : (
            <BodyPartsViewer
              onReady={setBp3dEngine}
              leftVisible={leftVisible}
              onToggleLeft={() => setLeftVisible((v) => !v)}
              rightVisible={rightVisible}
              onToggleRight={() => setRightVisible((v) => !v)}
              headerVisible={headerVisible}
              onToggleHeader={() => setHeaderVisible((v) => !v)}
              isZen={isZen}
              onToggleZen={toggleZen}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          )}
        </main>

        {/* Panel Kanan: Tab Info, Gejala, dan Skrip */}
        {rightVisible && (
          <aside className="flex min-h-0 flex-1 flex-col bg-white lg:border-l lg:border-line">
            <nav className="flex shrink-0 border-b border-line" role="tablist">
              {TABS.map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`relative h-10 flex-1 text-[13px] font-medium ${
                    tab === k ? "text-accent-deep" : "text-mute hover:text-ink"
                  }`}
                >
                  {label}
                  {k === "symptoms" && annotations.length > 0 && (
                    <span className="ml-1.5 font-mono text-[10.5px] text-faint">{annotations.length}</span>
                  )}
                  {tab === k && <span className="absolute inset-x-0 bottom-[-1px] h-[2px] bg-accent" />}
                </button>
              ))}
            </nav>
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
              {tab === "info" && (
                <InfoTab
                  engine={engine}
                  bp3dEngine={bp3dEngine}
                  mode={viewMode}
                  labels={labels}
                  onShow={onShow}
                  onFocus={onFocus}
                  onMark={() => {
                    setTab("symptoms");
                    if (viewMode === "simulation") {
                      engine?.setMarkMode(true);
                    } else {
                      bp3dEngine?.setMarkMode(true);
                    }
                  }}
                />
              )}
              {tab === "symptoms" && (
                <SymptomTab
                  engine={engine}
                  bp3dEngine={bp3dEngine}
                  mode={viewMode}
                  symptoms={symptoms}
                  labels={labels}
                  annotations={annotations}
                  pending={pending}
                  onShow={onShow}
                  onFocus={onFocus}
                  onSavePending={(f) => void savePending(f)}
                  onCancelPending={() => setPending(null)}
                  onDeleteAnnotation={(a) => void deleteAnnotation(a)}
                />
              )}
              {tab === "script" && <ScriptTab engine={engine} bp3dEngine={bp3dEngine} mode={viewMode} />}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
