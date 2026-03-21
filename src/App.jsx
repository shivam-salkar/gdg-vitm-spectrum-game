import React, { useState, useEffect } from "react";
import { useGameState } from "./hooks/useGameState.js";
import { usePixiSound } from "./hooks/usePixiSound.js";
import { CONFIG } from "./constants/gameConfig.js";

import LoadingScreen from "./components/LoadingScreen.jsx";
import IntroScreen from "./components/IntroScreen.jsx";
import TutorialScreen from "./components/TutorialScreen.jsx";
import CombatScreen from "./components/CombatScreen.jsx";
import RewardScreen from "./components/RewardScreen.jsx";

import "./App.css";

// Preload assets
const ASSETS_TO_LOAD = [
  "/background.mp4",
  "/assets/Samurai/Idle.png",
  "/assets/Samurai/Walk.png",
  "/assets/Samurai/Run.png",
  "/assets/Samurai/Attack_1.png",
  "/assets/Samurai/Attack_2.png",
  "/assets/Samurai/Attack_3.png",
  "/assets/Samurai/Protection.png",
  "/assets/Samurai/Dead.png",
  "/assets/Samurai_Commander/Idle.png",
  "/assets/Samurai_Commander/Walk.png",
  "/assets/Samurai_Commander/Run.png",
  "/assets/Samurai_Commander/Attack_1.png",
  "/assets/Samurai_Commander/Attack_2.png",
  "/assets/Samurai_Commander/Attack_3.png",
  "/assets/Samurai_Commander/Protect.png",
  "/assets/Samurai_Commander/Hurt.png",
  "/assets/Samurai_Commander/Dead.png",
];

export default function App() {
  const gameState = useGameState();
  const sounds = usePixiSound();
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    async function loadAssets() {
      try {
        await Promise.all(
          ASSETS_TO_LOAD.map(
            (url) =>
              new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
              }),
          ),
        );
        setAssetsLoaded(true);
      } catch (e) {
        console.error("Asset loading error:", e);
        setAssetsLoaded(true); // Attempt to proceed anyway
      }
    }
    loadAssets();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gameAspect = CONFIG.STAGE_WIDTH / CONFIG.STAGE_HEIGHT;
      const screenAspect = vw / vh;

      let newScale;
      if (screenAspect > gameAspect) {
        // Screen is wider
        newScale = vh / CONFIG.STAGE_HEIGHT;
      } else {
        // Screen is taller
        newScale = vw / CONFIG.STAGE_WIDTH;
      }
      setScale(newScale);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { screen } = gameState;

  if (!assetsLoaded) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#000",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: "24px",
        }}>
        Loading Game Assets...
      </div>
    );
  }

  return (
    <>
      <style>{`
        #portrait-lock {
          display: none;
        }
        @media screen and (max-width: 900px) and (orientation: portrait) {
          #portrait-lock {
            display: flex !important;
          }
          #game-content {
            display: none !important;
          }
        }
      `}</style>

      {/* Portrait Lock Screen Overlay */}
      <div
        id="portrait-lock"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "#0d1117",
          zIndex: 99999,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
          fontFamily: "'Noto Sans JP', sans-serif",
        }}>
        <img
          src="/assets/phone-rotate.png"
          alt="Rotate phone"
          style={{
            width: "120px",
            marginBottom: "30px",
            opacity: 0.8,
            filter: "invert(1)",
          }}
        />
        <h2
          style={{
            marginBottom: "15px",
            letterSpacing: "2px",
            textAlign: "center",
          }}>
          LANDSCAPE REQUIRED
        </h2>
        <p
          style={{
            textAlign: "center",
            padding: "0 40px",
            lineHeight: "1.5",
            opacity: 0.7,
          }}>
          Please rotate your device to play SPECTRUM.
        </p>
      </div>

      <div
        id="game-content"
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        }}>
        <div
          style={{
            position: "relative",
            width: CONFIG.STAGE_WIDTH,
            height: CONFIG.STAGE_HEIGHT,
            overflow: "hidden",
            backgroundColor: "#0d1117",
            boxShadow: "0 0 20px rgba(255, 69, 0, 0.3)",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}>
          {screen === "loading" && (
            <LoadingScreen gameState={gameState} sounds={sounds} />
          )}
          {screen === "intro" && <IntroScreen gameState={gameState} />}
          {screen === "tutorial" && <TutorialScreen gameState={gameState} />}
          {screen === "combat" && (
            <CombatScreen gameState={gameState} sounds={sounds} />
          )}
          {screen === "reward" && <RewardScreen gameState={gameState} />}
        </div>
      </div>

      {/* Fullscreen Button - Fixed Position */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const elem = document.documentElement;
          try {
            if (elem.requestFullscreen) {
              elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
              elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
              elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
              elem.msRequestFullscreen();
            }
          } catch (err) {
            console.log("Fullscreen request failed:", err);
          }
        }}
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          width: "50px",
          height: "50px",
          backgroundColor: "transparent",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          backgroundImage: "url('/assets/fullscreen_button.png')",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          transition: "all 0.2s",
          pointerEvents: "auto",
          opacity: 0.8,
          imageRendering: "pixelated",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        title="Fullscreen"></button>
    </>
  );
}
