"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import { API_DOC, EXAMPLES, buildAiPrompt, runScript } from "@/anatomy/script";
import type { SavedScript } from "./types";

interface LogLine {
  level: "log" | "warn" | "error" | "ok";
  text: string;
}

const fmt = (v: unknown) => {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const LOG_COLOR: Record<LogLine["level"], string> = {
  log: "text-ink-soft",
  warn: "text-warn",
  error: "text-danger",
  ok: "text-accent-deep",
};

export default function ScriptTab({ engine }: { engine: AnatomyEngine | null }) {
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState<SavedScript[]>([]);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const run = useRef<{ abort: () => void } | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);

  const loadSaved = useCallback(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((rows: SavedScript[]) => setSaved(rows))
      .catch(() => undefined);
  }, []);

  useEffect(loadSaved, [loadSaved]);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest" });
  }, [logs]);

  const execute = () => {
    if (!engine || running) return;
    setLogs([]);
    setRunning(true);
    const r = runScript(engine, code, (level, ...a) => setLogs((l) => [...l, { level, text: a.map(fmt).join(" ") }].slice(-200)));
    run.current = r;
    void r.promise.finally(() => {
      setRunning(false);
      run.current = null;
    });
  };

  const stop = () => run.current?.abort();

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    const res = await fetch("/api/scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n, code }) });
    if (res.ok) {
      setName("");
      loadSaved();
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/scripts?id=${id}`, { method: "DELETE" });
    loadSaved();
  };

  const [copiedKind, setCopiedKind] = useState<string | null>(null);

  const copyPromptText = async (text: string, kind = "prompt") => {
    await navigator.clipboard.writeText(text);
    setCopiedKind(kind);
    setTimeout(() => setCopiedKind(null), 2000);
  };

  const copyFullPrompt = async () => {
    if (!engine) return;
    await copyPromptText(buildAiPrompt(engine), "full");
  };

  const PROMPT_TEMPLATES = [
    {
      title: "Serangan Jantung & Arteri Koroner",
      prompt: `Buatkan skrip ANATOMI untuk memvisualisasikan infark miokard akut (serangan jantung):
- Mulai dengan reset model
- Samarkan rangka dan sembunyikan kulit
- Sorot jantung dan arteri koroner (LAD, RCA, LCx)
- Dekatkan kamera dan fokus pada bilik kiri (left-ventricle)
- Jalankan detak jantung 75 bpm
- Kedipkan anterior-interventricular-artery (LAD) warna merah
- Beri penanda pada LAD: 'Oklusi LAD ("The Widow Maker")' dan pada left-ventricle: 'Iskemia dinding anterior'
- Putar kamera mengorbit secara perlahan`,
    },
    {
      title: "Saraf Kejepit (HNP) & Ischialgia",
      prompt: `Buatkan skrip ANATOMI untuk memvisualisasikan hernia nukleus pulposus (HNP) L4-L5:
- Mulai dengan reset model
- Tampilkan tulang belakang dan saraf
- Isolasi ruas lumbal, sakrum, diskus L4-L5, dan nervus iskiadikus
- Sorot disc-L4-L5 dengan warna merah dan sciatic-nerve dengan warna kuning
- Arahkan kamera ke punggung bawah (azimuth 160)
- Beri penanda 'Diskus L4–L5 menekan radiks saraf' dan 'Nyeri menjalar sepanjang tungkai'
- Kedipkan diskus yang bermasalah`,
    },
    {
      title: "Kranium & Saraf Kranial",
      prompt: `Buatkan skrip ANATOMI untuk mendemonstrasikan kranium dan persarafan kepala:
- Reset model dan fokus ke kepala
- Sorot frontal-bone, parietal-bone, temporal-bone, occipital-bone
- Tampilkan dan sorot optic-nerve (CN II) dan trigeminal-nerve (CN V)
- Tunjukkan posisi kelenjar hipofisis (pituitary-gland) di sela tursika
- Tambahkan label penjelasan pada saraf optik dan hipofisis
- Lakukan orbit kamera 360 derajat mengelilingi kepala`,
    },
    {
      title: "Saluran Cerna & Duodenum",
      prompt: `Buatkan skrip ANATOMI untuk menelusuri sistem pencernaan:
- Reset model, samarkan lapisan rangka
- Sorot berurutan esofagus, lambung, duodenum, empedu, dan pankreas
- Tunjukkan hubungan saluran empedu utama (bile-duct) dan pankreas menuju duodenum
- Lakukan zoom in ke perut atas dan beri label pada organ-organ utama`,
    },
    {
      title: "Perintah JSON (anatomy.exec)",
      prompt: `Format perintah JSON yang valid untuk dieksekusi via anatomy.exec([...]):
[
  { "do": "reset" },
  { "do": "layer", "args": ["skeletal", { "opacity": 0.2 }] },
  { "do": "layer", "args": ["integumentary", { "visible": false }] },
  { "do": "highlight", "args": [["heart", "left-coronary-artery", "anterior-interventricular-artery"], { "dim": true }] },
  { "do": "focus", "args": ["heart", { "duration": 1200, "distance": 1.2 }] },
  { "parallel": [
    { "do": "heartbeat", "args": [75] },
    { "do": "blink", "args": ["anterior-interventricular-artery", { "times": 5, "color": "#ff3333" }] }
  ]},
  { "do": "mark", "args": ["anterior-interventricular-artery", "Oklusi LAD (Serangan Jantung)", { "severity": 3 }] },
  { "do": "wait", "args": [2000] },
  { "do": "orbit", "args": [50, 10, { "duration": 3000 }] }
]`,
    },
  ];

  return (
    <div className="space-y-5 px-4 py-4">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="label">Editor skrip</h3>
          <select
            className="field !h-7 !w-auto max-w-[190px] !py-0 text-[12px]"
            value=""
            aria-label="Muat contoh"
            onChange={(e) => {
              const ex = EXAMPLES.find((x) => x.name === e.target.value);
              if (ex) setCode(ex.code);
            }}
          >
            <option value="">Muat contoh…</option>
            {EXAMPLES.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          aria-label="Kode skrip"
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const t = e.currentTarget;
              const s = t.selectionStart;
              const v = t.value;
              setCode(v.slice(0, s) + "  " + v.slice(t.selectionEnd));
              requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              execute();
            }
          }}
          className="thin-scroll h-72 w-full resize-y border border-line-strong bg-wash p-3 font-mono text-[12px] leading-[1.65] text-ink outline-none focus:border-accent"
        />

        <div className="mt-2 flex items-center gap-2">
          <button className="btn btn-primary" onClick={execute} disabled={!engine || running}>
            {running ? "Berjalan…" : "Jalankan"}
          </button>
          <button className="btn" onClick={stop} disabled={!running}>
            Hentikan
          </button>
          <button className="btn" onClick={() => void engine?.resetAll()}>
            Reset model
          </button>
          <span className="ml-auto font-mono text-[10.5px] text-faint">Ctrl/⌘ + Enter</span>
        </div>

        <div className="thin-scroll mt-3 h-28 overflow-y-auto border border-line bg-white p-2.5 font-mono text-[11.5px] leading-5" aria-live="polite">
          {logs.length === 0 ? (
            <span className="text-faint">Keluaran skrip muncul di sini.</span>
          ) : (
            logs.map((l, i) => (
              <div key={i} className={`whitespace-pre-wrap break-words ${LOG_COLOR[l.level]}`}>
                <span className="text-faint">{l.level === "ok" ? "✓" : l.level === "error" ? "✕" : l.level === "warn" ? "!" : "›"}</span> {l.text}
              </div>
            ))
          )}
          <div ref={logEnd} />
        </div>
      </section>

      <section>
        <h3 className="label mb-2">Skrip tersimpan</h3>
        <div className="mb-2 flex gap-2">
          <input className="field" placeholder="Nama skrip" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} aria-label="Nama skrip" />
          <button className="btn" onClick={() => void save()} disabled={!name.trim()}>
            Simpan
          </button>
        </div>
        {saved.length === 0 ? (
          <p className="text-[12.5px] text-mute">Belum ada skrip tersimpan.</p>
        ) : (
          <ul className="divide-y divide-line border border-line">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-1.5">
                <button className="min-w-0 flex-1 truncate text-left text-[13px] text-ink hover:text-accent" onClick={() => setCode(s.code)}>
                  {s.name}
                </button>
                <button className="text-[12px] text-faint hover:text-danger" onClick={() => void remove(s.id)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-line bg-wash/50 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <h3 className="label !text-ink">Prompt Model & Agen AI</h3>
          </div>
          <button
            className={`btn !h-7 !px-3 font-medium transition-all ${copiedKind === "full" ? "!border-accent-deep !bg-accent-deep !text-white" : "btn-primary"}`}
            onClick={() => void copyFullPrompt()}
          >
            {copiedKind === "full" ? "✓ Tersalin!" : "Salin Prompt Agen Lengkap"}
          </button>
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          Gunakan prompt ini pada <strong>Claude</strong>, <strong>ChatGPT</strong>, <strong>Gemini</strong>, atau <strong>Ollama lokal</strong>. Model AI akan menghasilkan skrip JavaScript atau array JSON yang siap dijalankan langsung di konsol maupun editor ini.
        </p>

        {/* Template prompt cepat */}
        <div className="mt-3 space-y-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-faint">Contoh Prompt Cepat (Siap Salin):</span>
          <div className="space-y-1.5">
            {PROMPT_TEMPLATES.map((tmpl, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 rounded border border-line bg-white px-2.5 py-1.5 text-[12px]">
                <span className="font-medium text-ink">{tmpl.title}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    className="btn !h-6 !px-2 !text-[11px]"
                    onClick={() => void copyPromptText(tmpl.prompt, `tmpl-${idx}`)}
                  >
                    {copiedKind === `tmpl-${idx}` ? "✓ Tersalin" : "Salin"}
                  </button>
                  <button
                    className="btn !h-6 !px-2 !text-[11px]"
                    title="Muat ke editor skrip"
                    onClick={() => {
                      if (tmpl.title.includes("JSON")) {
                        setCode(`await anatomy.exec(${tmpl.prompt.replace(/^Format perintah JSON.*\n/, "")});`);
                      } else {
                        // find matching example if exists
                        const match = EXAMPLES.find((ex) => ex.name.toLowerCase().includes(tmpl.title.toLowerCase().split(" ")[0]));
                        if (match) setCode(match.code);
                      }
                    }}
                  >
                    Pakai
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <details className="mt-3 border border-line bg-white">
          <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-medium text-ink-soft hover:bg-wash">
            Dokumentasi Lengkap API (window.anatomy)
          </summary>
          <pre className="thin-scroll max-h-96 overflow-auto border-t border-line bg-wash p-3 font-mono text-[11px] leading-[1.6] text-ink-soft">{API_DOC}</pre>
        </details>

        <div className="mt-3 border-t border-line pt-2 text-right">
          <span className="font-mono text-[10.5px] text-faint">ANATOMI · buatan Ardellio Satria Anindito</span>
        </div>
      </section>
    </div>
  );
}
