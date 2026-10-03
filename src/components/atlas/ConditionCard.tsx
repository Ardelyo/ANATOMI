"use client";

import { SEVERITY_STYLE, type Condition } from "./types";

export default function ConditionCard({
  c,
  labels,
  matched,
  onShow,
  onFocus,
}: {
  c: Condition;
  labels: Map<string, string>;
  matched?: Set<string>;
  onShow: (c: Condition) => void;
  onFocus: (structure: string) => void;
}) {
  return (
    <div className="border border-line-strong bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-line bg-wash px-3 py-2.5">
        <div>
          <h4 className="text-[14px] font-semibold leading-snug text-ink">{c.name}</h4>
          <p className="label mt-0.5 !text-[10px]">{c.system}</p>
        </div>
        <span className={`shrink-0 px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wide ${SEVERITY_STYLE[c.severity]}`}>{c.severity}</span>
      </div>
      <div className="space-y-3 px-3 py-3 text-[13px] leading-relaxed text-ink-soft">
        <p>{c.description}</p>

        <div>
          <p className="label mb-1.5">Gejala khas</p>
          <ul className="flex flex-wrap gap-1.5">
            {c.symptoms.map((s) => {
              const hit = matched?.has(s);
              return (
                <li
                  key={s}
                  className={`border px-1.5 py-0.5 text-[11.5px] ${hit ? "border-accent bg-tint text-accent-deep" : "border-line text-mute"}`}
                >
                  {labels.get(s) ?? s}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-l-2 border-danger bg-danger-bg px-2.5 py-2 text-[12.5px] text-danger">
          <span className="font-semibold">Segera cari bantuan bila: </span>
          {c.redFlags}
        </div>

        <p>
          <span className="font-semibold text-ink">Langkah awal: </span>
          {c.advice}
        </p>

        <div>
          <p className="label mb-1.5">Struktur terkait</p>
          <div className="flex flex-wrap gap-1.5">
            {c.structures.map((s) => (
              <button key={s} onClick={() => onFocus(s)} className="border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-ink-soft hover:bg-tint">
                {s}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary w-full" onClick={() => onShow(c)}>
          Tampilkan pada model
        </button>
      </div>
    </div>
  );
}
