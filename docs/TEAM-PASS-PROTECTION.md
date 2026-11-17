# Takım pas koruması

## Saha ve savunma seçenekleri

- **3–4:** 3 DL + 4 LB.
- **4–3:** 4 DL + 3 LB.
- **5 kişilik hat:** 5 DL + 2 LB başlangıcı.
- **6 kişilik hat:** 6 DL + 1 LB başlangıcı.

Diziliş seçimi hazır DL/LB yerleşimini yükler; sonra oyuncuları istediğiniz tekniklere sürükleyin. Seçilmiş sağ/sol/orta veya iki dış blitz yeni front’ta korunur. Blitz düğmeleri DL konumlarını değiştirmez. İki dış blitz için LB sayısı yetersizse ikinci LB eklenir; tabloda gerçek personel ve tehdit sayısı gösterilir.

Hash, field/boundary yönünü belirler. Orta hash’te field yönü elle seçilir. Sağ/sol hücumun kendi bakış açısına göredir.

Oyuncu niyeti: `auto` yerleşime/manuel yola göre; `blitz` gerçek blitz; `show` yalnız gösterme; `hold` bekleme. Otomatik LB LOS’un 1.8 yard yakınına geldiğinde tehdit sayılır. Derindeki LB kendiliğinden blitz yapmaz. RB kutusu arka alandaki blokçuyu ekler/kaldırır.

## Adam paylaşımı — öncelik sırası

1. Boundary guard ve tackle’ın kendi taraflarındaki DL’leri önce eşleştirilir. Bu eşleşmeler field kayması için tekrar dağıtılmaz.
2. Kalan DL’ler C / field guard / field tackle ve serbest blokçulara konumlarına göre paylaşılır. Fazladan DL varsa ilk beşi alıp sonuncuyu yok saymak yerine tüm DL’ler değerlendirilir.
3. Seçilen koruma kuralı uygulanır. Eksik atama veya gerçek sayı fazlası tabloda açıkça görünür. QB’nin gözetimi blok değildir.

### Normal field dış blitz

Daha hafif front’ta FT dış field tehdidine kayar ve **ALERT** çağırır. FG tackle’ın DL’sine, C field guard’ın DL’sine geçer. **Boundary guard ve tackle kendi DL’lerini bırakmaz.** C’nin field tarafında alacağı iç DL yoksa dış DE’ye kadar koşmaz; field A-gap bölgesini veya gelen iç tehdidi kontrol eder.

Varsayılan 4–3 + sağ field blitz örneği:

| Blokçu | Sorumluluk |
|---|---|
| LT | DL1 · boundary man |
| LG | DL2 · boundary man |
| C | DL3 · field slide |
| RG | DL4 · field slide |
| RT | SAM · dış field blitz, ALERT |

Field soldaysa kural aynalanır. Sağ/sol saha ismine sabitlenmez.

### Boundary dış blitz

Normal kuralda OL bu tehdide dokunmaz. RB varsa karşılar; RB yoksa QB hot tehdidini gözetir. Field ve boundary’den birlikte gelen baskıda field zinciri ve RB görevi birlikte uygulanır.

### İç blitz ve C–guard iletişimi

C guard’larla LB kimliğini paylaşır. Uygun 1-tech eşleşmesinde C ilgili guard ile combo yapar ve LB’yi gözetir. Gerçek iç blitz’te C ayrılır, guard 1-tech’te kalır. C veya guard başka bir DL’ye bağlıysa o DL boş bırakılarak combo yapılmaz. Serbest blokçu kendi bölgesindeki ek iç tehdidi alır. RB altı kişilik korumada kalan iç/field tehdidini de tamamlar.

### Big-on-big — kalabalık 5/6 DL hatları

5 veya daha fazla DL bulunan hatta en az altı tehdit olduğunda **BIG ON BIG** uygulanır:

- OL kendi bölgesindeki DL’yi başka blitz uğruna bırakmaz.
- Serbest OL ve RB önce sahipsiz DL’leri, ardından ek LB/rusher’ları bölgelerine göre paylaşır.
- **5 DL + 1 LB:** beş OL DL’lerde, RB ek LB’de.
- **6 DL:** beş OL beş DL’de, RB altıncı DL’de. Altıncı DL listeden düşmez.
- **6 DL, RB yok:** beş DL bloke edilir; bir gerçek serbest rusher QB hot/gözetiminde gösterilir.
- **6 DL + 1 gerçek LB blitz:** OL + RB altı kişiyi paylaşır, yedinci tehdit açıkça gösterilir.
- **6 DL + 2 gerçek LB blitz:** sekiz tehdit vardır; altı blokçu ile iki kişi serbest kalır. İkisi de tabloda ve QB notunda görünür.

Bir LB yalnız gösteriyorsa gerçek rusher sayılmaz; açık bir DL bırakılıp RB’nin yalnız blöfe gitmesi önlenir. Daha hafif 3–4 / 4–3 front’larda klasik field zinciri ve C–guard ID korunur; altı kişilik korumada RB ek iç/field tehdidini tamamlar.

## Görünür dağılım ve oynatma

Sahanın altındaki **Adam paylaşımı** tablosu, Oynat’a basmadan da her DL/LB’nin sorumlusunu gösterir. Boundary eşleşmeleri ayrıca işaretlidir. Combo sonrası LB’ye çıkış ve QB’nin yalnız gözetmesi açıkça yazılır. Gerçek serbest rusher turuncu HOT satırıdır.

**Oynat** mevcut yerleşimden korumayı hesaplar ve tüm aşamaları oynatır. **Sonraki** adım adım izletir. Oyuncuyu seçerek notunu ve POV’ını inceleyin. Kayıtlı savunma konumları korunur; eski otomatik hareketler her hesaplamada yeniden üretilir.

## Tempo ve animasyon

İlk açılışta **0.5× Eğitim** seçilir. 0.25× / 0.75× / 1× / 1.5× de kullanılabilir; tercih saklanır. Yol uzadıkça süre uzar; RB sabit kısa sürede uzun mesafeyi koşmaz. Otomatik RB tepe hızı senaryo zamanında en fazla 3 yard/sn olacak şekilde hesaplanır.

OL kick–slide–square sonrası temas ve anchor/blokta kalma yapar. Gövde geri hareket ederken savunmaya dönük kalır. RB kontrollü yaklaşır, gather yapıp blokta kalır. İç pickup’ta RB’nin temas noktası OL’un arkasında tutulur. Loop tüm oyunu ID aşamasından tekrarlar; bitişte Oynat yeniden başlatır.

## Kontrol sınırı

Bu araç fizik motoru değil, takım kuralına göre atama ve hareket öğreticisidir. Hazır front/blitz kombinasyonları için atama, sayı fazlası, hız ve yaklaşık çakışma kontrolleri testlidir. Elle çizilmiş olağandışı yollar antrenör tarafından doğrulanmalıdır. Paylaşılan tarayıcı açılamadığında GPU görüntüsü ve kullanıcı etkileşimi görsel olarak doğrulanmış sayılmaz.

## Oyuncu POV / baş kontrolü

POV göz hizası seçili modelin başına bağlıdır. Yatay görüş açısı başlangıçta 100°; panelden 80–115° arası ayarlanır, dikey açı ekran oranına göre sınırlanır. Kalın kask çerçevesi yerine hafif kenar gölgesi kullanılır.

Sahada fareyi basılı tutup sürükleyerek veya dokunmatik ekranda sürükleyerek başı çevirin. **Fareyle serbest bakış** imleci kilitler; fare hareketi doğrudan bakışı kontrol eder, Escape kilitten çıkar. Desteklenmezse sürükleme kullanılabilir. **R** veya **Bakışı sıfırla** öğretici hedef bakışına döner. Başka oyuncu seçildiğinde bakış sıfırlanır. Oyuncunun görevi, blok yönü ve elleri baş hareketinden bağımsızdır.
