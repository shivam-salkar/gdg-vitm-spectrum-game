import React, { useRef, useEffect, useState } from "react";
import Background from "./Background.jsx";
import PlayerSprite from "./PlayerSprite.jsx";
import EnemySprite from "./EnemySprite.jsx";
import { SPRITE_POSITIONS } from "../constants/gameConfig.js";
import "../game.css";

export default function IntroScreen({ gameState }) {
  const [time, setTime] = useState(0);
  const [titleAlpha, setTitleAlpha] = useState(1);
  const [subtitleChar, setSubtitleChar] = useState(0);
  const cleanupRef = useRef(false);
  const audioPlayedRef = useRef(false);
  const introAudioRef = useRef(null);

  const LYRICS =
  "You burned my people. You broke our code. Now you face what remains… the Ghost.";
  const SUBTITLE_START = 10; // frames to wait before starting subtitles
  const CHAR_SPEED = 5; // frames per character (lower = faster typing)
  const SUBTITLE_DURATION = LYRICS.length * CHAR_SPEED + 60; // Typewriter time + short hold
  const INTRO_END_TIME = SUBTITLE_START + SUBTITLE_DURATION;

  useEffect(() => {
    cleanupRef.current = false;
    return () => {
      cleanupRef.current = true;
      if (introAudioRef.current) {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
        introAudioRef.current = null;
      }
    };
  }, []);

  // Play player voice on intro start (only once)
  useEffect(() => {
    if (audioPlayedRef.current) return;
    audioPlayedRef.current = true;

    const audio = new Audio("/assets/audio.mp3");
    audio.volume = 0.6;
    introAudioRef.current = audio;
    audio.play().catch((err) => console.log("Audio play failed:", err));
  }, []);

  const stopIntroAudio = () => {
    if (introAudioRef.current) {
      introAudioRef.current.pause();
      introAudioRef.current.currentTime = 0;
      introAudioRef.current = null;
    }
  };

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
          style={{
            position: "absolute",
            bottom: "80px",
            width: "50%",
            left: "25%",
            textAlign: "center",
            fontFamily: "'Press Start 2P', serif",
            fontSize: "10px",
            lineHeight: "20px",
            color: "#fff",
            textShadow: "2px 2px #000",
            pointerEvents: "none",
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: "10px",
            borderRadius: "4px",
          }}>
          {LYRICS.substring(0, subtitleChar)}
        </div>
      )}

      {time < INTRO_END_TIME && (
        <div
          onClick={handleSkipIntro}
          style={{
            position: "absolute",
            bottom: "30px",
            right: "30px",
            padding: "10px 20px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            border: "2px solid #fff",
            color: "#fff",
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: "14px",
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
