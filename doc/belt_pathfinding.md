# Belt Pathfinding Logic

Sistem penempatan belt otomatis yang memungkinkan pembangunan jalur logistik dengan lebih efisien menggunakan algoritma pencarian jalur terpendek.

## Aturan Teknis Penempatan
1. **Titik Awal (Start Point)**:
   - Jalur belt hanya boleh mulai dibangun/ditekan pertama kali pada blok yang memiliki port bertipe **Output** (lubang keluar fasilitas sumber).
   - *Logic*: Aliran barang keluar dari fasilitas menuju jalur distribusi.

2. **Pencarian Jalur Otomatis (Dynamic Pathfinding)**:
   - Belt akan membuat jalur terpendek secara visual mengikuti posisi kursor (pointer).
   - *Logic*: Algoritma A* atau BFS yang berjalan secara real-time pada layer preview.

3. **Algoritma Jalur Terpendek (Shortest Path Algorithm)**:
   - **Syarat 3.1: Collision Facility**: Jalur tidak boleh menabrak fasilitas (bangunan) apapun yang ada di artboard.
   - **Syarat 3.2: Belt Interaction**:
     - Jika menabrak belt yang sudah ada, jalur baru akan menimpa (replace) belt lama.
     - **No Overlap**: Satu blok hanya boleh diisi oleh satu unit belt. Tidak diperbolehkan ada dua belt bertumpuk pada ketinggian yang sama.
   - **Syarat 3.3: Automatic Bridging**:
     - Jika jalur belt bersimpangan dengan belt lain secara vertikal maupun horizontal, sistem akan secara otomatis mengganti unit belt pada titik persimpangan tersebut dengan fasilitas **Belt Bridge**.
   - **Syarat 3.4: Manual Continuation**:
     - User dapat melakukan klik di sembarang koordinat grid yang kosong untuk menetapkan titik jangkar (anchor point) dan melanjutkan pembangunan jalur jika terputus.
   - **Syarat 3.5: Titik Akhir (End Point)**:
     - Jika jalur ditarik mendekati fasilitas tujuan, ujung jalur hanya bisa dikaitkan ke lobang **Input** (lubang masuk fasilitas tujuan).

## Mekanisme Matematis
- Menggunakan grid-based navigation.
- Bobot (weight) pada block yang sudah berisi bangunan set ke infinity.
- Deteksi persimpangan (intersection) memicu penggantian komponen menjadi `item_port_belt_bridge_1`.
