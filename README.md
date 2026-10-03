# ANATOMI

> **Visualisasi Anatomi Manusia 3D Interaktif & Medis Komprehensif**  
> *Buatan Ardellio Satria Anindito*  
> 🌐 **Live Website GitHub Pages:** [https://ardelyo.github.io/ANATOMI/](https://ardelyo.github.io/ANATOMI/)  
> 💻 **Repositori GitHub:** [https://github.com/Ardelyo/ANATOMI](https://github.com/Ardelyo/ANATOMI)

ANATOMI adalah platform visualisasi anatomi manusia 3D berbasis web modern yang interaktif, presisi secara klinis, ramah perangkat mobile (smartphone/tablet), serta mendukung visualisasi dual-mode: **Mode Simulasi Kinematik** dan **Mode Scan Medis Riil BodyParts3D 4.0** (2.234 model hasil segmentasi MRI/CT).

Dilengkapi dengan kendali kamera multi-sudut dinamis (*Orbit & Free Cam Fly-through*), *Pinpoint Highlight* presisi mikro berdenyut, pemotongan radiologis real-time (*CT/MRI cross-section*), pencocok gejala penyakit diferensial, serta otomasi skrip yang dapat dipandu oleh agen kecerdasan buatan (AI Prompt Generator untuk Claude, ChatGPT, Gemini, Ollama).

---

## Fitur Utama

### 1. Desain Kompatibel Mobile & Layar Penuh (Mobile-First Fullscreen)
- **Kanvas 3D Penuh di Layar Smartphone (`100dvh`):** Kanvas 3D otomatis mengisi seluruh layar ponsel tanpa terhimpit oleh panel samping.
- **Bilah Navigasi Cepat Mengambang (*Floating Bottom Bar*):** Akses instan ke `Kanvas 3D`, `Struktur`, `Diagnosa`, `Skrip AI`, dan `Layar Penuh`.
- **Laci Geser Halus (*Slide-Up Bottom Sheets*):** Membuka panel struktur 15 sistem dan diagnosa gejala secara modular tanpa mengganggu viewport 3D.
- **Mode Layar Penuh Mobile Murni:** Satu sentuhan untuk mengaktifkan Fullscreen API peramban dan menyembunyikan semua antarmuka (Zen Mode), menyisakan 100% kanvas 3D imersif dengan tombol keluar minimalis.
- **Gestur Sentuh Halus (`touch-action: none`):** Rotasi halus satu jari dan cubit dua jari (*pinch-to-zoom*) tanpa memicu tarikan halaman atau refresh peramban ponsel.

### 2. Dual-Engine Visualisasi Anatomi
- **Mode Simulasi Kinematik:**
  - Multi-sistem tubuh terpadu: Rangka lengkap, otot bergradien kontraksi, organ dalam, sistem koroner jantung berdetak ritmis (72-76 bpm), respirasi paru & diafragma, serta artikulasi sendi bebas (bahu, siku, pergelangan, panggul, lutut, leher, rahang).
- **Mode Scan Medis Riil (BodyParts3D 4.0):**
  - **2.234 Mesh Anatomi Asli:** Berasal dari data pemindaian medis nyata dan ontologi FMA (*Foundational Model of Anatomy*).
  - **15 Sistem Anatomi:** Rangka, Otot Rangka, Jantung, Arteri, Vena, Saraf, Pernapasan, Pencernaan, Kemih, Limfatik & Imun, Endokrin, Reproduksi, Kulit, Jaringan Ikat, dan Organ Sensorik.
  - **Penguraian Spasial (*Exploded Inventory* 0–100%):** Memisahkan seluruh 2.234 struktur ke dalam grid spasial 3D untuk inspeksi bagian mikro.
  - **Potongan Bidang CT/MRI (*Cross-Section Clipping*):** Memotong tubuh pada bidang Sagital ($X$), Aksial ($Y$), atau Koronal ($Z$) secara real-time.

### 3. Pinpoint Highlight & Shot Sinematik Animatif
- **Pinpoint Highlight Presisi Mikro:** Bukan hanya melihat organ secara luas, melainkan menyorot langsung titik patologis spesifik (misal: oklusi percabangan arteri koroner LAD, hernia diskus L4-L5, kiasma optikum), meredupkan organ sekitar, dan menancapkan pin 3D berdenyut dengan tingkat keparahan klinis (*severity 1, 2, 3*).
- **Kamera Sinematik Mulus:** Gliding kamera swoop-in close-up, rotasi orbital terukur, serta transisi interpolasi halus (*easeInOutQuad*).
- **Free Cam (Kamera Terbang Bebas):** Navigasi first-person (WASD, Space/Shift, drag mouse) untuk terbang menjelajahi rongga dalam tubuh manusia (mediastinum, intrakranial, retroperitoneum).

### 4. Generator AI Prompt Komprehensif & Skrip Otomasi
- Antarmuka runtime global `window.anatomy` menyediakan API lengkap untuk dikendalikan kode JavaScript maupun skrip agen AI.
- Dilengkapi penyalin sistem prompt komprehensif untuk **Claude 3.7**, **ChatGPT-4o**, **Gemini 2.5 Flash**, dan **Ollama lokal**.
- Koleksi contoh skrip sinematik siap pakai:
  1. *Oklusi Akut Arteri Koroner (LAD) & Infark Miokard*
  2. *Saraf Kejepit HNP Lumbal & Ischialgia*
  3. *Saraf Kranial & Kiasma Optikum*
  4. *Refleks Patela & Biomekanika Genu*
  5. *Penguraian Spasial 2.234 Model Medis*
  6. *Penerbangan Bebas (Free Cam Flight) Melintasi Toraks*

### 5. Arsitektur Offline-First & Penyimpanan Lokal
- Menggunakan penyimpanan lokal peramban (*localStorage*) untuk penanda gejala dan koleksi skrip pengguna sehingga data tetap bertahan saat peramban ditutup.
- Bebas dependensi database eksternal untuk pengoperasian mandiri.

---

## Pintasan Papan Ketik (Keyboard Shortcuts)

| Tombol | Fungsi |
|---|---|
| `Z` | Mode Layar Penuh 3D / Zen Mode (sembunyikan/tampilkan semua panel) |
| `[` | Sembunyikan / Tampilkan Panel Struktur Kiri |
| `]` | Sembunyikan / Tampilkan Panel Info & Diagnostik Kanan |
| `H` | Sembunyikan / Tampilkan Header Utama |
| `F` | Layar Penuh Browser Native |
| `Esc` | Keluar dari Mode Layar Penuh / Tutup Laci Mobile |
| `Ctrl / Cmd + Enter` | Jalankan kode pada Editor Skrip |

---

## Menjalankan Aplikasi Secara Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru.

### Langkah-langkah
```bash
# Pasang dependensi
npm install

# Jalankan server lokal Next.js
npm run dev
```

Buka `http://localhost:3000` pada peramban Anda.

---

## Lisensi & Atribusi

Hak Cipta © 2026 **ANATOMI** oleh **Ardellio Satria Anindito**.  
Basis data medis BodyParts3D 4.0 dirilis di bawah lisensi *Creative Commons Attribution 4.0 International* (The Database Center for Life Science, Jepang).
