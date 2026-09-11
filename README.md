# Quiz Shorts Otomasyonu

> **BU OTOMASYON IPTAL EDILDI (11 Eylul 2026).**
> Quiz paylasimlari kanalin goruntulenmelerini dusurdugu icin zamanlanmis
> uretim tamamen kaldirildi: GitHub Actions workflow'u, uretim script'leri
> (`produceQuiz.mjs`, `slotGuard.mjs`, `upload.mjs`, `makeSfx.mjs`) ve konu
> gecmisi dosyalari silindi. Format sifirdan yeniden tasarlanacak.
> Eski kod git gecmisinde duruyor: `git show c04dbfc`.
>
> Asagidaki dokumantasyon eski kuruluma aittir, artik gecerli degildir.

---

Türkçe YouTube Shorts için 3 soruluk bilgi testi videoları üretir ve kanala yükler.

Günde 4 video, tamamen otomatik, GitHub Actions üzerinde ücretsiz çalışır.
İstediğinde elle de çalıştırabilirsin.

---

## Ne üretiyor

```
Açılış kartı → SORU 1 → geri sayım → cevap → SORU 2 → ... → kapanış
```

- **Görüntünün tamamını Remotion çiziyor.** Stok video ya da yapay zekâ görseli
  kullanılmıyor; dolayısıyla "konuyla alakasız klip" diye bir sorun yok ve
  sonuç her çalıştırmada aynı kalitede çıkıyor. Dosya boyutu ~10 MB.
- **Ses:** soru ve cevaplar Edge TTS ile seslendiriliyor. Sürekli müzik yok;
  düşünme penceresinde tik-tak, süre dolunca çan çalıyor.
- **Kapanış:** kanal avatarı, kanal adı, yorum çağrısı, beğen/abone butonları.
- Süre ~40 saniye. Her sorunun ekran süresi kendi seslendirmesinden hesaplanıyor.

---

## Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

`esbuild` kurulum scripti için onay isterse:

```bash
npm approve-scripts esbuild
```

### 2. Ayarlar

`.env.example` dosyasını `.env` olarak kopyala ve doldur:

| Anahtar | Nereden alınır | Ücret |
|---|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Ücretsiz |
| `YT_CLIENT_ID` / `YT_CLIENT_SECRET` | Google Cloud Console → OAuth client (Desktop) | Ücretsiz |

Edge TTS anahtar istemiyor.

### 3. YouTube izni (tek seferlik)

```bash
npm run youtube-auth
```

Tarayıcı açılır, kanalın sahibi hesapla onay verirsin, `token.json` oluşur.

---

## Elle çalıştırma

```bash
npm run quiz
```

Video üretir ve **kanala yükler.**

```bash
npm run quiz:test
```

Üretir ama **yüklemez** — `out/quiz.mp4` içine yazar. Yayınlamadan önce
görmek istediğinde bunu kullan.

Terminal açmak istemezsen klasördeki `.bat` dosyalarına çift tıklayabilirsin:
**Quiz Yayinla.bat** ve **Quiz Test Et (yuklemez).bat**

Kompozisyonu canlı düzenlemek için:

```bash
npm run preview
```

---

## Otomatik yayın (GitHub Actions)

Workflow günde 4 kez video çıkarır. Saatler Türkiye saatine göre en yüksek
etkileşim pencerelerine yerleştirildi:

| TRT | Neden |
|---|---|
| 13:17 | Öğle arası zirvesi |
| 16:23 | Okul/iş çıkışı |
| 19:17 | Akşam zirvesi |
| 21:37 | Gece öncesi son dilim |

### Repo ayarları

**Settings → Secrets and variables → Actions → Secrets** altına ekle:

```
GEMINI_API_KEY
GEMINI_MODEL
EDGE_TTS_VOICE
EDGE_TTS_RATE
YT_CLIENT_ID
YT_CLIENT_SECRET
YT_REDIRECT_URI
YT_PRIVACY_STATUS
YT_TOKEN_JSON      <- token.json dosyasinin TUM icerigi
```

İstersen **Variables** sekmesine `CHANNEL_NAME` ekleyebilirsin (varsayılan: Fokus).

İlk denemeyi Actions sekmesinden **Run workflow** ile elle tetikle.

### Zamanlama neden böyle kurulu

GitHub Actions'ın zamanlanmış işleri garanti değil — kendi belgelerinde
"yoğunluk dönemlerinde gecikebilir veya çalışmayabilir" yazıyor.

Bu yüzden tek bir cron'a güvenilmiyor: cron her 20 dakikada bir yokluyor,
asıl kararı `scripts/slotGuard.mjs` veriyor. Bekçi geçmiş slotlardan
yayınlanmamış olan var mı diye bakar; yoksa iş ~20 saniyede biter, varsa
pipeline çalışır. Böylece GitHub tetiklemelerin çoğunu düşürse bile slottan
sonraki ilk başarılı yoklamada video çıkar, ve aynı slot için ikinci kez çıkmaz.

---

## Doğruluk denetimi

Sorular yapay zekâ üretiyor, ama **doğrudan yayına gitmiyorlar.**

Her soru üretildikten sonra, doğru cevabın ne olduğu **söylenmeden** modele
yeniden soruluyor. Üç bağımsız örnek alınıyor ve her biri model zincirinde
farklı bir noktadan başlıyor — aynı modele üç kez sormak bağımsız kontrol
sayılmaz, aynı hatayı üç kez tekrarlar.

Bir sorunun videoya girmesi için:

- üç örnek de **aynı** şıkkı seçmeli
- seçilen şık, soruda işaretli cevapla eşleşmeli
- hiçbiri soruyu "tartışmalı" işaretlememeli
- hiçbiri "emin değilim" dememeli

Geçemeyen soru eleniyor ve yerine yenisi üretiliyor. Üç doğrulanmış soru
toplanamazsa **video hiç üretilmiyor** — yanlış bilgi yayınlamaktansa o gün
video çıkmasın.

Terminalde şöyle görünür:

```
[teknoloji] Televizyon ekranı silerken ne kullanılmalı? → A) Mikrofiber bez ... ✓ 3/3 doğrulandı
[araba] Araba lastiği üzerindeki harfler neyi ifade eder? → C) Hız sınırını ... ✗ ELENDİ: doğrulayıcılar B dedi
```

Biçim denetimleri de var: 3 şık zorunlu, şık en fazla 4 kelime, cevap anlatımı
en fazla 10 kelime, üç soru üç **farklı alandan**, "hiçbiri/hepsi" gibi kaçamak
şık yasak.

Şıkları **kod karıştırıyor** (Fisher-Yates). Modelden "doğru şıkkın yerini
değiştir" istemek güvenilir değil; doğru cevabı ilk şık yazma eğilimi o kadar
güçlü ki denetimi tamamen bloke ediyordu.

Ekrandaki metnin **aynısı** seslendiriliyor; okuduğunla duyduğun ayrışamıyor.

### Yine de %100 değil

Doğrulama modelin kendi bilgisine dayanıyor. Üç örneğin de aynı şekilde
yanıldığı bir konu teorik olarak geçebilir. Gözüne takılan bir hata olursa
YouTube Studio'dan videoyu silebilirsin.

---

## İçerik ayarları

Kitle ve konu ağırlığı `scripts/produceQuiz.mjs` içindeki istemde tanımlı:
konular günlük hayattan, ağırlık araba / teknoloji / alet-tamir / spor /
tarih / bilim / para / doğa alanlarında, mutfak-temizlik üç soruda en fazla
bir kez. Yabancı özel ad kullanılmıyor.

Süre ayarları aynı dosyanın başında:

| Sabit | Ne yapar |
|---|---|
| `DUSUNME_SANIYE` | Soru okunduktan sonra düşünme payı (3.5 sn) |
| `HEDEF_SORU` | Video başına soru sayısı (3) |
| `MIN_SORU` | Bu sayının altına düşülürse video üretilmez (3) |
| `MAX_TUR` | Doğrulanmış soru toplamak için en fazla kaç tur (6) |

---

## Sorun çıkarsa

**"Yeterli DOĞRULANMIŞ soru üretilemedi"** — doğrulayıcılar üst üste sorulara
itiraz etti. Tekrar çalıştır; bu bir hata değil, koruma çalışıyor demek.

**Gemini 503** — ücretsiz katmanda yoğunluk. Script yedek modellere kendisi
geçiyor; hepsi doluysa birkaç dakika sonra dene.

**Yükleme yetkisi hatası** — `token.json` süresi dolmuş olabilir.
`npm run youtube-auth` ile yenile ve Actions'taki `YT_TOKEN_JSON` secret'ını
güncelle.

**Elle ve otomatik aynı anda** — ikisi de aynı kanala yükler. Elle
çalıştırdığın gün otomatik slotlardan biriyle çakışırsa arka arkaya iki video
çıkar; bu, videoların gösterim havuzunu bölüştürür.
