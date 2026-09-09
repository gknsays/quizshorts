// scripts/slotGuard.mjs
// "Simdi video hazirlanmali mi, hazirlanirsa kacta yayinlanmali?" sorusunu
// cevaplayan bekci.
//
// SORUN NEYDI?
// GitHub Actions'in zamanlanmis isleri ne garanti ne de dakikinde calisir.
// Olculen gercek davranis (8 Eylul 2026) tetiklemelerin saatlerce GECIKMELI
// geldigi, bir kismininsa hic gelmedigi yonunde. Yayin saatini "isin calistigi
// an"a bagladigin surece bu gecikmeyi yenmenin yolu yok: eski tasarimda
// tetikleme telafi penceresi kapandiktan sonra geliyor, bekci "bekleyen slot
// yok" deyip is saniyeler icinde bitiyordu. Calistirmalar yesil gorunuyordu
// ama gun boyu tek video cikmiyordu.
//
// COZUM: yayin saatini tetiklemeden AYIRMAK.
// Video hedef saatten saatler once uretiliyor ve YouTube'a "private +
// publishAt" ile yukleniyor. Yayina alma isini YouTube yapiyor ve dakikasi
// dakikasina yapiyor. GitHub isi gece 02:00'de de calistirsa 06:40'ta da
// calistirsa, video TRT 07:00'de yayina giriyor.
//
// Kullanim:
//   node scripts/slotGuard.mjs check   -> GITHUB_OUTPUT'a should_run / slot / publish_at yazar
//   node scripts/slotGuard.mjs done    -> yayinlanan hedefi isler

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const STATE_FILE = path.join(DATA_DIR, "slots.json");

// Turkiye 2016'dan beri yaz saati uygulamiyor; TRT butun yil UTC+3.
const TRT_OFFSET = 3;

// YAYIN SAATLERI (TRT). Video tam bu saatlerde izleyiciye acilir.
//
// Kanalda IKI AYRI NIS donusumlu yayinlaniyor, saatler boyle bolundu:
//   TRT 07:00  quiz         <- BU DEPO
//   TRT 11:00  pratik bilgi (gknsays/shorts deposu)
//   TRT 14:00  quiz         <- BU DEPO
//   TRT 17:00  pratik bilgi (gknsays/shorts deposu)
//   TRT 19:30  quiz         <- BU DEPO
const YAYIN_SAATLERI = ["07:00", "14:00", "19:30"];

// Video, yayin saatinden en fazla bu kadar once uretilmeye baslanir. Genis
// tutuluyor: GitHub tetiklemeleri saatlerce gecikebildigi icin hedeften once
// ise yarayan bir tetikleme yakalama sansini bu belirliyor.
//
// 8 saat ozellikle 07:00 yayini icin kritik: uretim penceresi bir onceki aksam
// TRT 23:00'te aciliyor, yani sabahki video gece boyunca hazirlanabiliyor.
// Bu yuzden bekci GUN SINIRINI ASABILIYOR - hedefler "bugune" degil, kendi
// tarihlerine bagli.
const HAZIRLIK_SAATI = 8;

// Yayin saati gectigi halde video hala uretilmemisse (GitHub o pencerede hic
// tetikleme gondermediyse) bu sure boyunca hala uretilir - ama artik
// zamanlanmadan, DOGRUDAN yayinlanir. Bunun otesinde o yayin dusurulur:
// gece yarisi sabah videosunu atmanin anlami yok.
const GECIKME_TOLERANSI_SAAT = 3;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  // Gecmis gunleri sonsuza kadar tutmaya gerek yok; son 7 gun yeter.
  const days = Object.keys(state).sort();
  const trimmed = {};
  for (const d of days.slice(-7)) trimmed[d] = state[d];

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(trimmed, null, 2) + "\n");
}

const pad = (n) => String(n).padStart(2, "0");

// Hedefler TRT takvimine gore etiketleniyor. "07:00 yayini" 04:00 UTC'ye denk
// geliyor; UTC gunune gore etiketlense insan icin okunmaz hale gelirdi.
function trtBugun(now) {
  const t = new Date(now.getTime() + TRT_OFFSET * 3600 * 1000);
  return { yil: t.getUTCFullYear(), ay: t.getUTCMonth(), gun: t.getUTCDate() };
}

function trtGunKey(d) {
  return `${d.yil}-${pad(d.ay + 1)}-${pad(d.gun)}`;
}

// TRT tarihi + TRT saati -> o anin gercek UTC karsiligi.
function yayinAniniHesapla(trtTarih, hhmm) {
  const [saat, dakika] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(trtTarih.yil, trtTarih.ay, trtTarih.gun, saat - TRT_OFFSET, dakika)
  );
}

function trtGoster(d) {
  const t = new Date(d.getTime() + TRT_OFFSET * 3600 * 1000);
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

// Dun / bugun / yarin icin tum yayin hedeflerini zaman sirasinda uretir.
// Uc gune bakiyoruz cunku bir hedefin uretim penceresi bir onceki gune,
// telafi penceresi de bir sonraki gune tasabiliyor.
function tumHedefler(now) {
  const bugun = trtBugun(now);
  const hedefler = [];
  for (const ofset of [-1, 0, 1]) {
    const t = new Date(Date.UTC(bugun.yil, bugun.ay, bugun.gun + ofset));
    const tarih = {
      yil: t.getUTCFullYear(),
      ay: t.getUTCMonth(),
      gun: t.getUTCDate(),
    };
    for (const saat of YAYIN_SAATLERI) {
      hedefler.push({
        gunKey: trtGunKey(tarih),
        saat,
        yayinAni: yayinAniniHesapla(tarih, saat),
      });
    }
  }
  return hedefler.sort((a, b) => a.yayinAni - b.yayinAni);
}

function siradakiYayin(now, state) {
  let enYakinErken = null;

  for (const hedef of tumHedefler(now)) {
    if ((state[hedef.gunKey] || []).includes(hedef.saat)) continue;

    const hazirlikBaslangici = new Date(
      hedef.yayinAni.getTime() - HAZIRLIK_SAATI * 3600 * 1000
    );
    const sonSans = new Date(
      hedef.yayinAni.getTime() + GECIKME_TOLERANSI_SAAT * 3600 * 1000
    );

    if (now > sonSans) continue; // bu yayin tamamen kacti
    if (now < hazirlikBaslangici) {
      // Hedefler zaman sirali; ilk rastladigimiz en yakin olani.
      if (!enYakinErken) enYakinErken = { ...hedef, hazirlikBaslangici };
      continue;
    }
    return { durum: "uret", ...hedef, gecikti: now >= hedef.yayinAni };
  }

  return enYakinErken ? { durum: "erken", ...enYakinErken } : { durum: "yok" };
}

function writeOutput(lines) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  fs.appendFileSync(out, lines.join("\n") + "\n");
}

function main() {
  const command = process.argv[2] || "check";
  const now = new Date();
  const state = loadState();

  if (command === "done") {
    const slot = process.env.SLOT;
    if (!slot) {
      console.error("SLOT ortam degiskeni yok, islenemedi.");
      process.exit(1);
    }
    // Elle tetiklenen calistirmalar kotaya sayilmaz; islenirse o gunun
    // zamanlanmis yayinlarindan biri atlanmis olur.
    if (slot === "manual") {
      console.log("Manuel calistirma, kotaya islenmiyor.");
      return;
    }
    // slot bicimi: "2026-09-10@07:00"
    const [gunKey, saat] = slot.split("@");
    if (!gunKey || !saat) {
      console.error(`SLOT bicimi anlasilamadi: "${slot}"`);
      process.exit(1);
    }
    state[gunKey] = [...new Set([...(state[gunKey] || []), saat])].sort();
    saveState(state);
    console.log(`OK: ${gunKey} TRT ${saat} yayini hazirlandi olarak islendi.`);
    return;
  }

  const sonuc = siradakiYayin(now, state);
  const bugunKey = trtGunKey(trtBugun(now));

  console.log(`Su an: ${bugunKey} ${trtGoster(now)} TRT`);
  console.log(
    `Bugun hazirlananlar: ${(state[bugunKey] || []).join(", ") || "yok"}`
  );

  if (sonuc.durum === "yok") {
    console.log("-> Hazirlanacak yayin yok.");
    writeOutput(["should_run=false"]);
    return;
  }

  if (sonuc.durum === "erken") {
    console.log(
      `-> Henuz erken. ${sonuc.gunKey} TRT ${sonuc.saat} yayini icin uretim ` +
        `${trtGoster(sonuc.hazirlikBaslangici)} TRT'de basliyor.`
    );
    writeOutput(["should_run=false"]);
    return;
  }

  const cikti = ["should_run=true", `slot=${sonuc.gunKey}@${sonuc.saat}`];

  if (sonuc.gecikti) {
    // Yayin saati gecmis ve video hala yok: zamanlamanin anlami kalmadi,
    // dogrudan yayinla. publish_at bos birakiliyor.
    console.log(
      `-> ${sonuc.gunKey} TRT ${sonuc.saat} yayini gecikti, video uretilip DOGRUDAN yayinlanacak.`
    );
    cikti.push("publish_at=");
  } else {
    const publishAt = sonuc.yayinAni.toISOString().split(".")[0] + "Z";
    console.log(
      `-> Video simdi uretilecek, YouTube'a ${sonuc.gunKey} TRT ${sonuc.saat} (${publishAt}) icin zamanlanacak.`
    );
    cikti.push(`publish_at=${publishAt}`);
  }

  writeOutput(cikti);
}

main();
