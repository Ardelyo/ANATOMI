"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import { createApi } from "@/anatomy/script";
import type { BodyPartsEngine } from "@/anatomy/bodyparts3d/engine";
import { createBP3DApi } from "@/anatomy/bodyparts3d/script";
import Viewport from "./Viewport";
import BodyPartsViewer from "@/anatomy/bodyparts3d/BodyPartsViewer";
import LeftPanel from "./LeftPanel";
import InfoTab from "./InfoTab";
import SymptomTab, { type PendingMark } from "./SymptomTab";
import ScriptTab from "./ScriptTab";
import type { Annotation, Condition, Tab, ViewMode } from "./types";
import {
  deleteClientAnnotation,
  getClientAnnotations,
  getClientSymptoms,
  saveClientAnnotation,
  type ClientSymptom,
} from "@/lib/client-data";

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

type MobileSheet = "none" | "structure" | "info" | "symptoms" | "script";

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
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>("none");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [symptoms, setSymptoms] = useState<ClientSymptom[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pending, setPending] = useState<PendingMark | null>(null);

  const labels = useMemo(() => new Map(symptoms.map((s) => [s.slug, s.label])), [symptoms]);
  const isZen = !leftVisible && !rightVisible && !headerVisible;

  const toggleZen = useCallback(() => {
    if (isZen) {
      setLeftVisible(true);
      setRightVisible(true);
      setHeaderVisible(true);
      setMobileSheet("none");
    } else {
      setLeftVisible(false);
      setRightVisible(false);
      setHeaderVisible(false);
      setMobileSheet("none");
    }
  }, [isZen]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const openMobileFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    }
    setHeaderVisible(false);
    setLeftVisible(false);
    setRightVisible(false);
    setMobileSheet("none");
  }, []);

  // Muat data gejala awal
  useEffect(() => {
    getClientSymptoms().then((rows) => setSymptoms(rows));
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
        setMobileSheet("symptoms");
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
        setMobileSheet("symptoms");
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

  // Muat anotasi awal dari penyimpanan lokal persisten
  useEffect(() => {
    const rows = getClientAnnotations() as unknown as Annotation[];
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
        if (mobileSheet !== "none") {
          setMobileSheet("none");
        } else if (isZen) {
          toggleZen();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleZen, toggleFullscreen, isZen, mobileSheet]);

  const onShow = useCallback(
    (c: Condition) => {
      if (viewMode === "simulation") {
        engine?.unhighlight();
        engine?.highlight(c.structures, { dim: true });
      } else {
        bp3dEngine?.unhighlight();
        bp3dEngine?.highlight(c.structures, { dim: true });
      }
    },
    [viewMode, engine, bp3dEngine],
  );

  const onFocus = useCallback(
    (structure: string) => {
      if (viewMode === "simulation") {
        engine?.unhighlight();
        engine?.highlight(structure, { dim: true });
        void engine?.focus(structure, { duration: 1000 });
      } else {
        bp3dEngine?.unhighlight();
        bp3dEngine?.highlight(structure, { dim: true });
        void bp3dEngine?.focus(structure, { duration: 1000 });
      }
    },
    [viewMode, engine, bp3dEngine],
  );

  const savePending = async (f: { label: string; note: string; severity: number }) => {
    if (!pending) return;
    const row = saveClientAnnotation({
      partId: pending.partId,
      point: pending.point,
      label: f.label,
      note: f.note ?? "",
      severity: f.severity,
    }) as unknown as Annotation;

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
    deleteClientAnnotation(a.id);
    engine?.removeMarker(`a${a.id}`);
    bp3dEngine?.removeMarker(`a${a.id}`);
    setAnnotations((list) => list.filter((x) => x.id !== a.id));
  };

  const hasHighlight =
    viewMode === "simulation"
      ? (engine?.highlighted().length ?? 0) > 0
      : (bp3dEngine?.highlightedIds.size ?? 0) > 0;

  // Penentuan grid kolom dinamis desktop
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
    <div ref={containerRef} className="flex h-[100dvh] w-full flex-col bg-white overflow-hidden select-none">
      {/* Header Utama Responsif (Desktop & Mobile) */}
      {headerVisible && (
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-white/95 backdrop-blur z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Ikon logo anatomi */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-tint text-accent">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="2.5" y="2.5" width="15" height="15" rx="2" />
                <path d="M10 5.5v9M6.5 8.5h7M7.5 14.5h5" />
              </svg>
            </div>

            <div className="leading-tight min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-[14px] sm:text-[14.5px] font-bold tracking-tight text-ink truncate">ANATOMI</h1>
                <span className="hidden sm:inline-block rounded bg-tint px-1.5 py-0.5 text-[10.5px] font-medium text-accent-deep whitespace-nowrap">
                  buatan Ardellio Satria Anindito
                </span>
              </div>
              <p className="hidden font-mono text-[9px] uppercase tracking-[0.06em] text-faint md:block">
                Visualisasi 3D Interaktif · Rangka, Otot, Organ, Sirkulasi & Saraf
              </p>
            </div>

            {/* Pemilih Mode Tampilan (Pill Switcher) */}
            <div className="flex items-center rounded border border-line-strong bg-wash p-0.5 text-[11px] sm:text-[11.5px] ml-1 sm:ml-2">
              <button
                className={`h-6 rounded px-2 sm:px-2.5 font-medium transition-colors ${
                  viewMode === "simulation" ? "bg-white text-ink shadow-xs font-semibold" : "text-mute hover:text-ink"
                }`}
                onClick={() => setViewMode("simulation")}
                title="Mode Simulasi Dinamis & Pergerakan Sendi"
              >
                Simulasi
              </button>
              <button
                className={`h-6 rounded px-2 sm:px-2.5 font-medium transition-colors ${
                  viewMode === "bodyparts3d" ? "bg-white text-ink shadow-xs font-semibold" : "text-mute hover:text-ink"
                }`}
                onClick={() => setViewMode("bodyparts3d")}
                title="Mode Scan Medis Nyata BodyParts3D (2.234 Meshes)"
              >
                Scan Medis
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {hasHighlight && (
              <button
                className="btn !h-7 !px-2 !text-[11.5px]"
                onClick={() => {
                  engine?.unhighlight();
                  bp3dEngine?.unhighlight();
                }}
              >
                Batal Sorot
              </button>
            )}

            {/* Desktop Panel Toggles */}
            <div className="hidden lg:flex items-center gap-1">
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

            {/* Tombol Fullscreen Mobile */}
            <button
              className="flex h-7 w-7 items-center justify-center rounded border border-line-strong text-ink hover:bg-wash lg:hidden"
              onClick={openMobileFullscreen}
              title="Layar Penuh Kanvas 3D"
              aria-label="Layar Penuh"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
              </svg>
            </button>
          </div>
        </header>
      )}

      {/* Floating Zen Exit Button (Hanya tampil saat Zen Mode atau Fullscreen aktif) */}
      {isZen && (
        <button
          className="fixed top-3 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur border border-line-strong text-ink hover:bg-wash transition-transform active:scale-95"
          onClick={toggleZen}
          title="Keluar dari Layar Penuh (Escape / Z)"
          aria-label="Keluar Layar Penuh"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 10h4v4M12 10H8v4M4 6h4V2M12 6H8V2" />
          </svg>
        </button>
      )}

      {/* Konten Utama */}
      <div className={`relative flex min-h-0 flex-1 flex-col lg:grid ${gridLayoutClass}`}>
        {/* Panel Kiri: Struktur Anatomi Desktop */}
        {leftVisible && (
          <aside className="hidden lg:block min-h-0 border-r border-line bg-white">
            <LeftPanel engine={engine} bp3dEngine={bp3dEngine} mode={viewMode} />
          </aside>
        )}

        {/* Viewport 3D Canvas (Full-height di Mobile) */}
        <main className="relative flex-1 min-h-0 w-full h-full bg-white">
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

        {/* Panel Kanan Desktop: Tab Info, Gejala, dan Skrip */}
        {rightVisible && (
          <aside className="hidden lg:flex min-h-0 flex-1 flex-col bg-white border-l border-line">
            <nav className="flex shrink-0 border-b border-line" role="tablist">
              {TABS.map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`relative h-10 flex-1 text-[13px] font-medium transition-colors ${
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
                  symptoms={symptoms as unknown as import("./types").Symptom[]}
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

      {/* ───────────── MOBILE FLOATING BOTTOM BAR ───────────── */}
      {!isZen && (
        <nav
          className="fixed bottom-3 inset-x-3 z-30 flex items-center justify-around rounded-full border border-line-strong bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-md lg:hidden max-w-md mx-auto"
          aria-label="Navigasi Mobile"
        >
          <button
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
              mobileSheet === "none" ? "text-accent-deep font-semibold" : "text-ink-soft hover:text-ink"
            }`}
            onClick={() => setMobileSheet("none")}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>Kanvas 3D</span>
          </button>

          <button
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
              mobileSheet === "structure" ? "text-accent-deep font-semibold" : "text-ink-soft hover:text-ink"
            }`}
            onClick={() => setMobileSheet((v) => (v === "structure" ? "none" : "structure"))}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>Struktur</span>
          </button>

          <button
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
              mobileSheet === "symptoms" || mobileSheet === "info" ? "text-accent-deep font-semibold" : "text-ink-soft hover:text-ink"
            }`}
            onClick={() => {
              setTab("symptoms");
              setMobileSheet((v) => (v === "symptoms" ? "none" : "symptoms"));
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>Diagnosa</span>
          </button>

          <button
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
              mobileSheet === "script" ? "text-accent-deep font-semibold" : "text-ink-soft hover:text-ink"
            }`}
            onClick={() => {
              setTab("script");
              setMobileSheet((v) => (v === "script" ? "none" : "script"));
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>Skrip AI</span>
          </button>

          <button
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium rounded-full text-ink-soft hover:text-accent-deep transition-colors"
            onClick={openMobileFullscreen}
            title="Layar Penuh Kanvas 3D"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            <span>Layar Penuh</span>
          </button>
        </nav>
      )}

      {/* ───────────── MOBILE SLIDE-UP BOTTOM SHEET ───────────── */}
      {mobileSheet !== "none" && (
        <>
          {/* Backdrop gelap transparan */}
          <div
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs lg:hidden transition-opacity"
            onClick={() => setMobileSheet("none")}
            aria-hidden="true"
          />

          {/* Kontainer Sheet Geser */}
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[86dvh] h-[82dvh] flex-col rounded-t-2xl border-t border-line-strong bg-white shadow-2xl lg:hidden animate-in slide-in-from-bottom duration-250">
            {/* Header Drawer dengan Grip & Tombol Tutup */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-1 w-10 rounded-full bg-line-strong absolute left-1/2 -top-2.5 -translate-x-1/2" />
                <h3 className="font-semibold text-[13.5px] text-ink">
                  {mobileSheet === "structure"
                    ? "Struktur Anatomi 15 Sistem"
                    : mobileSheet === "symptoms"
                    ? "Diagnosa & Penanda Gejala"
                    : mobileSheet === "info"
                    ? "Informasi Organ & Ontologi FMA"
                    : "Editor Skrip & Prompt AI"}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {mobileSheet !== "structure" && (
                  <div className="flex rounded border border-line-strong bg-wash p-0.5 text-[11px]">
                    <button
                      className={`h-6 rounded px-2 font-medium ${
                        tab === "info" ? "bg-white text-ink font-semibold shadow-xs" : "text-mute"
                      }`}
                      onClick={() => {
                        setTab("info");
                        setMobileSheet("info");
                      }}
                    >
                      Info
                    </button>
                    <button
                      className={`h-6 rounded px-2 font-medium ${
                        tab === "symptoms" ? "bg-white text-ink font-semibold shadow-xs" : "text-mute"
                      }`}
                      onClick={() => {
                        setTab("symptoms");
                        setMobileSheet("symptoms");
                      }}
                    >
                      Gejala
                    </button>
                    <button
                      className={`h-6 rounded px-2 font-medium ${
                        tab === "script" ? "bg-white text-ink font-semibold shadow-xs" : "text-mute"
                      }`}
                      onClick={() => {
                        setTab("script");
                        setMobileSheet("script");
                      }}
                    >
                      Skrip
                    </button>
                  </div>
                )}

                <button
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink hover:bg-wash transition-colors"
                  onClick={() => setMobileSheet("none")}
                  aria-label="Tutup"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Isi Drawer */}
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
              {mobileSheet === "structure" ? (
                <LeftPanel engine={engine} bp3dEngine={bp3dEngine} mode={viewMode} />
              ) : tab === "info" ? (
                <InfoTab
                  engine={engine}
                  bp3dEngine={bp3dEngine}
                  mode={viewMode}
                  labels={labels}
                  onShow={onShow}
                  onFocus={onFocus}
                  onMark={() => {
                    setTab("symptoms");
                    setMobileSheet("symptoms");
                    if (viewMode === "simulation") {
                      engine?.setMarkMode(true);
                    } else {
                      bp3dEngine?.setMarkMode(true);
                    }
                  }}
                />
              ) : tab === "symptoms" ? (
                <SymptomTab
                  engine={engine}
                  bp3dEngine={bp3dEngine}
                  mode={viewMode}
                  symptoms={symptoms as unknown as import("./types").Symptom[]}
                  labels={labels}
                  annotations={annotations}
                  pending={pending}
                  onShow={onShow}
                  onFocus={onFocus}
                  onSavePending={(f) => void savePending(f)}
                  onCancelPending={() => setPending(null)}
                  onDeleteAnnotation={(a) => void deleteAnnotation(a)}
                />
              ) : (
                <ScriptTab engine={engine} bp3dEngine={bp3dEngine} mode={viewMode} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
