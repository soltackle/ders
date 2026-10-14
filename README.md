# Maliye çalışma masası

KPSS A Maliye çalışma kâğıtlarını adım adım kullanmak için GitHub Pages üzerinde çalışan, tek kullanıcıya yönelik bir çalışma sitesi.

## Özellikler

- 31 P.A.C.E.R. dersi, 129 çalışma bloğu, kaynak paragrafları ve belge cevap anahtarları
- P / A / C / E / R görevlerine göre yapılandırılmış cevap alanları; örnek cevabı açma ve kopyalama
- Bionik vurgu, paragraf odağı ve kelime kelime okuma; hız, kelime grubu, vurgu, boyut ve duraklama tercihleri
- Otomatik cihaz kaydı, çalışma istatistikleri, ders sonu öz değerlendirme ve zamanlı tekrar kartları
- Kaynak paragrafına bağlı, düzenlenebilir kavram bağlantıları; ders sonu kaynak soruları ve Tüket/Sindir süre özeti
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
