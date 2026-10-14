# Maliye çalışma masası

KPSS A Maliye çalışma kâğıtlarını adım adım kullanmak için GitHub Pages üzerinde çalışan, tek kullanıcıya yönelik bir çalışma sitesi.

## Özellikler

- 31 P.A.C.E.R. dersi, 129 çalışma bloğu, kaynak paragrafları ve belge cevap anahtarları
- Tek çalışma ekranında okuma → kendi notların → sorular → blok özeti; sabit geri/devam düğmeleri ve adımından devam
- 348 kavram ve 570 analoji/not görevinde belgedeki örnek cevabı yazarken açma ve kopyalama; P / E / R cevap alanları
- Metin üzerinde ilerleyen kelime vurgusu ve ortada kelime gösterimi; her iki görünümde oynat/durdur, hız, konum seçme ve kaldığın kelimeden devam
- Bionik vurgu, paragraf odağı, otomatik kaydırma ve hareket azaltma; kelime grubu, yazı boyutu ve duraklama tercihleri
- Sıcak açık zemin ve dengeli koyu tema; derslerde varsayılan odak görünümü, açılır okuma seçenekleri ve rahat metin genişliği
- Otomatik cihaz kaydı, çalışma istatistikleri, ders sonu öz değerlendirme ve zamanlı tekrar kartları
- 31 dersin Y cevap anahtarlarından hazırlanmış 93 otomatik kavram haritası; adlandırılmış ilişkiler, otomatik yerleşim ve kaynak açıklaması
- Kaynak paragrafına bağlı kişisel kavram bağlantıları ve analoji notları; ders sonu kaynak soruları ve Tüket/Sindir süre özeti
- 10/20/40 dakikalık veya özel çalışma oturumu, mola sayacı ve tarihli görev erteleme
- Supabase e-posta hesabıyla cihazlar arası ilerleme eşitlemesi; GitHub özel depo eşitlemesi alternatif olarak durur

Uygulanan kapsam ve sıradaki işler: [P.A.C.E.R. geliştirme planı](docs/pacer-gelistirme-plani.md).

## Yerel çalıştırma

```bash
python3 scripts/build_content.py
python3 -m http.server --directory site 8000
```

Tarayıcıda `http://localhost:8000` adresini aç.

## Güncel kaynaklardan içerik üretme

Sitedeki `site/data/courses.json`, `maliye/*.docx` dosyalarından oluşturulur:

```bash
python3 scripts/build_content.py
```

Betik Python standart kütüphanesini kullanır; uygulama paketleri yüklenmez.

## Kavram haritaları ve kontroller

`scripts/concept_maps.json`, DOCX belgelerindeki Y cevapları incelenerek
hazırlanmış kavram ve ilişki etiketlerini içerir. Her yol kendi Y cevap
kimliğine bağlıdır; kaynak cevap değişirse içerik üretimi durur. Böyle bir
değişiklikte ilgili bağlantıları kaynak cevaba göre inceleyip `_source`
SHA256 değerini gözden geçirilen cevapla güncelle. Cevabı bulunmayan
açık uçlu Y görevleri için hazır harita üretilmez.

Tarayıcı haritayı yerel Dagre dosyasıyla otomatik yerleştirir. Büyük haritalar
kendi panelinde kaydırılabilir; kaynak açıklaması ve bağlantı listesi de
haritanın altında bulunur. Kişisel harita notları ayrı saklanır.

Kaynak eşleşmesi, ok yönleri, eksik bağlantılar ve döngüler:

```bash
python3 scripts/test_build_content.py
```

GitHub Pages yayını bu kontrolleri çalıştırır. Ders verisi, CSS, JavaScript
ve grafik yerleşim dosyası aynı yayın sürümüyle yüklenir.

## GitHub Pages

`codex/study-app` dalına ders, site ya da içerik betiği değişikliği geldiğinde `.github/workflows/publish-pages.yml` siteyi üretip GitHub Pages'e yayımlar. Bu depo için Pages ortamı bu dalı kabul ediyor. Depoda **Settings → Pages → Build and deployment → Source: GitHub Actions** ayarı seçili olmalıdır. Yayın adresi GitHub Actions tamamlandığında iş akışındaki deployment çıktısında görünür.

## Supabase ile cihazlar arası ilerleme kaydı

İlerleme önce bu tarayıcıya kaydolur. Supabase hesabına giriş yaptığında yerel kayıt hesapla birleştirilir ve diğer cihazlarda aynı e-posta/şifreyle devam edebilirsin. Site yalnızca Supabase publishable anahtarını kullanır; kullanıcı verisini korumak için veritabanı erişimi oturum açmış kullanıcıya ve RLS kurallarına bağlıdır.

Supabase projesinde bir defa:

1. **SQL Editor → New query** bölümünde [`supabase/setup.sql`](supabase/setup.sql) içeriğini çalıştır.
2. **Authentication → URL Configuration** içinde Site URL’yi `https://soltackle.github.io/ders/` yap ve Redirect URLs listesine `https://soltackle.github.io/ders/**` ekle.
3. Email provider açık kalsın. Sitede **Ayarlar → Supabase cihazlar arası kayıt** bölümünden hesap oluştur; gerekiyorsa e-postanı doğrula. Diğer cihazda aynı hesapla giriş yap.

Mevcut bu cihaz kaydı, ilk girişte Supabase hesabına aktarılır. İlerleme yerelde de kalır; bağlantı yoksa çalışmaya devam edebilirsin. `service_role` anahtarı siteye konmaz.

## GitHub eşitlemesi (alternatif)

GitHub App ile özel ilerleme deposu kullanmak istersen bu seçenek de Ayarlar’da duruyor:

1. GitHub hesabında örneğin `ders-ilerlemem` adlı **private** bir depo aç.
2. [Yeni GitHub App oluştur](https://github.com/settings/apps/new). Webhook kullanma; Repository permissions altında yalnızca **Contents: Read and write** izni seç. Oluşturduktan sonra app ayarlarından **Device Flow**’u etkinleştir.
3. **Install App** sayfasından app’i yalnızca `ders-ilerlemem` deposuna kur.
4. Sitede **Ayarlar → GitHub cihazlar arası eşitleme** bölümünden GitHub kullanıcı adını ve depo adını girip yetkilendir.
