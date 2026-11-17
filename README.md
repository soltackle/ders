# OL Atölye

Amerikan futbolunda OL, QB ve receiver görevlerini anlatmak için Türkçe, çevrimdışı çalışan oyun ve savunma editörü. İlk oyun, koçla görüşülen **Empty** korumasıdır: field kayma, boundary MAN ve boundary LB baskısını QB’nin okuyup hareket etmesi. Empty kadrosunda RB yoktur.

- [Uygulamayı aç](https://soltackle.github.io/ders/)
- [Tek HTML dosyasını indir](https://github.com/soltackle/ders/raw/refs/heads/master/OL_Atolye_Editor.html)

İndirilen `OL_Atolye_Editor.html` dosyasını tarayıcıda açın. Kurulum, sunucu ve internet bağlantısı gerektirmez. GitHub Pages yayını ilk aktarım sonrası Actions işlemi tamamlandığında güncellenir.

## Kullanım

1. Empty oyununda oyuncuyu seçip **Adımlar** sekmesini açın. Rookie görünümünde açıklama, yön, hedef, karar koşulu, sık hata ve kontrol sorusu; normal görünümde kısa görev çağrıları gösterilir. 11 oyuncu için başlangıçta toplam 66 adım vardır.
2. Front, teknik, hash, hiza, baskı durumu ve savunmacı yollarını değiştirin. Canlı anlatım yeni savunmaya göre güncellenir. LB’nin çizgiye yaklaşması baskıyı kendiliğinden açmaz.
3. **Ortak adım metinlerini düzenle** ile bu oyunun anlatımını değiştirin; adım ekleyin, silin veya sıralayın. `{target}`, `{field}`, `{gap}` gibi alanlar güncel savunmayla doldurulur. Bunları tamamen kendi cümlenizle de değiştirebilirsiniz.
4. **Bu oyuncu için düzenlenebilir kopya** ile canlı anlatımı oyuncuya özel koç adımlarına çevirin. Bu kopya savunma değiştiğinde kendiliğinden değişmez. **Canlı anlatımı göster** ile otomatik anlatıma dönebilirsiniz; kayıtlı koç adımları korunur.
5. Savunmacıyı seçip **Yol çiz** aracında sahaya tıklayın/dokunun. Noktaları taşıyın veya silin. **Yol noktaları** sekmesinden koordinatları, sıralamayı ve gecikmeleri düzenleyin. Oyuncuya çizdiğiniz yol, yaklaşık OL hareket gösterimine göre önceliklidir.
6. Savunmayı isim vererek look olarak kaydedin. Oyun değiştirirken savunma korunur. **Özel varyasyon aç** belirli savunma + hash için ayrı görev kopyası oluşturur.
7. **Yedek / HTML** menüsünden JSON yedeği veya bütün kayıtlarınızın gömülü olduğu güncel HTML indirin. Eski OL Atölye v2 JSON kayıtları içe aktarılabilir.

Yeni oyunlar boş görevlerle oluşturulur. Mevcut 39 genel hareket şablonu bağımsız kopyalanır; bir oyunda düzenlemek diğer oyunların metnini değiştirmez. Empty dışında kendiliğinden oyun üretilmez.

## Empty anlatımının mantığı

- Field GAP/SLIDE, boundary MAN. Orta top sol hash gibi değerlendirilir; sağ hash’te mantık aynalanır.
- Field LB baskısında field tackle LB’ye kayar; guard ve center field yönündeki sıradaki tehditleri karşılar.
- Boundary tackle kendi adamında kalır. Empty’de boundary LB baskısını QB görüp hareket eder.
- LB blitz yoksa center 1 teknik üzerinde o taraftaki guard ile ortak çalışır; göz ve gövde LB okumasına açık kalır.
- Slant, stunt ve fazla baskı cevapları bu çalışma mantığından üretilen **düzenlenebilir taktik önerileridir**. Açık baskılar görünür kalır; beş koruyucuya gerçekte kapatamayacağı ek tehditler kapatılmış gibi gösterilmez.

OL konumları yaklaşık öğretim gösterimidir; gerçek blok başarısı veya ölçülü set mesafesi hesaplanmaz. Receiver yolları verilen görselin yaklaşık izidir; kesin rota adı, yard derinliği veya otomatik hot rota sırası iddia edilmez.

## Kayıtların korunması

Oyunlar, açıklamalar, şablonlar, look’lar, çizgiler ve varyasyonlar kullanılan tarayıcıda tutulur. Başka cihaz veya tarayıcıya kendiliğinden eşitlenmez. Dosya ya da cihaz değiştirirken güncel HTML veya JSON yedeği alın. Kullanıcı kayıtları bu repoya veya bir sunucuya otomatik gönderilmez.

Eski `ol-atolye-takim-v2` kayıt anahtarı silinmez. Erişilebilen eski kayıtlar içe alınır; eski notlar ve elle yapılan paylaşımlar arşivde korunur. Tarayıcı farklı yerel dosyaların depolamasını ayırırsa eski dosyadan JSON yedeği aktarın.

## Geliştirme ve doğrulama

Node.js 22+ ve Python 3 gerekir. Uygulamanın kendisi bağımlılık gerektirmez; jsdom yalnız otomatik testlerde kullanılır.

```sh
npm ci
npm run build
npm test
```

Kaynaklar `src/`, taşınabilir derleme betiği `scripts/build.py`, testler `tests/` altındadır. Derleme aynı kaynaklarla aynı HTML’yi üretir. `index.html` ve `OL_Atolye_Editor.html` aynı, bağımsız çalışan uygulamadır.

Testler; 756 front/hash/teknik/taraf/blitz birleşimini, rookie/normal anlatımı, metin düzenlemeyi, manuel önceliğini, fare/dokunmatik yol olaylarını, look kayıtlarını ve JSON/HTML geri yüklemeyi kapsar. DOM ve veri testleri canlı tarayıcıdaki görsel kontrolün yerine geçmez.

`master` dalındaki değişiklikler `.github/workflows/publish-pages.yml` üzerinden mevcut GitHub Pages yayınına aktarılır.

## Önceki repo içeriği

Aktarım öncesindeki içerik `backup/before-ol-atolye-2026-11-17` dalında ve Git geçmişinde korunmuştur. Ana dalın dosyaları bu projeyle değiştirilmiştir.
