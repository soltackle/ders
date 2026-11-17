# O-Line Lab

Ofansif hat eğitim editörü ve oynatıcısı. **Canlı uygulama:** https://soltackle.github.io/ders/

## Başlatma

Node.js 22.13+ veya 24 gerekir.

```sh
npm ci
npm run dev
npm test
npm run build
```

`dist/` statik çıktıdır. Bağıl varlık yolları GitHub Pages alt dizinlerini destekler. Pages ortamı yalnızca `codex/study-app` dalını kabul eder. `master` kaynak dalıdır; yayına gönderilecek commit bu dala da push edilmelidir. İş akışı test, tip kontrolü ve derleme geçmeden dağıtım yapmaz.

## Eğitim akışı

1. Bir örnek Case seçin; LT/LG/C/RG/RT’ye tıklayarak POV’a geçin.
2. Sonraki düğmesi aktif adımın sonuna kadar oynatır ve durur. Önceki, tekrar, yavaş çekim, loop ve zaman çizelgesi kullanılabilir. Boşluk tuşu oynatır/durdurur.
3. POV HUD oyuncunun aktif aksiyon/fazını, atamasını ve hedefini gösterir. Mini harita konumunu gösterir. Omuz arkası düğmesi kendi bedenini görmeyi sağlar.
4. Karar adımının sonunda yanıt seçin. Seçeneğe kayıtlı Case adı atanmışsa o Case açılır; doğru yanıt belirtilmişse tahmin geri bildirimi gösterilir.

## Tasarım akışı

**Tasarla** modunda panelleri açın. 2D’de oyuncular taşınabilir; DL’ler ayarlara göre omuz/baş hizasına yapışır. Aksiyon kaydedildikten sonra altın yol düğümleri sürüklenebilir veya **2D’de yol noktası çiz** ile ara noktalar eklenebilir. Pull/trap şablonu `open → run → gather → strike` fazlarını ve yolunu üretir. Diğer etiketler ve atama tipleri panelden seçilir. Engage alanı bir oyuncunun temas sırasında diğeriyle birlikte taşınmasını sağlar; bakış hedefi bağımsızdır.

Adım paneli oyuncu notları, odak, çağrı okları ve karar seçeneklerini düzenler. Playbook paneli JSON kurallarını doğrular ve her kuraldan Case iskeleti üretir. Case kütüphanesi ad/şema filtresi, kopyalama, açma ve silme destekler. Undo/redo ve Ctrl/Cmd+Z, senaryo değişikliklerini geri alır. JSON yükleme/dışa aktarma farklı cihazlara aktarım içindir. Aktif senaryo otomatik olarak bu tarayıcıya kaydedilir; kütüphane kaydı ayrıca yapılır.

## Analiz ve AI

Analiz; DL tekniği/gap’i, covered OL, field/boundary, çizimden blitz, rollerin oyunculara çözülmesi, eksik sorumlular, overload, pull boşluğu, trap hedefi ve olası çakışmaları hesaplar. Sonuçlar geometrik ve taktik bir yardımcıdır; fizik simülasyonu veya koç kararının yerine geçmez. Teknik adları, omuz mesafesi ve blitz etiketleri ayarlardan değiştirilebilir.

AI paketi senaryoyu, playbook’u, analizi ve 2D PNG’yi içerir. API formu OpenAI uyumlu, tarayıcı isteklerini kabul eden bir servis, model ve kullanıcı anahtarı gerektirir. Anahtar kalıcı depolamaya yazılmaz ve istek sonrasında alandan temizlenir. Geçerli JSON önerisi önizlenebilir; **Senaryoya uygula** seçilene kadar mevcut Case değişmez. Şema dışı ve bilinmeyen oyunculu öneriler reddedilir. Doğal dil tarifiyle tam senaryo üretimi de aynı doğrulamadan geçer.

## Görseller ve video

Varsayılan, football duruşları için prosedürel eklemli modeldir. Hareketler senaryo zamanından hesaplanır; eğri yollar, mesafeye bağlı adım döngüsü, yumuşak kamera, hedefe uzanan eller, gölgeler, izler ve temas vurgusu kullanılır. Ayarlardan kendi `.glb` modelinizi yükleyebilirsiniz; skin ve animasyon klipleri desteklenir. Paketteki isteğe bağlı Cesium Man, skin/klip destekli insan modeli örneğidir; football motion-capture modeli değildir. Kaynak ve lisansı [ATTRIBUTION.md](public/models/ATTRIBUTION.md) dosyasındadır. Özel model oturumda kalır; JSON’a gömülmez.

MediaRecorder destekleyen tarayıcılarda saha videosu kaydedilebilir. Başlatmak ve durdurmak için aynı düğmeye basın; WebM indirilir. Yerleşik gerçekçi football motion-capture kütüphanesi sağlanmaz.

## Takım pas koruması şablonu

Sol senaryo menüsündeki **Takım pas koruması · otomatik**, yerleştirdiğiniz savunmaya göre Oynat anında pas korumasını üretir. Field dış blitz’te FT ALERT → FG → C zinciri, boundary’de RB varsa pickup / yoksa QB hot gözetimi, iç tehditte C–guard 1-tech combo ve LB gözetimi uygulanır. 3/4/5 DL başlangıç front’ları vardır. [Takım kuralı ve kullanım](docs/TEAM-PASS-PROTECTION.md).

Diğer örnek Case’lerdeki genel playbook ayrıca düzenlenebilir. Otomatik takım şablonu kendi takım kuralını kullanır; sayı fazlasını ve çözülemeyen atamaları açıkça bildirir.

## Doğrulama sınırları

Veri modeli, taktik analiz ve editör akışları otomatik testlerle kapsanır. Paylaşılan tarayıcı/önizleme altyapısı çalışmadığında 3D görünüm, mobil düzen, video çıktısı ve gerçek sağlayıcıyla AI çağrısı etkileşimli olarak doğrulanmış sayılmaz. API erişimi ve kullanılan modelin lisansı kullanıcı tarafından sağlanır.
