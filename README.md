# Maliye çalışma masası

KPSS A Maliye çalışma kâğıtlarını adım adım kullanmak için GitHub Pages üzerinde çalışan, tek kullanıcıya yönelik bir çalışma sitesi.

## Özellikler

- 31 P.A.C.E.R. dersi, 129 çalışma bloğu, kaynak paragrafları ve belge cevap anahtarları
- P / A / C / E / R görevlerine göre yapılandırılmış cevap alanları; örnek cevabı açma ve kopyalama
- Bionik vurgu, paragraf odağı ve kelime kelime okuma; hız, kelime grubu, vurgu, boyut ve duraklama tercihleri
- Otomatik cihaz kaydı, çalışma istatistikleri, ders sonu öz değerlendirme ve zamanlı tekrar kartları
- Kaynak paragrafına bağlı, düzenlenebilir kavram bağlantıları; ders sonu kaynak soruları ve Tüket/Sindir süre özeti
- 10/20/40 dakikalık veya özel çalışma oturumu, mola sayacı ve tarihli görev erteleme
- Opsiyonel GitHub özel depo eşitlemesi; Supabase veya uygulama sunucusu gerektirmez

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

## Kişisel ilerlemeyi GitHub'da saklama

İlerleme, yanıtlar ve okuma ayarları varsayılan olarak kullandığın tarayıcıda kaydedilir. Cihazlar arasında anahtar kopyalayıp yapıştırmadan eşitlemek için bir kez GitHub App kur:

1. GitHub hesabında örneğin `ders-ilerlemem` adlı **private** bir depo aç.
2. [Yeni GitHub App oluştur](https://github.com/settings/apps/new). Webhook kullanma; Repository permissions altında yalnızca **Contents: Read and write** izni seç. Oluşturduktan sonra app ayarlarından **Device Flow**’u etkinleştir.
3. **Install App** sayfasından app’i yalnızca `ders-ilerlemem` deposuna kur.
4. Sitede **Ayarlar → GitHub cihazlar arası eşitleme** bölümüne GitHub kullanıcı adını ve depo adını yazıp **GitHub ile yetkilendir**’e bas. App’in Client ID’si sitede önceden tanımlıdır. Gösterilen kodu GitHub cihaz yetkilendirme sayfasında onayla.
5. Diğer cihazlarda da kendi tarayıcılarının Ayarlar ekranından aynı işlemi yap.

Client ID gizli değildir; app erişimi yalnızca kurduğun depolar ve verdiğin içerik izniyle sınırlıdır. Yetkilendirme tokenı cihazın tarayıcı saklama alanında tutulur, kaynak koduna veya ilerleme deposuna yazılmaz. İstersen Ayarlar’da önceden oluşturduğun fine-grained tokenla bağlanma seçeneği de vardır. Bağlantı olmadan yerel çalışma ve dışa aktarma/geri yükleme kullanılabilir.
