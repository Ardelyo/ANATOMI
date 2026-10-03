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
    name: "Sirkulasi koroner & serangan jantung",
    desc: "Visualisasikan arteri koroner (LAD, RCA, LCx) dan area iskemia miokardium.",
    code: `await anatomy.reset();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('skeletal', { opacity: 0.15 });
anatomy.layer('muscular', { visible: false });
anatomy.highlight(['heart', 'left-coronary-artery', 'anterior-interventricular-artery', 'right-coronary-artery', 'circumflex-artery'], { dim: true });
await anatomy.focus('heart', { duration: 1200, distance: 1.15, azimuth: 20, elevation: 8 });
anatomy.heartbeat(76);
anatomy.blink(['anterior-interventricular-artery'], { color: '#e03030', times: 6 });
anatomy.mark('anterior-interventricular-artery', 'Oklusi LAD ("The Widow Maker")', { severity: 3 });
anatomy.mark('left-ventricle', 'Iskemia dinding anterior bilik kiri', { severity: 3 });
log('Arteri desenden anterior kiri (LAD) memperdarahi 50% miokardium ventrikel kiri.');
await sleep(2500);
await anatomy.orbit(60, 5, { duration: 2500 });`,
  },
  {
    name: "Saraf perifer & jalur refleks",
    desc: "Jalur saraf dari sumsum tulang belakang, kauda ekuina, hingga tungkai.",
    code: `await anatomy.reset();
anatomy.layer('integumentary', { opacity: 0.08 });
anatomy.layer('skeletal', { opacity: 0.5 });
anatomy.layer('muscular', { opacity: 0.25, visible: true });
anatomy.highlight(['spinal-cord', 'cauda-equina', 'femoral-nerve', 'sciatic-nerve', 'common-fibular-nerve', 'tibial-nerve', 'patellar-ligament'], { color: '#d9cd96', dim: true });
await anatomy.focus(['lumbar', 'pelvis'], { duration: 1200, azimuth: 165, elevation: 12 });
anatomy.mark('cauda-equina', 'Kauda ekuina (berkas saraf spinal L2–S5)', { severity: 2 });
anatomy.mark('sciatic-nerve.L', 'Nervus iskiadikus paha belakang', { severity: 2 });
await sleep(2400);
await anatomy.focus(['femur.L', 'shank.L'], { duration: 1500, azimuth: 30, elevation: -5 });
anatomy.mark('patellar-ligament.L', 'Ligamen patela (titik refleks lutut)');
anatomy.mark('common-fibular-nerve.L', 'Saraf fibularis leher tulang betis', { severity: 1 });`,
  },
  {
    name: "Kranium & saraf kranial",
    desc: "Tulang kranium (frontal, parietal, temporal, oksipital) dan saraf optik/trigeminus.",
    code: `await anatomy.reset();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('muscular', { visible: false });
anatomy.isolate(['cranium', 'frontal-bone', 'parietal-bone', 'temporal-bone', 'occipital-bone', 'sphenoid-bone', 'cerebrum', 'optic-nerve', 'trigeminal-nerve', 'pituitary-gland'], { dim: true });
await anatomy.view('front', { duration: 1000, distance: 1.15 });
anatomy.highlight(['frontal-bone', 'parietal-bone', 'temporal-bone', 'occipital-bone'], { color: '#e6e3da' });
anatomy.highlight(['optic-nerve', 'trigeminal-nerve', 'pituitary-gland'], { color: '#d9cd96', intensity: 0.8 });
anatomy.mark('optic-nerve.L', 'Nervus opticus (CN II) & kiasma', { severity: 2 });
anatomy.mark('pituitary-gland', 'Kelenjar hipofisis di sela tursika', { severity: 1 });
await sleep(2500);
await anatomy.orbit(45, 15, { duration: 2500 });`,
  },
  {
    name: "Detak jantung",
    desc: "Fokus pada jantung, animasikan lub-dub, putar kamera.",
    code: `// Detak jantung 72 bpm
await anatomy.reset();
anatomy.layer('skeletal', { opacity: 0.2 });
anatomy.layer('integumentary', { visible: false });
anatomy.highlight('heart', { color: '#e0605f', intensity: 0.25, dim: true });
await anatomy.focus('heart', { duration: 1200, azimuth: 0, elevation: 5 });
anatomy.heartbeat(72);
anatomy.mark('left-ventricle', 'Bilik kiri (pompa utama)');
anatomy.mark('right-atrium', 'Serambi kanan');
await sleep(2500);
await anatomy.orbit(70, 10, { duration: 2200 });
await anatomy.orbit(-70, 10, { duration: 3600 });
await anatomy.view('front');`,
  },
  {
    name: "Pernapasan",
    desc: "Paru-paru, diafragma, dan rongga dada bergerak.",
    code: `await anatomy.reset();
anatomy.layer('skeletal', { opacity: 0.45 });
anatomy.layer('integumentary', { opacity: 0.07 });
anatomy.highlight(['lung', 'diaphragm'], { color: '#3b73d6', intensity: 0.18 });
await anatomy.focus('thorax', { duration: 1200 });
anatomy.breathe(14);
await sleep(3500);
await anatomy.view('left', { duration: 1600, distance: 2.2 });
await sleep(4000);`,
  },
  {
    name: "Putar ke semua arah",
    desc: "Tampilkan model dari depan, kanan, belakang, kiri, atas, bawah.",
    code: `await anatomy.reset();
for (const v of ['front', 'right', 'back', 'left', 'top', 'bottom', 'front']) {
  await anatomy.view(v, { duration: 1400 });
  log('Tampilan:', v);
  await sleep(700);
}`,
  },
  {
    name: "Telusuri saluran cerna",
    desc: "Sorot organ pencernaan satu per satu dari esofagus ke rektum.",
    code: `await anatomy.reset();
anatomy.layer('skeletal', { opacity: 0.15 });
anatomy.layer('integumentary', { visible: false });
const route = ['esophagus','stomach','duodenum','jejunum','ileum','cecum','ascending-colon','transverse-colon','descending-colon','sigmoid-colon','rectum'];
await anatomy.focus('digestive', { duration: 1100 });
for (const id of route) {
  anatomy.unhighlight();
  anatomy.highlight(id, { color: '#2f6fe0', dim: true });
  const d = anatomy.info(id);
  anatomy.clearMarks();
  anatomy.mark(id, d.name);
  log(d.name + ' — ' + d.description);
  await sleep(1300);
}
anatomy.unhighlight();
anatomy.clearMarks();`,
  },
  {
    name: "Gejala serangan jantung",
    desc: "Jalankan pemeriksa gejala lalu tandai area nyeri menjalar.",
    code: `await anatomy.reset();
anatomy.layer('integumentary', { opacity: 0.08 });
const hasil = await anatomy.diagnose(['nyeri-dada', 'nyeri-lengan-kiri', 'keringat-dingin', 'sesak-napas']);
log('Kemungkinan teratas:', hasil[0].name, '(skor ' + hasil[0].score + ')');
anatomy.mark('left-ventricle', 'Nyeri dada menekan', { severity: 3 });
anatomy.mark('humerus.L', 'Nyeri menjalar ke lengan kiri', { severity: 2 });
anatomy.mark('mandible', 'Nyeri rahang', { severity: 2 });
await sleep(1500);
anatomy.blink(['left-ventricle'], { times: 5 });
await anatomy.orbit(40, 8, { duration: 2500 });`,
  },
  {
    name: "HNP lumbal (saraf kejepit)",
    desc: "Diskus L4–L5 dan L5–S1 menekan saraf iskiadikus.",
    code: `await anatomy.reset();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('skeletal', { opacity: 1 });
anatomy.layer('muscular', { visible: false });
anatomy.isolate(['spine', 'ilium', 'sciatic-nerve', 'spinal-cord', 'femur'], { dim: true });
anatomy.highlight(['disc-L4-L5', 'disc-L5-S1'], { color: '#e0605f', intensity: 0.6 });
anatomy.highlight('sciatic-nerve', { color: '#e0a02b', intensity: 0.6 });
await anatomy.focus(['lumbar', 'sacrum'], { duration: 1200, azimuth: 160, elevation: 8 });
anatomy.mark('disc-L4-L5', 'Diskus L4–L5 menonjol', { severity: 3 });
anatomy.mark('sciatic-nerve.L', 'Nyeri menjalar sepanjang saraf', { severity: 2 });
await sleep(1500);
await anatomy.view('left', { duration: 1800, distance: 1.6 });
anatomy.blink(['disc-L4-L5', 'disc-L5-S1'], { times: 4 });`,
  },
  {
    name: "Berjalan",
    desc: "Siklus jalan sederhana: pinggul, lutut, pergelangan, ayunan lengan.",
    code: `await anatomy.reset();
anatomy.layer('muscular', { visible: true });
anatomy.layer('integumentary', { opacity: 0.07 });
anatomy.layer('skeletal', { opacity: 0.7 });
await anatomy.view('right', { duration: 1000, distance: 3.2 });
anatomy.walk(1);
await sleep(7000);
anatomy.walk(false);
await anatomy.pose('rest');`,
  },
  {
    name: "Lambaian tangan",
    desc: "Gerakkan sendi bahu dan siku secara berurutan.",
    code: `await anatomy.reset();
anatomy.layer('muscular', { visible: true });
await anatomy.view('front', { duration: 800 });
await anatomy.joint('shoulder.R', { abd: 150 }, { duration: 800 });
for (let i = 0; i < 4; i++) {
  await anatomy.joint('elbow.R', 55, { duration: 350 });
  await anatomy.joint('elbow.R', 5, { duration: 350 });
}
await anatomy.pose('rest');`,
  },
  {
    name: "Pisahkan antar sistem",
    desc: "Tampilan terurai: tiap sistem organ bergeser ke samping.",
    code: `await anatomy.reset();
anatomy.layer('muscular', { visible: true });
anatomy.layer('integumentary', { visible: false });
await anatomy.view('front', { duration: 600 });
await anatomy.explode(1, { duration: 1400 });
await sleep(3500);
await anatomy.explode(0, { duration: 1200 });`,
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

PENANDAAN
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
Anda adalah asisten medis & visualisasi visual yang mengendalikan model 3D "ANATOMI" melalui objek runtime global "window.anatomy".
Tulis HANYA kode JavaScript yang valid (atau format JSON anatomy.exec jika diminta) tanpa pembungkus penjelasan ekstra.
Selalu mulai dengan:
  await anatomy.reset();
Gunakan "await" untuk setiap animasi/transisi dan "await sleep(ms)" untuk jeda antar adegan.
Gunakan Bahasa Indonesia baku dan terminologi Latin anatomi resmi untuk label penanda.

${API_DOC}

### DAFTAR ID STRUKTUR YANG TERSEDIA
(Catatan: Tambahkan akhiran ".L" untuk sisi kiri atau ".R" untuk sisi kanan tubuh pasien pada struktur bilateral. Ruas vertebra-C1..C7, T1..T12, L1..L5, disc-L4-L5 dst., serta rib-1..rib-12 tersedia lengkap):
${ids}

### TAG & WILAYAH
head, skull, cranium, neck, thorax, ribcage, sternum, abdomen, pelvis, upper-limb, lower-limb, shoulder, hand, knee, foot, spine, vertebra, disc, cervical, thoracic, lumbar, airway, bronchi, lung, heart, coronary, vessels, oral-cavity, gi-tract, liver, small-intestine, large-intestine, urinary-tract, brain, cns, nerve.`;
}
