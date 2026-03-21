import React, { useRef, useEffect, useState } from "react";
import Background from "./Background.jsx";
import Particles from "./Particles.jsx";
import "../game.css";

export default function RewardScreen({ gameState }) {
  const [time, setTime] = useState(0);
  const [text1Alpha, setText1Alpha] = useState(0);
  const [text2Alpha, setText2Alpha] = useState(0);
  const [text3Alpha, setText3Alpha] = useState(0);
  const [rewardAlpha, setRewardAlpha] = useState(0);
  const [buttonAlpha, setButtonAlpha] = useState(0);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((t) => {
        const newTime = t + 1;

        if (newTime > 30) {
          setText1Alpha(Math.min(1, (newTime - 30) / 30));
        }
        if (newTime > 60) {
          setText2Alpha(Math.min(1, (newTime - 60) / 30));
        }
        if (newTime > 90) {
          setText3Alpha(Math.min(1, (newTime - 90) / 30));
        }
        if (newTime > 120) {
          setRewardAlpha(Math.min(1, (newTime - 120) / 30));
        }
        if (newTime > 150) {
          setButtonAlpha(Math.min(1, (newTime - 150) / 30));
          setButtonsEnabled(true);
        }

        return newTime;
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, []);

  const handleRestart = () => {
    gameState.resetGame();
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#0d1117",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}>
      <Background />

      <div
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          width: "170px",
          height: "58px",
          overflow: "hidden",
          zIndex: 20,
          pointerEvents: "none",
        }}>
        <img
          src="/assets/gdg-logo.png"
          alt="GDG logo"
          style={{
            position: "absolute",
            top: "-6px",
            left: "-10px",
            width: "185px",
            height: "66px",
            objectFit: "contain",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: "110px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "620px",
          height: "420px",
          background:
            "radial-gradient(circle, rgba(255, 170, 0, 0.3) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      <Particles count={50} type="ember" />

      <div
        className="victory-text"
        style={{
          position: "absolute",
          top: "105px",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: text1Alpha,
          transition: "opacity 0.2s",
          fontSize: "40px",
        }}>
        VICTORY
      </div>

      <div
        className="pixel-text pixel-text--soft"
        style={{
          position: "absolute",
          top: "175px",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: text2Alpha,
          transition: "opacity 0.2s",
          fontSize: "13px",
          color: "#ffffff",
          textAlign: "center",
          width: "78%",
        }}>
        You have defended the realm.
      </div>

      <div
        className="pixel-text pixel-text--soft"
        style={{
          position: "absolute",
          top: "210px",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: text3Alpha,
          transition: "opacity 0.2s",
          fontSize: "9px",
          color: "#aaaaaa",
        }}>
        SPECTRUM 2026 - GDG VITM
      </div>

      <div
        style={{
          position: "absolute",
          top: "225px",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: rewardAlpha,
          transition: "opacity 0.2s",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}>
        <div
          className="pixel-text pixel-text--soft"
          style={{
            fontSize: "10px",
            color: "#ffd56b",
          }}>
          YOUR REWARD
        </div>

        <div
          style={{
            width: "420px",
            height: "180px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0",
          }}>
          <img
            src="/assets/sword.png"
            alt="Katana reward"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              imageRendering: "pixelated",
              filter: "drop-shadow(0 0 18px rgba(255, 210, 90, 0.35))",
            }}
          />
        </div>
      </div>

      <button
        className="game-button"
        onClick={handleRestart}
        style={{
          position: "absolute",
          top: "430px",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: buttonAlpha,
          transition: "opacity 0.2s",
          cursor: buttonsEnabled ? "pointer" : "default",
          pointerEvents: buttonsEnabled ? "auto" : "none",
        }}>
        PLAY AGAIN
      </button>
    </div>
  );
}
