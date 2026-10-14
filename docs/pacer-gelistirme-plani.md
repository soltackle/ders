# P.A.C.E.R. çalışma sitesi — ayrıntılı geliştirme planı

Durum: temel uygulama ve ek çalışma paketi `codex/study-app` dalında. Oturum/mola sayacı, tarihli görev erteleme, kaynak paragrafı etiketli düzenlenebilir kavram bağlantıları ve Chromium tarayıcı kontrolleri eklendi. Gerçek iki cihaz eşitlemesi, GitHub App yetkilendirmesi gerektirdiği için kullanıcı tarayıcılarında ayrıca doğrulanmalı; serbest sürüklemeli grafik sonraki geliştirme olarak duruyor.

### 14 Ekim 2026 — okuma ve hazır harita ek paketi

Görsel güncelleme: sıcak ve daha düşük parlaklıktaki yüzeyler, tek vurgu
rengi, sistem yazı tipi, 65 karakterlik okuma genişliği ve sade çalışma
sayfası uygulandı. Tekrarlanan blok yönergesi kaldırıldı; okuma seçenekleri
ve yönergeler açılır alanlara taşındı. Odak görünümü varsayılan açık;
ders başlığındaki düğmeden veya Ayarlar'dan değiştirilebilir. Açık ve koyu
görünümde 360/768/1280 px kontrolleri, oynatma, cevap koruma, odak geçişi
ve örnek metin/kontrol kontrastı doğrulandı.

- Normal metin görünümüne oynat/durdur ve hız kontrolü eklendi. Kelime arka
  planı metin içinde ilerliyor; kelimeye tıklama, konum sürgüsü, önceki/sonraki
  kelime ve paragraf kontrolleri aynı okuma konumunu kullanıyor. Ortada kelime
  gösterimi ile metin görünümü arasında konum korunuyor.
- Otomatik kaydırma ve hareket azaltma tercihlerine Ayarlar'dan erişiliyor.
  Bionik görünüm, kelime vurgusu, hız, kelime grubu ve noktalama beklemesi
  iki görünümde de uygulanıyor. Okumayı oynatmak bloğu otomatik tamamlamıyor.
- 31 ders için kaynak Y cevap anahtarları esas alınarak 93 hazır kavram
  haritası eklendi. Kavramlar ve adlandırılmış ilişkiler otomatik yerleştiriliyor.
  Haritalar okuma, sindirme ve oturum sonu ekranlarında açılıyor; kaynak
  açıklaması ve metin biçimindeki bağlantı listesi doğrudan erişilebilir.
  Kişisel bağlantılar ve eski notlar ayrıca korunuyor.
- İçerik üretimi, harita ile cevap anahtarının sürümünün uyuşmasını,
  bağlantıların bütünlüğünü ve okların yönünü denetliyor. Ders JSON'u da
  yayın sürümüne bağlandı; yeni haritalar eski ders verisiyle yüklenmiyor.
- Chromium'da oynat/durdur, hız, konum seçme, görünüm değişimi, otomatik
  kaydırma, tercihler ve yenileme sonrası devam kontrol edildi. 93 haritada
  düğüm/etiket çakışması, 360/768/1280 px taşma ve eski kayıtların korunması
  kontrolleri geçti. Dallanan 16 mobil harita senaryosu ayrıca doğrulandı.

Serbest sürükleme ve aşağıda sonraki paket olarak belirtilen özellikler bu
ek paketle tamamlanmış sayılmıyor. İki cihazla gerçek Supabase eşitleme
kontrolü de ayrı bekliyor.

## 1. Hedef ve temel kararlar

İş yerindeki kısa çalışma aralarında açıldığında, kaldığın dersin tam aşamasından devam ettiren; okumayı, bilgiyi işlemeyi ve daha sonra hatırlamayı ayrı ayrı takip eden kişisel bir çalışma alanı kuracağız.

Temel, DOCX belgelerinin ilk sayfalarındaki yöntem olacak:

- Önce **Tüket**, ardından **Sindir**. Zaman azsa çalışma bloğunu küçült; okuma hızını öğrenme başarısı sayma.
- P, A, C, E ve R beş **bilgi türü**. Bunlar her derste aynı sırayla uygulanacak beş zorunlu adım değil.
- Kavram haritası okuma sırasında büyüyebilir; analoji fark edildiği anda eleştirilebilir. Okuma ekranından bu iki alana erişim bulunacak.
- Referans bilgisi kartla hatırlanacak; kanıt ise bir kavramı açıklama veya savunmada kullanılacak.
- Cevabı açma ve kopyalama korunacak. Bu işlemler, bilginin bağımsız olarak hatırlandığı anlamına gelmeyecek.

Uygulama GitHub Pages üzerinde statik kalacak; cihazlar arası ilerleme Supabase Auth + RLS korumalı tabloya yazılacak. Supabase sunucu kodu veya service_role anahtarı sitede tutulmayacak.

## 2. İncelemede doğrulanan mevcut durum

Uygulamada 31 ders ve 129 blok var. Kaynak okuma, bionik görünüm, kelime oynatıcı, cevap alanları, örnek cevap gösterme/kopyalama, yerel kayıt, yedekleme, tekrar ve istatistik altyapısı mevcut.

Yeni özelliklerden önce düzeltilmesi gereken sorunlar:

| Bulgu | Etkisi | Yapılacak iş |
| --- | --- | --- |
| DOCX E/R tablolarındaki bilgi metni ikinci hücreden alınmıyor. 1095 ER kaydının 742'sinde soru metni boş, 353'ünde yalnızca paragraf referansı var. | Kullanıcının sınıflandıracağı bilgi görünmüyor. | Tablo satırlarını ve hücrelerini anlamlarına göre ayrıştırmak; bilgi metni ve kaynak referansını ayrı saklamak. |
| Gün sonu kanıt provası tablosu son bloğun normal görevlerine karışıyor. | Boş ve tekrar eden görevler oluşuyor; görev sayısı yanıltıcı oluyor. | Kanıt provası için ayrı oturum oluşturmak. Aynı D kimliğinin farklı kaynak bölümlerinde tekrarını bağlamıyla ayırmak. |
| Belgelerdeki hazır K referans kartları veri modeline aktarılmamış. | Tekrarlar hazır ön/arka yüzler yerine E/R cevap metninden türetiliyor. | Kaynaktaki kartları doğrudan ve dersle bağlantılı aktarmak. |
| Belgedeki oturum değerlendirme soruları ayrı alan olarak aktarılmıyor. | Ders bitişi yalnızca genel güven seçimine indirgeniyor. | Belgeye ait değerlendirme sorularını ve yönergelerini saklamak. |
| Kelime vurgusunun HTML'si ilk gösterimde metne çevriliyor; canlı güncelleme de vurguyu kaldırıyor. | Aktif kelime arka planı oynatma boyunca görünmüyor. | Aynı kelime işaretleme yöntemini ilk gösterimde, oynatmada, ok tuşunda ve konum kaydırıcısında kullanmak. |
| Son CSS kuralları metin boyutu ve satır aralığı değişkenlerini eziyor. | Ayarlar ekranda gerçek bir değişiklik yapmıyor. | Görünümü tek bir değişken ve bileşen sistemiyle toparlamak. |
| Kelime oynatıcı bionik kapatma tercihini gözetmiyor. | Kapalı seçilse de kalın harfler kalıyor. | Tercihi bütün okuma görünümlerinde uygulamak. |
| Telefonda ana menü gizleniyor ve yerine genel gezinme gelmiyor. | Ana ekran, tekrar ve istatistiklere dönüş zorlaşıyor. | Erişilebilir mobil menü eklemek. |

Bu bulgular kaynak kod, içerik dosyası ve DOCX tablo örnekleri üzerinden doğrulandı. Görsel tarayıcı testi bu plan hazırlığında yapılmadı.

## 3. Kullanıcının çalışma akışı

### Ana ekran

- Ana eylem: **Kaldığım yerden devam et**. Üzerinde ders adı, blok, aşama ve varsa görev numarası yazacak.
- Bugünün tekrarları: referans kartları ve kanıt provası ayrı gösterilecek.
- Kısa zaman seçimi: 10 / 20 / 40 dakika veya özel süre. Öneri, kaynakta bulunan okuma ve sindirme sürelerine göre yapılacak; yarım kalan çalışma saklanacak.
- Ayrıntılı istatistikler kendi sayfasında kalacak. Ana ekranın odağı bugünkü çalışma olacak.

### Ders başlangıcı

Kısa bir başlangıç paneli konunun çekirdeğini, oturum sonunda yapabilmen gerekeni ve belgede belirtilen bilgi türü ağırlıklarını gösterecek. P.A.C.E.R. kullanım rehberi ilk açılışta sunulacak, sonra ihtiyaç olduğunda açılabilecek.

### Tüket

Aktif blok metni gösterilecek. Metin içinde kelime takibi ve ortada kelime gösterimi ayrı okuma seçenekleri olacak. Oynat/durdur ve hız hemen erişilecek; diğer tercihler tek bir okuma ayarları panelinde bulunacak.

Kavram haritası ve analoji notuna hızlı erişim olacak. İlk pakette kaynak paragrafa bağlı tür/not ekleme kullanılacak; serbest metin seçimiyle ayrıntılı etiketleme daha sonraki paket olacak.

**Okumayı bitirdim → Sindir** eylemi okuma aşamasını tamamlayacak. Oynatıcının metin sonuna ulaşması kendiliğinden bütün bloğu tamamlamayacak.

### Sindir

Belgedeki sıraya ve bilgi türlerine göre tek görev veya çalışma alanı gösterilecek. Üstte tür, kısa işlem yönergesi ve blok içindeki ilerleme yer alacak.

Kendi cevabını yazma, `?` ile örnek cevabı açma, doğrudan kopyalama ve Ctrl/Cmd + Enter ile ilerleme korunacak. Cevap açılırken yazılan metin, imleç ve kaydırma konumu korunacak.

Kullanıcı çalışmayı **işledim**, **tekrar gerekli** veya **daha sonra** şeklinde işaretleyebilecek. Atlanan görev atlanmış olarak saklanacak; tamamlanmış sayılmayacak. Geri dönmek ve bloklar arasında gezinmek mümkün olacak.

### Blok ve ders sonu

Blok özetinde okuma durumu, işlenen görevler ve kalan işler gösterilecek. Gerekli işler tamamlanmadan normal **Bloğu tamamla** eylemi tamamlanma kaydı oluşturmayacak; **Daha sonra devam et** ile ders içinde ilerlemek mümkün olacak.

Ders sonunda belgedeki değerlendirme ve haritada gezinme görevleri açılacak. Kanıtlar gün/hafta sonu provasına, referanslar tekrar listesine taşınacak. Ders akışının tamamlanması ile bütün bilgilerin öğrenilmiş olması ayrı gösterilecek.

## 4. Bilgi türlerine uygun çalışma alanları

| Tür | Ekrandaki işlem | Saklanacak çıktı | Sonraki kullanım |
| --- | --- | --- | --- |
| **P — İşlemsel** | Problemi çöz, işlem adımlarını yaz, örnek çözümle karşılaştır. | Çözüm, düzeltme ve öz değerlendirme. | Zorlandığın uygulamayı yeniden çözme. |
| **A — Analojik** | Benzetmeyi yaz; benzerlik, ayrım, bozulduğu yer ve iyileştirmeyi incele. | Kaynak göreviyle bağlantılı analoji ve eleştiri. | Konuyu açıklarken kullanma, tekrar eleştirme. |
| **C — Kavramsal** | Kavramları ekle, ilişki fiiliyle bağla, haritayı her blokta büyüt. | Düğümler ve adlandırılmış bağlantılar. | Belgedeki Y haritada gezinme görevleri. |
| **E — Kanıt** | Örnek/vaka/sayıyı ilgili kavrama bağlayarak sakla. | Kanıt, kaynak, açıkladığı kavram ve kullanıcının açıklaması. | G kanıt provasında bir iddiayı kanıtla açıklama. |
| **R — Referans** | Hazır kartın ön yüzünü oku, hatırla, arka yüzünü aç ve değerlendir. | K kartı kimliği, kişisel not, tekrar geçmişi ve sıradaki tarih. | Günlük aralıklı tekrar. |

Kavram haritasının ilk sürümünde **kavram → ilişki → kavram** şeklinde klavyeyle düzenlenebilen bağlantı listesi olacak; aynı veri sade bir ağ olarak gösterilecek. Karmaşık sürükleme tuvali ve otomatik yerleştirme ayrı bir aşama olacak.

E/R ayrımında bilgi önce görünür olacak. Kullanıcı E veya R seçecek ve gerekçesini yazacak; ardından belgedeki cevapla karşılaştırabilecek. Kullanıcının seçimi ve kaynaktaki sınıf ayrı kaydedilecek. Yanlış seçilen kanıt otomatik olarak referans tekrarlarına düşmeyecek.

Kaynakta ayrı örnek cevabı bulunmayan açık uçlu görevlerde bu durum açıkça belirtilecek; uydurma bir doğru cevap veya otomatik doğruluk puanı üretmeyeceğiz.

## 5. Görsel tasarım ve okuma ayarları

Görsel yön: sıcak açık zemin, rahat okunur koyu metin ve tek yeşil vurgu. Koyu temada da aynı hiyerarşi ve kontrast korunacak.

- Arayüz yazıları genellikle 14–16 px; kaynak metin varsayılan 19 px ve ayarlanabilir olacak.
- Okuma genişliği yaklaşık 60–70 karakter; varsayılan satır aralığı 1,8 olacak. Kullanıcının seçimi anında uygulanacak.
- Ana çalışma alanında tek aşama/tek görev öne çıkacak. Ders planı, hedefler ve ayrıntılı ayarlar açılır panellerde bulunacak.
- Dekoratif hero, gereksiz kart çerçeveleri ve yoğun sayaçlar azaltılacak. Sabit alt kontrol alanında önceki adım, duraklat/devam et ve sonraki adım olacak.
- Telefonda erişilebilir gezinme, en az 44 px dokunma alanları ve ekranı daraltmayan kontrol yerleşimi bulunacak.
- Normal metin kontrastı en az 4,5:1; kontrol ve odak işaretleri en az 3:1 olacak. Bilgi türleri yalnızca renklerle anlatılmayacak.

Ayarlar şu gruplarda düzenlenecek:

1. **Okuma:** metin/kelime gösterimi, bionik açık/kapalı, kalın başlangıç oranı, aktif kelime arka planı ve paragraf odağı.
2. **Oynatma:** kelime/dakika hızı, kelime grubu, noktalama beklemesi, otomatik kaydırma ve hareket azaltma.
3. **Görünüm:** tema, yazı boyutu, satır aralığı, okuma genişliği ve odak modu.
4. **Çalışma:** oturum süresi, isteğe bağlı mola ve tekrar hedefi.
5. **Veriler:** kayıt/eşitleme durumu, yedek indirme, geri yükleme ve Supabase/GitHub bağlantısı.

Hız seçimi öğrenme puanı olarak kullanılmayacak. Oynatma hızı ile yumuşak ekran kaydırması ayrı tercihler olacak.

## 6. İlerleme, tekrarlar ve istatistikler

Tamamlanma kayıtları:

- **Okuma tamamlandı:** kullanıcının açık işaretlemesi.
- **Görev işlendi:** görev türüne uygun çıktı veya açık öz değerlendirme.
- **Blok tamamlandı:** gerekli okuma ve sindirme işleri tamamlandı.
- **Ders akışı tamamlandı:** bloklar ve kaynakta bulunan oturum sonu çalışmaları tamamlandı.
- **Tekrar gerekli:** yukarıdakilerden ayrı bir hatırlama durumu.

Örnek cevabı görmek veya kopyalamak tek başına görev tamamlanması oluşturmayacak. Metin uzunluğu ve geçirilen süre de anlayış kanıtı sayılmayacak.

İstatistikler tamamlanan ders/blok, tüket/sindir oturum süreleri, P/A/C/E/R bazında işlenen çalışmalar, referans tekrar sonuçları ve kanıt provası sayısını gösterecek. Kısa haftalık görünüm çalışma günlerini ve tekrar gereken konuları özetleyecek. Öz değerlendirme puanları sınav başarısı gibi sunulmayacak.

Belgedeki günlük kısa tekrar ve üç doğru seans sonrasında seyrekleştirme yaklaşımı korunacak. Önerilen takvim: önce günlük tekrar; üç doğru seansın ardından 3 → 7 → 14 → 30 gün. Unutulan kart yeniden günlük sıraya dönecek. Kullanıcıya tarihi değiştirme ve kartı erteleme seçeneği sunulacak. Kesin gün aralıkları uygulama tercihi; belgenin zorunlu takvimi değil.

Oturum süresi sekme görünürlüğüne, oynatma/duraklatma ve oturum durumuna bağlı kaydedilecek. Ekranda açık kalma süresi kesin odak süresi olarak etiketlenmeyecek.

## 7. İçerik ve veri mimarisi

İçerik üretiminde paragraflar ve tablolar belge sırasıyla okunacak. Tablo hücrelerini tek metne indirgemek yerine E/R ayrımı, K kartları ve kanıt provası satırları kendi alanlarına aktarılacak.

Önerilen içerik alanları: `guide`, `knowledgeProfile`, `blocks`, `referenceCards`, `evidencePractice`, `mapWalks`, `reflectionQuestions`. Mevcut ders/blok/görev kimlikleri korunacak; tabloda bulunan kaynak referansları ayrıca tutulacak.

İlerleme modeline aşama, aktif görev, okuma konumu, görev durumu, kavram bağlantıları, analoji alanları, kanıt notları, kart tekrarları ve oturumlar eklenecek. Eski düz metin cevaplar yeni alanlarda korunacak; içerik düzeltmesi nedeniyle anlamı değişen eşleşmeler kaybolmak yerine **eski çalışma kaydı** olarak tutulacak.

Yeni veri sürümüne geçişte:

1. Eski kaydın yerel kopyasını al.
2. Ders ve görev kimliklerini değişmeden aktar; taşınan kanıt görevlerini açık bir eşleme listesiyle bağla.
3. Biten dersleri **önceki sürümde tamamlandı** olarak koru. Sonradan eklenen işleri ayrıca göster; eski ilerlemeyi sessizce sıfırlama veya yeni görevleri otomatik tamamlanmış sayma.
4. Hata olursa eski kaydı yüklemeye devam et; yedeği geri alma yolunu koru.

Supabase eşitlemesi kullanıcıya ait `study_progress` satırını kullanır; RLS aynı kullanıcının dışındaki erişimleri engeller. Bu cihazda kayıt, eşitleme bekliyor, eşitlendi ve hata durumları gösterilir. GitHub özel depo eşitlemesi alternatif olarak durur.

Supabase Auth e-posta/şifre oturumu her cihazda saklanır ve yenilenir. İlerleme JSONB satırında saklanır; RLS kullanıcının kendi satırına erişmesini sağlar. Publishable key açık istemci kodunda kullanılmak üzere tasarlanmıştır; service_role anahtarı hiçbir zaman sitede bulunmaz.

Kod, mevcut statik yapı içinde içerik, kayıt, okuma, P.A.C.E.R. alanları, tekrarlar, istatistikler ve eşitleme sorumluluklarına bölünecek. Sırf görünümü değiştirmek için büyük bir framework geçişi yapılmayacak.

## 8. Uygulama sırası ve aşama çıkış koşulları

| Aşama | Çalışma paketi | Aşama sonunda hazır olacak | Doğrulama |
| --- | --- | --- | --- |
| **1 — İçerik ve mevcut hatalar** | DOCX tablolarını düzelt; K kartlarını ve provayı ayır; kelime vurgusu/bionik/boyut ayarlarını düzelt. | Gerçek soru metinleri ve güvenilir okuma tercihleri. | Temsilî DOCX tablo satırları ile üretilen kayıtların eşleşmesi; 31 ders/129 blok kontrolü; eksik metin raporu; oynatıcı işlev testi. |
| **2 — Yeni görsel temel** | Tutarlı CSS değişkenleri, sade ana ekran, mobil menü, odak çalışma kabuğu. | Ana ekran, okuma ve tek görev ekranı için somut örnekler. | 360/768/1280 px ekranlar, %200 yakınlaştırma, kontrast ve klavye kontrolü. |
| **3 — Aşamalı çalışma ve kayıt** | Tüket/sindir ayrımı, tek görev ilerlemesi, eski veri geçişi ve tamamlanma kuralları. | Dersin doğru aşamasından devam edilen, veri kaybetmeyen çalışma. | Yenileme/geri dönüş/örnek cevabı açma senaryoları; kısmi ve tamamlanmış kayıt geçişi. |
| **4 — Türlere uygun araçlar** | C bağlantı listesi ve ağ görünümü, A eleştirisi, P çözüm, E/R ayrımı ve kanıt bankası. | Her bilgi türünün kendi çıktısı. | Örnek bir derste bütün mevcut türleri işleme, kaydetme ve yeniden açma. |
| **5 — Hatırlama ve prova** | Kaynaktaki K kartları, günlük tekrar takvimi, Y haritada gezinme ve G kanıt provası. | Günlük ve hafta sonu çalışmaları. | Doğru tarih hesapları, kaynaktaki ön/arka yüz eşleşmesi, E ve R'nin ayrı akışı. |
| **6 — İstatistik ve eşitleme** | Aşama bazlı ölçümler, haftalık özet, hata/çakışma durumları ve Supabase/GitHub bağlantılarını doğrulama. | Durumu anlaşılır, birden çok cihazda devam edilebilir kayıt. | Gerçek kullanıcı senaryosu; iki cihaz değişikliği; ağ kesintisi ve yeniden deneme; yedek geri yükleme. |
| **7 — Yayın ve son kontrol** | GitHub Pages iş akışı, içerik üretimi ve son sürüm kontrolü. | Yayınlanmış ve canlı adresinde kontrol edilmiş sürüm. | CI başarılı; canlı sitede ana ekran → okuma → sindirme → kayıt → tekrar akışı çalışıyor. |

Uygulanan bölüm: **1, 2, ana çalışma akışının 3. aşaması ve tekrar/prova işlerinin 5. aşaması**. Ek pakette çalışma/mola zamanlayıcısı, tekrar tarihi ve paragraf/block kaynak etiketli düzenlenebilir harita bağlantıları eklendi. Kod mevcut `v1` tarayıcı kaydına yeni alanlar ekler; cevaplar ve eski kayıtlar korunur. Serbest sürüklemeli ağ düzeni, gerçek iki cihaz yetkilendirme/eşitleme testi ve canlı kabul akışı ayrıca yapılmalı.

### İlk uygulamada teslim edilenler

- DOCX tablo ayrıştırıcısı E/R görev metnini, kaynak referanslarını, K kartlarını, bilgi profillerini ve G kanıt provasını ayrı JSON alanlarına üretiyor. Kanıt provası, normal blok görevlerinden ayrıldı.
- Ders ekranında Tüket ve Sindir adımları, görev başına ilerleme ve öz değerlendirme; yazarken aynı ekranda örnek cevabı açma/kopyalama; C bağlantı satırları ve canlı harita önizlemesi ile A analoji notları bulunuyor.
- Bionik görünüm, kelime vurgusu, kelime grubu, hız, yazı boyutu ve satır aralığı ayarları; son okuma konumu, cevaplar ve notlar mevcut yerel kayıt modelinde saklanıyor.
- Hazır referans kartları seçilip aralıklı tekrara ekleniyor. Kanıt provası ve kanıt havuzu ayrı gösteriliyor.
- Ana ekran, Tüket/Sindir süre özeti, ilerleme istatistikleri ve telefon alt menüsü sadeleştirildi. Kaynaklardaki 93 oturum sonu yansıtma sorusu ayrı kaydediliyor. Eşitleme birleştirmesinde yakın zamanda farklı düzenlenen metinler için seçim kartı eklendi.

### Henüz tamamlanmayanlar

- Harita bağlantıları satır tabanlı biçimde düzenlenebilir ve kaynak paragrafı etiketleri görünür. Serbest sürükleme ve otomatik grafik yerleşimi sonraki iş.
- Süre kaydı sekme görünürlüğü ve yakın etkileşim koşuluna dayanıyor; kesin odak süresi sayılmaz.
- Supabase istemci eşitlemesi ve RLS tablosu eklendi; canlı kimlik doğrulama testi bu çalışma ortamında Supabase yönetim araçları/API erişimi olmadığı için yapılamadı. Kullanıcı `supabase/setup.sql` dosyasını SQL Editor’da bir defa çalıştırmalı. Pages iş akışı `codex/study-app` dalını yayımlar.
- Chromium’da 360 px mobil genişlik, 180 CSS px dar görünüm (yaklaşık %200 yakınlaştırma), klavye ile ders açma ve temel çalışma akışları kontrol edildi. Canlı site ve cihazlar arası eşitleme son kontrolü ayrıca bekliyor.

## 9. Son kabul senaryosu

Kullanıcı bir derse girip metni kelime takibiyle okur, hızını ve yazı boyutunu değiştirir, bir kavram bağlantısı ekler ve sindirme aşamasına geçer. Bir görevde kendi cevabını yazıp örneği açar/kopyalar; yazdığı cevap korunur. Bir E/R bilgisini sınıflandırır, kanıtı saklar ve referans kartını tekrar listesine alır. Sayfayı kapatıp açınca aynı dersin aynı görevinden devam eder. Tamamlanma ve tekrar durumları birbirinden doğru ayrılır. Mobilde bütün sayfalara ulaşabilir ve yedeğini indirip geri yükleyebilir.

Bu senaryo doğrulanmadan yalnızca sayfa açılıyor diye sürüm tamamlanmış sayılmayacak. Cihazlar arası devam özelliği ayrıca gerçek yetkilendirme ve eşitleme testiyle doğrulanacak.

## 10. Sonraki paketlere bırakılan fikirler

Serbest sürüklemeli gelişmiş kavram haritası, metin seçimiyle ayrıntılı etiketleme, tarayıcı bildirimi, çevrimdışı uygulama kurulumu, sesli okuma ve sınav simülasyonu çekirdek akıştan sonra ele alınacak. Yapay zekâyla cevap puanlama ve belge dışında soru üretimi bu planın ilk sürüm kapsamına dahil değil.


### Tek ekranda sıralı çalışma — 14 Ekim 2026

Okuma, C/A not soruları, diğer blok soruları ve özet aynı çalışma alanında sırayla açılır.
Sayfa yerine aktif panel kayar; geri/devam düğmeleri ekranda kalır. Kaynak metin ve
hazır kavram haritası bu alanda açılır; kapatınca çalışılan soruya dönülür.
Oturum sonu Y soruları, değerlendirme soruları ve öz değerlendirme de tek tek ilerler.

C/A alanlarında belgedeki örnek cevap gösterilir ve kopyalanır; kendi cevap metni
değişmez. Serbest kavram/analoji notları korunmuştur. Ayrıştırıcı artık farklı
PACER analoji başlığını ve “Kendi analojin” görevini de okur; soru ile cevap anahtarı
farklı bloklarda bulunduğunda özgün konu başlığıyla eşleştirir. 348 C ve 570 A
görevinin kaynak cevabı vardır.

Özet otomatik blok tamamlamaz. Eksik görevler listelenir; okuma ve görevler bitince
blok tamamlanır, aksi halde sonraya bırakılabilir. Önceki görev kimlikleri, aktif
görev indeksi, cevaplar, serbest notlar ve kelime konumu değişmeden korunur.


Kontroller: 8 kaynak/içerik testi; 360×740, 768×900, 1280×900 ve yatay 844×390
boyutlarında okuma, not cevaplarını açma/kopyalama, geri/ileri, Ctrl+Enter,
yenileyip devam etme, blok özeti ve oturum sonu akışı. Ayrıca 320 px koyu tema,
kelime görünümü, ileri tarihe erteleme ve eksik görev kontrolü; yeni eklenen
analoji sorularında eski görev indeksinin korunması ve blok numarası sıralı
olmayan belgelerde cevap kaydedip doğru bloktan devam etme doğrulandı.


Serbest kavram ve analoji notlarına da ayrı “? Cevabı göster” ve kopyalama
düğmeleri eklendi. 129 bloğun cevap anahtarındaki özgün “Harita:” metni
kavram notlarında gösterilir; analoji örneği aynı not alanında açılır.
Örneği açmak/kopyalamak yazılan notu veya görev tamamlama durumunu değiştirmez.
360/1280 px ekranlarda göster/gizle, pano, not/imleç konumu ve yenileme sonrası
notların korunması; 9 kaynak/içerik testi doğrulandı.
