# Field zone

Kullanıcının isteğiyle pas korumasından ayrı yeni field zone senaryosu eklendi. **Inside** ve **outside/stretch** seçilebilir. Takıma özel zone kuralları henüz tarif edilmediği için varsayılan davranış koç tarafından düzenlenebilir standart taslak olarak etiketlenir.

## Oyuncu paylaşımı

- Beş OL ile savunmanın DL’leri yanal konumlara göre, tüm DL’ler değerlendirilerek eşleştirilir. Slant/stunt ile temas noktasındaki konum değişimi hesaba katılır.
- DL’si olan OL adamını tutar. Önü açık OL, en fazla bir komşu asıl blokçunun DL’sine combo yardımcısı olur. Bir yardımcı ikinci bir yardımcıya bağlanmaz.
- Yakın bölgesinde aktif LB varsa yardımcı, kontrollü temas aşamasından sonra LB’ye çıkar. Asıl blokçu DL’de kalır. Yardımcı uzaktaki dış blitz uğruna bütün hattı geçmez.
- Backside OL cutoff yapar; outside ilk adımı daha geniştir ve playside omuza reach hedefler. İç zone daha kısa yanal adım ve ileri drive kullanır.
- QB snap/mesh/handoff ve fake, RB ise mesh/okuma/carry yapar. RB, koşu senaryosunda altıncı blokçu sayılmaz. Beşten fazla DL veya kapatılamayan LB’ler blok dışı takipçi olarak görünür; pas korumasındaki QB hot kuralı uygulanmaz.

## Savunma

3–4, 4–3, 5 DL + 2 LB ve 6 DL + 1 LB; sol/sağ/orta/iki dış blitz, blitz gösterme, manuel yerleşim ve teknik seçimi kullanılabilir. Front değişimi zone türünü ve genel reaksiyon ayarlarını korur. Blitz seçilmeyen LB’ler kendi koşu reaksiyonunu sürdürür.

DL: base/run-read, field slant, boundary slant, pinch, widen, twist/stunt. Twist, field tarafındaki iki uygun DL’nin kademeli yol değişimidir. LB: gap fit, field flow, scrape, sail, bait, hold. Oyuncu reaksiyonu genel ayardan önceliklidir; gerçek blitz niyeti aktif rush üretir, show/hold niyeti oyuncuyu sabit tutar. Manuel savunma yolları otomatik hesaplamayla silinmez. Başlangıçtaki DL koordinatları Oynat sırasında değiştirilmez.

## Koşucu ve zaman

Bang/bend/bounce elle seçilebilir. Otomatik seçim bu üç okuma çevresindeki koridorları hareketli blokçulara olan mesafeleriyle karşılaştırır. Savunmanın konumunu da dikkate alır; futbol zekâsı veya takıma özel RB kuralı iddiası taşımaz. Hiçbir koridorun açık olmadığı durumda taktik kararın koç tarafından değiştirilmesi gerekir. Engel aşma/tackle fiziği yoktur.

OL zone adımı öne gider; pas seti geri adımı kullanılmaz. Combo sonrasında ayrı climb, drive ve blok tutuş aşamaları vardır. Uzak oyuncuların yaklaşması hızlandırılmaz; hareket süresi uzar. RB yaklaşması 2.6 yard/s ile sınırlıdır. Normal hazır oyun eğitim hızında yaklaşık 16 saniye görünür; hız, tekrar, loop, zaman çizelgesi, POV ve fareyle baş kontrolü kullanılabilir. Top snap’ten QB’ye, mesh’ten sonra RB’ye bağlanır ve geri sarma tutarlıdır.

## Sınırlar ve doğrulama

Otomatik temel paylaşım standart covered/uncovered eğitim taslağıdır. Takımın Ace/Deuce/Trey iletişimi, TE/WR blokları, bütün stunt devirleri, özel LB fitleri, gerçek tackle ve güç fiziği tanımlı değildir. Özel yerleşimlerde olası yol çakışmaları analizde gösterilir.

Otomatik testler her iki zone türünü, iki hash yönünü, 3–4/4–3/5/6 DL ve tüm blitz seçeneklerini kapsar. Ayrıca DL/LB reaksiyonları, combo sahibi–yardımcı ayrımı, RB hızları, teknik seçimi, manuel yollar, kütüphane kaydı, panel seçimleri ve sahnedeki top konumu doğrulanır. DOM ve Three.js sahne hesapları GPU ekran görüntüsüyle yapılan görsel incelemenin yerini tutmaz.
