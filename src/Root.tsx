import React from "react";
import { Composition } from "remotion";
import { QuizVideo, QuizVideoProps, quizSureleri } from "./QuizVideo";

const FPS = 30;

// Remotion Studio'da (npm run preview) görülecek örnek veri. Gerçek üretimde
// bu değerlerin tamamı scripts/produceQuiz.mjs tarafından inputProps olarak
// override edilir.
const quizDefaultProps: QuizVideoProps = {
  title: "Bunları biliyor musun?",
  questions: [
    {
      soru: "Araba lastiği hava basıncı ne zaman ölçülmeli?",
      secenekler: ["Yol sonrası sıcakken", "Soğukken", "Fark etmez"],
      dogru: 1,
    },
    {
      soru: "Deprem anında ilk ne yapılmalı?",
      secenekler: ["Merdivene koşmak", "Çök-kapan-tutun", "Balkona çıkmak"],
      dogru: 1,
    },
    {
      soru: "Televizyon ekranı silerken ne kullanılmalı?",
      secenekler: ["Mikrofiber bez", "Islak sünger", "Kağıt havlu"],
      dogru: 0,
    },
  ],
  outro: "Kaç tanesini bildin?",
  outroAlt: "Yorumda belirt 👇",
  channelName: "Fokus",
  channelAvatar: "brand/avatar.jpg",
  audioSegments: [],
};

// Toplam süre, soru başına ölçülen seslendirme sürelerinden hesaplanıyor.
// Hesap bileşenle aynı fonksiyondan geldiği için ikisi asla ayrışmıyor.
const calculateQuizDuration = async ({ props }: { props: QuizVideoProps }) => {
  const { toplam } = quizSureleri(props);
  return { durationInFrames: Math.max(FPS, Math.round(toplam * FPS)), props };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="QuizVideo"
      component={QuizVideo}
      durationInFrames={30 * FPS}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={quizDefaultProps}
      calculateMetadata={calculateQuizDuration}
    />
  );
};
