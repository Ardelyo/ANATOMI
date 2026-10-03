"use client";

import { useMemo, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import { SYSTEMS, metaFor, type SystemId } from "@/anatomy/catalog";

type Axis = "x" | "y" | "z" | null;
const CLIP_RANGE: Record<"x" | "y" | "z", [number, number, number]> = {
  x: [-0.25, 0.25, 0],
  y: [0.1, 1.75, 1.0],
  z: [-0.16, 0.16, 0],
};

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="label">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function LeftPanel({ engine }: { engine: AnatomyEngine | null }) {
  const [axis, setAxis] = useState<Axis>(null);
  const [pos, setPos] = useState(0);
  const [flip, setFlip] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<SystemId | null>(null);

  const entries = useMemo(() => {
    if (!engine) return [];
    const seen = new Set<string>();
    const out: { base: string; id: string; name: string; latin: string; system: SystemId }[] = [];
    for (const p of engine.parts) {
      if (!p.pick || seen.has(p.base)) continue;
      seen.add(p.base);
      const m = metaFor(p.base);
      out.push({ base: p.base, id: p.id, name: m.name, latin: m.latin, system: p.system });
    }
    return out;
  }, [engine]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.system] = (c[e.system] ?? 0) + 1;
    return c;
  }, [entries]);

  const query = q.trim().toLowerCase();
  const results = query
    ? entries.filter((e) => e.name.toLowerCase().includes(query) || e.latin.toLowerCase().includes(query) || e.base.includes(query)).slice(0, 80)
    : [];

  const pick = (e: { base: string; id: string }) => {
    if (!engine) return;
    engine.reveal(e.base);
    engine.select(e.id);
    void engine.focus(e.base);
  };

  const applyClip = (a: Axis, p: number, f: boolean) => {
    setAxis(a);
    setPos(p);
    setFlip(f);
    engine?.setClip(a, p, f);
  };

  const row = (e: (typeof entries)[number]) => (
    <button
      key={e.base}
      onClick={() => pick(e)}
      className={`block w-full px-2 py-1.5 text-left hover:bg-tint ${engine?.selectedId && metaFor(engine.selectedId).base === e.base ? "bg-tint" : ""}`}
    >
      <span className="block text-[12.5px] leading-tight text-ink">{e.name}</span>
      {e.latin && <span className="block font-mono text-[10.5px] leading-tight text-faint">{e.latin}</span>}
    </button>
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <Section
          title="Lapisan"
          aside={
            <button className="text-[11.5px] text-accent hover:underline" onClick={() => engine?.showAll()}>
              Tampilkan semua
            </button>
          }
        >
          <ul className="space-y-2">
            {SYSTEMS.map((s) => {
              const l = engine?.layers[s.id];
              return (
                <li key={s.id}>
                  <div className="flex items-center gap-2.5">
                    <button
                      role="switch"
                      aria-checked={l?.visible ?? false}
                      aria-label={s.label}
                      onClick={() => engine?.layer(s.id, { visible: !l?.visible })}
                      className="grid h-4 w-4 shrink-0 place-items-center border"
                      style={{ borderColor: s.color, background: l?.visible ? s.color : "#fff" }}
                    >
                      {l?.visible && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="1.8">
                          <path d="M2 5.2 4.2 7.4 8 3" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-[13px] ${l?.visible ? "text-ink" : "text-faint"}`}>{s.label}</span>
                    <span className="font-mono text-[10.5px] text-faint">{counts[s.id] ?? 0}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={l?.opacity ?? 1}
                      aria-label={`Opasitas ${s.label}`}
                      onChange={(ev) => engine?.layer(s.id, { opacity: Number(ev.target.value) })}
                      className="!w-20"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Potongan bidang">
          <div className="flex overflow-hidden rounded border border-line-strong">
            {(
              [
                [null, "Mati"],
                ["x", "Sagital"],
                ["z", "Koronal"],
                ["y", "Aksial"],
              ] as [Axis, string][]
            ).map(([a, label], i) => (
              <button
                key={label}
                onClick={() => applyClip(a, a ? CLIP_RANGE[a][2] : 0, flip)}
                className={`h-7 flex-1 text-[12px] font-medium ${i > 0 ? "border-l border-line" : ""} ${axis === a ? "bg-accent text-white" : "text-ink-soft hover:bg-tint"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {axis && (
            <div className="mt-2.5 flex items-center gap-3">
              <input
                type="range"
                min={CLIP_RANGE[axis][0]}
                max={CLIP_RANGE[axis][1]}
                step={0.005}
                value={pos}
                aria-label="Posisi potongan"
                onChange={(ev) => applyClip(axis, Number(ev.target.value), flip)}
              />
              <button className="btn !h-6 !px-2" onClick={() => applyClip(axis, pos, !flip)}>
                Balik
              </button>
            </div>
          )}
        </Section>

        <Section title="Struktur">
          <input className="field" placeholder="Cari: jantung, femur, lumbar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari struktur" />
          <div className="mt-2">
            {query ? (
              results.length ? (
                <div className="-mx-2">{results.map(row)}</div>
              ) : (
                <p className="px-0.5 py-2 text-[12.5px] text-mute">Tidak ada struktur yang cocok.</p>
              )
            ) : (
              <ul className="-mx-2">
                {SYSTEMS.map((s) => (
                  <li key={s.id}>
                    <button
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-tint"
                      onClick={() => setOpen(open === s.id ? null : s.id)}
                      aria-expanded={open === s.id}
                    >
                      <span className="h-2 w-2 shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 text-[13px] text-ink">{s.label}</span>
                      <span className="font-mono text-[10.5px] text-faint">{counts[s.id] ?? 0}</span>
                      <span className="w-3 text-center text-faint">{open === s.id ? "−" : "+"}</span>
                    </button>
                    {open === s.id && <div className="ml-4 border-l border-line">{entries.filter((e) => e.system === s.id).map(row)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
