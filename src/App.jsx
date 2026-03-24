import React, { useState, useEffect, useRef, useCallback } from "react";
import { useGameState } from "./hooks/useGameState.js";
import { usePixiSound } from "./hooks/usePixiSound.js";
import { CONFIG } from "./constants/gameConfig.js";
import { CRITICAL_ASSET_URLS, WARM_ASSET_URLS } from "./constants/sprites.js";

import LoadingScreen from "./components/LoadingScreen.jsx";
import IntroScreen from "./components/IntroScreen.jsx";
import TutorialScreen from "./components/TutorialScreen.jsx";
import CombatScreen from "./components/CombatScreen.jsx";
import RewardScreen from "./components/RewardScreen.jsx";

import "./App.css";

const IMAGE_FILE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
const preloadCache = new Map();

function getViewportSize() {
  if (typeof window === "undefined") {
    return {
      width: CONFIG.STAGE_WIDTH,
      height: CONFIG.STAGE_HEIGHT,
    };
  }

  const viewport = window.visualViewport;
  return {
    width: Math.max(1, Math.round(viewport?.width ?? window.innerWidth)),
    height: Math.max(1, Math.round(viewport?.height ?? window.innerHeight)),
  };
}

function getStageScale(width, height) {
  const gameAspect = CONFIG.STAGE_WIDTH / CONFIG.STAGE_HEIGHT;
  const screenAspect = width / height;

  if (screenAspect > gameAspect) {
    return height / CONFIG.STAGE_HEIGHT;
  }

  return width / CONFIG.STAGE_WIDTH;
}

function setViewportCssVars({ width, height }) {
  document.documentElement.style.setProperty("--app-height", `${height}px`);
  document.documentElement.style.setProperty("--app-width", `${width}px`);
}

function preloadAsset(url) {
  if (preloadCache.has(url)) {
    return preloadCache.get(url);
  }

  const assetPromise = IMAGE_FILE_RE.test(url)
    ? new Promise((resolve) => {
        let settled = false;
        const img = new Image();

        const finish = () => {
          if (settled) return;
          settled = true;
          resolve(url);
        };

        img.decoding = "async";
        img.onload = finish;
        img.onerror = finish;
        img.src = url;

        if (img.complete) {
          finish();
        }
      })
    : fetch(url, { cache: "force-cache" })
        .catch(() => null)
        .then(() => url);

  preloadCache.set(url, assetPromise);
  return assetPromise;
}

export default function App() {
  const gameState = useGameState();
  const sounds = usePixiSound();
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [scale, setScale] = useState(() => {
    const viewport = getViewportSize();
    return getStageScale(viewport.width, viewport.height);
  });
  const fullscreenRequestedRef = useRef(false);
  const [multiplayerConfig, setMultiplayerConfig] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get("session");
    const sessionId =
      sessionFromUrl && sessionFromUrl.trim()
        ? sessionFromUrl.trim()
        : "game-room-1";

    const playerFromUrl = params.get("player");
    if (playerFromUrl && playerFromUrl.trim()) {
      setMultiplayerConfig({
        sessionId,
        playerId: playerFromUrl.trim(),
      });
      return;
    }

    const storageKey = "spectrum-player-id";
    let playerId = window.sessionStorage.getItem(storageKey);
    if (!playerId) {
      playerId = `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      window.sessionStorage.setItem(storageKey, playerId);
    }

    setMultiplayerConfig({
      sessionId,
      playerId,
    });
  }, []);

  const requestFullscreen = useCallback(() => {
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
  }, []);

  const syncViewport = useCallback(() => {
    const viewport = getViewportSize();
    setViewportCssVars(viewport);
    setScale(getStageScale(viewport.width, viewport.height));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const totalAssets = CRITICAL_ASSET_URLS.length;

    async function loadCriticalAssets() {
      let completedAssets = 0;

      await Promise.allSettled(
        CRITICAL_ASSET_URLS.map(async (url) => {
          await preloadAsset(url);
          if (cancelled) return;

          completedAssets += 1;
          setLoadingProgress(Math.round((completedAssets / totalAssets) * 100));
        }),
      );

      if (!cancelled) {
        setLoadingProgress(100);
        setAssetsReady(true);
      }
    }

    loadCriticalAssets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!assetsReady) return undefined;

    let cancelled = false;
    let timeoutId = null;
    let idleId = null;

    const warmAssets = () => {
      if (cancelled) return;
      WARM_ASSET_URLS.forEach((url) => {
        void preloadAsset(url);
      });
    };

    if (window.requestIdleCallback) {
      idleId = window.requestIdleCallback(warmAssets, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(warmAssets, 250);
    }

    return () => {
      cancelled = true;
      if (idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [assetsReady]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      if (fullscreenRequestedRef.current) return;
      fullscreenRequestedRef.current = true;
      requestFullscreen();
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
      window.removeEventListener("keydown", handleFirstInteraction, true);
    };

    window.addEventListener("pointerdown", handleFirstInteraction, true);
    window.addEventListener("keydown", handleFirstInteraction, true);
    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
      window.removeEventListener("keydown", handleFirstInteraction, true);
    };
  }, [requestFullscreen]);

  useEffect(() => {
    setViewportCssVars(getViewportSize());

    const viewport = window.visualViewport;
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    document.addEventListener("fullscreenchange", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      document.removeEventListener("fullscreenchange", syncViewport);
    };
  }, [syncViewport]);

  const { screen } = gameState;
  const stageWidth = CONFIG.STAGE_WIDTH * scale;
  const stageHeight = CONFIG.STAGE_HEIGHT * scale;

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
          width: "var(--app-width, 100vw)",
          height: "var(--app-height, 100dvh)",
          backgroundColor: "#0d1117",
          zIndex: 99999,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
          fontFamily: '"Press Start 2P", monospace',
          textTransform: "uppercase",
          textShadow: "2px 2px 0 #000",
        }}
      >
        <img
          src="/assets/phone-rotate.webp"
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
            fontSize: "18px",
            lineHeight: "1.6",
          }}
        >
          LANDSCAPE REQUIRED
        </h2>
        <p
          style={{
            textAlign: "center",
            padding: "0 40px",
            lineHeight: "1.8",
            opacity: 0.7,
            fontSize: "11px",
            maxWidth: "420px",
          }}
        >
          Please rotate your device to play SPECTRUM.
        </p>
      </div>

      <div
        id="game-content"
        style={{
          width: "var(--app-width, 100vw)",
          height: "var(--app-height, 100dvh)",
          backgroundColor: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          touchAction: "manipulation",
        }}
      >
        <div
          style={{
            position: "relative",
            width: `${stageWidth}px`,
            height: `${stageHeight}px`,
            overflow: "hidden",
            backgroundColor: "#0d1117",
            boxShadow: "0 0 20px rgba(255, 69, 0, 0.3)",
            contain: "layout paint",
            isolation: "isolate",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${CONFIG.STAGE_WIDTH}px`,
              height: `${CONFIG.STAGE_HEIGHT}px`,
              transform: `translateZ(0) scale(${scale})`,
              transformOrigin: "top left",
              willChange: "transform",
              backfaceVisibility: "hidden",
            }}
          >
            {screen === "loading" && (
              <LoadingScreen
                gameState={gameState}
                sounds={sounds}
                loadingProgress={loadingProgress}
                assetsReady={assetsReady}
              />
            )}
            {screen === "intro" && (
              <IntroScreen gameState={gameState} sounds={sounds} />
            )}
            {screen === "tutorial" && <TutorialScreen gameState={gameState} />}
            {screen === "combat" && (
              <CombatScreen
                gameState={gameState}
                sounds={sounds}
                multiplayerConfig={multiplayerConfig}
              />
            )}
            {screen === "reward" && <RewardScreen gameState={gameState} />}
          </div>
        </div>
      </div>

      {/* Fullscreen Button - Fixed Position */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          requestFullscreen();
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
          backgroundImage: "url('/assets/fullscreen_button.webp')",
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
        title="Fullscreen"
      ></button>
    </>
  );
}
