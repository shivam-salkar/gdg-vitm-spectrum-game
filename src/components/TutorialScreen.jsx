import React, { useRef, useEffect, useState } from "react";
import Background from "./Background.jsx";
import PlayerSprite from "./PlayerSprite.jsx";
import EnemySprite from "./EnemySprite.jsx";
import Particles from "./Particles.jsx";
import { SPRITE_POSITIONS } from "../constants/gameConfig.js";
import "../game.css";

export default function TutorialScreen({ gameState }) {
  const [time, setTime] = useState(0);
  const [text1Alpha, setText1Alpha] = useState(0);
  const [text2Alpha, setText2Alpha] = useState(0);
  const [text2Scale, setText2Scale] = useState(1);
  const [rippleProgress, setRippleProgress] = useState(0);
  const cleanupRef = useRef(false);

  useEffect(() => {
    cleanupRef.current = false;
    return () => {
      cleanupRef.current = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((t) => {
        const newTime = t + 1;

        if (newTime > 30) {
          setText1Alpha(Math.min(1, (newTime - 30) / 30));
        }

        if (newTime > 90) {
          setText2Alpha(1);
          setText2Scale(1 + Math.sin(newTime * 0.1) * 0.05);
          setRippleProgress(newTime > 90 ? ((newTime - 90) % 60) / 60 : 0);
        } else {
          setText2Alpha(0);
        }

        return newTime;
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    if (!cleanupRef.current) {
      gameState.setScreen("combat");
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#0d1117",
        overflow: "hidden",
        cursor: "pointer",
      }}
      onClick={handleClick}>
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
        style={{
          position: "absolute",
          top: "150px",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: text1Alpha,
          transition: "opacity 0.2s",
          fontSize: "24px",
          fontFamily: "monospace",
          color: "#ffffff",
          textAlign: "center",
        }}>
        An enemy approaches...
      </div>

      <div
        style={{
          position: "absolute",
          top: "200px",
          left: "50%",
          transform: `translateX(-50%) scale(${text2Scale})`,
          opacity: text2Alpha,
          fontSize: "32px",
          fontFamily: "monospace",
          color: "#ff4500",
          fontWeight: "bold",
          textAlign: "center",
          transition: "opacity 0.2s",
        }}>
        CLICK TO ATTACK!
      </div>

      {time > 90 && (
        <div
          className="ripple-effect"
          style={{
            position: "absolute",
            left: "512px",
            top: "400px",
            width: `${rippleProgress * 60 * 2}px`,
            height: `${rippleProgress * 60 * 2}px`,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </div>
  );
}
