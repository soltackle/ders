# Plan kapsamı ve doğrulama

Bu tablo uygulanan davranışları izler. Görsel kalite iddiası veya fotogerçekçi football motion-capture teslimi değildir.

| Plan alanı | Uygulama |
|---|---|
| JSON şema, başlangıç Case’leri | Zod; takım pas koruması + field inside/outside zone, 3–4 / 4–3 ve 5/6 kişilik hat seçenekleri |
| Zaman tabanlı oynatıcı | Saf konum/poz hesapları, spline, ileri/geri sarma, adım, yavaş çekim, loop |
| Üç görünüm | Ortografik tahta, arkadan orbit, oyuncu POV; yumuşak geçiş, HUD, mini harita, eller/top |
| Alan ve diziliş | Hash/field/boundary; 5 OL + DL/LB; oyuncu ekleme/silme, snap ve teknik/gap etiketleri |
| Görsel hareket editörü | Yol noktası ekleme, düğüm taşıma, aksiyon/atama etiketleri, pull/trap şablonu ve fazları |
| Adım editörü | Zaman, not, odak halkası, snap öncesi çağrı okları; ekleme/silme |
| Playbook | Field/boundary rolleri; boundary man önceliği; ALERT ve big-on-big; OL + RB adam paylaşımı; kural düzenleme ve Case üretimi |
| Zone koşusu | Inside/outside seçimi; field adımı, reach/drive, combo–climb, cutoff, QB mesh/RB carry, bang/bend/bounce; DL/LB reaksiyonları ve oyuncu bazında override |
| Senaryo yönetimi | Undo/redo; JSON aktarımı; otomatik tarayıcı kaydı; şema/Case aramalı kütüphane |
| Analiz | Teknik/gap, covered OL, rush sayıları, blitz, rol hedefleri, free rusher, overload, trap, pull boşluğu, çakışma |
| AI | 2D PNG içeren paket; kullanıcı servis/anahtarıyla soru ve senaryo üretimi; şema doğrulama, öneri önizleme/kabul |
| Karar ve tahmin | Soru, seçenekler, doğru yanıt, kayıtlı Case’e dallanma |
| Model ve animasyon | Prosedürel eklemli football modeli, hedefe uzanan kollar; GLB skin/klip desteği ve lisanslı insan modeli örneği |
| Video | Tarayıcı MediaRecorder desteğiyle WebM saha kaydı |
| Yayın | GitHub Pages; test ve derlemeyi zorunlu kılan Actions iş akışı |

## Dış bağımlılıklar ve doğrulama sınırları

- Takımın pas koruması, kullanıcının sonraki açıklamasıyla netleştirildi; TEAM-PASS-PROTECTION.md dosyasında uygulanan kural ve sayı fazlası sınırları açıklanır.
- Gerçek AI yanıtı için API anahtarı ve tarayıcıdan isteğe izin veren servis gerekir. Harici sağlayıcıyla gerçek istek, anahtar sağlanmadan doğrulanmış sayılmaz.
- Prosedürel football hareketleri ile skinli örnek insan modeli ayrı seçeneklerdir. Football’a özel gerçekçi mocap/glTF varlığı pakette yoktur; kullanıcı kendi lisanslı GLB’sini yükleyebilir. Cesium Man’in atıfları model dizinindedir.
- Managed preview relay ve paylaşılan tarayıcı başlatılamadı. DOM ve sahne hesapları testlidir; GPU görüntüsü, mobil görünüm ve video görüntüsünün insan gözüyle kontrolü tamamlanmış sayılmaz.
- Oynatırken oyuncuyu sürükleyerek canlı hareket kaydı, orijinal planda “sonra eklenebilir” olarak yer alır ve bu sürümün kapsamına alınmamıştır.
