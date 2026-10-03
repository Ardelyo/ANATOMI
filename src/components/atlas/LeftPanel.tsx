"use client";

import { useMemo, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import type { BodyPartsEngine } from "@/anatomy/bodyparts3d/engine";
import { SYSTEMS, metaFor, type SystemId } from "@/anatomy/catalog";
import { BP3D_SYSTEMS, type BP3DSystemId, type BP3DPart } from "@/anatomy/bodyparts3d/types";
import type { ViewMode } from "./types";

type Axis = "x" | "y" | "z" | null;
const CLIP_RANGE: Record<"x" | "y" | "z", [number, number, number]> = {
  x: [-0.35, 0.35, 0],
  y: [0.05, 1.8, 0.9],
  z: [-0.2, 0.2, 0],
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

export default function LeftPanel({
  engine,
  bp3dEngine,
  mode = "simulation",
}: {
  engine: AnatomyEngine | null;
  bp3dEngine?: BodyPartsEngine | null;
  mode?: ViewMode;
}) {
  const [axis, setAxis] = useState<Axis>(null);
  const [pos, setPos] = useState(0);
  const [flip, setFlip] = useState(false);
  const [q, setQ] = useState("");
  const [openSim, setOpenSim] = useState<SystemId | null>(null);
  const [openBP3D, setOpenBP3D] = useState<BP3DSystemId | null>(null);

  // ───── Simulation entries
  const simEntries = useMemo(() => {
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

  const simCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of simEntries) c[e.system] = (c[e.system] ?? 0) + 1;
    return c;
  }, [simEntries]);

  // ───── BodyParts3D entries
  const bp3dParts = useMemo(() => bp3dEngine?.atlas?.parts ?? [], [bp3dEngine?.atlas]);
  const bp3dCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of bp3dParts) c[p.system] = (c[p.system] ?? 0) + 1;
    return c;
  }, [bp3dParts]);

  const query = q.trim().toLowerCase();

  const simResults = query
    ? simEntries
        .filter(
          (e) =>
            e.name.toLowerCase().includes(query) ||
            e.latin.toLowerCase().includes(query) ||
            e.base.includes(query),
        )
        .slice(0, 60)
    : [];

  const bp3dResults = query
    ? bp3dParts
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.id.toLowerCase().includes(query) ||
            p.conceptId.toLowerCase().includes(query),
        )
        .slice(0, 60)
    : [];

  const applyClip = (a: Axis, p: number, f: boolean) => {
    setAxis(a);
    setPos(p);
    setFlip(f);
    if (mode === "simulation") {
      engine?.setClip(a, p, f);
    } else {
      bp3dEngine?.setClip(a, p, f);
    }
  };

  const pickSim = (e: { base: string; id: string }) => {
    if (!engine) return;
    engine.reveal(e.base);
    engine.select(e.id);
    void engine.focus(e.base);
  };

  const pickBP3D = (p: BP3DPart) => {
    if (!bp3dEngine) return;
    bp3dEngine.select(p.id);
    bp3dEngine.focus(p.id);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {/* ───── Section Lapisan ───── */}
        <Section
          title={mode === "simulation" ? "Lapisan Anatomi (9 Sistem)" : "15 Sistem Tubuh BodyParts3D"}
          aside={
            <button
              className="text-[11.5px] text-accent hover:underline"
              onClick={() => {
                if (mode === "simulation") engine?.showAll();
                else {
                  for (const s of BP3D_SYSTEMS) bp3dEngine?.setLayer(s.id, { visible: true, opacity: 1 });
                }
              }}
            >
              Tampilkan semua
            </button>
          }
        >
          {mode === "simulation" ? (
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
                      <span className="font-mono text-[10.5px] text-faint">{simCounts[s.id] ?? 0}</span>
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
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto thin-scroll">
              {BP3D_SYSTEMS.map((s) => {
                const l = bp3dEngine?.layers[s.id];
                const active = l?.visible ?? true;
                return (
                  <li key={s.id}>
                    <div className="flex items-center gap-2.5">
                      <button
                        role="switch"
                        aria-checked={active}
                        aria-label={s.nameId}
                        onClick={() => bp3dEngine?.setLayer(s.id, { visible: !active })}
                        className="grid h-4 w-4 shrink-0 place-items-center border"
                        style={{ borderColor: s.color, background: active ? s.color : "#fff" }}
                      >
                        {active && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="1.8">
                            <path d="M2 5.2 4.2 7.4 8 3" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-[12.5px] truncate ${active ? "text-ink font-medium" : "text-faint"}`}>
                        {s.nameId}
                      </span>
                      <span className="font-mono text-[10px] text-faint shrink-0">{bp3dCounts[s.id] ?? 0}</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={l?.opacity ?? 1}
                        aria-label={`Opasitas ${s.nameId}`}
                        onChange={(ev) => bp3dEngine?.setLayer(s.id, { opacity: Number(ev.target.value) })}
                        className="!w-16"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* ───── Section Potongan Bidang ───── */}
        <Section title="Potongan bidang (CT/MRI Clip)">
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
                className={`h-7 flex-1 text-[12px] font-medium ${i > 0 ? "border-l border-line" : ""} ${
                  axis === a ? "bg-accent text-white" : "text-ink-soft hover:bg-tint"
                }`}
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
                className="w-full"
              />
              <button className="btn !h-6 !px-2 shrink-0" onClick={() => applyClip(axis, pos, !flip)}>
                Balik
              </button>
            </div>
          )}
        </Section>

        {/* ───── Section Struktur & Pencarian ───── */}
        <Section title={mode === "simulation" ? "Struktur Anatomi" : "Katalog 2.234 Scan Medis"}>
          <input
            className="field w-full"
            placeholder={mode === "simulation" ? "Cari: jantung, femur, lumbar…" : "Cari organ: heart, femur, cranial nerve…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari struktur"
          />

          <div className="mt-2">
            {mode === "simulation" ? (
              query ? (
                simResults.length ? (
                  <div className="-mx-2">
                    {simResults.map((e) => (
                      <button
                        key={e.base}
                        onClick={() => pickSim(e)}
                        className={`block w-full px-2 py-1.5 text-left hover:bg-tint ${
                          engine?.selectedId && metaFor(engine.selectedId).base === e.base ? "bg-tint" : ""
                        }`}
                      >
                        <span className="block text-[12.5px] leading-tight text-ink">{e.name}</span>
                        {e.latin && <span className="block font-mono text-[10.5px] leading-tight text-faint">{e.latin}</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-0.5 py-2 text-[12.5px] text-mute">Tidak ada struktur yang cocok.</p>
                )
              ) : (
                <ul className="-mx-2">
                  {SYSTEMS.map((s) => (
                    <li key={s.id}>
                      <button
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-tint"
                        onClick={() => setOpenSim(openSim === s.id ? null : s.id)}
                        aria-expanded={openSim === s.id}
                      >
                        <span className="h-2 w-2 shrink-0" style={{ background: s.color }} />
                        <span className="flex-1 text-[13px] text-ink">{s.label}</span>
                        <span className="font-mono text-[10.5px] text-faint">{simCounts[s.id] ?? 0}</span>
                        <span className="w-3 text-center text-faint">{openSim === s.id ? "−" : "+"}</span>
                      </button>
                      {openSim === s.id && (
                        <div className="ml-4 border-l border-line">
                          {simEntries
                            .filter((e) => e.system === s.id)
                            .map((e) => (
                              <button
                                key={e.base}
                                onClick={() => pickSim(e)}
                                className={`block w-full px-2 py-1.5 text-left hover:bg-tint ${
                                  engine?.selectedId && metaFor(engine.selectedId).base === e.base ? "bg-tint" : ""
                                }`}
                              >
                                <span className="block text-[12.5px] leading-tight text-ink">{e.name}</span>
                                {e.latin && (
                                  <span className="block font-mono text-[10.5px] leading-tight text-faint">{e.latin}</span>
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : query ? (
              bp3dResults.length ? (
                <div className="-mx-2 max-h-96 overflow-y-auto thin-scroll">
                  {bp3dResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickBP3D(p)}
                      className={`block w-full px-2 py-1.5 text-left hover:bg-tint ${
                        bp3dEngine?.selectedId === p.id ? "bg-tint" : ""
                      }`}
                    >
                      <span className="block text-[12.5px] leading-tight text-ink">{p.name}</span>
                      <span className="block font-mono text-[10px] text-faint">
                        {p.conceptId} · {p.id}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-0.5 py-2 text-[12.5px] text-mute">Tidak ada struktur yang cocok.</p>
              )
            ) : (
              <ul className="-mx-2 max-h-96 overflow-y-auto thin-scroll">
                {BP3D_SYSTEMS.map((s) => {
                  const partsInSys = bp3dParts.filter((p) => p.system === s.id);
                  const isOpen = openBP3D === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-tint"
                        onClick={() => setOpenBP3D(isOpen ? null : s.id)}
                        aria-expanded={isOpen}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="flex-1 text-[12.5px] text-ink">{s.nameId}</span>
                        <span className="font-mono text-[10.5px] text-faint">{partsInSys.length}</span>
                        <span className="w-3 text-center text-faint">{isOpen ? "−" : "+"}</span>
                      </button>
                      {isOpen && (
                        <div className="ml-3 border-l border-line max-h-60 overflow-y-auto thin-scroll">
                          {partsInSys.slice(0, 100).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => pickBP3D(p)}
                              className={`block w-full px-2 py-1 text-left hover:bg-tint ${
                                bp3dEngine?.selectedId === p.id ? "bg-tint" : ""
                              }`}
                            >
                              <span className="block text-[11.5px] leading-tight text-ink truncate">{p.name}</span>
                              <span className="block font-mono text-[9.5px] text-faint">{p.conceptId}</span>
                            </button>
                          ))}
                          {partsInSys.length > 100 && (
                            <p className="px-2 py-1 text-[10.5px] text-faint italic">
                              +{partsInSys.length - 100} struktur lainnya (gunakan pencarian).
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
