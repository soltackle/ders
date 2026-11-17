# O-Line Lab

Ofansif hat oyuncuları için senaryo tabanlı eğitim aracının ilk sürümü. Vite, TypeScript, Three.js, Zustand ve Zod kullanır.

## Çalıştırma

```sh
npm install
npm run dev
```

`npm run build` derleme ve tip kontrolü, `npm test` veri modeli kontrolleridir. Statik çıktı `dist/` altındadır.

## Kullanım

Üç örnek senaryodan birini seçin, oyuncuya tıklayın ve adımları oynatın. Tasarla modunda 2D görünümde oyuncular sürüklenebilir. Senaryonun tam verisi JSON düzenleyicisinden değiştirilebilir, indirilebilir ve yüklenebilir. Değişiklikler bu tarayıcıda saklanır. AI paketi, senaryo ve yerel analiz verilerini JSON olarak indirir; harici AI servisine veri göndermez.

## Mevcut kapsam ve sınırlamalar

Bu ilk sürüm; gerçekçi rig ve IK, otomatik teknik tespiti, waypoint/aksiyonun görsel editörü, playbook editörü, geri alma, AI API bağlantısı, video dışa aktarma, dallanma, gelişmiş çarpışma ve görev analizlerini içermez. 3D oyuncular basit stilize modellerdir, hareket interpolasyonla gösterilir. Pas korumasındaki belirsizlikler korunmuştur; verilen örnekler koç tarafından doğrulanmalıdır. JSON editörü kurallara göre doğrulanır, ancak taktik doğruluğu garanti etmez.
