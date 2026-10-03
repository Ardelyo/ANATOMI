"use client";

import { useEffect, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import { SYSTEM_BY_ID, metaFor } from "@/anatomy/catalog";
import ConditionCard from "./ConditionCard";
import { SEVERITY_STYLE, type Condition } from "./types";

export default function InfoTab({
  engine,
  labels,
  onShow,
  onFocus,
  onMark,
}: {
  engine: AnatomyEngine | null;
  labels: Map<string, string>;
  onShow: (c: Condition) => void;
  onFocus: (structure: string) => void;
  onMark: () => void;
}) {
  const id = engine?.selectedId ?? null;
  const part = id ? engine?.byId.get(id)?.[0] : undefined;
  const meta = id ? metaFor(id) : null;
  const [list, setList] = useState<{ key: string; items: Condition[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!part) return;
    const keys = [part.id, part.base, ...part.tags].join(",");
    let alive = true;
    fetch(`/api/conditions?keys=${encodeURIComponent(keys)}`)
      .then((r) => r.json())
      .then((items: Condition[]) => {
        if (alive) {
          setList({ key: part.id, items });
          setOpen(null);
        }
      })
      .catch(() => alive && setList({ key: part.id, items: [] }));
    return () => {
      alive = false;
    };
  }, [part]);

  if (!engine || !id || !meta || !part) {
    return (
      <div className="space-y-5 px-4 py-5">
        <div>
          <h2 className="text-[17px] font-semibold leading-tight text-ink">Atlas anatomi manusia</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
            Model 3D dewasa dengan rangka, otot, organ, pembuluh darah, dan saraf. Putar, zoom, dan klik bagian mana pun untuk mengenali struktur serta penyakit yang menyertainya.
          </p>
        </div>
        <ol className="space-y-2.5 text-[13px] text-ink-soft">
          {[
            ["Putar & identifikasi", "Seret untuk memutar, gulir untuk zoom, klik kanan/dua jari untuk menggeser."],
            ["Periksa gejala", "Buka tab Gejala, pilih keluhan, lihat kemungkinan kondisi lalu sorot lokasinya pada model."],
            ["Kodekan animasi", "Tab Skrip menyediakan API JavaScript untuk menganimasikan sendi, organ, kamera, dan penanda."],
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
            [24, "ruas tulang belakang"],
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

  const sys = SYSTEM_BY_ID[meta.system];
  const isolated = engine.state().isolated !== null;
  const items = list?.key === part.id ? list.items : null;

  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <p className="label flex items-center gap-1.5">
          <span className="inline-block h-2 w-2" style={{ background: sys.color }} />
          {sys.label}
        </p>
        <h2 className="mt-1 text-[18px] font-semibold leading-tight text-ink">{meta.name}</h2>
        {meta.latin && <p className="mt-0.5 font-mono text-[12px] text-mute">{meta.latin}</p>}
        <div className="mt-2 flex flex-wrap gap-1">
          {part.tags.slice(0, 6).map((t) => (
            <span key={t} className="border border-line px-1.5 py-px font-mono text-[10.5px] text-mute">
              {t}
            </span>
          ))}
        </div>
      </div>

      {meta.desc && <p className="text-[13.5px] leading-relaxed text-ink-soft">{meta.desc}</p>}

      <div className="grid grid-cols-4 gap-1.5">
        <button className="btn" onClick={() => void engine.focus(part.base)}>
          Fokus
        </button>
        <button
          className="btn"
          data-on={isolated}
          onClick={() => (isolated ? engine.isolate(null) : engine.isolate(part.base, { dim: true }))}
        >
          Isolasi
        </button>
        <button
          className="btn"
          onClick={() => {
            engine.hide(part.base);
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
          <p className="border border-dashed border-line-strong px-3 py-3 text-[12.5px] text-mute">Belum ada kondisi dalam basis data yang terkait langsung dengan struktur ini.</p>
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
                    <span className={`shrink-0 px-1.5 py-px font-mono text-[10px] uppercase ${SEVERITY_STYLE[c.severity]}`}>{c.severity}</span>
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
