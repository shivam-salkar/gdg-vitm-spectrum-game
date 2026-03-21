import React, { useRef, useEffect, useState, useCallback } from "react";
import Background from "./Background.jsx";
import PlayerSprite from "./PlayerSprite.jsx";
import EnemySprite from "./EnemySprite.jsx";
import { SPRITE_POSITIONS } from "../constants/gameConfig.js";
import "../game.css";

export default function IntroScreen({ gameState, sounds }) {
  const [time, setTime] = useState(0);
  const [titleAlpha, setTitleAlpha] = useState(1);
  const [subtitleChar, setSubtitleChar] = useState(0);
  const [awaitingInteraction, setAwaitingInteraction] = useState(false);
  const cleanupRef = useRef(false);
  const audioPlayedRef = useRef(false);
  const introAudioRef = useRef(null);

  const LYRICS =
  "You burned my people. You broke our code. Now you face what remains… the Ghost.";
  const SUBTITLE_START = 10; // frames to wait before starting subtitles
  const CHAR_SPEED = 7; // frames per character (lower = faster typing)
  const SUBTITLE_DURATION = LYRICS.length * CHAR_SPEED + 180; // Typewriter time + longer hold
  const INTRO_END_TIME = SUBTITLE_START + SUBTITLE_DURATION;

  const stopIntroAudio = useCallback(() => {
    if (introAudioRef.current) {
      introAudioRef.current.pause();
      introAudioRef.current.currentTime = 0;
      introAudioRef.current = null;
    }
  }, []);

  const tryPlayIntroAudio = useCallback(() => {
    if (cleanupRef.current || audioPlayedRef.current || !introAudioRef.current) {
      return;
    }

    const playPromise = introAudioRef.current.play();
    if (playPromise?.then) {
      playPromise
        .then(() => {
          audioPlayedRef.current = true;
          setAwaitingInteraction(false);
        })
        .catch((err) => {
          console.log("Intro audio play failed:", err);
          setAwaitingInteraction(true);
        });
      return;
    }

    audioPlayedRef.current = true;
    setAwaitingInteraction(false);
  }, []);

  useEffect(() => {
    cleanupRef.current = false;
    sounds?.stopAmbientWind?.();

    return () => {
      cleanupRef.current = true;
      stopIntroAudio();
      sounds?.startAmbientWind?.();
    };
  }, [sounds, stopIntroAudio]);

  useEffect(() => {
    const audio = new Audio("/assets/player_speech.mp3");
    audio.preload = "auto";
    audio.volume = 1;
    introAudioRef.current = audio;
    tryPlayIntroAudio();

    return () => {
      if (introAudioRef.current === audio) {
        stopIntroAudio();
      }
    };
  }, [stopIntroAudio, tryPlayIntroAudio]);

  useEffect(() => {
    if (!awaitingInteraction) return;

    const handleInteraction = () => {
      tryPlayIntroAudio();
    };

    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [awaitingInteraction, tryPlayIntroAudio]);

  const handleSkipIntro = () => {
    stopIntroAudio();
    gameState.setScreen("tutorial");
  };

  useEffect(() => {
    if (time >= INTRO_END_TIME && !cleanupRef.current) {
      stopIntroAudio();
      gameState.setScreen("tutorial");
    }
  }, [time, gameState, INTRO_END_TIME]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((t) => {
        const newTime = t + 1;
        setTitleAlpha(Math.max(0, 1 - newTime / 60));

        // Handle subtitle typewriter effect
        if (
          newTime > SUBTITLE_START &&
          newTime < SUBTITLE_START + SUBTITLE_DURATION
        ) {
          const subtitleTime = newTime - SUBTITLE_START;
          const charIndex = Math.floor(subtitleTime / CHAR_SPEED);
          setSubtitleChar(Math.min(charIndex, LYRICS.length));
        } else if (newTime >= SUBTITLE_START + SUBTITLE_DURATION) {
          setSubtitleChar(0);
        }

        return newTime;
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [gameState]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#0d1117",
        overflow: "hidden",
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

      <PlayerSprite
        x={SPRITE_POSITIONS.PLAYER_HOME_X}
        y={SPRITE_POSITIONS.SPRITE_Y}
        phase="idle"
      />
      <EnemySprite
        x={SPRITE_POSITIONS.ENEMY_HOME_X}
        y={SPRITE_POSITIONS.SPRITE_Y}
        phase="idle"
      />

      <div
        className="title-text"
        style={{
          position: "absolute",
          top: "200px",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: titleAlpha,
          transition: "opacity 0.3s ease-out",
          fontSize: "42px",
        }}>
        SPECTRUM
      </div>

      {subtitleChar > 0 && (
        <div
          className="pixel-text pixel-text--soft"
          style={{
            position: "absolute",
            bottom: "80px",
            width: "50%",
            left: "25%",
            textAlign: "center",
            fontSize: "10px",
            lineHeight: "20px",
            color: "#fff",
            pointerEvents: "none",
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: "10px",
            borderRadius: "4px",
          }}>
          {LYRICS.substring(0, subtitleChar)}
        </div>
      )}

      {awaitingInteraction && (
        <div
          className="pixel-text pixel-text--soft"
          style={{
            position: "absolute",
            bottom: "140px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            border: "2px solid #fff",
            color: "#fff",
            fontSize: "9px",
            textAlign: "center",
            zIndex: 100,
          }}>
          TAP OR PRESS ANY KEY FOR VOICE
        </div>
      )}

      {time < INTRO_END_TIME && (
        <div
          onClick={handleSkipIntro}
          className="pixel-text pixel-text--soft"
          style={{
            position: "absolute",
            bottom: "30px",
            right: "30px",
            padding: "10px 20px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            border: "2px solid #fff",
            color: "#fff",
            fontSize: "10px",
            fontWeight: "900",
            cursor: "pointer",
            borderRadius: "4px",
            zIndex: 100,
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#fff";
            e.currentTarget.style.color = "#000";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
            e.currentTarget.style.color = "#fff";
          }}>
          SKIP INTRO ➔
        </div>
      )}
    </div>
  );
}
