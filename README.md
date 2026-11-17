# O-Line Lab

Ofansif hat oyuncuları için senaryo tabanlı eğitim aracı. Vite, TypeScript, Three.js, Zustand ve Zod kullanır. GitHub Actions, `master` dalına yapılan değişiklikleri GitHub Pages'e yayınlar.

## Çalıştırma

```sh
npm ci
npm run dev
```

`npm run build` derleme ve tip kontrolü, `npm test` veri modeli kontrolleridir. Statik çıktı `dist/` altındadır.

## Kullanım

Örnek senaryolardan birini seçin, oyuncuya tıklayın ve adımları oynatın. Tasarla modunda oyuncuları 2D sahada taşıyın; aksiyon, pull ve adım ekleyin, analiz yapın veya JSON düzenleyicisinden bütün veriyi düzenleyin. Case'ler ve aktif senaryo tarayıcının yerel depolamasına kaydedilir; JSON ile dosyaya aktarılabilir. Video kaydı tarayıcı desteğine bağlıdır. AI özelliği, kullanıcının girdiği OpenAI uyumlu API adresi, model ve anahtarla doğrudan istek gönderir; anahtar uygulama tarafından kaydedilmez. Sağlayıcıya senaryo ve analiz gönderilir. AI çıktısı antrenör tarafından doğrulanmalıdır.

## Kapsam ve sınırlamalar

Teknik ve çakışma tespitleri yaklaşık hesaplamalardır. Pas korumasındaki belirsiz kurallar açık bırakılmıştır. Oyuncu modeli basit stilizedir; gelişmiş rig ve IK, gerçekçi model, animasyonlu eller, görsel waypoint sürükleme, otomatik kuraldan case üretimi, AI önerisinin sahneye uygulanması, karar dallarında case geçişi ve tahmin modu henüz uygulanmadı. Çizilen taktiklerin doğruluğu antrenör tarafından doğrulanmalıdır.
