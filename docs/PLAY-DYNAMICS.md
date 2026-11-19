# Ravens pas ve temas davranışı

## Pas hedefi

Pas, rollout, boundary guard wrap ve field screen çağrılarında uygun alıcı seçilir. Hedefler mevcut oyunun rotalarından ve blok görevlerinden çıkarılır. QB/OL ve koruma görevindeki RB seçilemez. Inside/outside zone'a açık geçiş pas kontrollerini kapatır. Pas hedefi ve zamanı Ravens taslağı, senaryo JSON'u ve rakip paket seçimleriyle birlikte saklanır.

Çıkış penceresi snap sonrası QB hazırlığı, senaryo bitişi ve QB'nin LOS'u geçme zamanı ile sınırlanır. Hedef değişince geçerli zaman aralığı yeniden hesaplanır. Geçersiz/eski hedef temizlenir; pencere dışı zaman geçerli aralığa alınır. Hedef seçilmezse top QB'de kalır.

QB, takımın bildiği alıcı rotasına öne atış yapar. Atıştan sonra uçuş noktası değişmez. Savunmacının gelecekteki konumu atış çözümüne katılmaz. Top uçuşta hiçbir oyuncunun taşıdığı top olarak çizilmez; karşılamadan sonra alıcının eline bağlanır. Otomatik sonuç, geçen uçuş bölümündeki savunma temasını, alıcının sabit noktaya ulaşmasını ve yakın savunmayı kontrol eder. Eğitim için tamamlanan/eksik pas dalı ayrıca seçilebilir. Otomatik interception kararı üretilmez.

Savunma seçilen hedefi atıştan önce öğrenmez. Mevcut coverage görevi sürer; gözlenen atıştan ve tepki gecikmesinden sonra topa kırılır, karşılama sonrasında alıcıya rally yapar. Field screen kendi oyun yönünü ve eskort bloklarını korur. Pas hedefi değiştirmek blok paylaşımını veya kaynak alıcı rotalarını başka bir oyuna dönüştürmez.

## Temas ve ilerleme

`play-dynamics.ts`, tasarlanmış aksiyonları değiştirmeden antrenman görünümünün konumlarını üretir. Her 1/30 saniyede rota ilerlemesi, hız/ivme, yerel takım arkadaşına yol verme, gövde ayrımı ve temas çözülür. Aynı zaman sorgusu aynı konumu verir; ileri atlama, geri sarma ve tekrar aynı önbellek zaman çizelgesini kullanır.

Gövde yarıçapı 0.32 saha birimidir. Aynı takım ve karşı takım gövdeleri ayrılır; dar bir rota koridorundaki yerel kaçınma takım arkadaşlarının baş başa kilitlenmesini önler. Uzak `engage` bağlantıları fiziksel temasa dönüşmez. Açık alanda rol hızları ve ivme sınırlıdır. Blokçu ve savunmacı gerçekten yaklaştığında atamaları ve pull fazları kontrol edilir; open/run sırasında uzaktaki hedefe temas kurulmaz. Temaslı ikili birlikte sınırlı drive yapar, kaynak okunun bütün mesafesi savunmacıya dayatılmaz.

Taşıyıcıyla sürdürülen yakın temas oyunu durdurur. Pas çıkmadan QB arka alanda durdurulursa sack gösterilir. Pas uçuşunda QB artık taşıyıcı sayılmaz. Başarılı karşılama sonrası taşıyıcı alıcıdır. Oyunun bitişinde taşıyıcı durur, diğer oyuncular yavaşlar; top gelecekteki bir devir anına atlamaz. Saha sınırı gövde yarıçapını da içerir.

Ofans covered/uncovered, field ALERT ve big-on-big atamaları korunur. Bu katman animasyon sırasında ilerlemeyi temasla sınırlar. Tasarla modunda kaynak yolları ve düzenleme noktaları gösterilir. Kullanıcının kaynak çizimi olarak tuttuğu 9 numara ve rakip paketin kaynak hareket modu otomatik temas katmanına girmez.

Counter/Dart/trap ve 29 numaralı özel koşuda otomatik top devri, son carry segmentini beklemek yerine ilk iki saniyedeki yakın backfield mesh'e bağlanır. Çizimde böyle bir buluşma yoksa taşıyıcıya kısa ve hız sınırlı QB yaklaşması eklenir; sonraki kaynak fake/rota noktaları korunur. QB–taşıyıcı mesh sırasında birbirinden kaçınmaz; gövde ayrımı korunur ve diğer takım arkadaşları yer açar. Manuel devir zamanı `transferManual` ile saklanır. Ulaşılamayan taşıyıcıya saha boyunca handoff yapılmaz.

Counter/Dart/trap taşıyıcısı fake sonrası puller'ın temasını birkaç saniye sabit beklemez. Aynı çizilmiş koridorda kontrollü takip yapar; puller girişini tamamlayınca ileri carry bölümü başlar. Kaynak fake noktaları, blokçuların yolları ve hedef koridor korunur.

## Doğrulama ve sınırlar

Saf model testleri; gövde ayrımı, uzak bağlantı, blok direnci, takım arkadaşıyla rota kesişmesi, hız/ivme, saha sınırı, taşıyıcının durması, pas uçuşu/karşılama ve geri sarma tutarlılığını kapsar. 35 Ravens oyunu ve rakip paket kombinasyonları ayrıca kontrol edilir. Headless Chromium görüntüleri gerçek WebGL sahnesinde snap, temas ve oyun sonunu karşılaştırmak için alınır.

Bu yaklaşım taktik eğitim içindir. Momentum, güç ve top becerileri için ölçülmüş oyuncu verisi kullanılmaz. Otomatik tamamlanan/eksik pas ve tackle kararları geometrik eşiklerden oluşur; gerçek maç olasılığı veya hakem kararı olarak sunulmaz. 9 numaranın açıklanmamış takım kuralı ve kaynakta bulunmayan coverage çağrıları ayrıca varsayılmaz.
