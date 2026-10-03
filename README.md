# ANATOMI

> **Visualisasi Anatomi Manusia 3D Interaktif**  
> *Buatan Ardellio Satria Anindito*

ANATOMI adalah platform edukasi anatomi manusia 3D berbasis web modern yang interaktif, presisi, dan sepenuhnya responsif. Dilengkapi dengan kontrol visualisasi multi-sistem tubuh, mode layar penuh (Zen Mode), mesin skrip animasi yang dapat dikendalikan agen kecerdasan buatan (AI), serta pencocok gejala klinis berbasis data terbuka.

---

## Fitur Utama

- **Model 3D Anatomi Multi-Sistem:**
  - **Rangka (*Skeletal*):** Kranium (Tulang Frontal, Parietal, Temporal dengan prosesus mastoid/stiloid, Oksipital, Sfenoid), maksila, mandibula bersendi, lengkung gigi, tulang rawan iga, klavikula, skapula, vertebra servikal/torakal/lumbal, sakrum, koksigis, dan tulang ekstremitas atas & bawah.
  - **Otot (*Muscular*):** Otot wajah & leher (masseter, temporalis, SCM), otot punggung (trapezius, latissimus dorsi, erektor spinae), otot dada (pektoralis mayor & minor, interkostal), otot dinding perut, kuadriseps, hamstring, gastroknemius, soleus, tendon Achilles, ligamen patela, dan traktus iliotibialis (*IT band*).
  - **Peredaran Darah & Jantung (*Circulatory*):** Jantung 4 ruang berdetak dinamis, aorta, arteri karotis, vena jugularis, arteri subklavia, arteri & vena brakialis, arteri & vena femoralis, trunkus seliakus, arteri mesenterika superior & inferior, vena renalis, vena iliaka, serta **arteri koroner** (*LAD / The Widow Maker*, *RCA*, *LCx*) dan sistem kelenjar getah bening limfatik.
  - **Pernapasan (*Respiratory*):** Laring, tulang rawan krikoid, epiglotis, trakea bergelang kartilago, karina trakea, bronkus primer & sekunder, lobus paru kiri & kanan, dan diafragma bergerak dengan animasi respirasi.
  - **Pencernaan (*Digestive*):** Rongga mulut & lidah, faring, esofagus, lambung, lobus hati kiri & kanan, kandung empedu, saluran empedu utama (*ductus choledochus*), pankreas, saluran pankreas (*ductus pancreaticus*), duodenum C-loop, jejunum, ileum, sekum, apendiks vermiformis, dan kolon bersegmen hingga rektum.
  - **Saraf (*Nervous*):** Hemisfer serebri, serebelum, batang otak, saraf optik (CN II) & kiasma optikum, traktus olfaktorius (CN I), saraf trigeminus (CN V), sumsum tulang belakang, kauda ekuina (*cauda equina*), pleksus brakialis, saraf radialis, saraf medianus, saraf ulnaris, saraf femoralis, saraf iskiadikus (*sciatic*), saraf tibialis, dan saraf fibularis komunis.
  - **Endokrin & Kemih (*Endocrine & Urinary*):** Kelenjar hipofisis (*pituitary*), kelenjar timus, kelenjar tiroid, kelenjar adrenal, ginjal, ureter, dan kandung kemih.
  - **Kulit (*Integumentary*):** Penanda kontur tubuh semi-transparan untuk orientasi spasial.

- **Mode Layar Penuh & Tampilan Fokus (Zen Mode):**
  - Sembunyikan panel navigasi kiri, panel info kanan, dan header secara bersamaan untuk visualisasi kanvas 3D 100% tanpa distraksi.
  - Toolbar mengambang (*floating HUD*) pada kanvas memudahkan navigasi saat panel tertutup.
  - Pemilih lapisan anatomi cepat (*Quick Layer Drawer*) langsung di atas kanvas 3D.
  - Dukungan Fullscreen Browser native.

- **Integrasi Skrip Agen AI & Otomasi:**
  - Runtime global `window.anatomy` menyediakan API lengkap untuk inspeksi, penyorotan, pergerakan sendi, kamera orbit, potongan bidang aksial/sagital/koronal, dan animasi.
  - Template prompt siap salin untuk **Claude**, **ChatGPT**, **Gemini**, atau **Ollama lokal**.
  - Dukungan eksekusi deklaratif berbasis JSON (`anatomy.exec([...])`).

- **Arsitektur Offline-First & Zero-Database Fallback:**
  - Dapat langsung dijalankan secara mandiri tanpa harus memasang database eksternal. Apabila `DATABASE_URL` tidak tersedia, sistem secara otomatis beralih ke penyimpanan in-memory lokal yang memuat seluruh kamus gejala dan data penyakit.

---

## Pintasan Papan Ketik (Keyboard Shortcuts)

| Tombol | Fungsi |
|---|---|
| `Z` | Beralih Mode Layar Penuh 3D / Zen Mode (sembunyikan seluruh navigasi) |
| `[` | Tampilkan / Sembunyikan Panel Struktur Kiri |
| `]` | Tampilkan / Sembunyikan Panel Info & Diagnostik Kanan |
| `H` | Tampilkan / Sembunyikan Header |
| `F` | Layar Penuh Browser Native |
| `Esc` | Keluar dari Zen Mode / Batalkan Mode Penandaan |
| `Ctrl / Cmd + Enter` | Jalankan kode pada Editor Skrip |

---

## Menjalankan Aplikasi Secara Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau yang lebih baru.

### Instalasi & Menjalankan

```bash
# Pasang dependensi
npm install

# Jalankan server pengembangan
npm run dev
```

Buka peramban pada alamat `http://localhost:3000`.

### Menjalankan Build Produksi

```bash
# Bangun aplikasi untuk produksi
npm run build

# Jalankan server produksi
npm start
```

---

## Lisensi & Atribusi

Hak Cipta © 2026 **ANATOMI** oleh **Ardellio Satria Anindito**.  
Dikembangkan untuk tujuan visualisasi dan edukasi anatomi manusia interaktif.
