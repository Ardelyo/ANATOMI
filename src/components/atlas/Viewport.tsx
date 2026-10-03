"use client";

import { useEffect, useRef, useState } from "react";
import { AnatomyEngine } from "@/anatomy/engine";
import { SYSTEMS, metaFor } from "@/anatomy/catalog";

const VIEW_BUTTONS: [string, string][] = [
  ["front", "Depan"],
  ["right", "Kanan"],
  ["back", "Belakang"],
  ["left", "Kiri"],
  ["top", "Atas"],
  ["bottom", "Bawah"],
  ["iso", "Iso"],
];

export interface ViewportProps {
  engine: AnatomyEngine | null;
  onReady: (e: AnatomyEngine) => void;
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

export default function Viewport({
  engine,
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
}: ViewportProps) {
  const mount = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cam, setCam] = useState({ az: 0, el: 0, dist: 3.5 });
  const [exploded, setExploded] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mount.current || !overlay.current) return;
    let eng: AnatomyEngine | null = null;
    try {
      eng = new AnatomyEngine(mount.current, overlay.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "WebGL tidak tersedia");
      return;
    }
    const offHover = eng.on<{ id: string; x: number; y: number } | null>("hover", setHover);
    const offCam = eng.on<{ az: number; el: number; dist: number }>("camera", setCam);
    onReady(eng);
    return () => {
      offHover();
      offCam();
      eng?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && engine?.markMode) {
        engine.setMarkMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  const active = new Set(engine?.activeAnimations() ?? []);
  const rect = boxRef.current?.getBoundingClientRect();
  const az = ((Math.round(cam.az) % 360) + 360) % 360;

  const download = () => {
    if (!engine) return;
    const a = document.createElement("a");
    a.href = engine.snapshot();
    a.download = "ANATOMI-3D.png";
    a.click();
  };

  return (
    <div ref={boxRef} className="relative h-full w-full select-none overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 hatch opacity-60" />
      <div ref={mount} className="absolute inset-0 touch-none" />
      <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {!engine && !error && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[13px] font-semibold text-ink">ANATOMI</p>
            <p className="label mt-1">Menyusun model anatomi 3D…</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-8 text-center">
          <p className="max-w-sm text-sm text-mute">
            Model 3D memerlukan WebGL. Aktifkan akselerasi perangkat keras pada peramban Anda. ({error})
          </p>
        </div>
      )}

      {/* HUD kiri atas */}
      <div className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] leading-5 text-mute">
        <div>
          AZ <span className="text-ink">{String(az).padStart(3, "0")}°</span> &nbsp;EL{" "}
          <span className="text-ink">{Math.round(cam.el)}°</span> &nbsp;JARAK{" "}
          <span className="text-ink">{cam.dist.toFixed(2)} m</span>
        </div>
        {engine?.selectedId && (
          <div className="mt-0.5 text-ink-soft">
            <span className="text-faint">PILIH</span> {metaFor(engine.selectedId).name}
          </div>
        )}
      </div>

      {/* Floating Toolbar Kontrol Navigasi & Layar Penuh (Kanan Atas) */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded border border-line-strong bg-white/95 p-1 shadow-sm backdrop-blur">
        {/* Toggle Panel Kiri (Struktur) */}
        {onToggleLeft && (
          <button
            className={`flex h-7 items-center gap-1 px-2 text-[11.5px] font-medium transition-colors ${
              leftVisible ? "bg-wash text-ink" : "text-faint hover:text-ink"
            }`}
            onClick={onToggleLeft}
            title={leftVisible ? "Sembunyikan Panel Struktur ( [ )" : "Tampilkan Panel Struktur ( [ )"}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M6 2v12" />
            </svg>
            <span className="hidden sm:inline">Struktur</span>
          </button>
        )}

        {/* Toggle Panel Kanan (Info & Diagnostik) */}
        {onToggleRight && (
          <button
            className={`flex h-7 items-center gap-1 px-2 text-[11.5px] font-medium transition-colors ${
              rightVisible ? "bg-wash text-ink" : "text-faint hover:text-ink"
            }`}
            onClick={onToggleRight}
            title={rightVisible ? "Sembunyikan Panel Info ( ] )" : "Tampilkan Panel Info ( ] )"}
          >
            <span className="hidden sm:inline">Info</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M10 2v12" />
            </svg>
          </button>
        )}

        {/* Toggle Header */}
        {onToggleHeader && (
          <button
            className={`hidden h-7 items-center gap-1 px-2 text-[11.5px] font-medium transition-colors md:flex ${
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

        <div className="h-4 w-px bg-line" />

        {/* Mode Zen / Layar Penuh 3D (Sembunyikan Seluruh Navigasi) */}
        {onToggleZen && (
          <button
            className={`flex h-7 items-center gap-1.5 px-2.5 text-[11.5px] font-medium transition-colors ${
              isZen ? "bg-accent-deep text-white" : "bg-wash text-ink hover:text-accent-deep"
            }`}
            onClick={onToggleZen}
            title="Layar Penuh / Sembunyikan Semua Panel Navigasi ( Z )"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              {isZen ? (
                <>
                  <path d="M5 2v3H2M11 2v3h3M5 14v-3H2M11 14v-3h3" />
                </>
              ) : (
                <>
                  <path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3" />
                </>
              )}
            </svg>
            <span>{isZen ? "Keluar Zen" : "Layar Penuh"}</span>
          </button>
        )}

        {/* Fullscreen Browser Native */}
        {onToggleFullscreen && (
          <button
            className="flex h-7 w-7 items-center justify-center text-ink-soft hover:bg-wash hover:text-ink"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Keluar Layar Penuh Browser ( F )" : "Layar Penuh Browser ( F )"}
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

      {/* Banner informasi saat dalam Mode Zen */}
      {isZen && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-line-strong bg-white/90 px-3 py-1 font-mono text-[11px] text-mute shadow-sm backdrop-blur">
          Mode Layar Penuh 3D · Tekan <span className="font-semibold text-ink">Z</span> atau{" "}
          <span className="font-semibold text-ink">Esc</span> untuk memunculkan panel kembali
        </div>
      )}

      {/* Mode tandai */}
      {engine?.markMode && (
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-3 rounded border border-accent bg-white px-3 py-1.5 text-[12.5px] text-ink shadow-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
          Klik titik pada model untuk menandai gejala
          <button className="btn !h-6" onClick={() => engine.setMarkMode(false)}>
            Batal (Esc)
          </button>
        </div>
      )}

      {/* Tooltip hover */}
      {hover && rect && !engine?.markMode && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-line-strong bg-white/95 px-2.5 py-1 text-[12px] font-medium text-ink shadow-sm backdrop-blur"
          style={{
            left: Math.min(hover.x - rect.left + 14, rect.width - 210),
            top: Math.max(4, hover.y - rect.top - 8),
          }}
        >
          {metaFor(hover.id).name}
        </div>
      )}

      {/* Popover Menu Lapisan Cepat */}
      {showLayerMenu && engine && (
        <div className="absolute bottom-14 left-1/2 z-30 w-72 -translate-x-1/2 rounded border border-line-strong bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5">
            <span className="text-[12px] font-semibold text-ink">Lapisan Anatomi</span>
            <button
              className="text-[11px] text-faint hover:text-ink"
              onClick={() => setShowLayerMenu(false)}
            >
              ✕ Tutup
            </button>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto thin-scroll">
            {SYSTEMS.map((s) => {
              const l = engine.layers[s.id];
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={l?.visible ?? false}
                      onChange={() => engine.layer(s.id, { visible: !l?.visible })}
                      className="cursor-pointer"
                    />
                    <span className="text-ink">{s.label}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={l?.opacity ?? 1}
                    onChange={(e) => engine.layer(s.id, { opacity: Number(e.target.value) })}
                    className="w-20"
                    title={`Opasitas ${s.label}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kontrol bawah */}
      <div
        className={`absolute inset-x-0 ${
          isZen ? "bottom-3" : "bottom-16 lg:bottom-3"
        } z-20 flex items-center justify-start sm:justify-center gap-2 px-3 overflow-x-auto thin-scroll max-w-full pb-1`}
      >
        {/* Sudut Pandang Kamera */}
        <div className="flex overflow-hidden rounded border border-line-strong bg-white/95 shadow-sm backdrop-blur">
          {VIEW_BUTTONS.map(([k, label], i) => (
            <button
              key={k}
              className={`h-7 px-2.5 text-[12px] font-medium text-ink-soft hover:bg-tint hover:text-ink ${
                i > 0 ? "border-l border-line" : ""
              }`}
              onClick={() => engine?.view(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lapisan Cepat */}
        <button
          className={`btn ${showLayerMenu ? "!border-accent !bg-wash" : ""}`}
          onClick={() => setShowLayerMenu((v) => !v)}
          title="Buka pemilih lapisan anatomi cepat"
        >
          Lapisan
        </button>

        {/* Tombol Aksi & Animasi */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button className="btn" data-on={engine?.spinning ?? false} onClick={() => engine?.spin(!engine.spinning)}>
            Putar
          </button>
          <button className="btn" data-on={active.has("breathe")} onClick={() => engine?.breathe(!active.has("breathe"))}>
            Napas
          </button>
          <button className="btn" data-on={active.has("heartbeat")} onClick={() => engine?.heartbeat(!active.has("heartbeat"))}>
            Detak
          </button>
          <button className="btn" data-on={active.has("walk")} onClick={() => engine?.walk(!active.has("walk"))}>
            Jalan
          </button>
          <button
            className="btn"
            data-on={exploded}
            onClick={() => {
              const next = !exploded;
              setExploded(next);
              void engine?.explode(next ? 1 : 0);
            }}
          >
            Pisah
          </button>
          <button className="btn" data-on={engine?.xrayOn ?? false} onClick={() => engine?.xray(!engine.xrayOn)}>
            X-ray
          </button>
          <button
            className="btn"
            onClick={() => {
              setExploded(false);
              void engine?.resetAll();
            }}
          >
            Reset
          </button>
          <button className="btn" onClick={download} title="Simpan tampilan saat ini sebagai PNG resolusi tinggi">
            PNG
          </button>
        </div>
      </div>
    </div>
  );
}
