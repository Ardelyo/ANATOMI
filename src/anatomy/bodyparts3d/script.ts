import type { BodyPartsEngine } from "./engine";
import { BP3D_SYSTEMS } from "./types";

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

export function createBP3DApi(e: BodyPartsEngine, ctl: Ctl, log: Log) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: any = {
    // ── Identifikasi & Informasi
    parts: (query?: string) => {
      if (!e.atlas) return [];
      const q = query?.toLowerCase();
      return e.atlas.parts
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.conceptId.toLowerCase().includes(q))
        .map((p) => ({ id: p.id, name: p.name, conceptId: p.conceptId, system: p.system, bounds: p.bounds }));
    },
    concepts: (query?: string) => {
      if (!e.atlas) return [];
      const q = query?.toLowerCase();
      return e.atlas.concepts
        .filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
        .map((c) => ({ id: c.id, name: c.name, count: c.elements.length }));
    },
    info: (idOrName: string) => {
      if (!e.atlas) return null;
      const p = e.atlas.parts.find(
        (part) =>
          part.id === idOrName || part.conceptId === idOrName || part.name.toLowerCase().includes(idOrName.toLowerCase()),
      );
      if (!p) return null;
      const sys = BP3D_SYSTEMS.find((s) => s.id === p.system);
      return {
        id: p.id,
        name: p.name,
        conceptId: p.conceptId,
        system: p.system,
        systemName: sys?.nameId ?? p.system,
        bounds: p.bounds,
      };
    },
    select: (id: string | null) => e.select(id),
    highlight: (ids: string | string[], opts?: { color?: string; dim?: boolean }) => e.highlight(ids, opts),
    unhighlight: () => e.unhighlight(),
    isolate: (id: string | null) => e.isolate(id),

    // ── PINPOINT HIGHLIGHT (Presisi Mikro Klinis)
    pinpoint: (
      idOrName: string,
      o?: {
        point?: [number, number, number];
        label?: string;
        severity?: number;
        duration?: number;
        distance?: number;
        pulse?: boolean;
      },
    ) => e.pinpoint(idOrName, o),

    // ── Layer 15 Sistem
    layer: (system: string, o: { visible?: boolean; opacity?: number }) => e.setLayer(system as never, o),
    showAll: () => {
      for (const s of BP3D_SYSTEMS) e.setLayer(s.id, { visible: true, opacity: 1 });
    },
    hideAll: () => {
      for (const s of BP3D_SYSTEMS) e.setLayer(s.id, { visible: false });
    },

    // ── Penguraian Spasial & Potongan Radiologis
    explode: (factor: number) => e.setExplode(factor),
    clip: (axis: "x" | "y" | "z" | null, pos?: number, flip?: boolean) => e.setClip(axis, pos ?? 0, flip ?? false),
    xray: (on = true) => e.setXray(on),

    // ── Kamera Animatif & Shot Sinematik
    view: (name: string, o?: { duration?: number; distance?: number }) => e.view(name, o),
    focus: (idOrName: string, o?: { duration?: number; distance?: number; azimuth?: number; elevation?: number }) =>
      e.focus(idOrName, o),
    orbit: (azDeg: number, elDeg: number, o?: { distance?: number; duration?: number }) => e.orbit(azDeg, elDeg, o),
    cameraMode: (mode: "orbit" | "free") => e.setCameraMode(mode),
    spin: (on = true) => e.spin(on),
    project: (x: number, y: number, z: number) => e.projectPoint([x, y, z]),
    identify: (screenX: number, screenY: number) => e.unprojectPoint(screenX, screenY),
    snapshot: () => e.snapshot(),

    // ── Penandaan & Gejala
    mark: (point: [number, number, number], label: string, severity = 1) => {
      const id = `mark_${Date.now()}`;
      e.addMarker({ id, partId: e.selectedId ?? "unknown", point, label, severity });
      return id;
    },
    unmark: (id: string) => e.removeMarker(id),
    clearMarks: () => e.clearMarkers(),

    sleep,
    wait: sleep,
    log: (...args: unknown[]) => log("log", ...args),

    // Eksekusi deklaratif JSON
    exec: async (commands: Array<{ do: string; args?: unknown[]; parallel?: Array<{ do: string; args?: unknown[] }> }>) => {
      for (const cmd of commands) {
        if (ctl.aborted) throw new AbortScript();
        if (cmd.parallel) {
          await Promise.all(cmd.parallel.map((p) => api[p.do]?.(...(p.args ?? []))));
        } else if (cmd.do === "wait" || cmd.do === "sleep") {
          await sleep(Number(cmd.args?.[0] ?? 1000));
        } else {
          await api[cmd.do]?.(...(cmd.args ?? []));
        }
      }
    },
  };
  return api;
}

export const BP3D_EXAMPLES = [
  {
    name: "Shot Sinematik: Oklusi Arteri Koroner (LAD) & Infark",
    desc: "Kamera meluncur ke apeks jantung, meredupkan toraks, dan pinpoint highlight oklusi LAD berdenyut.",
    code: `// Shot Sinematik: Oklusi Arteri Koroner (LAD) & Infark Miokard
anatomy.unhighlight();
anatomy.isolate(null);
anatomy.clip(null);

anatomy.showAll();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('muscular', { visible: false });
anatomy.layer('skeletal', { opacity: 0.15 });

log('1. Memulai penerbangan kamera dari jarak jauh ke rongga dada...');
await anatomy.view('front', { duration: 1000, distance: 3.2 });
await sleep(600);

log('2. Kamera swoop-in cepat dan glide ke organ jantung...');
await anatomy.focus('heart', { duration: 1500, distance: 0.95, azimuth: 25, elevation: 12 });

log('3. Pinpoint highlight pada percabangan arteri koroner desenden anterior kiri (LAD)...');
await anatomy.pinpoint('anterior interventricular', {
  label: 'Oklusi Akut LAD ("The Widow Maker")',
  severity: 3,
  duration: 1200,
  distance: 0.45
});

log('4. Kamera melakukan orbital sweep mengelilingi miokardium yang iskemia...');
await anatomy.orbit(65, 14, { duration: 2500, distance: 0.55 });
await sleep(800);

log('5. Pinpoint highlight kedua pada dinding anterior bilik kiri...');
await anatomy.pinpoint('left ventricle', {
  label: 'Zona Iskemia Transmural Dinding Anterior',
  severity: 3,
  duration: 1000
});

await anatomy.orbit(20, 8, { duration: 2000, distance: 0.7 });
log('Visualisasi oklusi koroner selesai.');`,
  },
  {
    name: "Shot Sinematik: Saraf Kranial & Kiasma Optikum",
    desc: "Kamera menyelam masuk ke kranium, isolasi persarafan visual dan sela tursika.",
    code: `// Shot Sinematik: Saraf Kranial & Kiasma Optikum
anatomy.unhighlight();
anatomy.isolate(null);
anatomy.clip(null);

anatomy.hideAll();
anatomy.layer('nervous', { visible: true, opacity: 1 });
anatomy.layer('sensory', { visible: true, opacity: 1 });
anatomy.layer('skeletal', { visible: true, opacity: 0.25 });

log('1. Mengarahkan kamera ke kubah tengkorak...');
await anatomy.view('front', { duration: 900, distance: 1.8 });

log('2. Kamera meluncur masuk ke dasar kranium anterior...');
await anatomy.focus('optic nerve', { duration: 1500, distance: 0.38, elevation: 22, azimuth: 15 });

log('3. Pinpoint highlight pada Kiasma Optikum (persilangan serabut nasal penglihatan)...');
await anatomy.pinpoint('optic chiasm', {
  label: 'Kiasma Optikum (N. II)',
  severity: 2,
  duration: 1200,
  distance: 0.22
});
await sleep(1000);

log('4. Rotasi orbital 360 derajat mengelilingi sela tursika...');
await anatomy.orbit(-80, 28, { duration: 2800, distance: 0.3 });

log('5. Pinpoint highlight pada pangkal nervus trigeminus (CN V)...');
await anatomy.pinpoint('trigeminal nerve', {
  label: 'Radiks Sensorik & Motorik N. Trigeminus (CN V)',
  severity: 1,
  duration: 1000
});`,
  },
  {
    name: "Shot Sinematik: Hernia Diskus Lumbal & Radiks Saraf",
    desc: "Kamera meluncur ke punggung bawah, potong sagital aktif, dan pinpoint jepitan saraf.",
    code: `// Shot Sinematik: Hernia Diskus Lumbal & Saraf Iskiadikus
anatomy.unhighlight();
anatomy.isolate(null);

anatomy.showAll();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('muscular', { opacity: 0.2 });

log('1. Kamera meluncur memutar ke punggung belakang...');
await anatomy.view('back', { duration: 1200, distance: 2.4 });
await sleep(500);

log('2. Menyelam ke segmen lumbal L4-L5 dan sakrum...');
await anatomy.focus('lumbar vertebra', { duration: 1400, distance: 0.65, azimuth: 165, elevation: 8 });

log('3. Mengaktifkan potongan sagital tepat pada kanalis spinalis...');
anatomy.clip('x', 0, false);
await sleep(1500);

log('4. Pinpoint highlight pada radiks saraf lumbal tertekan (HNP)...');
await anatomy.pinpoint('lumbar', {
  label: 'Hernia Diskus Intervertebralis L4-L5 (Penekanan Saraf)',
  severity: 3,
  duration: 1200,
  distance: 0.35
});

await anatomy.orbit(195, 12, { duration: 2200, distance: 0.4 });
await sleep(1500);
anatomy.clip(null);
log('Potongan bidang dinonaktifkan.');`,
  },
  {
    name: "Shot Sinematik: Navigasi Bebas (Free Cam Flight)",
    desc: "Beralih ke Free Cam untuk terbang bebas melintasi rongga mediastinum dan abdomen.",
    code: `// Shot Sinematik: Penerbangan Bebas (Free Cam Flight)
anatomy.unhighlight();
anatomy.isolate(null);
anatomy.showAll();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('muscular', { opacity: 0.15 });
anatomy.layer('skeletal', { opacity: 0.3 });

log('1. Mengarahkan posisi awal penerbangan ke depan toraks...');
await anatomy.view('front', { duration: 1000, distance: 1.6 });

log('2. Mengaktifkan Mode Free Cam (Kamera Terbang Bebas)...');
anatomy.cameraMode('free');

log('3. Kontrol aktif:');
log('   • W/S : Terbang Maju / Mundur');
log('   • A/D : Geser Kiri / Kanan');
log('   • Space/Shift : Naik / Turun');
log('   • Drag Mouse : Mengarahkan pandangan 360°');`,
  },
  {
    name: "Shot Sinematik: Penguraian Spasial 2.234 Model",
    desc: "Kamera dolly-out ke sudut isometrik, mengurai ribuan struktur dan pinpoint organ inti.",
    code: `// Shot Sinematik: Penguraian Spasial 2.234 Model (Exploded Inventory)
anatomy.unhighlight();
anatomy.isolate(null);
anatomy.showAll();
anatomy.layer('integumentary', { visible: false });

log('1. Kamera dolly-out ke sudut pandang isometrik elevated...');
await anatomy.view('three-quarter', { duration: 1200, distance: 4.8 });

log('2. Memulai proses penguraian spasial 2.234 struktur scan medis...');
for (let f = 0; f <= 1; f += 0.04) {
  anatomy.explode(f);
  await sleep(40);
}

await sleep(1500);
log('3. Pinpoint highlight jantung yang mengambang dalam grid spasial...');
await anatomy.pinpoint('heart', {
  label: 'Organ Jantung (Terurai)',
  severity: 1,
  duration: 1200,
  distance: 1.2
});

await sleep(2000);
log('4. Mengembalikan seluruh struktur anatomi ke posisi utuh semula...');
await anatomy.view('front', { duration: 1000, distance: 3.5 });
for (let f = 1; f >= 0; f -= 0.04) {
  anatomy.explode(f);
  await sleep(40);
}

log('Model anatomi telah terakit utuh kembali.');`,
  },
];

export function buildBP3DAiPrompt(e: BodyPartsEngine): string {
  const partsCount = e.atlas?.parts.length ?? 2234;
  const conceptsCount = e.atlas?.concepts.length ?? 3432;

  const sysList = BP3D_SYSTEMS.map(
    (s) => `  • ${s.id} (${s.nameId}): ${s.description}`,
  ).join("\n");

  return `### IDENTITAS SISTEM ANATOMI MEDIS
Nama Aplikasi: ANATOMI — Scan Medis 3D (BodyParts3D)
Karya: Ardellio Satria Anindito
Basis Data: BodyParts3D 4.0 (The Database Center for Life Science, Japan / CC BY 4.0)
Total Model: ${partsCount} struktur hasil scan medis nyata yang tersegmentasi secara individual.
Total Konsep FMA: ${conceptsCount} konsep ontologi anatomi (Foundational Model of Anatomy).

### PERAN ANDA
Anda adalah sutradara visualisasi medis & asisten anatomi komputasional.
Tulis HANYA kode JavaScript yang valid (atau format JSON anatomy.exec jika diminta) yang mengendalikan objek runtime global "window.anatomy".

### PRINSIP SINEMATIK & PINPOINT HIGHLIGHTING:
1. JANGAN HANYA MENYOROT ORGAN SECARA LUAS:
   Gunakan fungsi "anatomy.pinpoint(target, { label, severity, duration, distance })" untuk menyorot secara mikro presisi, menancapkan pulsing pin 3D berdenyut, dan mengarahkan kamera swoop-in close-up dramatis ke titik patologis!
2. CHOREOGRAFI KAMERA ANIMATIF:
   Gunakan kombinasi "anatomy.view()", "anatomy.focus()", "anatomy.orbit()", dan "anatomy.cameraTo()" dengan parameter { duration, distance, azimuth, elevation } agar kamera meluncur dengan mulus (smooth easeInOut), bukan berpindah patah-patah!
3. NAVIGASI FREE CAM (TERBANG BEBAS):
   Beralihlah ke "anatomy.cameraMode('free')" saat mendemonstrasikan eksplorasi rongga dalam tubuh (toraks, kranium, abdomen).
4. POTONGAN RADIOLOGIS REAL-TIME:
   Gunakan "anatomy.clip('x'|'y'|'z', pos, flip)" untuk membelah tubuh pada bidang sagital, aksial, atau koronal saat menginspeksi organ dalam.

### DAFTAR 15 SISTEM ANATOMI YANG TERSEDIA:
${sysList}

### DOKUMENTASI LENGKAP API WINDOW.ANATOMY (BODYPARTS3D):
KAMERA SINEMATIK & PROYEKSI INPUT
  await anatomy.view('front'|'back'|'left'|'right'|'top'|'bottom'|'iso', {duration?, distance?})
  await anatomy.focus(idOrName, {duration?, distance?, azimuth?, elevation?})
  await anatomy.orbit(azimuthDeg, elevationDeg, {distance?, duration?})
  await anatomy.cameraTo(azRad, elRad, dist, [x,y,z], durationMs)
  anatomy.cameraMode('orbit' | 'free')          → Beralih ke Orbit Cam atau Free Cam (WASD fly cam)
  anatomy.spin(true | false)                    → Putaran rotasi kontinu
  anatomy.project(x, y, z)                      → Proyeksi titik 3D meter ke 2D piksel layar {x, y, visible}
  anatomy.identify(screenX, screenY)            → Raycasting dari layar ke organ 3D
  anatomy.snapshot()                            → Menghasilkan gambar PNG data URL

PINPOINT HIGHLIGHT & SELEKSI
  await anatomy.pinpoint(idOrName, {point?: [x,y,z], label?, severity?: 1|2|3, duration?, distance?, pulse?: true})
      → Menyorot target secara mikro, kamera meluncur mendekat, menancapkan pin 3D berdenyut.
  anatomy.select(partId | null)                 → Memilih dan menyorot struktur
  anatomy.highlight(ids, {color?, dim?})        → Menyorot array ID dengan efek glow
  anatomy.unhighlight()                         → Menghapus seluruh sorotan
  anatomy.isolate(partId | null)                → Mengisolasi struktur (menyembunyikan yang lain)
  anatomy.info(idOrName)                        → {id, name, conceptId, system, bounds}
  anatomy.parts(query?)                         → Daftar bagian yang cocok
  anatomy.concepts(query?)                      → Daftar konsep FMA yang cocok

KONTROL LAYER 15 SISTEM
  anatomy.layer(systemId, {visible?, opacity?}) → Mengatur keterlihatan dan transparansi sistem
  anatomy.showAll() / anatomy.hideAll()

PENGURAIAN SPASIAL & POTONGAN RADIOLOGIS
  anatomy.explode(factor: 0..1)                 → Mengurai seluruh 2.234 model ke dalam ruang spasial
  anatomy.clip('x'|'y'|'z'|null, pos, flip?)    → Potongan sagital (x), aksial (y), koronal (z)
  anatomy.xray(true | false)                    → Mode rontgen transparan

PENANDAAN & INPUT KLINIS
  anatomy.mark([x, y, z], label, severity)      → Menancapkan pin gejala 3D pada permukaan organ
  anatomy.unmark(id) / anatomy.clearMarks()
  await sleep(ms)                               → Jeda durasi antar adegan sinematik
  log(...args)                                  → Menuliskan pesan ke konsol output

Selalu awali skrip dengan:
  anatomy.unhighlight();
  anatomy.isolate(null);
  anatomy.clip(null);`;
}
