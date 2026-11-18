# Ravens · MOST aktarımı

Kullanıcının sağladığı Playmaker X HTML anlık görüntüsünün MOST sekmesindeki 35 oyun aktarılmıştır. Kaynak oyun adları, kimlikleri, toplam 385 ofans oyuncusu, konumları ve çizilmiş yol verileri `src/data/ravens-most.json` içinde bulunur. Özgün HTML, hesap bilgileri, harici uygulama kodu ve ödeme/izleme öğeleri projeye alınmaz.

Yeniden aktarım: `node scripts/import-ravens.mjs kaynak.html`. Betik yalnız MOST kartlarını alır; 35 oyun, her oyunda 11 benzersiz oyuncu ve desteklenen SVG komutlarını doğrular. Rastgele HTML veya JavaScript çalıştırmaz. Önizlemeler alınan koordinatlardan güvenli SVG elemanları olarak yeniden kurulur.

## Konum ve yollar

Kaynak SVG 1024 × 2304 koordinat sistemi kullanır; LOS y=1152’dir. Center x’i başlangıç merkezi kabul edilir. Kaynak OL aralıklarının medyanı 1.2 uygulama birimine normalize edilir; x ve y aynı ölçekle dönüştürülerek şekil oranları korunur, ekran y ekseni saha z eksenine çevrilir. Bu çizim aktarımı fiziksel saha ölçülerinin veya oyuncu hızlarının birebir ölçümü değildir.

M/L/H/V çizgileri ve Q/C eğrileri okunur. Eğriler örneklenir; rota köşeleri polyline enterpolasyonuyla korunur. Uzun yollar şemanın nokta sınırına göre bölünür. Kesik/dotted çizgi motion kabul edilir ve snap öncesinde oynatılır. Diğer yollar snap sonrasında sırayla yürütülür. Motion hızı 3, rota hızı 4 birim/s üst sınırına göre süre hesaplanır; takım koruma/zone bölümü motion bittikten sonra başlar. Bu zamanlar eğitim ayarıdır.

## Şema seçimi

- **Çizimdeki yollar:** 11 ofans oyuncusunun çizilmiş hareketleri korunur. Savunma sadece çalışma yerleşimidir, atama veya takip kararı uydurulmaz.
- **Takım pas koruması:** OL’de mevcut ALERT, boundary man ve big-on-big paylaşımı uygulanır. RB’ye pickup verilmişse kaynak RB yolu yerine koruma hareketi oynar. Diğer rotalar korunur; QB hot gözetimi kaybolmaz.
- **Field inside / outside zone:** Covered kendi DL’sini tutar; uncovered yalnız zone yönünde gerekiyorsa yardım ederek veya doğrudan ikinci seviyeye çıkar. QB/RB mesh ve koşu şeması takım zone motorundan gelir; diğer oyuncuların çizilmiş rotaları korunur.

OUTZONE adı outside, ZONE adı inside için başlangıç önerisidir; zone varyantı kullanıcı tarafından değiştirilebilir. OL yolu çizilmeyen açık pas örnekleri başlangıçta pas korumasını kullanır. Counter, option ve OL blokları çizilmiş diğer örnekler çizim modunda başlar. Bu sınıflandırma oyun adının veya diyagramın tüm taktik ayrıntılarının doğrulandığı anlamına gelmez.

Q kimliği korunarak pozisyon QB yapılır. H, Empty olmayan dizilişte arka alan hizasındaysa veya HPP olarak belirtilmişse RB olarak eşlenir; F FB olarak gösterilir. Bu rol eşlemesi arayüzde belirtilir, Tasarla modunda değiştirilebilir. 11 ofans oyuncusu korunur; RB bulunmayan oyuna fazladan RB otomatik eklenmez. Zone için RB yoksa motor bunu bildirir.

Kaynakta hiçbir oyunda savunma oyuncusu çizilmemiştir. Başlangıç savunması mevcut 4–3 çalışma front’udur; 3–4/4–3/5/6 DL, teknik ve blitz seçenekleri kullanılabilir. Bu seçimler Ravens oyun kimliğini ve ofans yerleşimini değiştirmez.

## Kayıt ve doğrulama

Ravens ile OL Antrenman sekmeleri ayrı taslaklar tutar. Her Ravens oyununa ait seçilen blok modu ve düzenlemeler tarayıcıya ayrıca kaydedilir. JSON aktarma ve Case kütüphanesi Ravens kimliğini korur. `#ravens` bağlantısı bölümün doğrudan açılmasını sağlar. Geniş dizilişler ve rotalar için tahta ve mini saha ölçeği uyarlanır; POV ve baş kontrolü kullanılabilir.

Testler 35 oyunun bütün adlarını ve 385 oyuncusunu, rota sonlarının kaynakla eşleşmesini, SVG eğrilerini/köşelerini, dört modda şema geçerliliğini, yeniden hesaplama tutarlılığını, motion sırasını, takım koruması önceliğini, oyun filtresi/seçimini, kayıt ve sekmeler arası dönüşü kapsar. Kaynağa göre bilinmeyen QB okuması, pas hedefi, gerçek handoff anı, özel stunt/option kararı ve koşullu blok devri ayrıca takım tarafından tarif edilmelidir. Çizim modunda top için pas/handoff kararı eklenmez.
