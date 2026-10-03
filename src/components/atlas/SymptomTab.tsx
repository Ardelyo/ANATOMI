"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import { metaFor } from "@/anatomy/catalog";
import ConditionCard from "./ConditionCard";
import { SEVERITY_STYLE, type Annotation, type Condition, type DiagnoseHit, type Symptom } from "./types";

export interface PendingMark {
  partId: string;
  point: [number, number, number];
}

const SEV_LABEL = ["", "Ringan", "Sedang", "Berat"];
const SEV_DOT = ["", "#2f6fe0", "#d99a2b", "#d9534f"];

export default function SymptomTab({
  engine,
  symptoms,
  labels,
  annotations,
  pending,
  onShow,
  onFocus,
  onSavePending,
  onCancelPending,
  onDeleteAnnotation,
}: {
  engine: AnatomyEngine | null;
  symptoms: Symptom[];
  labels: Map<string, string>;
  annotations: Annotation[];
  pending: PendingMark | null;
  onShow: (c: Condition) => void;
  onFocus: (structure: string) => void;
  onSavePending: (f: { label: string; note: string; severity: number }) => void;
  onCancelPending: () => void;
  onDeleteAnnotation: (a: Annotation) => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DiagnoseHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", note: "", severity: 1 });

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const m = new Map<string, Symptom[]>();
    for (const s of symptoms) {
      if (ql && !s.label.toLowerCase().includes(ql)) continue;
      const l = m.get(s.region) ?? [];
      l.push(s);
      m.set(s.region, l);
    }
    return [...m.entries()];
  }, [symptoms, q]);

  useEffect(() => {
    if (chosen.length === 0) return;
    const t = setTimeout(() => {
      setBusy(true);
      fetch("/api/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symptoms: chosen }) })
        .then((r) => r.json())
        .then((d: { results: DiagnoseHit[] }) => setHits(d.results))
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(t);
  }, [chosen]);

  const toggle = (slug: string) => {
    setOpenSlug(null);
    setChosen((c) => (c.includes(slug) ? c.filter((s) => s !== slug) : [...c, slug]));
  };

  const clear = () => {
    setChosen([]);
    setHits([]);
    setOpenSlug(null);
    engine?.unhighlight();
  };

  const shownHits = chosen.length ? hits : [];
  const matchedSet = (h: DiagnoseHit) => new Set(h.matched.map((m) => m.slug));

  return (
    <div className="space-y-6 px-4 py-4">
      {/* Pemeriksa gejala */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="label">Pemeriksa gejala</h3>
          {chosen.length > 0 && (
            <button className="text-[11.5px] text-accent hover:underline" onClick={clear}>
              Bersihkan ({chosen.length})
            </button>
          )}
        </div>

        {chosen.length > 0 && (
          <ul className="mb-2.5 flex flex-wrap gap-1.5">
            {chosen.map((s) => (
              <li key={s}>
                <button onClick={() => toggle(s)} className="flex items-center gap-1.5 border border-accent bg-tint px-2 py-0.5 text-[12px] text-accent-deep hover:bg-white">
                  {labels.get(s) ?? s}
                  <span aria-hidden className="text-[13px] leading-none">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <input className="field" placeholder="Cari gejala: nyeri, batuk, demam…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari gejala" />

        <div className="thin-scroll mt-2 max-h-52 space-y-3 overflow-y-auto border border-line p-2.5">
          {groups.length === 0 && <p className="text-[12.5px] text-mute">Gejala tidak ditemukan.</p>}
          {groups.map(([region, list]) => (
            <div key={region}>
              <p className="label mb-1.5 !text-[10px]">{region}</p>
              <ul className="flex flex-wrap gap-1.5">
                {list.map((s) => {
                  const on = chosen.includes(s.slug);
                  return (
                    <li key={s.slug}>
                      <button
                        onClick={() => toggle(s.slug)}
                        aria-pressed={on}
                        className={`border px-2 py-0.5 text-[12px] ${on ? "border-accent bg-accent text-white" : "border-line-strong text-ink-soft hover:bg-tint"}`}
                      >
                        {s.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {chosen.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="label">Kemungkinan kondisi</h4>
              <span className="font-mono text-[10.5px] text-faint">{busy ? "menganalisis…" : `${shownHits.length} hasil`}</span>
            </div>
            <ul className="space-y-1.5">
              {shownHits.map((h) => (
                <li key={h.slug}>
                  {openSlug === h.slug ? (
                    <ConditionCard c={h} labels={labels} matched={matchedSet(h)} onShow={onShow} onFocus={onFocus} />
                  ) : (
                    <button
                      onClick={() => {
                        setOpenSlug(h.slug);
                        onShow(h);
                      }}
                      className="block w-full border border-line px-3 py-2 text-left hover:border-line-strong hover:bg-wash"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-[13px] font-medium text-ink">{h.name}</span>
                        <span className={`shrink-0 px-1.5 py-px font-mono text-[10px] uppercase ${SEVERITY_STYLE[h.severity]}`}>{h.severity}</span>
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-[3px] flex-1 bg-line">
                          <span className="block h-full bg-accent" style={{ width: `${Math.round(h.score * 100)}%` }} />
                        </span>
                        <span className="font-mono text-[10.5px] text-mute">
                          {h.matched.length}/{h.symptoms.length} cocok
                        </span>
                      </span>
                    </button>
                  )}
                </li>
              ))}
              {!busy && shownHits.length === 0 && <li className="text-[12.5px] text-mute">Tidak ada kondisi yang cocok dalam basis data.</li>}
            </ul>
          </div>
        )}

        <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-mute">
          Alat edukasi berbasis pencocokan gejala, bukan diagnosis. Keluhan berat atau berlanjut perlu diperiksa tenaga kesehatan.
        </p>
      </section>

      {/* Penanda */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="label">Penanda gejala pada model</h3>
          <button className="btn !h-6 !px-2" data-on={engine?.markMode ?? false} onClick={() => engine?.setMarkMode(!engine.markMode)}>
            {engine?.markMode ? "Batal tandai" : "Tandai titik"}
          </button>
        </div>

        {pending && (
          <form
            className="mb-3 space-y-2.5 border border-accent bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.label.trim()) return;
              onSavePending(form);
              setForm({ label: "", note: "", severity: 1 });
            }}
          >
            <p className="text-[12px] text-mute">
              Pada <span className="font-medium text-ink">{metaFor(pending.partId).name}</span>
            </p>
            <input className="field" autoFocus placeholder="Mis. nyeri tajam, kesemutan, benjolan" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} aria-label="Label gejala" />
            <input className="field" placeholder="Catatan (opsional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} aria-label="Catatan" />
            <div className="flex overflow-hidden border border-line-strong">
              {[1, 2, 3].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setForm({ ...form, severity: s })}
                  className={`h-7 flex-1 text-[12px] ${s > 1 ? "border-l border-line" : ""} ${form.severity === s ? "bg-ink text-white" : "text-ink-soft hover:bg-tint"}`}
                >
                  {SEV_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" type="submit">
                Simpan penanda
              </button>
              <button className="btn" type="button" onClick={onCancelPending}>
                Batal
              </button>
            </div>
          </form>
        )}

        {annotations.length === 0 && !pending ? (
          <p className="border border-dashed border-line-strong px-3 py-3 text-[12.5px] leading-relaxed text-mute">
            Aktifkan “Tandai titik”, lalu klik lokasi keluhan pada model dari sudut mana pun. Penanda tersimpan dan ikut berputar bersama tubuh.
          </p>
        ) : (
          <ul className="divide-y divide-line border border-line">
            {annotations.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 px-3 py-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEV_DOT[a.severity] }} />
                <button className="min-w-0 flex-1 text-left" onClick={() => void engine?.focusMarker(`a${a.id}`)}>
                  <span className="block truncate text-[13px] text-ink">{a.label}</span>
                  <span className="block truncate text-[11.5px] text-mute">
                    {metaFor(a.partId).name}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                </button>
                <button className="text-[12px] text-faint hover:text-danger" onClick={() => onDeleteAnnotation(a)} aria-label={`Hapus ${a.label}`}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
