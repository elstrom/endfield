# Arknights: Endfield - 2D Production Sandbox Simulation
## Kerja Dokumentasi & Rencana Implementasi

Sistem ini adalah evolusi dari kalkulator produksi statis menjadi simulasi sandbox 2D dinamis dengan akselerasi hardware untuk pencarian solusi optimal (AI Search) menggunakan GPU.

---

### 1. Arsitektur Teknologi (Stack)
*   **Backend**: Rust (Tauri v2)
    *   `tauri`: Framework aplikasi desktop.
    *   `wgpu`: Interface langsung ke hardware GPU (Vulkan/DirectX/Metal) untuk compute shader.
    *   `serde`: Serialisasi data resep dan item.
*   **Frontend**: React 19 + Vite
    *   `PixiJS`: Rendering engine berbasis WebGL untuk viewport 2D (target 60 FPS).
    *   `Tailwind CSS`: Styling UI panel dan komponen.
    *   `Zustand` atau `React Context`: State management untuk UI.

---

### 2. Struktur Data (Evolusi dari Sistem Lama)
Data akan dibawa dari folder `old` namun dikonversi menjadi format yang lebih optimal untuk paralelisme GPU:
*   **`Node`**: Mewakili Fasilitas/Mesin (dari `facilities.ts`).
*   **`Edge`**: Mewakili jalur logistik/kabel antar mesin.
*   **`Resource`**: Mewakili Item (dari `items.ts`) yang mengalir dalam sirkuit.
*   **`Recipe`**: Aturan transformasi data pada setiap `Node`.

---

### 3. Logika Perhitungan (GPU AI Search)
Berbeda dengan sistem lama yang menggunakan Linear Solver di CPU, sistem baru akan menggunakan:
*   **Compute Shader (WGSL)**: Menjalankan jutaan iterasi simulasi secara paralel di GPU untuk mencari "Throughput Maksimal" atau "Konsumsi Daya Terendah".
*   **Brute-Force/Heuristic Search**: Mengevaluasi topologi jaringan yang dibuat user untuk mendeteksi bottleneck secara real-time.

---

### 4. Tahapan Pengerjaan

#### Fase 1: Fondasi & Inisialisasi
1.  Setup proyek Tauri dengan template React + TS.
2.  Konfigurasi `PixiJS` di dalam React sebagai area sandbox utama.
3.  Integrasi `wgpu` di sisi Rust untuk persiapan binding GPU.

#### Fase 2: Porting Data & Model
1.  Migrasi data resep dan item dari `old` ke format Rust `struct`.
2.  Membuat sistem loading data yang akan dikirim ke shader GPU.

#### Fase 3: Visual Sandbox (UX/UI)
1.  Implementasi sistem Drag & Drop komponen ke dalam canvas.
2.  Implementasi sistem "Wiring" (penyambungan kabel) antar mesin secara visual.
3.  Optimasi rendering PixiJS agar tetap 60 FPS meskipun terdapat ribuan objek.

#### Fase 4: Engine AI & Simulasi
1.  Penulisan WGSL Compute Shader untuk logika kalkulasi produksi.
2.  Sinkronisasi status simulasi dari Rust ke Frontend melalui Tauri Events.
3.  Implementasi "AI Optimizer" untuk menyarankan penempatan mesin yang paling efisien.

#### Fase 5: Konfigurasi & Finalisasi
1.  Penyatuan seluruh parameter global ke dalam satu file `config` (sesuai aturan user).
2.  Debugging, stress test (jutaan kalkulasi), dan pengemasan aplikasi.

---

### 5. Prinsip Kerja (User Rules)
1.  **Direct & Optimal**: Tidak ada skrip redundant, kode langsung ditargetkan pada performa.
2.  **Global Config**: Semua parameter (kecepatan simulasi, warna UI, konstanta fisik) akan disatukan di satu file pusat.
3.  **Low Latency**: Komunikasi antara UI (JS) dan Engine (Rust) menggunakan buffer biner jika diperlukan untuk kecepatan maksimal.
