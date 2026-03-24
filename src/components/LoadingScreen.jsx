import React, { useRef, useEffect } from "react";
import "../game.css";

export default function LoadingScreen({
  gameState,
  sounds,
  loadingProgress = 0,
  assetsReady = false,
}) {
  const completedRef = useRef(false);
  const progress = assetsReady ? 100 : loadingProgress;

  useEffect(() => {
    if (!assetsReady || completedRef.current) return undefined;

    completedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      try {
        sounds.startAmbientWind();
      } catch (e) {
        console.warn("Audio start failed", e);
      }
      gameState.setScreen("intro");
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [assetsReady, gameState, sounds]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0d1117",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
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
        }}
      >
        <img
          src="/assets/gdg-logo.webp"
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

      <div className="title-text" style={{ marginBottom: "80px" }}>
        SPECTRUM
      </div>

      <div
        className="pixel-text pixel-text--soft"
        style={{
          marginBottom: "40px",
          textAlign: "center",
          fontSize: "12px",
          color: "#ffffff",
          lineHeight: "1.8",
        }}
      >
        by GOOGLE DEVELOPER GROUP VITM
      </div>

      <div
        style={{
          width: "300px",
          height: "20px",
          border: "2px solid #ffffff",
          borderRadius: "4px",
          overflow: "hidden",
          background: "#111",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #ff4500, #ff6b00)",
            transition: "width 0.1s ease-out",
          }}
        />
      </div>

      <div
        className="pixel-text pixel-text--soft"
        style={{
          marginTop: "20px",
          fontSize: "10px",
          color: "#aaa",
        }}
      >
        {Math.round(progress)}%
      </div>
    </div>
  );
}
