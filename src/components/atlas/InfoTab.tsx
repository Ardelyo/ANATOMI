"use client";

import { useEffect, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import type { BodyPartsEngine } from "@/anatomy/bodyparts3d/engine";
import { SYSTEM_BY_ID, metaFor } from "@/anatomy/catalog";
import { BP3D_SYSTEMS, type BP3DPart, type BP3DConcept } from "@/anatomy/bodyparts3d/types";
import ConditionCard from "./ConditionCard";
import { SEVERITY_STYLE, type Condition, type ViewMode } from "./types";

export default function InfoTab({
  engine,
  bp3dEngine,
  mode = "simulation",
  labels,
  onShow,
  onFocus,
  onMark,
}: {
  engine: AnatomyEngine | null;
  bp3dEngine?: BodyPartsEngine | null;
  mode?: ViewMode;
  labels: Map<string, string>;
  onShow: (c: Condition) => void;
  onFocus: (structure: string) => void;
  onMark: () => void;
}) {
  // State kondisi
  const [list, setList] = useState<{ key: string; items: Condition[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  // ───── Simulation Part & Meta
  const simId = engine?.selectedId ?? null;
  const simPart = simId ? engine?.byId.get(simId)?.[0] : undefined;
  const simMeta = simId ? metaFor(simId) : null;

  // ───── BodyParts3D Part & Concept
  const bp3dId = bp3dEngine?.selectedId ?? null;
  const bp3dPart: BP3DPart | undefined = bp3dId
    ? bp3dEngine?.atlas?.parts.find((p) => p.id === bp3dId)
    : undefined;
  const bp3dConcept: BP3DConcept | undefined = bp3dPart
    ? bp3dEngine?.atlas?.concepts.find((c) => c.elements.includes(bp3dPart.id))
    : undefined;
  const bp3dSystem = bp3dPart ? BP3D_SYSTEMS.find((s) => s.id === bp3dPart.system) : null;

  // Query kondisi terkait untuk Simulation mode
  useEffect(() => {
    if (mode !== "simulation" || !simPart) return;
    const keys = [simPart.id, simPart.base, ...simPart.tags].join(",");
    let alive = true;
    fetch(`/api/conditions?keys=${encodeURIComponent(keys)}`)
      .then((r) => r.json())
      .then((items: Condition[]) => {
        if (alive) {
          setList({ key: simPart.id, items });
          setOpen(null);
        }
      })
      .catch(() => alive && setList({ key: simPart.id, items: [] }));
    return () => {
      alive = false;
    };
  }, [mode, simPart]);

  // Query kondisi terkait untuk BodyParts3D mode
  useEffect(() => {
    if (mode !== "bodyparts3d" || !bp3dPart) return;
    const nameWords = bp3dPart.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const keys = [bp3dPart.system, bp3dPart.name, bp3dPart.conceptId, ...nameWords].join(",");
    let alive = true;
    fetch(`/api/conditions?keys=${encodeURIComponent(keys)}`)
      .then((r) => r.json())
      .then((items: Condition[]) => {
        if (alive) {
          setList({ key: bp3dPart.id, items });
          setOpen(null);
        }
      })
      .catch(() => alive && setList({ key: bp3dPart.id, items: [] }));
    return () => {
      alive = false;
    };
  }, [mode, bp3dPart]);

  // Tampilan Default saat belum ada bagian yang dipilih
  if (mode === "simulation" && (!engine || !simId || !simMeta || !simPart)) {
    return (
      <div className="space-y-5 px-4 py-5">
        <div>
          <h2 className="text-[17px] font-semibold leading-tight text-ink">Simulasi Anatomi 3D</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
            Model interaktif multi-sistem dengan pergerakan sendi, detak jantung, respirasi paru, dan pemeriksaan klinis.
          </p>
        </div>
        <ol className="space-y-2.5 text-[13px] text-ink-soft">
          {[
            ["Putar & Identifikasi", "Seret untuk memutar kamera, gulir mouse untuk zoom, klik organ mana pun."],
            ["Periksa Gejala", "Buka tab Gejala, pilih keluhan klinis, dan sorot lokasi penyakit pada tubuh."],
            ["Kodekan Skrip AI", "Jalankan skrip animasi kustom atau kirim prompt terstruktur ke model bahasa."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 font-mono text-[11px] text-accent">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block font-medium text-ink">{t}</span>
                <span className="block text-mute">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-3 border border-line text-center">
          {[
            [engine ? engine.uniqueIds().length : 0, "struktur"],
            [9, "sistem"],
            [24, "ruas vertebra"],
          ].map(([n, l], i) => (
            <div key={String(l)} className={`px-2 py-2.5 ${i > 0 ? "border-l border-line" : ""}`}>
              <div className="font-mono text-[16px] text-ink">{n}</div>
              <div className="text-[10.5px] leading-tight text-mute">{l}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "bodyparts3d" && (!bp3dEngine || !bp3dId || !bp3dPart)) {
    const partsCount = bp3dEngine?.atlas?.parts.length ?? 2234;
    return (
      <div className="space-y-5 px-4 py-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-accent-deep">BodyParts3D 4.0</span>
          </div>
          <h2 className="text-[17px] font-semibold leading-tight text-ink">Scan Medis Nyata (2.234 Meshes)</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
            Rekonstruksi komputasional dari citra scan medis manusia dewasa nyata (The Database Center for Life Science, Japan).
            Setiap organ, tulang, dan pembuluh darah tersegmentasi secara mandiri.
          </p>
        </div>

        <ol className="space-y-2.5 text-[13px] text-ink-soft">
          {[
            ["Klik Organ & Tulang", "Klik langsung pada 2.234 struktur di layar untuk memeriksa nama dan ID ontologi FMA."],
            ["Orbit & Free Cam", "Gunakan Orbit Cam untuk pandangan 360°, atau Free Cam (WASD) untuk terbang ke dalam rongga dada/kepala."],
            ["Urai Model (Exploded View)", "Gunakan slider di bawah untuk mengurai ribuan struktur ke dalam grid spasial teratur."],
            ["Potongan Bidang (Clip)", "Buka panel Struktur untuk memotong tubuh pada bidang Sagital, Koronal, atau Aksial."],
            ["Tandai Titik Gejala", "Tancapkan pin gejala 3D langsung pada permukaan organ scan medis nyata."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 font-mono text-[11px] text-accent">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block font-medium text-ink">{t}</span>
                <span className="block text-mute">{d}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-3 border border-line text-center">
          {[
            [partsCount.toLocaleString(), "model 3D"],
            [15, "sistem tubuh"],
            ["3.432", "konsep FMA"],
          ].map(([n, l], i) => (
            <div key={String(l)} className={`px-2 py-2.5 ${i > 0 ? "border-l border-line" : ""}`}>
              <div className="font-mono text-[16px] text-ink">{n}</div>
              <div className="text-[10.5px] leading-tight text-mute">{l}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ───── Render Detail BodyParts3D
  if (mode === "bodyparts3d" && bp3dPart && bp3dEngine) {
    const items = list?.key === bp3dPart.id ? list.items : null;
    const isIsolated = bp3dEngine.isolatedId === bp3dPart.id;
    const bounds = bp3dPart.bounds;

    return (
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="label flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: bp3dSystem?.color ?? "#2f6fe0" }}
            />
            {bp3dSystem?.nameId ?? bp3dPart.system}
          </p>
          <h2 className="mt-1 text-[17.5px] font-semibold leading-tight text-ink">{bp3dPart.name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="border border-line px-1.5 py-px font-mono text-[10.5px] text-mute">
              ID: {bp3dPart.id}
            </span>
            <span className="border border-line px-1.5 py-px font-mono text-[10.5px] text-accent-deep">
              {bp3dPart.conceptId}
            </span>
            {bp3dConcept && (
              <span className="border border-line px-1.5 py-px text-[10.5px] text-ink-soft">
                {bp3dConcept.name}
              </span>
            )}
          </div>
        </div>

        {/* Deskripsi Sistem & Bounding Box */}
        <div className="rounded border border-line bg-wash/40 p-2.5 text-[12px] space-y-1">
          <p className="text-ink-soft">{bp3dSystem?.description}</p>
          <div className="pt-1 font-mono text-[10.5px] text-faint">
            Bounding Box: [{bounds[0].map((v) => v.toFixed(2)).join(", ")}] s/d [{bounds[1].map((v) => v.toFixed(2)).join(", ")}] m
          </div>
          <div className="font-mono text-[10.5px] text-faint">
            Vertex: {bp3dPart.vertexCount.toLocaleString()} · Index: {bp3dPart.indexCount.toLocaleString()}
          </div>
        </div>

        {/* Tombol Aksi Struktur */}
        <div className="grid grid-cols-4 gap-1.5">
          <button className="btn" onClick={() => bp3dEngine.focus(bp3dPart.id)} title="Arahkan kamera ke organ">
            Fokus
          </button>
          <button
            className={`btn ${isIsolated ? "btn-primary" : ""}`}
            onClick={() => (isIsolated ? bp3dEngine.isolate(null) : bp3dEngine.isolate(bp3dPart.id))}
            title="Hanya tampilkan organ ini"
          >
            {isIsolated ? "Batal" : "Isolasi"}
          </button>
          <button
            className="btn"
            onClick={() => {
              bp3dEngine.select(null);
              bp3dEngine.unhighlight();
            }}
            title="Batalkan pilihan"
          >
            Lepas
          </button>
          <button className="btn" onClick={onMark} title="Tandai titik gejala pada organ ini">
            Tandai
          </button>
        </div>

        {/* Kondisi Klinis Terkait */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="label">Kondisi Klinis Terkait</h3>
            {items && <span className="font-mono text-[10.5px] text-faint">{items.length}</span>}
          </div>
          {items === null ? (
            <p className="text-[12.5px] text-mute">Memeriksa basis data penyakit…</p>
          ) : items.length === 0 ? (
            <p className="border border-dashed border-line-strong px-3 py-3 text-[12px] text-mute">
              Tidak ada kondisi spesifik yang terhubung langsung dengan nama & ID struktur ini.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((c) => (
                <li key={c.id}>
                  {open === c.id ? (
                    <ConditionCard c={c} labels={labels} onShow={onShow} onFocus={onFocus} />
                  ) : (
                    <button
                      onClick={() => setOpen(c.id)}
                      className="flex w-full items-center justify-between gap-3 border border-line px-3 py-2 text-left hover:border-line-strong hover:bg-wash"
                    >
                      <span className="text-[13px] text-ink">{c.name}</span>
                      <span className={`shrink-0 px-1.5 py-px font-mono text-[10px] uppercase ${SEVERITY_STYLE[c.severity]}`}>
                        {c.severity}
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ───── Render Detail Simulation
  if (!simPart || !simMeta || !engine) return null;
  const sys = SYSTEM_BY_ID[simMeta.system];
  const isolated = engine.state().isolated !== null;
  const items = list?.key === simPart.id ? list.items : null;

  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <p className="label flex items-center gap-1.5">
          <span className="inline-block h-2 w-2" style={{ background: sys.color }} />
          {sys.label}
        </p>
        <h2 className="mt-1 text-[18px] font-semibold leading-tight text-ink">{simMeta.name}</h2>
        {simMeta.latin && <p className="mt-0.5 font-mono text-[12px] text-mute">{simMeta.latin}</p>}
        <div className="mt-2 flex flex-wrap gap-1">
          {simPart.tags.slice(0, 6).map((t) => (
            <span key={t} className="border border-line px-1.5 py-px font-mono text-[10.5px] text-mute">
              {t}
            </span>
          ))}
        </div>
      </div>

      {simMeta.desc && <p className="text-[13.5px] leading-relaxed text-ink-soft">{simMeta.desc}</p>}

      <div className="grid grid-cols-4 gap-1.5">
        <button className="btn" onClick={() => void engine.focus(simPart.base)}>
          Fokus
        </button>
        <button
          className="btn"
          data-on={isolated}
          onClick={() => (isolated ? engine.isolate(null) : engine.isolate(simPart.base, { dim: true }))}
        >
          Isolasi
        </button>
        <button
          className="btn"
          onClick={() => {
            engine.hide(simPart.base);
            engine.select(null);
          }}
        >
          Sembunyi
        </button>
        <button className="btn" onClick={onMark}>
          Tandai
        </button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="label">Kondisi terkait</h3>
          {items && <span className="font-mono text-[10.5px] text-faint">{items.length}</span>}
        </div>
        {items === null ? (
          <p className="text-[12.5px] text-mute">Memuat…</p>
        ) : items.length === 0 ? (
          <p className="border border-dashed border-line-strong px-3 py-3 text-[12.5px] text-mute">
            Belum ada kondisi dalam basis data yang terkait langsung dengan struktur ini.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((c) => (
              <li key={c.id}>
                {open === c.id ? (
                  <ConditionCard c={c} labels={labels} onShow={onShow} onFocus={onFocus} />
                ) : (
                  <button
                    onClick={() => setOpen(c.id)}
                    className="flex w-full items-center justify-between gap-3 border border-line px-3 py-2 text-left hover:border-line-strong hover:bg-wash"
                  >
                    <span className="text-[13px] text-ink">{c.name}</span>
                    <span className={`shrink-0 px-1.5 py-px font-mono text-[10px] uppercase ${SEVERITY_STYLE[c.severity]}`}>
                      {c.severity}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
