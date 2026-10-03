"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BodyPartsEngine, type BP3DCameraMode, type BP3DMarker } from "./engine";
import { BP3D_SYSTEMS } from "./types";

interface BodyPartsViewerProps {
  onReady?: (engine: BodyPartsEngine) => void;
  leftVisible?: boolean;
  onToggleLeft?: () => void;
  rightVisible?: boolean;
  onToggleRight?: () => void;
  headerVisible?: boolean;
  onToggleHeader?: () => void;
  isZen?: boolean;
  onToggleZen?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const VIEW_BUTTONS = [
  { key: "front", label: "Depan" },
  { key: "right", label: "Kanan" },
  { key: "back", label: "Belakang" },
  { key: "left", label: "Kiri" },
  { key: "top", label: "Atas" },
  { key: "bottom", label: "Bawah" },
  { key: "iso", label: "¾ Iso" },
];

export default function BodyPartsViewer({
  onReady,
  leftVisible = true,
  onToggleLeft,
  rightVisible = true,
  onToggleRight,
  headerVisible = true,
  onToggleHeader,
  isZen = false,
  onToggleZen,
  isFullscreen = false,
  onToggleFullscreen,
}: BodyPartsViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BodyPartsEngine | null>(null);

  const [, setEngineReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [camMode, setCamMode] = useState<BP3DCameraMode>("orbit");
  const [camInfo, setCamInfo] = useState({ az: 0, el: 0, dist: 3.6 });
  const [explodeVal, setExplodeVal] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
  const [markersList, setMarkersList] = useState<BP3DMarker[]>([]);

  useEffect(() => {
    if (!mountRef.current || !overlayRef.current) return;
    const eng = new BodyPartsEngine(mountRef.current, overlayRef.current);
    engineRef.current = eng;

    const unregProgress = eng.on<number>("progress", (p) => setProgress(p));
    const unregCamera = eng.on<{ az: number; el: number; dist: number }>("camera", (c) => setCamInfo(c));
    const unregHover = eng.on<{ id: string; name: string; x: number; y: number } | null>("hover", (h) =>
      setHoverInfo(h),
    );
    const unregChange = eng.on("change", () => {
      setMarkersList(Array.from(eng.markers.values()));
    });

    eng
      .loadAtlas()
      .then(() => {
        setEngineReady(true);
        onReady?.(eng);
      })
      .catch((err: Error) => {
        setError(err.message || "Gagal menginisialisasi model BodyParts3D.");
      });

    return () => {
      unregProgress();
      unregCamera();
      unregHover();
      unregChange();
      eng.dispose();
      engineRef.current = null;
    };
  }, [onReady]);

  const toggleCamMode = (mode: BP3DCameraMode) => {
    setCamMode(mode);
    engineRef.current?.setCameraMode(mode);
  };

  const downloadPng = () => {
    if (!engineRef.current) return;
    const a = document.createElement("a");
    a.href = engineRef.current.snapshot();
    a.download = "ANATOMI-Scan-Medis.png";
    a.click();
  };

  const engine = engineRef.current;
  const az = ((Math.round(camInfo.az) % 360) + 360) % 360;

  // Bagian-bagian yang sedang disorot (Highlight Info & 3D Proyeksi)
  const highlightedParts = useMemo(() => {
    const eng = engineRef.current;
    if (!eng || !eng.atlas) return [];
    const list: Array<{
      id: string;
      name: string;
      conceptId: string;
      system: string;
      proj: { x: number; y: number; visible: boolean; inFront: boolean } | null;
    }> = [];
    for (const id of eng.highlightedIds) {
      const part = eng.atlas.parts.find((p) => p.id === id || p.conceptId === id);
      if (!part) continue;
      const center = new THREE.Vector3()
        .fromArray(part.bounds[0])
        .add(new THREE.Vector3().fromArray(part.bounds[1]))
        .multiplyScalar(0.5);
      const proj = eng.projectPoint(center);
      const sys = BP3D_SYSTEMS.find((s) => s.id === part.system);
      list.push({
        id: part.id,
        name: part.name,
        conceptId: part.conceptId,
        system: sys?.nameId ?? part.system,
        proj,
      });
      if (list.length >= 4) break;
    }
    return list;
  }, [camInfo, markersList]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 hatch opacity-60" />
      <div ref={mountRef} className="absolute inset-0 touch-none" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {/* Loading Progress */}
      {progress < 100 && !error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-white/85 backdrop-blur-sm">
          <div className="max-w-xs px-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            <h4 className="mt-3 text-[13.5px] font-semibold text-ink">Memuat Scan Medis BodyParts3D 4.0</h4>
            <p className="mt-1 font-mono text-[11.5px] text-faint">
              2.234 Model Nyata · 15 Sistem Anatomi ({progress}%)
            </p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded bg-line">
              <div className="h-full bg-accent transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 grid place-items-center p-6 text-center">
          <p className="max-w-sm text-sm text-danger">{error}</p>
        </div>
      )}

      {/* HUD Kiri Atas: Orientasi, Kamera & Koordinat Proyeksi */}
      <div className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] leading-5 text-mute z-10">
        <div>
          AZ <span className="text-ink">{String(az).padStart(3, "0")}°</span> &nbsp;EL{" "}
          <span className="text-ink">{Math.round(camInfo.el)}°</span> &nbsp;JARAK{" "}
          <span className="text-ink">{camInfo.dist.toFixed(2)} m</span>
        </div>
        <div>
          MODE KAMERA:{" "}
          <span className="font-semibold text-ink">{camMode === "orbit" ? "ORBIT 360°" : "FREE CAM (FLY)"}</span>
        </div>
        {engine?.selectedId && (
          <div className="mt-0.5 text-ink-soft">
            <span className="text-faint">PILIH</span> {engine.selectedId}
          </div>
        )}
      </div>

      {/* Tooltip Hover Organ */}
      {hoverInfo && !engine?.markMode && camMode === "orbit" && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-line-strong bg-white/95 px-2.5 py-1 text-[12px] font-medium text-ink shadow-sm backdrop-blur"
          style={{
            left: Math.min(hoverInfo.x + 14, window.innerWidth - 240),
            top: Math.max(8, hoverInfo.y - 12),
          }}
        >
          {hoverInfo.name}
        </div>
      )}

      {/* Mode Tandai Titik Banner */}
      {engine?.markMode && (
        <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-3 rounded border border-accent bg-white px-3 py-1.5 text-[12.5px] text-ink shadow-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
          Klik titik pada scan medis untuk menancapkan pin gejala
          <button className="btn !h-6" onClick={() => engine.setMarkMode(false)}>
            Batal (Esc)
          </button>
        </div>
      )}

      {/* Banner Teks Highlight Persistent (Menunjukkan apa yang sedang disorot di Scan Medis) */}
      {!engine?.markMode && !isZen && highlightedParts.length > 0 && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-accent bg-white/95 px-3 py-1 shadow-md backdrop-blur-md max-w-[92vw]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-deep" />
          </span>
          <div className="text-[12px] font-semibold text-ink truncate">
            <span>Disorot: </span>
            <span className="text-accent-deep">{highlightedParts[0].name}</span>
            {highlightedParts.length > 1 && (
              <span className="text-faint text-[11px] font-normal"> (+{highlightedParts.length - 1} lainnya)</span>
            )}
          </div>
          <button
            className="rounded bg-tint px-2 py-0.5 text-[11px] font-medium text-accent-deep hover:bg-accent hover:text-white transition-colors shrink-0"
            onClick={() => void engine?.focus(highlightedParts[0].id, { duration: 1000 })}
            title="Arahkan kamera ke organ yang disorot"
          >
            ⌖ Fokus
          </button>
          <button
            className="text-faint hover:text-ink text-[12px] px-1 shrink-0"
            onClick={() => engine?.unhighlight()}
            title="Hapus sorotan"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pin & Tag Teks 3D Melayang Langsung pada Organ yang Disorot di Scan Medis */}
      {!engine?.markMode &&
        highlightedParts.map((p) => {
          if (!p.proj || !p.proj.visible || !p.proj.inFront) return null;
          return (
            <div
              key={p.id}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full z-20 flex flex-col items-center cursor-pointer transition-transform duration-100"
              style={{ left: p.proj.x, top: p.proj.y - 8 }}
              onClick={() => void engine?.focus(p.id, { duration: 1000 })}
            >
              <div className="flex items-center gap-1.5 rounded-full border border-accent bg-white/95 px-2.5 py-1 shadow-md backdrop-blur-md">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-deep" />
                </span>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-[11.5px] font-bold text-ink whitespace-nowrap">{p.name}</span>
                  <span className="font-mono text-[9px] text-accent-deep font-semibold whitespace-nowrap mt-0.5">
                    {p.conceptId ? `${p.conceptId} · ` : ""}{p.system}
                  </span>
                </div>
                <button
                  className="ml-1 text-faint hover:text-ink text-[11px] leading-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    engine?.unhighlight();
                  }}
                  title="Tutup Sorotan"
                >
                  ✕
                </button>
              </div>
              <div className="h-2 w-0.5 bg-accent/70" />
              <div className="h-1 w-1 rounded-full bg-accent" />
            </div>
          );
        })}

      {/* Floating Toolbar Navigasi & Layar Penuh Kanan Atas */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded border border-line-strong bg-white/95 p-1 shadow-sm backdrop-blur">
        {/* Toggle Struktur (Desktop) */}
        {onToggleLeft && (
          <button
            className={`hidden lg:flex h-7 items-center gap-1 px-2 text-[11.5px] font-medium transition-colors ${
              leftVisible ? "bg-wash text-ink" : "text-faint hover:text-ink"
            }`}
            onClick={onToggleLeft}
            title={leftVisible ? "Sembunyikan Panel Struktur ( [ )" : "Tampilkan Panel Struktur ( [ )"}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M6 2v12" />
            </svg>
            <span>Struktur</span>
          </button>
        )}

        {/* Toggle Info (Desktop) */}
        {onToggleRight && (
          <button
            className={`hidden lg:flex h-7 items-center gap-1 px-2 text-[11.5px] font-medium transition-colors ${
              rightVisible ? "bg-wash text-ink" : "text-faint hover:text-ink"
            }`}
            onClick={onToggleRight}
            title={rightVisible ? "Sembunyikan Panel Info ( ] )" : "Tampilkan Panel Info ( ] )"}
          >
            <span>Info</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M10 2v12" />
            </svg>
          </button>
        )}

        {/* Toggle Header (Desktop) */}
        {onToggleHeader && (
          <button
            className={`hidden h-7 items-center gap-1 px-2 text-[11.5px] font-medium transition-colors lg:flex ${
              headerVisible ? "bg-wash text-ink" : "text-faint hover:text-ink"
            }`}
            onClick={onToggleHeader}
            title={headerVisible ? "Sembunyikan Header ( H )" : "Tampilkan Header ( H )"}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M2 6h12" />
            </svg>
          </button>
        )}

        <div className="hidden lg:block h-4 w-px bg-line" />

        {/* Mode Zen */}
        {onToggleZen && (
          <button
            className={`flex h-7 items-center gap-1 px-2 sm:px-2.5 text-[11.5px] font-medium transition-colors ${
              isZen ? "bg-accent-deep text-white" : "bg-wash text-ink hover:text-accent-deep"
            }`}
            onClick={onToggleZen}
            title="Layar Penuh / Sembunyikan Semua Panel Navigasi ( Z )"
          >
            <span className="hidden sm:inline">{isZen ? "Keluar Zen" : "Layar Penuh"}</span>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="sm:hidden">
              <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
            </svg>
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

      {/* FreeCam Nav Guide saat aktif */}
      {camMode === "free" && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded border border-line-strong bg-white/90 px-3 py-1 font-mono text-[11px] text-ink shadow-sm backdrop-blur">
          <span className="font-semibold text-accent-deep">FREE CAM:</span> WASD: Gerak · Space/Shift: Naik/Turun · Drag Mouse: Arah Pandang
        </div>
      )}

      {/* Kontrol Bawah: Kamera, Mode Fly, Explode, X-Ray & PNG */}
      <div
        className={`absolute inset-x-0 ${
          isZen ? "bottom-3" : "bottom-16 lg:bottom-3"
        } z-20 flex items-center justify-start sm:justify-center gap-2 px-3 overflow-x-auto thin-scroll max-w-full pb-1`}
      >
        {/* Toggle Mode Kamera: Orbit vs Free Fly */}
        <div className="flex overflow-hidden rounded border border-line-strong bg-white/95 shadow-sm backdrop-blur">
          <button
            className={`h-7 px-2.5 text-[12px] font-medium transition-colors ${
              camMode === "orbit" ? "bg-wash text-ink font-semibold" : "text-mute hover:text-ink"
            }`}
            onClick={() => toggleCamMode("orbit")}
            title="Kamera Orbit Mengelilingi Target 360°"
          >
            Orbit Cam
          </button>
          <button
            className={`h-7 px-2.5 text-[12px] font-medium border-l border-line transition-colors ${
              camMode === "free" ? "bg-accent-deep text-white font-semibold" : "text-mute hover:text-ink"
            }`}
            onClick={() => toggleCamMode("free")}
            title="Kamera Terbang Bebas Menembus Rongga Tubuh (WASD)"
          >
            Free Cam
          </button>
        </div>

        {/* Sudut Pandang Presisi: Desktop */}
        {camMode === "orbit" && (
          <div className="hidden sm:flex overflow-hidden rounded border border-line-strong bg-white/95 shadow-sm backdrop-blur shrink-0">
            {VIEW_BUTTONS.map((vb, idx) => (
              <button
                key={vb.key}
                className={`h-7 px-2.5 text-[12px] font-medium text-ink-soft hover:bg-tint hover:text-ink ${
                  idx > 0 ? "border-l border-line" : ""
                }`}
                onClick={() => engine?.view(vb.key)}
              >
                {vb.label}
              </button>
            ))}
          </div>
        )}

        {/* Sudut Pandang Presisi: Mobile Dropdown */}
        {camMode === "orbit" && (
          <div className="sm:hidden shrink-0">
            <select
              className="field !h-7 !w-auto !py-0 !px-2 text-[11.5px] font-medium bg-white/95 shadow-xs border-line-strong"
              defaultValue="three-quarter"
              aria-label="Sudut Pandang Kamera"
              onChange={(e) => engine?.view(e.target.value)}
            >
              <option value="front">🎥 Depan</option>
              <option value="right">Kanan</option>
              <option value="back">Belakang</option>
              <option value="left">Kiri</option>
              <option value="top">Atas</option>
              <option value="bottom">Bawah</option>
              <option value="three-quarter">Iso</option>
            </select>
          </div>
        )}

        {/* Slider Penguraian (Exploded Inventory) */}
        <div className="flex items-center gap-1.5 sm:gap-2 rounded border border-line-strong bg-white/95 px-2 sm:px-3 py-1 shadow-sm backdrop-blur shrink-0">
          <span className="text-[11px] sm:text-[11.5px] text-faint font-medium">Urai:</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={explodeVal}
            onChange={(e) => {
              const v = Number(e.target.value);
              setExplodeVal(v);
              engine?.setExplode(v);
            }}
            className="w-14 sm:w-20 cursor-pointer"
            title="Urai struktur anatomi ke dalam ruang spasial"
          />
          <span className="font-mono text-[10px] sm:text-[10.5px] text-ink min-w-[24px] sm:min-w-[28px]">
            {Math.round(explodeVal * 100)}%
          </span>
        </div>

        {/* Tombol Aksi Tambahan */}
        <button
          className="btn !h-7 !px-2.5 !text-[11.5px] shrink-0"
          data-on={engine?.spinning ?? false}
          onClick={() => engine?.spin(!engine.spinning)}
          title="Putar model secara kontinu"
        >
          Putar
        </button>
        <button
          className="btn !h-7 !px-2.5 !text-[11.5px] shrink-0"
          data-on={engine?.xrayOn ?? false}
          onClick={() => engine?.setXray(!engine.xrayOn)}
          title="Mode X-Ray transparan"
        >
          X-ray
        </button>
        <button
          className="btn !h-7 !px-2.5 !text-[11.5px] shrink-0"
          onClick={() => {
            setExplodeVal(0);
            engine?.setExplode(0);
            engine?.unhighlight();
            engine?.isolate(null);
            engine?.view("three-quarter");
          }}
          title="Reset tampilan model"
        >
          Reset
        </button>
        <button
          className="btn !h-7 !px-2.5 !text-[11.5px] shrink-0"
          onClick={downloadPng}
          title="Simpan gambar resolusi tinggi PNG"
        >
          PNG
        </button>
      </div>
    </div>
  );
}
