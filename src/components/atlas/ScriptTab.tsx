"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnatomyEngine } from "@/anatomy/engine";
import type { BodyPartsEngine } from "@/anatomy/bodyparts3d/engine";
import { API_DOC, EXAMPLES, buildAiPrompt, runScript } from "@/anatomy/script";
import { BP3D_EXAMPLES, buildBP3DAiPrompt, createBP3DApi } from "@/anatomy/bodyparts3d/script";
import { deleteClientScript, getClientScripts, saveClientScript } from "@/lib/client-data";
import type { SavedScript, ViewMode } from "./types";

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

export default function ScriptTab({
  engine,
  bp3dEngine,
  mode = "simulation",
}: {
  engine: AnatomyEngine | null;
  bp3dEngine?: BodyPartsEngine | null;
  mode?: ViewMode;
}) {
  const currentExamples = mode === "simulation" ? EXAMPLES : BP3D_EXAMPLES;
  const [code, setCode] = useState(currentExamples[0].code);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState<SavedScript[]>([]);
  const [name, setName] = useState("");
  const run = useRef<{ abort: () => void } | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);

  // Update contoh awal jika mode berubah
  useEffect(() => {
    setCode(mode === "simulation" ? EXAMPLES[0].code : BP3D_EXAMPLES[0].code);
  }, [mode]);

  const loadSaved = useCallback(() => {
    const rows = getClientScripts();
    setSaved(
      rows.map((r) => ({
        id: r.id,
        name: r.title,
        code: r.code,
        createdAt: r.createdAt,
      }))
    );
  }, []);

  useEffect(loadSaved, [loadSaved]);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest" });
  }, [logs]);

  const execute = () => {
    if (running) return;
    setLogs([]);
    setRunning(true);

    const logFn = (level: LogLine["level"], ...a: unknown[]) =>
      setLogs((l) => [...l, { level, text: a.map(fmt).join(" ") }].slice(-200));

    if (mode === "simulation" && engine) {
      const r = runScript(engine, code, logFn);
      run.current = r;
      void r.promise.finally(() => {
        setRunning(false);
        run.current = null;
      });
    } else if (mode === "bodyparts3d" && bp3dEngine) {
      const ctl = { aborted: false, cbs: new Set<() => void>() };
      const api = createBP3DApi(bp3dEngine, ctl, logFn);

      const promise = (async () => {
        try {
          const fn = new Function("anatomy", "sleep", "log", `return (async () => {\n${code}\n})();`);
          await fn(api, api.sleep, api.log);
          logFn("ok", "Skrip BodyParts3D selesai dieksekusi.");
        } catch (err: unknown) {
          if (err instanceof Error && err.message === "Skrip dihentikan") {
            logFn("warn", "Skrip dihentikan oleh pengguna.");
          } else {
            logFn("error", err instanceof Error ? err.message : String(err));
          }
        }
      })();

      const r = {
        promise,
        abort: () => {
          ctl.aborted = true;
          ctl.cbs.forEach((cb) => cb());
        },
      };

      run.current = r;
      void promise.finally(() => {
        setRunning(false);
        run.current = null;
      });
    } else {
      setRunning(false);
      logFn("error", "Engine anatomi belum siap.");
    }
  };

  const stop = () => run.current?.abort();

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    saveClientScript(n, code);
    setName("");
    loadSaved();
  };

  const remove = async (id: number) => {
    deleteClientScript(id);
    loadSaved();
  };

  const [copiedKind, setCopiedKind] = useState<string | null>(null);

  const copyPromptText = async (text: string, kind = "prompt") => {
    await navigator.clipboard.writeText(text);
    setCopiedKind(kind);
    setTimeout(() => setCopiedKind(null), 2000);
  };

  const copyFullPrompt = async () => {
    if (mode === "simulation") {
      if (!engine) return;
      await copyPromptText(buildAiPrompt(engine), "full");
    } else {
      if (!bp3dEngine) return;
      await copyPromptText(buildBP3DAiPrompt(bp3dEngine), "full");
    }
  };

  const PROMPT_TEMPLATES_SIM = [
    {
      title: "Shot Sinematik: Oklusi LAD & Infark Akut",
      prompt: `Buatkan skrip ANATOMI (Simulasi) sinematik untuk mendemonstrasikan serangan jantung akut:
- Kamera swooping-in cepat dari wide shot ke apeks jantung (duration 1400ms, distance 0.95m)
- Samarkan rangka ke opasitas 0.15 dan sembunyikan kulit
- Aktifkan detak jantung ritmis 76 bpm
- Lakukan pinpoint highlight mikro pada percabangan anterior-interventricular-artery (LAD) dengan severity 3 dan label 'Oklusi LAD ("The Widow Maker")'
- Putar kamera orbital 65 derajat mengelilingi miokardium yang iskemia
- Pinpoint dinding anterior bilik kiri (left-ventricle) untuk menunjukkan area infark transmural
- Sertakan log penjelasan klinis interaktif di setiap transisi`,
    },
    {
      title: "Shot Sinematik: Saraf Kejepit HNP L4-L5 & Ischialgia",
      prompt: `Buatkan skrip ANATOMI (Simulasi) sinematik untuk visualisasi hernia nukleus pulposus:
- Kamera meluncur halus ke punggung belakang bawah (azimuth 165, elevation 8)
- Aktifkan potongan sagital melintasi kanalis spinalis (anatomy.clip('x', 0, false))
- Pinpoint highlight diskus L4-L5 yang mengalami herniasi dengan severity 3
- Pinpoint highlight radiks nervus iskiadikus yang mengalami kompresi saraf
- Lakukan orbital camera sweep 195 derajat memperlihatkan penjalaran rasa sakit ke tungkai
- Nonaktifkan potongan bidang dan kembalikan tampilan utuh`,
    },
    {
      title: "Shot Sinematik: Refleks Patela & Biomekanika Genu",
      prompt: `Buatkan skrip ANATOMI (Simulasi) sinematik untuk demonstrasi busur refleks monosinaptik:
- Kamera meluncur fokus ke sendi lutut kiri (patella.L) dari sudut anterolateral
- Pinpoint highlight pada ligamen patela (patellar-ligament.L) sebagai titik stimulus refleks
- Simulasikan ketukan palu refleks dan gerakan ekstensi sendi lutut berulang (anatomy.joint)
- Sorot inervasi nervus femoralis segmen L2-L4`,
    },
    {
      title: "Shot Sinematik: Kranium & Kiasma Optikum",
      prompt: `Buatkan skrip ANATOMI (Simulasi) sinematik untuk eksplorasi saraf kranial:
- Kamera menyelam masuk ke dasar kranium anterior
- Pinpoint highlight pada kiasma optikum (optic-nerve.L) dan kelenjar hipofisis
- Lakukan orbit kamera 360 derajat halus mengelilingi sela tursika`,
    },
  ];

  const PROMPT_TEMPLATES_BP3D = [
    {
      title: "Shot Sinematik: Oklusi Arteri Koroner (LAD) BP3D",
      prompt: `Buatkan skrip ANATOMI (BodyParts3D) sinematik untuk memvisualisasikan oklusi arteri koroner pada 2.234 model scan medis:
- Sembunyikan lapisan kulit dan otot, samarkan rangka ke opasitas 0.15
- Kamera glide swooping-in dari tampak depan ke organ jantung
- Lakukan pinpoint highlight mikro pada cabang anterior interventricular (LAD) dengan pin 3D berdenyut merah
- Lakukan orbital camera sweep mengelilingi apeks miokardium
- Pinpoint bilik kiri (left ventricle) untuk memperlihatkan jaringan yang mengalami iskemia`,
    },
    {
      title: "Shot Sinematik: Saraf Kranial & Sela Tursika BP3D",
      prompt: `Buatkan skrip ANATOMI (BodyParts3D) sinematik untuk diseksi intrakranial:
- Isolasi sistem saraf (nervous) dan organ sensorik (sensory) dengan rangka samar
- Kamera meluncur masuk ke dalam kranium (distance 0.38m)
- Pinpoint highlight kiasma optikum (optic chiasm) dan nervus trigeminus (trigeminal nerve)
- Orbit kamera 360 derajat mengelilingi dasar fossa kranial`,
    },
    {
      title: "Shot Sinematik: Penguraian Spasial 2.234 Model (Exploded)",
      prompt: `Buatkan skrip ANATOMI (BodyParts3D) sinematik untuk mendemonstrasikan penguraian spasial:
- Dolly-out kamera ke sudut pandang isometrik elevated (distance 4.8m)
- Urai 2.234 potongan anatomi dari explode 0 ke 1 secara bertahap
- Pinpoint highlight organ jantung dan otak yang mengambang di ruang terbuka
- Kembalikan seluruh model ke posisi anatomis utuh semula`,
    },
    {
      title: "Shot Sinematik: Navigasi Bebas (Free Cam Flight)",
      prompt: `Buatkan skrip ANATOMI (BodyParts3D) sinematik untuk mendemonstrasikan penerbangan kamera first-person:
- Beralih ke kamera terbang bebas: anatomy.cameraMode('free')
- Terbang melintasi sela iga anterior langsung ke dalam mediastinum di belakang sternum
- Inspeksi arkus aorta dan bifurkasio trakea dari jarak dekat`,
    },
  ];

  const activeTemplates = mode === "simulation" ? PROMPT_TEMPLATES_SIM : PROMPT_TEMPLATES_BP3D;

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Editor Skrip */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h3 className="label">Editor Skrip</h3>
            <span className="rounded bg-tint px-1.5 py-0.5 font-mono text-[9.5px] uppercase font-semibold text-accent-deep">
              {mode === "simulation" ? "Simulasi" : "BodyParts3D"}
            </span>
          </div>

          <select
            className="field !h-7 !w-auto max-w-[200px] !py-0 text-[12px]"
            value=""
            aria-label="Muat contoh"
            onChange={(e) => {
              const ex = currentExamples.find((x) => x.name === e.target.value);
              if (ex) setCode(ex.code);
            }}
          >
            <option value="">Muat contoh {mode === "simulation" ? "Simulasi" : "Scan Medis"}…</option>
            {currentExamples.map((x) => (
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
          <button
            className="btn btn-primary"
            onClick={execute}
            disabled={(mode === "simulation" && !engine) || (mode === "bodyparts3d" && !bp3dEngine) || running}
          >
            {running ? "Berjalan…" : "Jalankan"}
          </button>
          <button className="btn" onClick={stop} disabled={!running}>
            Hentikan
          </button>
          <button
            className="btn"
            onClick={() => {
              if (mode === "simulation") void engine?.resetAll();
              else {
                bp3dEngine?.unhighlight();
                bp3dEngine?.isolate(null);
                bp3dEngine?.setExplode(0);
                bp3dEngine?.setClip(null);
                bp3dEngine?.view("three-quarter");
              }
            }}
          >
            Reset
          </button>
          <span className="ml-auto font-mono text-[10.5px] text-faint">Ctrl/⌘ + Enter</span>
        </div>

        {/* Console Log Output */}
        <div
          className="thin-scroll mt-3 h-28 overflow-y-auto border border-line bg-white p-2.5 font-mono text-[11.5px] leading-5"
          aria-live="polite"
        >
          {logs.length === 0 ? (
            <span className="text-faint">Keluaran skrip eksekusi muncul di sini.</span>
          ) : (
            logs.map((l, i) => (
              <div key={i} className={`whitespace-pre-wrap break-words ${LOG_COLOR[l.level]}`}>
                <span className="text-faint">
                  {l.level === "ok" ? "✓" : l.level === "error" ? "✕" : l.level === "warn" ? "!" : "›"}
                </span>{" "}
                {l.text}
              </div>
            ))
          )}
          <div ref={logEnd} />
        </div>
      </section>

      {/* Skrip Tersimpan */}
      <section>
        <h3 className="label mb-2">Skrip Tersimpan</h3>
        <div className="mb-2 flex gap-2">
          <input
            className="field"
            placeholder="Nama skrip"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            aria-label="Nama skrip"
          />
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
                <button
                  className="min-w-0 flex-1 truncate text-left text-[13px] text-ink hover:text-accent"
                  onClick={() => setCode(s.code)}
                >
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

      {/* Prompt Model & Agen AI */}
      <section className="rounded border border-line bg-wash/50 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <h3 className="label !text-ink">
              Prompt Agen AI ({mode === "simulation" ? "Simulasi" : "BodyParts3D"})
            </h3>
          </div>
          <button
            className={`btn !h-7 !px-3 font-medium transition-all ${
              copiedKind === "full" ? "!border-accent-deep !bg-accent-deep !text-white" : "btn-primary"
            }`}
            onClick={() => void copyFullPrompt()}
          >
            {copiedKind === "full" ? "✓ Tersalin!" : "Salin Prompt Agen Lengkap"}
          </button>
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          Tempelkan prompt ini ke <strong>Claude</strong>, <strong>ChatGPT</strong>, <strong>Gemini</strong>, atau{" "}
          <strong>Ollama lokal</strong>. Model AI akan menghasilkan kode JavaScript atau format JSON yang siap
          dijalankan di browser untuk mengendalikan model 3D.
        </p>

        {/* Template Prompt Cepat */}
        <div className="mt-3 space-y-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-faint">
            Contoh Prompt {mode === "simulation" ? "Simulasi" : "Scan Medis"}:
          </span>
          <div className="space-y-1.5">
            {activeTemplates.map((tmpl, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded border border-line bg-white px-2.5 py-1.5 text-[12px]"
              >
                <span className="font-medium text-ink truncate">{tmpl.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
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
                      const match = currentExamples.find((ex) =>
                        ex.name.toLowerCase().includes(tmpl.title.toLowerCase().split(" ")[0]),
                      );
                      if (match) setCode(match.code);
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
          <pre className="thin-scroll max-h-96 overflow-auto border-t border-line bg-wash p-3 font-mono text-[11px] leading-[1.6] text-ink-soft">
            {API_DOC}
          </pre>
        </details>

        <div className="mt-3 border-t border-line pt-2 text-right">
          <span className="font-mono text-[10.5px] text-faint">ANATOMI · buatan Ardellio Satria Anindito</span>
        </div>
      </section>
    </div>
  );
}
