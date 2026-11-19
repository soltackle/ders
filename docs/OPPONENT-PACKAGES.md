# Kocaeli rakip savunma paketleri

Kullanıcının sağladığı Playmaker X HTML savunma görünümünden beş çağrı aktarılmıştır. Ham HTML uygulamaya eklenmez; yalnız oyun adı, kaynak kimliği, top merkezi, oyuncu yerleşimi ve SVG hareket yolları `src/data/opponent-kocaeli.json` içinde tutulur.

| Çağrı | Kaynak yerleşimi | Açılışta dikkat çeken hareket |
| --- | --- | --- |
| 2×2 spread 1&10 | 4 DL, 3 LB, 2 CB, SS, FS | Dört DL rush; LB öne fit; bazı DB drop hareketleri |
| Trips right 1&10 | 4 DL, 3 LB, 2 CB, SS, FS | DL rush, LB fit/drop ve dışa kayma |
| Trips right 3&az | 4 DL, 3 LB, 2 CB, SS, FS | S dış başlangıçtan içeri blitz; diğerleri kendi çizgilerinde |
| 2×2 spread 3&8 | 4 DL, 3 LB, 2 CB, SS, FS | DL rush, LB fit ve DB drop |
| Trips right 3&10 | 4 DL, 3 LB, 2 CB, SS, FS | S ve M çizgileri LOS yakınına gelir; adaptif modda gap baskısı kabul edilir |

Son çağrıdaki S/M hareketini baskı saymak bir eğitim yorumudur; oklar LOS'u geçmediğinden kaynakta kesin blitz etiketi olduğu iddia edilmez. Kısa öne LB adımları genel olarak blitz sayılmaz. Kaynakta gerçek DL twist/devir kesişmesi veya coverage alanı çizilmemiştir.

## Kullanım

1. Ravens'tan bir oyun açın.
2. Hazır savunma seçeneklerinin üstündeki ayrı **Rakip defans paketi · Kocaeli** bölümünden çağrı seçin.
3. **Ravens oyununa tepki** veya **Kaynakta çizilmiş hareketler** modunu seçip Oynat'a basın.

Paket, ofanstaki 11 oyuncuyu ve Ravens oyun kimliğini korur. Seçili paket başka Ravens kartına geçerken taşınır. Her çağrının kendi kaynak top merkezine göre yerleşimi kullanılır; trips/spread çağrıları ofans adına göre otomatik değiştirilmez. Field yönü değişimi ofans takım çağrısına uygulanır; rakip çiziminin sağ/sol yerleşimi korunur. Oyuncular editörde ayrıca taşınabilir.

Önceki savunmanın oyuncuları ve manuel yolları yedeklenir. Paketler arasında geçiş bu yedeği değiştirmez. **Paketi kaldır** yedeği geri yükler; hazır front veya blitz seçmek de rakip paketinden çıkar. Paket ve yedek, senaryo JSON'u ve yerel kayıtla saklanır. Kaldırılırken artık var olmayan oyuncu referansları temizlenir.

## Tepki modeli

Adaptif modda savunma önce çağrının kaynak açılışına sınırlı adım atar. Sonraki hareketler yalnız önceki zamanlarda gözlenen ofans konumlarına dayanır; gelecekteki rotaların son noktası okunmaz. Segmentler arasında yumuşak hareket kullanılır. DL, LB ve DB hız sınırları sırasıyla 2.6, 3.5 ve 4.1 saha birimi/sn; temel pas/koşu/screen okuma gecikmeleri 0.45/0.60/1.15 sn'dir. DB okumaları ayrıca 0.1 sn gecikir.

- Pas: DL ve gerçek blitz QB'ye baskı yapar. Blokçuya yakın temas kurduktan sonra karşı koyar; uzak puller'ın open/run fazında ona bağlanmaz. Covered DL'nin kendi blokçusu, kısa yardıma gelen oyuncudan önceliklidir. Combo'dan LB'ye geçiş gözlenen climb başlayınca devreye girer.
- Coverage: CB başlangıç eşleşmesindeki alıcıya gecikmeli tepki verir. Derin drop işareti ve safety rolü derin alanı koruyan bir eğitim davranışı üretir. LB pas görünüşünde hook bölgesi ve rota akışına göre hareket eder. Bunlar Cover 1/2/3 gibi kaynakta belirtilmeyen bir coverage çağrısını kanıtlamaz.
- Koşu: LB önce fit/guard-puller hareketini okur; taşıyıcı ilerleyince takip eder. Counter, Dart ve trap'te puller anahtarı kullanılır. DB dış omuz/contain açısı ve gecikmeli rally uygular.
- Özel oyunlar: Screen savunması pas görünüşünü okuduktan sonra rally yapar. Speed option'da dış force QB'ye açı alır; hücumun keep/pitch seçimi kullanıcıda kalır. Tush push'ta iç gap'lere sıkışma uygulanır. Rollout/wrap/lead ofans yolları korunur.
- CB/SS/FS normalde OL'nin blok veya hot rusher listesine girmez. Editörde açıkça blitz verilirse gerçek rusher olarak değerlendirilir.

Takım pas korumasındaki field ALERT zinciri, boundary adam paylaşımı ve OL+RB big-on-big kuralı korunur. Zone'da covered kendi DL'sini alır; uncovered playside yardım gerekiyorsa yapıp ikinci seviyeye çıkar. Reaksiyon katmanı bu ofans yollarını yeniden yazmaz.

Kaynak modunda çizilmiş savunma yolu sonuna kadar korunur; çizgisiz oyuncu yerinde kalır. Bu modda OL'nin engage bağlantısı kaynak savunma rotasını sürüklemez. Kaynak çizgileri ile ofans yolları kesişebilir; bu mod otomatik temas düzeltmesi yapmaz.

## Düzenleme ve sınırlar

Bir savunma aksiyonu kaydedildiğinde veya yol noktası düzenlendiğinde oyuncunun tüm üretilmiş yolu manuel sahipliğe geçer. Sonraki Oynat bu yolu veya zamanlarını yeniden üretmez. Konumu değiştirmek ise kaynak hareketini yeni başlangıç konumuna taşır. Hold/show niyetleri adaptif takipten çıkarılır.

Bu sistem taktik eğitim animasyonudur. Ravens pas hedefi seçimi, geometrik tamamlanan/eksik pas ve rotaya bağlı canlı gövde/temas katmanı [pas ve temas kurallarında](PLAY-DYNAMICS.md) açıklanır. Oyuncu verisine dayalı momentum, ragdoll, interception olasılığı veya rakibin bilinmeyen coverage çağrısı tahmin edilmez. Option dalı ofans kontrollerinde açıkça seçilir. Bir senaryoda en fazla 300 aksiyon üretilir; uzun oyunlarda savunma segmentleri bu bütçeye göre seyreltilir.

## Yeniden aktarım ve doğrulama

```sh
node --experimental-strip-types scripts/import-opponent.mjs snapshot.html
npm test
npm run build
```

Aktarım, her savunma kartındaki top işaretini merkez kabul eder. 1024×2304 kaynak koordinatları, OL ölçeğiyle aynı `1.2 / (1024 × 0.04)` oranına çevrilir. Savunma derinliği ve SVG yolunun dikey yönü kaynakla aynı işaretlidir. E/T/N → DL, S/M/W → LB, C → CB olarak eşlenir; tekrar eden harfler benzersiz kimlik taşır.

Testler 35 Ravens × 5 paket × 2 reaksiyon modu × 2 field yönü olmak üzere 700 kombinasyonda şema, oyuncu sayısı, aksiyon bütçesi, sahte DB rusher atamaları ve kaynak yol uçlarını denetler. Ayrıca tekrar hesaplama/JSON dönüşü, gecikmeli nedensellik, hız sınırları, gerçek temas, manuel düzenleme, arayüz seçimi ve savunma geri yükleme kontrolleri bulunur. jsdom ve matematik testleri gerçek WebGL görüntüsünün görsel doğrulaması değildir.
