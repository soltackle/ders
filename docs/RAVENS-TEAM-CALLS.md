# Ravens · doğrulanan takım çağrıları

Numaralar MOST kaynağındaki 35 kartın sabit sırasıdır. Oyun isimleri değiştirilmedi. Kullanıcının verdiği çağrı, isimden veya önceki otomatik tahminden önceliklidir.

| No | Çağrı | Uygulanan OL görevi |
|---|---|---|
| 1,2,3,4,5,7,15,16,17,18,22,23,25,33 | Pas | Field dış blitz ALERT → FG → C; boundary adam adam. Kalabalık hatlarda big-on-big, RB ek tehdit, gerçek sayı fazlası QB hot gözetimi. |
| 6,8,20,24,27 | Field zone | Covered kendi DL’si; uncovered yalnız zone yönünde gerekiyorsa yardım, sonra veya doğrudan ikinci seviye. 6 başlangıçta outside, diğerleri inside; varyant değiştirilebilir. |
| 9 | Kaynak çizimi | Kullanıcı açıkça kaynak çiziminde bırakmayı seçti. Otomatik GT kuralı uygulanmaz. |
| 10 | Field QB rollout | FT–FG–C field slide; boundary G/T adam adam. QB’nin çizilmiş field açılışı korunur. |
| 11 | Speed option | Çizimdeki QB field açılışı ve RB pitch rayı; keep/pitch eğitim seçimi gerçek top takibine bağlıdır. |
| 12 | GT counter | Kaynak RG + RT sola pull; guard kenar/kick, tackle arkasından ikinci seviye. |
| 13 | GT counter | Kaynak LG + LT sağa pull; yarım bırakılmış arka hat yolu canlı hedefe kadar tamamlanır. |
| 14 | Dart | Kaynak boundary LT sağa, hattın arkasından pull/lead yapar. Field tackle kendi DL’sini korur; puller LB’ye çıkar. |
| 19,26 | 3-tech trap | Kaynak LG sağa trap, RG hedef DL’yi bypass edip ikinci seviyeye çıkar. Hedef, pull yönündeki gerçek 3-tech’tir. |
| 21 | Field screen pas · U | U screen pasın alıcısıdır. RG/RT kısa pas görünüşü sonrası gecikmeli field çıkışı ve eskort. Uzak iç LB için tekrar hattın içine koşulmaz. |
| 28 | Boundary CT counter | Kaynak C + RT sola; center kick/kenar, tackle wrap/ikinci seviye. H’nin ters fake yolu korunur; F başlangıç taşıyıcısı olarak gösterilir. |
| 29 | Çizime özel | LG sola, RG sağa karşıt dış pull. H/F sol akış ve Z motion/fake korunur; başlangıç taşıyıcı H’dir. Genel GT şemasıyla değiştirilmez. |
| 30 | Boundary GT counter | Kaynak RG + RT sola; pull ve down bloklar korunur. |
| 31 | Field zone + FG lead | Field guard tackle’ın arkasından pull/lead çıkar. Uygun DL düzeninde tackle guard’ın iç adamına down/pin, guard dış adama lead yapar; diğer OL zone kuralında kalır. |
| 32 | Pas + boundary guard wrap | Boundary guard tackle’ın arkasından dış adamı alır; tackle boşalan iç DL’yi devralır. İç combo partneri de yeni sorumluya bağlanır. |
| 34 | Field 5-tech trap | LG pull/trap, field tackle trap adamını bırakıp ikinci seviyeye bypass; field solsa roller aynalanır. |
| 35 | Tush push | OL alçak ve ileri drive; QB center arkasından surge; H/U/Y QB arkasında destek. Top QB’de kalır. |

## Paylaşım ve animasyon

Trap hedefi istenen teknik ve tarafta gerçekten yoksa başka savunmacı o teknikmiş gibi etiketlenmez; uyarı ve bölge/pull yolu gösterilir. Pull yapanın açtığı yerde kaynak down yollarıyla yerel adam paylaşımı hesaplanır; uzaktaki DL’ye bütün hattı geçen sahte eşleşme verilmez. Blok dışı savunmacılar açıkça gösterilir.

Çizilmiş kısa pull yolları korunarak open/run/gather/strike/hold aşamalarıyla canlı hedefe tamamlanır. Counter/Dart taşıyıcısı ilk çizilmiş fake/mesh adımlarından sonra çağrılan koridora devam eder. Başlangıç savunma koordinatları değiştirilmez; teknik/front/blitz seçimi yeni atama üretir.

Field/boundary değiştiğinde yönlü oyunların ofans dizilişi ve OL rol/yolları birlikte aynalanır. 12/13/19/26/29 için yön, kullanıcı tarafından çizime bağlandığından kaynak sağ/sol yönüdür. Dart’ta boundary, pull yapan tackle’ı belirtir; kaynakta sağa çekilen tackle, ters field’da aynalanmış rol/yolla çalışır.

## Açık eğitim seçimleri

Speed option otomatik savunma zekâsıyla pitch kararı vermez; keep/pitch seçimi sahadaki topun kimde olduğunu ve transferini değiştirir. Screen alıcısı, özel koşu taşıyıcısı ve devir zamanı değiştirilir. Bunlar takımın henüz belirtmediği kesin top okuması/mesh için görünür eğitim ayarlarıdır. Tush push taşıyıcısı QB’ye sabittir.

Çalışma, zaman tabanlı taktik/animasyon simülasyonudur; gerçek darbe, güç, tackle, top yakalama veya itiş fiziği çözmez. Kaynakta savunma bulunmadığı için çalışma front’u kullanılır. Uygulama olmayan takım kurallarını sessizce üretmez.
