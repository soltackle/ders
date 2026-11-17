# Takım pas koruması — ilk ofans şablonu

## Kullanım

1. Sol menüde **Takım pas koruması · otomatik** seçin. Tasarla / 2D tahta açılır.
2. Takım pas koruması panelinden 3, 4 veya 5 DL başlangıç front’unu seçin. Bu düğmeler savunmayı yeniler; daha sonra oyuncuları istediğiniz tekniklere sürükleyin.
3. Bir LB / savunmacı seçip oyuncu panelindeki `intent` alanını kaydedin: `auto` yerleşim/manuel hareket, `blitz` gerçek blitz, `show` sadece blitz gösterme, `hold` bekleme. `auto` LB LOS’un 1.8 yard yakınına geldiğinde tehdit sayılır; derindeki LB izlenir, kendiliğinden blitz yaptırılmaz.
4. RB varsa kutuyu işaretleyin; yoksa kaldırın. Topun hash’i field/boundary’yi belirler; ortada field yönü elle seçilir.
5. **Oynat** atamaları o anki yerleşimden yeniden üretir ve korumayı baştan sona oynatır. **Sonraki** adım adım izletir. Oyuncu notu ve HUD kimin kimi aldığını gösterir. **Atamaları hesapla** animasyonu başlatmadan atama listesini açar.

## Takım kuralı

- Dış **field** blitz gösterilirse FT tehdide kayar ve **ALERT** çağırır. FG tackle’ın DL’ine, C guard’ın DL’ine geçer. Boundary tarafı kendi adam paylaşımında kalır. Field soldaysa zincir aynalanır.
- Dış **boundary** blitz OL hedefi yapılmaz. RB varsa RB pickup yapar. RB yoksa QB hot tehdidi gözetir; QB’nin gözetmesi blok sayılmaz.
- **İç tehditte** C guard’larla LB kimliğini paylaşır. Uygun 1-tech eşleşmesinde C ilgili guard ile combo yapar ve arkadaki LB’yi gözetir. Gerçek iç blitz’te C LB’ye çıkar, guard DL’de kalır. Sadece gösteren LB’ye otomatik çıkılmaz.
- **3/4/5 DL** için temel DL paylaşımı konuma göre tekil eşleşmeyle kurulur. Serbest OL yardım edebilir; bir DL’nin yanlışlıkla iki ayrı bağımsız man bloğu olması önlenir. Combo açıkça işaretlenir.

## Uygulama kararları ve sınırlar

- 1-tech yoksa var olan DL eşleşmesi korunur; serbest C iç tehdidi alır. 1-tech combo’su için guard başka DL’ye mecbursa, o DL sessizce boş bırakılmaz; uyarı gösterilir.
- 5 DL + dış field blitz gibi sayı fazlasında, kural zincirinin açık bıraktığı rusher belirtilir. Uygulama beş OL’un altı adamı bloke ettiğini iddia etmez veya tanımlanmamış RB iç-yardım kuralı eklemez.
- Birden fazla ek dış tehdit varsa ilk dış tehdit alınır; diğerleri açık rusher uyarısında yer alır.
- Savunma oyuncularının yazar tarafından girilen başlangıç konumları korunur. Manuel savunma yolları `auto` niyetinde korunur; `show`/`hold` bunları bastırır. Önceki otomatik yollar sonraki hesaplamada yeniden üretilir.
- Bu şablon yerel ve deterministiktir; AI anahtarı gerektirmez. Fizik motoru değildir, atama ve hareket öğreticisidir.
