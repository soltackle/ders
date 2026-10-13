# Maliye çalışma masası

KPSS A Maliye çalışma kâğıtlarını adım adım kullanmak için GitHub Pages üzerinde çalışan, tek kullanıcıya yönelik bir çalışma sitesi.

## Özellikler

- 31 P.A.C.E.R. dersi, 129 çalışma bloğu, kaynak paragrafları ve belge cevap anahtarları
- P / A / C / E / R görevlerine göre yapılandırılmış cevap alanları; örnek cevabı açma ve kopyalama
- Bionik vurgu, paragraf odağı ve kelime kelime okuma; hız, kelime grubu, vurgu, boyut ve duraklama tercihleri
- Otomatik cihaz kaydı, çalışma istatistikleri, ders sonu öz değerlendirme ve zamanlı tekrar kartları
- Opsiyonel GitHub özel depo eşitlemesi; Supabase veya uygulama sunucusu gerektirmez

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

`master` veya `codex/study-app` dalına ders, site ya da içerik betiği değişikliği geldiğinde `.github/workflows/publish-pages.yml` siteyi üretip GitHub Pages'e yayımlar. Depoda **Settings → Pages → Build and deployment → Source: GitHub Actions** ayarı seçili olmalıdır. Yayın adresi GitHub Actions tamamlandığında iş akışındaki deployment çıktısında görünür.

## Kişisel ilerlemeyi GitHub'da saklama

İlerleme, yanıtlar ve okuma ayarları varsayılan olarak kullandığın tarayıcıda kaydedilir. Cihazlar arasında eşitlemek istersen:

1. GitHub hesabında örneğin `ders-ilerlemem` adlı **private** bir depo aç.
2. Fine-grained personal access token oluştur; yalnızca bu depoyu seç ve **Contents: Read and write** izni ver.
3. Site → **Ayarlar** ekranında GitHub kullanıcı adını, özel depo adını ve tokenı bir kez gir.
4. Diğer cihazlarda da kendi tarayıcılarının Ayarlar ekranından aynı depoya bağlan.

Token her tarayıcının yerel saklama alanında durur, uygulama kaynak koduna veya ilerleme deposuna yazılmaz. Token süresi biterse yeni bir tokenla bağlantıyı yenileyebilirsin. Bağlantı olmadan yerel çalışma ve dışa aktarma/geri yükleme kullanılabilir.
