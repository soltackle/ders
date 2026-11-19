# Saha AI

`player-ai.ts`, oyuncunun görevine ve gördüğü sahaya göre küçük kararlar veren deterministik bir oyun AI'sidir. Oyuncular aynı plan üzerinde algılama, hatırlama, karar ve hareket döngüsüyle çalışır. Dış servis, dil modeli veya API anahtarı kullanılmaz.

## Kontroller

Ravens sahasının üstündeki **Saha AI etkin** varsayılan olarak açıktır. Kapatmak önceki atama/rotaya bağlı oynatmayı kullanır. **Kararları göster**, seçili oyuncunun karar nedenini ve görülen/hatırlanan oyuncu sayısını HUD'a ekler. Bu görüntüleme tercihi fiziksel sonucu değiştirmez ve zamanı sıfırlamaz. Davranışı açmak/kapatmak yeni bir oynatma başlatır.

Tercihler `scenario.playerAI` içinde saklanır; oyun kartı değiştirme, JSON dışa aktarma/yükleme ve yerel kayıtla korunur. 9 numaralı kaynak çizimi, seçilmiş diagram modu, rakibin kaynak hareket modu ve otomatik oynatma kapalıyken AI uygulanmaz. Kaynak yolları ve manuel savunma yolu sahipliği korunur.

## Algı

Karar girdisi, fizik/temas çözümünden geçmiş gerçek konumlardan oluşur. Defansın eski üretilmiş takip yolları canlı hedef olarak kullanılmaz. Savunma AI'si yalnız kendi çağrı landmark'ını, görünür oyuncuları, görünür topu ve yerel teması kullanır; hücumun seçili pas hedefini veya gizli keep/pitch dalını okumaz.

- Temel tepki gecikmesi 0.25 sn; LB için 0.04, DB için 0.08 sn eklenir.
- Görüş açısı 140 derecedir. Baş/gövde yönü, hareket yönünden ayrı tutulur; geri açılan DB ve geri drop yapan QB sahaya bakar. Bakış, hatırlanan veya görülen koordinata dayanır; hedef kimliğiyle onun gizli güncel konumu sorgulanmaz.
- DL/LB/DB/OFF görüş mesafeleri sırasıyla 8/14/22/16 saha birimidir. Oyuncular basitleştirilmiş görüş örtüşmesi oluşturur; yüksekteki topun görüşü ayrıca değerlendirilir.
- Görsel hafıza 1.2 sn'dir. Kaybolan oyuncu yalnız son bilinen hızından en fazla 0.35 sn öngörülebilir; gizli yeni dönüşleri bilinmez.
- Yakın temas anlık, yerel ve yalnız temasa katılan oyuncular için hissedilir. Eski görsel bilgi yeni temas bilgisini geriye taşıyamaz.
- Kararlar yaklaşık 0.18 sn aralıkla yenilenir; koşucunun koridor seçiminde ek bekleme/histerezis vardır. Rastgelelik kullanılmaz.

## Rollere göre davranış

| Rol | Karar | Bağlayıcı sınır |
| --- | --- | --- |
| OL / blokçu RB | Atanmış adamın kaldıraç ve temasını aynalar | Başka yakın tehdide atlayıp kendi adamını bırakmaz; combo/climb hedefi mevcut atamayla değişir |
| Pull / wrap / screen çıkışı | Çağrılan arka hat yolunu izler | Open/run sırasında uzak hedefe bağlanmaz; source yol ve sıra korunur |
| QB | Görülen baskıya küçük pocket düzeltmesi, sahayı okuma | Hedef seçilmediyse topu tutar; pas hedefi/atış/option kararı kullanıcıda kalır |
| Taşıyıcı | Görülen savunma ve takım arkadaşları arasında yerel boşluk seçer | Çağrılan rotadan yerel sapma en fazla 0.65 birim; mesh zamanı korunur |
| Alıcı | Yakın jam'den küçük ayrılma ve rota takibi | Rota türü, yönü veya derinliği yeniden yazılmaz |
| DL / blitzer | Önce kendi rush hattı, sonra görülen QB/taşıyıcı; yakın temasta ellerle mücadele | Körlemesine gelecekteki pas hedefine veya görünmeyen güncel QB'ye koşmaz |
| LB | Görülen guard/puller, ileri run ve geri pas setini ayırır; görünür uçuşa kırılır | Mesh sonucu görünmeden taşıyıcıyı bilmez; kendi gap/hook alanını korur |
| CB / safety | Kendi alanında görülen rota akışı; görünür top/taşıyıcıya contain/rally | Kaynakta belirtilmeyen gerçek bir coverage çağrısı olduğu iddia edilmez |

Ofans düzeltmesi hareketin her adımında hedef koridora geri bağlanır; küçük bir yön tercihi zamanla sınırsız yana kaymaya dönüşmez. Defansın hareket niyeti gecikmiş canlı gözlemden gelir; yalnız eski çizilmiş takip yoluna küçük sapma eklenmez. Son hız, ivme, gövde ayrımı, saha sınırı ve tackle/sack sonucu fizik/temas katmanının yetkisindedir.

## Tekrar ve doğrulama

AI durumu her senaryonun sabit zaman adımlı oynatmasında tutulur. Kararlar ve duyusal bakış koordinatları geçmiş kareye kopyalanır; gelecekteki güncelleme eski kareyi değiştirmez. İleri atlama ve geri sarma aynı sonucu verir. Karar gösterimi sonucu değiştirmez.

Testler; gizli hedef/konum değişimlerine karşı aynı gecikmiş gözlemde aynı defans kararını, hafıza süresini, görüş örtüşmesini, temas katılımcılarını, örtülü hedefe bakış sızıntısını, kendi adamında kalmayı, pass-set/run okumasını, pull/mesh ve QB kararlarını denetler. Ayrıca fiziksel koridor, scriptsiz savunmacı, manuel yol yönü, backpedal görüşü, 35 oyun × 5 paket ilk canlı tepkileri ve yeniden oynatma kontrolleri vardır.

Bu sürüm yerel rol davranışları ve taktik eğitim içindir. Öğrenilmiş NFL oyuncu becerisi, serbest yeni oyun icadı, takım stratejisi planlama, penaltı/hakem, ragdoll veya ölçülmüş oyuncu gücü simülasyonu içermez. Kaynakta tanımlanmayan coverage ve özel takım kuralları otomatik olarak gerçek kabul edilmez.
