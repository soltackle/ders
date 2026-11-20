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

`dist/` statik çıktıdır. Bağıl varlık yolları GitHub Pages alt dizinlerini destekler. Pages ortamı ve dağıtım iş akışı `codex/study-app` dalını kullanır. `master` kaynak dalıdır; yayına gönderilecek commit iki dala da push edilir. Böylece kaynak dalındaki ikinci bir dağıtım aynı Pages çalışmasını iptal etmez. İş akışı test, tip kontrolü ve derleme geçmeden dağıtım yapmaz.

## Eğitim akışı

1. Pas koruması veya Field zone senaryosunu açın; LT/LG/C/RG/RT’ye tıklayarak POV’a geçin.
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

Başlangıçtaki **Pas koruması**, yerleştirdiğiniz savunmaya göre Oynat anında pas korumasını üretir. Field dış blitz’te FT ALERT → FG → C zinciri, boundary’de RB varsa pickup / yoksa QB hot gözetimi, iç tehditte C–guard 1-tech combo ve LB gözetimi uygulanır. 3–4, 4–3, 5 ve 6 kişilik DL hatları vardır. Kalabalık 5/6 DL baskısında big-on-big paylaşımı uygulanır: OL kendi DL’sini bırakmaz; RB ek DL veya iç/field tehdidini alır. [Takım kuralı ve kullanım](docs/TEAM-PASS-PROTECTION.md).

Savunma seçeneklerinden sağ/sol/orta, iki dış blitz veya blitz yok seçilir; DL yerleşimi korunur. Otomatik takım şablonu kendi takım kuralını kullanır; sayı fazlasını ve çözülemeyen atamaları açıkça bildirir. Sahanın altındaki Adam paylaşımı tablosu gerçek blokçu/tehdit ilişkilerini, boundary adamlarını ve QB hot gözetimini gösterir. Eski trap/4i başlangıç senaryoları kaldırılır; pas koruması ve yeni field zone birlikte saklanır.

## Field zone · Inside / Outside

Aktif senaryodan **Field zone · Inside / Outside** seçin. Sahanın altındaki **Zone türü** alanında inside zone veya outside/stretch seçilebilir. Hash değişince ikisi de field yönüne aynalanır. Pas ve zone taslakları senaryo değiştirirken ayrı saklanır.

3–4 / 4–3 / 5 / 6 DL front’ları, DL teknikleri, elle yerleşim, sağ/sol/orta/iki dış blitz ve gösterme seçenekleri burada da kullanılabilir. DL için base, field/boundary slant, pinch, widen ve twist; LB için fit, flow, scrape, sail, bait ve hold seçilir. Oyuncu bazında reaksiyon genel ayarı değiştirmeden ayrıştırılabilir.

Covered OL başlangıçta karşısındaki adamı alır ve adamında kalır. Uncovered OL yalnız zone yönündeki komşusuna gerekiyorsa kısa combo yardımı yapıp ikinci seviyeye çıkar; yardım gerekmiyorsa doğrudan çıkar. Oynat, bu kuralı inside ve outside zone’da ileri zone adımı, climb ve backside cutoff ile uygular. Covered/uncovered durumu oyuncu kartlarında görünür. RB handoff sonrası koşucudur; bang/bend/bounce elle seçilir veya gerçek blok yollarına göre geometrik koridor önerisi kullanılır. Sayı fazlası savunmacı **blok dışı / takip** olarak gösterilir. RB blokçu sayılmaz.

Covered/uncovered paylaşımı kullanıcının tarif ettiği takım kuralını uygular. Yardımın erişilebilirliği ve ikinci seviye LB seçimi konumlara göre hesaplanır; özel stunt devirleri ve RB okumaları ayrıca düzenlenebilir. [Uygulanan zone kuralları ve sınırlar](docs/FIELD-ZONE.md).

## Ravens · MOST

Üst bölümdeki **Ravens · MOST** sekmesi, kullanıcı tarafından sağlanan Playmaker X HTML çiziminden aktarılan **35 ofans oyununu** içerir. Kartlarda kaynak yerleşimi ve rotalar görünür; adla arama ve zone/counter/option/pistol/bunch filtresi kullanılabilir. Bir kart seçildiğinde oyun aynı 2D/3D/POV sahnesinde açılır. [Doğrudan Ravens bölümü](https://soltackle.github.io/ders/#ravens).

**OL blok şeması** seçimi takımın numaralı oyun kurallarını, kaynak çizimini, pas korumasını ve inside/outside zone’u sunar. 35 oyun kullanıcı açıklamasına göre sabit numara ve tür etiketi taşır; numarayla arama yapılabilir. GT/CT counter, Dart, 3/5-tech trap, screen, guard lead/wrap ve tush push özel hareketleri çizilen OL yollarına göre uygulanır. 9 numara kullanıcının seçimiyle kaynak çiziminde kalır. [35 oyunun takım çağrıları](docs/RAVENS-TEAM-CALLS.md). Speed option keep/pitch dalı ve özel koşuların taşıyıcı/devir zamanı eğitim alanından seçilebilir; savunmaya göre otomatik karar verildiği iddia edilmez. Pas ve zone seçimlerinde takım kuralları OL ve ilgili RB/QB görevlerini hesaplar; diğer kaynak rotaları korunur. Savunma kaynakta bulunmadığı için çalışma front’u olarak eklenir ve değiştirilebilir.

Q kaynak harfi QB’ye, arka alandaki uygun H RB’ye eşlenir; Empty dizilişinde H otomatik RB yapılmaz. Konumların oranları korunur, ölçek OL aralığına göre normalize edilir. Kesik çizgiler snap öncesi motion olarak oynar. Motion/rota hızları ve snap zamanı eğitim amaçlı ayarlanır. Her Ravens oyununun taslağı ve OL Antrenman bölümü ayrı saklanır. [Aktarım ve sınırlar](docs/RAVENS-MOST.md).

## Ravens · Rakip defans paketleri

Ravens sahasının altındaki **Rakip defans paketi · Kocaeli** bölümü, hazır front/blitz seçeneklerinden ayrıdır. Sağlanan Playmaker X savunma çizimindeki **beş 4–3 çağrıyı ve 55 oyuncu yerleşimini** içerir: 2×2 spread 1&10, trips right 1&10, trips right 3&az, 2×2 spread 3&8 ve trips right 3&10. Paket değiştirmek ofans oyununu değiştirmez; Ravens kartı değiştirilince seçili rakip paketi ve reaksiyon modu korunur.

**Ravens oyununa tepki** modunda DL/blitz baskısı, pas rotalarına coverage, koşuda LB fit/puller okuması, dış contain, screen teşhisi ve taşıyıcı takibi gecikme ve hız sınırlarıyla üretilir. Takımın pas koruması, big-on-big ve covered/uncovered zone paylaşımı geçerlidir. Savunmacı uzaktaki puller’a temas etmiş gibi bağlanmaz; elle kaydedilen savunma yolları önceliklidir. **Kaynakta çizilmiş hareketler** modunda yalnız savunma çizgileri oynatılır; çizgisiz savunmacı yerinde kalır.

Kaynak coverage çağrısı/man-zone etiketi belirtmez. Adaptif coverage ve takip, çizimin açılışından sonra uygulanan eğitim kurallarıdır; rakibin gerçek coverage sistemi olarak sunulmaz. **Paketi kaldır** önceki savunmayı geri getirir; hazır front/blitz seçimi de paketten çıkar. [Kaynak aktarımı, tepkiler ve sınırlar](docs/OPPONENT-PACKAGES.md).

## Pas hedefi ve canlı temas

Her Ravens oyunundaki **Pas oyna** düğmesi takım pas korumasını ve alıcı seçimini açar. Yüzük E7 (21) field screen çağrısında pas U’ya atılır. Ravens pas oyunlarında **Pas alıcısı** alanından o oyunda rotaya çıkan alıcı seçilir. OL, QB ve pas korumasındaki RB hedef listesine girmez. Atış zamanı snap sonrası ve QB LOS'u geçmeden önceki oyun penceresinde tutulur; top QB'den sabit bir uçuşla alıcının oyun rotasındaki karşılama noktasına gider. Hedef seçilmezse top QB'de kalır. **Otomatik** pas sonucu; top yolundaki savunma temasına, alıcının noktaya yetişmesine ve yakın coverage'a göre tamamlanan/eksik pas üretir. Tamamlanan/eksik pas eğitim dalları da seçilebilir.

Antrenman görünümünde Ravens oyuncuları gövde mesafesini korur, takım arkadaşıyla kesişen yolda kısa bir yana adımla yer açar ve gerçek yakın temas kurulmadan birbirine bağlanmaz. Blokta ilerleme direnç ve hız sınırına bağlıdır. Sürdürülen taşıyıcı teması tackle/sack, sideline ise saha dışı sonucu üretir; taşıyıcı durur, diğer oyuncular yavaşlar. HUD oyun sonucunu ve topun uçuşunu gösterir. Mini harita ve POV aynı çözümlenmiş konumları kullanır; geri sarma aynı sonucu verir.

Tasarla görünümü kaynak yollarını düzenler. 9 numaralı oyun ile **Kaynakta çizilmiş hareketler** modu kaynak gösterimini korur. Bu sistem rotaya bağlı gövde/temas yaklaşımıdır; oyuncu gücü, beceri puanları, ragdoll veya hakem sistemi içermez. [Uygulanan pas ve temas kuralları](docs/PLAY-DYNAMICS.md).

## Saha AI · Oyuncu kararları

Ravens'taki **Saha AI** bölümü, rol bazlı canlı oyuncu davranışlarını açıp kapatır. Varsayılan açıktır. **Kararları göster** seçilince seçili oyuncunun neyi okuduğu, gördüğü ve hatırladığı oyuncu sayısı HUD'da görünür. Karar görünümü mevcut zamanı korur; AI davranışını değiştirmek oyunu başlangıca alır. Ayarlar oyunlar arasında ve JSON/yerel kayıtta korunur.

Her oyuncu gecikmeli gerçek saha konumlarını; görüş yönü, mesafe, oyuncu örtüşmesi, kısa hafıza ve yakın temas üzerinden okur. DL rush hattı/ellerle mücadele, LB guard/puller–pas seti okuması, DB alan/rota–top okuması; OL kendi adamını aynalama, QB pocket okuması ve taşıyıcı koridor seçimi uygular. QB ve backpedal yapan savunmacı geri giderken sahayı görmeye devam eder. Defans, seçtiğiniz pas hedefini veya görünmeyen koşucunun güncel yerini öğrenmez.

Takım blok ataması, pull/mesh sırası, alıcı rotası, pas hedefi, option keep/pitch ve manuel yollar koç kararı olarak korunur. Ofansın yerel düzeltmesi oyun koridoruyla sınırlıdır. Kaynak/diagram gösteriminde Saha AI uygulanmaz. Bu yerel ve deterministik bir oyun AI'sidir; eğitilmiş bir insan oyuncu modeli veya tam maç motoru değildir. [Davranış, algı ve sınırlar](docs/PLAYER-AI.md).

## Doğrulama sınırları

Veri modeli, taktik analiz ve editör akışları otomatik testlerle kapsanır. Paylaşılan tarayıcı/önizleme altyapısı çalışmadığında 3D görünüm, mobil düzen, video çıktısı ve gerçek sağlayıcıyla AI çağrısı etkileşimli olarak doğrulanmış sayılmaz. API erişimi ve kullanılan modelin lisansı kullanıcı tarafından sağlanır.
