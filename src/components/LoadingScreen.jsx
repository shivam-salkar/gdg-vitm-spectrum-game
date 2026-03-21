import React, { useRef, useEffect, useState } from "react";
import { wait } from "../hooks/useAnimationLoop.js";
import "../game.css";

export default function LoadingScreen({ gameState, sounds }) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const newProgress = Math.min(100, p + 0.5);
        progressRef.current = newProgress;

        if (newProgress >= 100 && !completedRef.current) {
          completedRef.current = true;
          clearInterval(interval);
          wait(100).then(() => {
            try {
              sounds.startAmbientWind();
            } catch (e) {
              console.warn("Audio start failed", e);
            }
            gameState.setScreen("intro");
          });
        }

        return newProgress;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [gameState, sounds]);

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
      }}>
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
        }}>
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
        }}>
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
        }}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}
