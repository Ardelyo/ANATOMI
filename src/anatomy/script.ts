import { AnatomyEngine, POSES, VIEWS, type Ease, type Target } from "./engine";
import { SYSTEMS, metaFor } from "./catalog";

export interface Ctl {
  aborted: boolean;
  cbs: Set<() => void>;
}

class AbortScript extends Error {
  constructor() {
    super("Skrip dihentikan");
  }
}

type Log = (level: "log" | "warn" | "error" | "ok", ...a: unknown[]) => void;

interface DiagnoseResult {
  name: string;
  slug: string;
  score: number;
  severity: string;
  structures: string[];
  matched: { slug: string; label: string }[];
}

/** API publik yang dipakai skrip pengguna, agen AI, maupun window.anatomy. */
export function createApi(e: AnatomyEngine, ctl: Ctl, log: Log) {
  const firstId = (t: Target): string | null => e.resolve(t)[0]?.id ?? null;

  const sleep = (ms: number) =>
    new Promise<void>((res, rej) => {
      if (ctl.aborted) return rej(new AbortScript());
      const done = () => {
        ctl.cbs.delete(cancel);
        res();
      };
      const id = setTimeout(done, ms);
      const cancel = () => {
        clearTimeout(id);
        rej(new AbortScript());
      };
      ctl.cbs.add(cancel);
    });

  type TweenProps = Parameters<AnatomyEngine["tween"]>[1];
  type TweenOpts = NonNullable<Parameters<AnatomyEngine["tween"]>[2]>;

  const base = {
    // ── Pengetahuan & identifikasi
    parts: (filter?: string) =>
      e
        .uniqueIds()
        .filter((id) => !filter || e.resolve(filter).some((p) => p.id === id))
        .map((id) => {
          const d = e.describe(id);
          return { id, name: d.name, system: d.system, tags: d.tags };
        }),
    find: (query: string) => e.find(query),
    info: (target: Target) => {
      const id = firstId(target);
      return id ? e.describe(id) : null;
    },
    select: (id: string | null) => e.select(id),
    identify: (x: number, y: number) => e.identify(x, y),
    state: () => e.state(),
    snapshot: () => e.snapshot(),
    systems: () => SYSTEMS.map((s) => ({ id: s.id, label: s.label })),
    joints: () => e.jointInfo(),
    poses: () => Object.keys(POSES),
    views: () => Object.keys(VIEWS),

    // ── Tampilan
    show: (t: Target) => e.show(t),
    hide: (t: Target) => e.hide(t),
    isolate: (t: Target | null, o?: { dim?: boolean }) => e.isolate(t, o),
    showAll: () => e.showAll(),
    layer: (system: string, o: { visible?: boolean; opacity?: number }) => e.layer(system, o),
    opacity: (t: Target, v: number) => e.opacity(t, v),
    xray: (on = true) => e.xray(on),
    clip: (axis: "x" | "y" | "z" | null, pos?: number, o?: { flip?: boolean }) => e.setClip(axis, pos ?? 0, o?.flip ?? false),

    // ── Penandaan
    highlight: (t: Target, o?: { color?: string; intensity?: number; dim?: boolean }) => e.highlight(t, o),
    unhighlight: (t?: Target) => e.unhighlight(t),
    blink: (t: Target, o?: { color?: string; times?: number; period?: number }) => e.blink(t, o),
    mark: (t: Target, label: string, o?: { severity?: number; point?: [number, number, number] }) => {
      const id = firstId(t);
      if (!id) throw new Error(`bagian tidak ditemukan: ${String(t)}`);
      return e.addMarker({ partId: id, label, severity: o?.severity ?? 1, always: true, point: o?.point });
    },
    pinpoint: (
      t: Target,
      o?: {
        point?: [number, number, number];
        label?: string;
        severity?: number;
        duration?: number;
        distance?: number;
        azimuth?: number;
        elevation?: number;
        color?: string;
      },
    ) => e.pinpoint(t, o),
    unmark: (id: string) => e.removeMarker(id),
    clearMarks: () => e.clearMarkers(false),

    // ── Kamera
    view: (name: string, o?: { duration?: number; distance?: number }) => e.view(name, o),
    focus: (t: Target, o?: { duration?: number; distance?: number; azimuth?: number; elevation?: number }) => e.focus(t, o),
    orbit: (azimuth: number, elevation: number, o?: { distance?: number; duration?: number }) => e.orbit(azimuth, elevation, o),
    zoom: (distance: number, o?: { duration?: number }) => e.zoom(distance, o),
    spin: (on: boolean | number = true) => e.spin(on),
    resetView: () => e.resetView(),

    // ── Animasi
    joint: (name: string, angles: number | Record<string, number>, o?: { duration?: number; ease?: Ease }) => e.joint(name, angles, o),
    pose: (name: string, o?: { duration?: number }) => e.pose(name, o),
    walk: (on: boolean | number = true) => e.walk(on),
    heartbeat: (on: boolean | number = true) => e.heartbeat(on),
    breathe: (on: boolean | number = true) => e.breathe(on),
    pulse: (t: Target, o?: { bpm?: number; amount?: number }) => e.pulse(t, o),
    tween: (t: Target, props: TweenProps, o?: TweenOpts) => e.tween(t, props, o),
    move: (t: Target, by: [number, number, number], o?: TweenOpts) => e.tween(t, { move: by }, o),
    rotate: (t: Target, deg: [number, number, number], o?: TweenOpts) => e.tween(t, { rotate: deg }, o),
    scale: (t: Target, s: number | [number, number, number], o?: TweenOpts) => e.tween(t, { scale: s }, o),
    explode: (factor = 1, o?: { duration?: number }) => e.explode(factor, o),
    stop: (key?: string) => e.stop(key),
    stopAll: () => e.stopAll(),
    reset: () => e.resetAll(),
    sleep,
    wait: sleep,

    // ── Gejala & penyakit (basis data)
    symptoms: async () => (await fetch("/api/symptoms")).json() as Promise<{ slug: string; label: string; region: string }[]>,
    conditions: async (keys?: string | string[]) => {
      const k = Array.isArray(keys) ? keys.join(",") : keys;
      return (await fetch(`/api/conditions${k ? `?keys=${encodeURIComponent(k)}` : ""}`)).json() as Promise<unknown[]>;
    },
    diagnose: async (symptoms: string[], o?: { show?: boolean }) => {
      const res = await fetch("/api/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symptoms }) });
      const { results } = (await res.json()) as { results: DiagnoseResult[] };
      if (ctl.aborted) throw new AbortScript();
      if (o?.show !== false && results[0]) {
        e.unhighlight();
        e.highlight(results[0].structures, { dim: true });
        await e.focus(results[0].structures);
      }
      return results;
    },
  };

  type Api = typeof base & { exec: (cmds: Command[]) => Promise<void>; log: (...a: unknown[]) => void };
  const api = {} as Api;
  for (const [k, fn] of Object.entries(base)) {
    (api as unknown as Record<string, unknown>)[k] =
      k === "sleep" || k === "wait"
        ? fn
        : (...args: unknown[]) => {
            if (ctl.aborted) throw new AbortScript();
            return (fn as (...a: unknown[]) => unknown)(...args);
          };
  }

  /** Jalankan daftar perintah JSON: [{"do":"focus","args":["heart"]}, {"do":"wait","args":[500]}]. */
  api.exec = async (cmds: Command[]) => {
    for (const c of cmds) {
      if (ctl.aborted) throw new AbortScript();
      if (c.parallel) {
        await Promise.all(c.parallel.map((x) => api.exec([x])));
        continue;
      }
      if (!c.do) continue;
      const fn = (api as unknown as Record<string, unknown>)[c.do];
      if (typeof fn !== "function") throw new Error(`perintah tidak dikenal: ${c.do}`);
      await (fn as (...a: unknown[]) => unknown)(...(c.args ?? []));
    }
  };
  api.log = (...a: unknown[]) => log("log", ...a);
  return api;
}

export interface Command {
  do?: string;
  args?: unknown[];
  parallel?: Command[];
}

export type AnatomyApi = ReturnType<typeof createApi>;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...a: unknown[]) => Promise<unknown>;

export function runScript(e: AnatomyEngine, code: string, log: Log) {
  const ctl: Ctl = { aborted: false, cbs: new Set() };
  const api = createApi(e, ctl, log);
  const sandboxConsole = {
    log: (...a: unknown[]) => log("log", ...a),
    warn: (...a: unknown[]) => log("warn", ...a),
    error: (...a: unknown[]) => log("error", ...a),
  };
  const promise = (async () => {
    try {
      const fn = new AsyncFunction("anatomy", "sleep", "log", "console", `"use strict";\n${code}`);
      const out = await fn(api, api.sleep, api.log, sandboxConsole);
      if (!ctl.aborted) log("ok", out === undefined ? "Selesai." : `Selesai → ${safe(out)}`);
    } catch (err) {
      if (err instanceof AbortScript || ctl.aborted) log("warn", "Skrip dihentikan.");
      else log("error", err instanceof Error ? err.message : String(err));
    }
  })();
  const abort = () => {
    ctl.aborted = true;
    ctl.cbs.forEach((cb) => cb());
    e.stopAll();
  };
  return { promise, abort };
}

function safe(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v, null, 0)?.slice(0, 400) ?? String(v);
  } catch {
    return String(v);
  }
}

// ───────────── Contoh skrip
export interface Example {
  name: string;
  desc: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    name: "Shot Sinematik: Oklusi Arteri Koroner (LAD) & Infark",
    desc: "Kamera meluncur ke apeks jantung, detak aktif, dan pinpoint highlight oklusi LAD berdenyut.",
    code: `// Shot Sinematik: Oklusi Akut Arteri Koroner (LAD) & Infark Miokard
await anatomy.reset();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('skeletal', { opacity: 0.15 });
anatomy.layer('muscular', { visible: false });

log('1. Mengarahkan kamera meluncur cepat ke rongga dada...');
await anatomy.view('front', { duration: 900, distance: 2.8 });

log('2. Kamera swoop-in close-up ke apeks jantung & detak 76 bpm...');
await anatomy.focus('heart', { duration: 1400, distance: 0.95, azimuth: 22, elevation: 10 });
anatomy.heartbeat(76);

log('3. Pinpoint highlight pada percabangan arteri LAD (The Widow Maker)...');
await anatomy.pinpoint('anterior-interventricular-artery', {
  label: 'Oklusi Akut LAD (Infark Miokard)',
  severity: 3,
  duration: 1200,
  distance: 0.42
});

log('4. Orbital camera sweep mengelilingi miokardium yang iskemia...');
await anatomy.orbit(65, 12, { duration: 2500, distance: 0.52 });
await sleep(600);

log('5. Pinpoint highlight pada zona iskemia ventrikel kiri...');
await anatomy.pinpoint('left-ventricle', {
  label: 'Zona Iskemia Dinding Anterior',
  severity: 3,
  duration: 1000
});

await anatomy.orbit(20, 8, { duration: 2000, distance: 0.7 });
log('Visualisasi infark miokard selesai.');`,
  },
  {
    name: "Shot Sinematik: Saraf Kejepit HNP L4-L5 & Ischialgia",
    desc: "Kamera meluncur ke punggung bawah, potongan sagital aktif, dan pinpoint radiks saraf.",
    code: `// Shot Sinematik: Saraf Kejepit HNP L4-L5 & Ischialgia
await anatomy.reset();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('muscular', { visible: false });
anatomy.layer('skeletal', { opacity: 1 });

log('1. Kamera memutar meluncur ke punggung bawah...');
await anatomy.view('back', { duration: 1100, distance: 2.2 });
await sleep(400);

log('2. Kamera menyelam ke segmen lumbal L4-L5 dan sakrum...');
await anatomy.focus(['lumbar', 'sacrum'], { duration: 1400, distance: 0.7, azimuth: 165, elevation: 8 });

log('3. Mengaktifkan potongan sagital melintasi kanalis spinalis...');
anatomy.clip('x', 0, false);
await sleep(1200);

log('4. Pinpoint highlight pada penonjolan diskus L4-L5...');
await anatomy.pinpoint('disc-L4-L5', {
  label: 'Hernia Nukleus Pulposus (HNP) L4-L5',
  severity: 3,
  duration: 1100,
  distance: 0.45
});

log('5. Pinpoint highlight pada radiks saraf iskiadikus yang terjepit...');
await anatomy.pinpoint('sciatic-nerve.L', {
  label: 'Kompresi Radiks N. Iskiadikus (Nyeri Menjalar)',
  severity: 2,
  duration: 1200,
  distance: 0.5
});

await anatomy.orbit(195, 14, { duration: 2400 });
await sleep(1500);
anatomy.clip(null);
log('Potongan bidang dinonaktifkan.');`,
  },
  {
    name: "Shot Sinematik: Refleks Patela & Inervasi Tungkai",
    desc: "Kamera meluncur ke lutut, pinpoint ligamen patela, dan memicu refleks ekstensi sendi.",
    code: `// Shot Sinematik: Refleks Patela & Inervasi Tungkai
await anatomy.reset();
anatomy.layer('integumentary', { opacity: 0.08 });
anatomy.layer('muscular', { opacity: 0.6 });
anatomy.layer('skeletal', { opacity: 0.8 });

log('1. Kamera meluncur ke artikulasio genu (sendi lutut kiri)...');
await anatomy.focus('patella.L', { duration: 1200, distance: 0.75, azimuth: 25, elevation: -5 });

log('2. Pinpoint highlight pada ligamen patela (titik ketukan refleks L2-L4)...');
await anatomy.pinpoint('patellar-ligament.L', {
  label: 'Ligamentum Patellae (Refleks Monosinaptik L2-L4)',
  severity: 1,
  duration: 1000,
  distance: 0.4
});
await sleep(800);

log('3. Stimulasi refleks: kontraksi kuadriseps & ekstensi sendi lutut...');
for (let i = 0; i < 3; i++) {
  await anatomy.joint('knee.L', 0, { duration: 180 });
  await anatomy.joint('knee.L', 35, { duration: 250 });
  await sleep(400);
}

log('Refleks patela positif fisiologis.');`,
  },
  {
    name: "Shot Sinematik: Kranium & Saraf Kranial",
    desc: "Kamera menyelam masuk ke kranium, isolasi persarafan visual dan sela tursika.",
    code: `// Shot Sinematik: Kranium & Saraf Kranial
await anatomy.reset();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('muscular', { visible: false });

log('1. Mengarahkan kamera meluncur ke kepala...');
await anatomy.view('front', { duration: 900, distance: 1.5 });

log('2. Kamera menyelam close-up ke dasar kranium anterior...');
await anatomy.focus('optic-nerve.L', { duration: 1400, distance: 0.35, elevation: 18, azimuth: 12 });

log('3. Pinpoint highlight pada N. Optikus (CN II) & Kiasma Optikum...');
await anatomy.pinpoint('optic-nerve.L', {
  label: 'Nervus Opticus & Kiasma Optikum (CN II)',
  severity: 2,
  duration: 1100,
  distance: 0.25
});
await sleep(800);

log('4. Pinpoint highlight pada kelenjar hipofisis di sela tursika...');
await anatomy.pinpoint('pituitary-gland', {
  label: 'Kelenjar Hipofisis (Master Gland)',
  severity: 1,
  duration: 1000
});

log('5. Rotasi kamera orbital 360 derajat mengelilingi dasar otak...');
await anatomy.orbit(60, 20, { duration: 2600, distance: 0.45 });`,
  },
  {
    name: "Shot Sinematik: Saluran Cerna & Duodenum C-Loop",
    desc: "Swoop-in menelusuri lambung, kurvatura duodenum, dan saluran empedu/pankreas.",
    code: `// Shot Sinematik: Saluran Cerna & Duodenum
await anatomy.reset();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('skeletal', { opacity: 0.15 });

log('1. Meluncur ke regio epigastrium dan hipokondrium kiri...');
await anatomy.focus('stomach', { duration: 1100, distance: 0.85, azimuth: 10, elevation: 5 });

log('2. Pinpoint highlight pada saluran empedu utama (bile duct)...');
await anatomy.pinpoint('bile-duct', {
  label: 'Ductus Choledochus (Saluran Empedu)',
  severity: 2,
  duration: 1000,
  distance: 0.4
});
await sleep(800);

log('3. Pinpoint highlight pada kurvatura duodenum C-loop & pankreas...');
await anatomy.pinpoint('duodenum', {
  label: 'Duodenum C-Loop & Ampula Vater',
  severity: 1,
  duration: 1100,
  distance: 0.45
});

await anatomy.orbit(45, 12, { duration: 2400 });`,
  },
];

// ───────────── Dokumentasi API
export const API_DOC = `ANATOMI — API SKRIP (window.anatomy)
buatan Ardellio Satria Anindito

Target = id bagian ("femur.L", "left-coronary-artery"), id dasar ("femur" = kiri+kanan), tag wilayah/organ ("lung", "heart", "coronary", "spine", "thorax", "brain"),
nama sistem ("skeletal","muscular","circulatory","respiratory","digestive","nervous","urinary","endocrine","integumentary"),
awalan bintang ("vertebra-L*"), atau array dari semuanya. Sisi: ".L" = kiri pasien (x+), ".R" = kanan pasien (x-).
Koordinat dunia: meter, y ke atas, depan tubuh = +z, kiri pasien = +x.
Semua fungsi animasi mengembalikan Promise (gunakan await). Skrip berjalan sebagai async function dengan variabel: anatomy, sleep(ms), log(...).

IDENTIFIKASI
  anatomy.parts(filter?)            → [{id,name,system,tags}]
  anatomy.find("jantung")           → id yang cocok (nama Indonesia/Latin/tag)
  anatomy.info(target)              → {id,name,latin,system,description,tags}
  anatomy.identify(x, y)            → bagian pada titik layar ternormalisasi 0..1 (untuk agen yang melihat snapshot)
  anatomy.snapshot()                → data URL PNG tampilan saat ini
  anatomy.state()                   → kamera, layer, highlight, sendi, penanda, animasi aktif

TAMPILAN
  anatomy.show(t) / hide(t) / showAll()
  anatomy.isolate(t, {dim?})        → hanya t terlihat (dim:true = yang lain samar); isolate(null) membatalkan
  anatomy.layer(sistem, {visible?, opacity?})
  anatomy.opacity(t, 0..1)          anatomy.xray(true|false)
  anatomy.clip('x'|'y'|'z'|null, posisi, {flip?})   → potongan sagital(x) / aksial(y) / koronal(z)

PENANDAAN & PINPOINT HIGHLIGHT
  await anatomy.pinpoint(t, {point?: [x,y,z], label?, severity?: 1|2|3, duration?, distance?, azimuth?, elevation?, color?})
      → Menyorot target secara presisi mikro, kamera swoop-in close-up dramatis, menancapkan pin 3D berdenyut, dan meredupkan struktur lain.
  anatomy.highlight(t, {color?, intensity?, dim?})  anatomy.unhighlight(t?)
  anatomy.blink(t, {color?, times?, period?})
  anatomy.mark(t, "label", {severity?: 1|2|3, point?: [x,y,z]}) → id penanda     anatomy.unmark(id)  anatomy.clearMarks()

KAMERA
  anatomy.view('front'|'back'|'left'|'right'|'top'|'bottom'|'iso' (juga: depan, belakang, kiri, kanan, atas, bawah), {duration?, distance?})
  anatomy.focus(t, {duration?, distance?, azimuth?, elevation?})   anatomy.orbit(azimuthDeg, elevationDeg, {distance?, duration?})
  anatomy.zoom(jarak)   anatomy.spin(true|false|kecepatan)   anatomy.resetView()

ANIMASI
  anatomy.joint(nama, sudut|{dof:deg}, {duration?, ease?})
      shoulder.L/R {flex,abd,rot}  elbow.L/R {flex}  wrist.L/R {flex,dev}  hip.L/R {flex,abd,rot}
      knee.L/R {flex}  ankle.L/R {flex}  neck {flex,rot,tilt}  jaw {open}   (tanpa sisi = kedua sisi)
  anatomy.pose('rest'|'tpose'|'arms-up'|'reach'|'sit'|'stride', {duration?})
  anatomy.walk(true|false)  anatomy.heartbeat(bpm|false)  anatomy.breathe(napasPerMenit|false)
  anatomy.pulse(t, {bpm?, amount?})
  anatomy.tween(t, {move:[x,y,z], rotate:[degX,degY,degZ], scale:n|[x,y,z], opacity:0..1}, {duration?, ease?, loop?:'repeat'|'pingpong', count?, delay?, key?})
  anatomy.move(t,[x,y,z],opts)  anatomy.rotate(t,[x,y,z],opts)  anatomy.scale(t,s,opts)
  anatomy.explode(faktor, {duration?})   anatomy.stop(key?)   anatomy.stopAll()   anatomy.reset()
  ease: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

GEJALA & PENYAKIT (basis data)
  await anatomy.symptoms()          → [{slug,label,region}]
  await anatomy.conditions(keys?)   → penyakit yang menyentuh struktur tertentu
  await anatomy.diagnose(["nyeri-dada","sesak-napas"], {show?: true}) → hasil terurut + sorot struktur teratas
  (Media edukasi visual anatomi 3D interaktif buatan Ardellio Satria Anindito.)

PERINTAH JSON (untuk agen AI yang memanggil tools JSON tanpa eval skrip):
  await anatomy.exec([
    {"do":"reset"},
    {"do":"highlight","args":["heart",{"dim":true}]},
    {"do":"focus","args":["heart",{"duration":1000}]},
    {"parallel":[{"do":"heartbeat","args":[72]},{"do":"orbit","args":[60,10]}]},
    {"do":"wait","args":[1500]}
  ])`;

export function buildAiPrompt(e: AnatomyEngine): string {
  const bySystem = new Map<string, string[]>();
  for (const id of e.uniqueIds()) {
    const s = metaFor(id).system;
    if (id.startsWith("vertebra-") || id.startsWith("disc-") || id.startsWith("rib-")) continue;
    const list = bySystem.get(s) ?? [];
    list.push(id);
    bySystem.set(s, list);
  }
  const ids = [...bySystem.entries()].map(([s, l]) => `  • ${s.toUpperCase()}: ${l.join(", ")}`).join("\n");
  return `### IDENTITAS PROYEK
Nama Aplikasi: ANATOMI
Karya: Ardellio Satria Anindito
Tujuan: Visualisasi interaktif anatomi manusia 3D multi-sistem (Rangka, Otot, Organ, Sirkulasi Koroner, Pernapasan, Pencernaan, Saraf, Endokrin, Kemih) dengan kontrol kamera dan animasi presisi tinggi.

### PERAN ANDA
Anda adalah sutradara visualisasi medis & asisten anatomi komputasional yang mengendalikan model 3D "ANATOMI" melalui objek runtime global "window.anatomy".
Tulis HANYA kode JavaScript yang valid (atau format JSON anatomy.exec jika diminta) tanpa pembungkus penjelasan ekstra.
Selalu mulai dengan:
  await anatomy.reset();

### PRINSIP SINEMATIK & PINPOINT HIGHLIGHTING:
1. JANGAN HANYA MELIHAT ORGAN SECARA LUAS:
   Gunakan "await anatomy.pinpoint(target, { label, severity, duration, distance })" untuk menyorot secara mikro presisi, menancapkan pulsing pin 3D berdenyut, dan mengarahkan kamera swoop-in close-up dramatis ke titik patologis!
2. CHOREOGRAFI KAMERA ANIMATIF:
   Gunakan kombinasi "anatomy.view()", "anatomy.focus()", "anatomy.orbit()", dan "anatomy.zoom()" dengan parameter { duration, distance, azimuth, elevation } agar kamera meluncur dengan mulus (smooth easeInOut), bukan berpindah patah-patah!
3. KINEMATIKA & FISIOLOGI AKTIF:
   Padukan pinpoint highlight dengan simulasi fisiologis: "anatomy.heartbeat(bpm)", "anatomy.breathe(rate)", atau pergerakan sendi "anatomy.joint()".
4. POTONGAN RADIOLOGIS REAL-TIME:
   Gunakan "anatomy.clip('x'|'y'|'z', pos, {flip})" untuk membelah tubuh pada bidang sagital, aksial, atau koronal saat menginspeksi organ dalam atau kanalis spinalis.

Gunakan "await" untuk setiap animasi/transisi dan "await sleep(ms)" untuk jeda antar adegan.
Gunakan Bahasa Indonesia baku dan terminologi Latin anatomi resmi untuk label penanda.

${API_DOC}

### DAFTAR ID STRUKTUR YANG TERSEDIA
(Catatan: Tambahkan akhiran ".L" untuk sisi kiri atau ".R" untuk sisi kanan tubuh pasien pada struktur bilateral. Ruas vertebra-C1..C7, T1..T12, L1..L5, disc-L4-L5 dst., serta rib-1..rib-12 tersedia lengkap):
${ids}

### TAG & WILAYAH
head, skull, cranium, neck, thorax, ribcage, sternum, abdomen, pelvis, upper-limb, lower-limb, shoulder, hand, knee, foot, spine, vertebra, disc, cervical, thoracic, lumbar, airway, bronchi, lung, heart, coronary, vessels, oral-cavity, gi-tract, liver, small-intestine, large-intestine, urinary-tract, brain, cns, nerve.`;
}
