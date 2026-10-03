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

    // ── Layer 15 Sistem
    layer: (system: string, o: { visible?: boolean; opacity?: number }) => e.setLayer(system as never, o),
    showAll: () => {
      for (const s of BP3D_SYSTEMS) e.setLayer(s.id, { visible: true, opacity: 1 });
    },
    hideAll: () => {
      for (const s of BP3D_SYSTEMS) e.setLayer(s.id, { visible: false });
    },

    // ── Penguraian & Potongan Bidang
    explode: (factor: number) => e.setExplode(factor),
    clip: (axis: "x" | "y" | "z" | null, pos?: number, flip?: boolean) => e.setClip(axis, pos ?? 0, flip ?? false),
    xray: (on = true) => e.setXray(on),

    // ── Kamera & Proyeksi Spasial
    view: (name: string) => e.view(name),
    focus: (idOrName: string) => e.focus(idOrName),
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
    name: "Eksplorasi Jantung & Pembuluh Koroner",
    desc: "Isolasi sistem kardiovaskular BodyParts3D, sorot arteri koroner dan ventrikel.",
    code: `// Eksplorasi kardiovaskular BodyParts3D nyata
anatomy.showAll();
anatomy.layer('integumentary', { visible: false });
anatomy.layer('muscular', { visible: false });
anatomy.layer('skeletal', { opacity: 0.15 });

anatomy.view('front');
log('Memfokuskan ke organ jantung (BodyParts3D)...');
anatomy.focus('heart');
anatomy.highlight(['heart', 'cardiac']);
await sleep(2000);

anatomy.view('three-quarter');
log('Menampilkan percabangan arteri pulmonalis dan aorta...');
await sleep(2500);`,
  },
  {
    name: "Penguraian Spasial 2.234 Struktur",
    desc: "Urai seluruh potongan scan medis ke dalam grid spasial 3D (exploded view).",
    code: `// Penguraian spasial (Exploded View)
anatomy.showAll();
anatomy.layer('integumentary', { visible: false });
anatomy.view('front');

log('Mengurai 2.234 struktur anatomi...');
for (let f = 0; f <= 1; f += 0.05) {
  anatomy.explode(f);
  await sleep(60);
}

await sleep(3500);
log('Mengembalikan struktur ke posisi anatomis utuh...');
for (let f = 1; f >= 0; f -= 0.05) {
  anatomy.explode(f);
  await sleep(60);
}`,
  },
  {
    name: "Inspeksi Saraf & Dasar Tengkorak",
    desc: "Fokus ke kepala, isolasi sistem saraf, dan potong bidang koronal.",
    code: `// Saraf & Dasar Tengkorak
anatomy.hideAll();
anatomy.layer('nervous', { visible: true, opacity: 1 });
anatomy.layer('skeletal', { visible: true, opacity: 0.3 });

anatomy.view('front');
anatomy.focus('brain');
log('Memeriksa hemisfer serebri dan saraf kranial...');
await sleep(2500);

log('Mengaktifkan potongan sagital melintasi garis tengah...');
anatomy.clip('x', 0, false);
await sleep(3000);
anatomy.clip(null);`,
  },
  {
    name: "Penerbangan Bebas (Free Cam) Toraks",
    desc: "Beralih ke Free Cam untuk terbang bebas di dalam rongga dada.",
    code: `// Penerbangan Bebas (Free Cam)
anatomy.layer('integumentary', { visible: false });
anatomy.layer('muscular', { opacity: 0.2 });
anatomy.view('front');

log('Beralih ke mode Free Cam (Kamera Terbang Bebas)...');
anatomy.cameraMode('free');
log('Gunakan tombol WASD untuk bergerak dan drag mouse untuk melihat sekeliling.');`,
  },
  {
    name: "Potongan Aksial & Sagital Tubuh",
    desc: "Demonstrasi potongan bidang radiologi CT/MRI pada tubuh nyata.",
    code: `// Potongan Bidang Radiologi
anatomy.showAll();
anatomy.layer('integumentary', { visible: false });
anatomy.view('three-quarter');

log('Potongan Aksial setinggi T4 (arkus aorta)...');
anatomy.clip('y', 1.25, false);
await sleep(3000);

log('Potongan Sagital melintasi septum jantung...');
anatomy.clip('x', 0, false);
await sleep(3000);

anatomy.clip(null);
log('Potongan bidang dinonaktifkan.');`,
  },
];

export function buildBP3DAiPrompt(e: BodyPartsEngine): string {
  const partsCount = e.atlas?.parts.length ?? 2234;
  const conceptsCount = e.atlas?.concepts.length ?? 3432;

  const sysList = BP3D_SYSTEMS.map(
    (s) => `  • ${s.id} (${s.nameId}): ${s.description}`,
  ).join("\n");

  return `### IDENTITAS SISTEM ANATOMI MEDIS
Nama Aplikasi: ANATOMI — Scan Medis 3D
Karya: Ardellio Satria Anindito
Basis Data: BodyParts3D 4.0 (The Database Center for Life Science, Japan / CC BY 4.0)
Total Model: ${partsCount} struktur hasil scan medis nyata yang tersegmentasi secara individual.
Total Konsep FMA: ${conceptsCount} konsep ontologi anatomi (Foundational Model of Anatomy).

### PERAN AGEN AI
Anda adalah asisten spesialis visualisasi anatomi 3D dan navigasi spasial tubuh manusia.
Tulis HANYA kode JavaScript yang valid (atau format JSON anatomy.exec jika diminta) yang berinteraksi langsung dengan objek runtime global "window.anatomy".

### DAFTAR 15 SISTEM ANATOMI YANG TERSEDIA:
${sysList}

### DOKUMENTASI API WINDOW.ANATOMY (BODYPARTS3D):
IDENTIFIKASI & SELEKSI
  anatomy.select(partId | null)                 → Memilih dan menyorot struktur spesifik
  anatomy.highlight(ids, {color?, dim?})        → Menyorot array ID dengan efek glow
  anatomy.unhighlight()                         → Menghapus seluruh sorotan
  anatomy.isolate(partId | null)                → Mengisolasi struktur (menyembunyikan yang lain)
  anatomy.info(idOrName)                        → {id, name, conceptId, system, bounds}
  anatomy.parts(query?)                         → Daftar bagian yang cocok
  anatomy.concepts(query?)                      → Daftar konsep FMA yang cocok

KONTROL LAYER 15 SISTEM
  anatomy.layer(systemId, {visible?, opacity?}) → Mengatur keterlihatan dan transparansi sistem
  anatomy.showAll() / anatomy.hideAll()

PENGURAIAN & POTONGAN RADIOLOGIS
  anatomy.explode(factor: 0..1)                 → Mengurai seluruh 2.234 model ke dalam ruang spasial
  anatomy.clip('x'|'y'|'z'|null, pos, flip?)    → Potongan sagital (x), aksial (y), koronal (z)
  anatomy.xray(true | false)                    → Mode rontgen transparan

KAMERA & PROYEKSI INPUT
  anatomy.cameraMode('orbit' | 'free')          → Beralih antara Orbit Cam dan Free Cam (WASD fly cam)
  anatomy.view('front'|'back'|'left'|'right'|'top'|'bottom'|'iso')
  anatomy.focus(idOrName)                       → Mengarahkan kamera dan zoom ke organ target
  anatomy.spin(true | false)                    → Putaran otomatis
  anatomy.project(x, y, z)                      → Memproyeksikan titik 3D meter ke koordinat layar 2D
  anatomy.identify(screenX, screenY)            → Raycasting dari layar ke organ 3D
  anatomy.snapshot()                            → Menghasilkan gambar PNG data URL

PENANDAAN & INPUT KLINIS
  anatomy.mark([x, y, z], label, severity)      → Menancapkan pin gejala 3D pada permukaan organ
  anatomy.unmark(id) / anatomy.clearMarks()

Selalu awali skrip dengan:
  anatomy.unhighlight();
  anatomy.isolate(null);
  anatomy.clip(null);`;
}
