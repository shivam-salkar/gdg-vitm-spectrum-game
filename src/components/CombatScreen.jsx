import React, { useState, useRef, useCallback, useEffect } from "react";
import Background from "./Background.jsx";
import PlayerSprite from "./PlayerSprite.jsx";
import EnemySprite from "./EnemySprite.jsx";
import HealthBar from "./HealthBar.jsx";
import AttackPopup from "./AttackPopup.jsx";
import "../game.css";

export default function CombatScreen({ gameState, sounds }) {
  const [playerX, setPlayerX] = useState(300);
  const [playerPhase, setPlayerPhase] = useState("idle");
  const [enemyPhase, setEnemyPhase] = useState("idle");
  const [slashActive, setSlashActive] = useState(false);
  const [flashWhite, setFlashWhite] = useState(false);
  const [screenDarken, setScreenDarken] = useState(false);
  const [slashPos, setSlashPos] = useState({ x: 0, y: 0 });
  const [showAttackPopup, setShowAttackPopup] = useState(false);
  const cleanupRef = useRef(false);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    console.log(
      "🎮 CombatScreen mounted/updated - gamePhase:",
      gameState.phase,
      "playerPhase:",
      playerPhase,
    );
  }, [gameState.phase, playerPhase]);

  useEffect(() => {
    cleanupRef.current = false;
    return () => {
      cleanupRef.current = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Transition from idle to readyToAttack after animation finishes
  useEffect(() => {
    console.log("🎯 Checking readyToAttack condition:", {
      gameStatePhase: gameState.phase,
      playerPhase,
    });
    if (gameState.phase === "idle" && playerPhase === "idle") {
      console.log("✅ Both idle! Setting readyToAttack in 2000ms");
      const timer = setTimeout(() => {
        if (!cleanupRef.current) {
          console.log("🎯 TRANSITIONING TO READY_TO_ATTACK!");
          gameState.setPhase("readyToAttack");
          setShowAttackPopup(true);
        }
      }, 2000); // Wait for idle animation to complete
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, playerPhase]);

  // Handle death phase
  useEffect(() => {
    if (gameState.phase === "death") {
      setScreenDarken(true);
      const timer = setTimeout(() => {
        if (!cleanupRef.current) {
          sounds.victory();
          gameState.setScreen("reward");
        }
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setScreenDarken(false);
    }
  }, [gameState.phase, gameState.enemyHP]);

  // Handle running animation - player moves towards enemy
  useEffect(() => {
    if (gameState.phase === "running" && playerPhase === "run") {
      const animate = () => {
        setPlayerX((prevX) => {
          const newX = prevX + 0.1; // Move right slowly
          if (newX >= 480) {
            // Reached attack position
            return 480;
          }
          animationFrameRef.current = requestAnimationFrame(animate);
          return newX;
        });
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      // After reaching position, switch to attacking
      const attackTimeout = setTimeout(() => {
        if (!cleanupRef.current) {
          const randomAttack = ["attack1", "attack2", "attack3"][
            Math.floor(Math.random() * 3)
          ];
          gameState.setAttackType(randomAttack);
          setPlayerPhase(randomAttack);
          gameState.setPhase("attacking");
        }
      }, 100); // Duration of run animation

      return () => {
        clearTimeout(attackTimeout);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [gameState.phase, playerPhase]);

  // Handle attacking animation
  useEffect(() => {
    if (gameState.phase === "attacking" && playerPhase.startsWith("attack")) {
      sounds.swordClash();

      // Slash effect
      setSlashActive(true);
      setFlashWhite(true);
      setSlashPos({ x: 500, y: 280 });

      setTimeout(() => setSlashActive(false), 300);
      setTimeout(() => setFlashWhite(false), 200);

      gameState.doDamage(25);

      setTimeout(() => {
        if (!cleanupRef.current) {
          setPlayerPhase("idle");
          setEnemyPhase("idle");
          setPlayerX(300); // Reset player position
          gameState.setPhase("idle");
        }
      }, 600);

      if (gameState.enemyHP <= 25) {
        sounds.enemyDeath();
      }
    }
  }, [gameState.phase, playerPhase]);

  const handleClick = useCallback(() => {
    if (gameState.phase === "readyToAttack" && !cleanupRef.current) {
      setShowAttackPopup(false);
      gameState.setPhase("running");
      setPlayerPhase("run");
      setEnemyPhase("protect");
    }
  }, [gameState.phase, gameState]);

  // Determine enemy display phase
  const displayEnemyPhase =
    gameState.phase === "attacking" ? "hit" : enemyPhase;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#0d1117",
        overflow: "hidden",
        cursor: gameState.phase === "readyToAttack" ? "pointer" : "default",
      }}
      onClick={handleClick}>
      <Background />

      {/* DEBUG: Show current phase */}
      <div
        style={{
          position: "absolute",
          top: "100px",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "20px",
          fontFamily: "monospace",
          color: "#00ff00",
          zIndex: 200,
        }}>
        Phase: {gameState.phase} | PopupVisible:{" "}
        {showAttackPopup ? "YES" : "NO"}
      </div>

      <HealthBar
        x={674}
        y={30}
        width={300}
        height={20}
        hp={gameState.playerHP}
        maxHp={100}
        color="green"
      />
      <HealthBar
        x={50}
        y={30}
        width={300}
        height={20}
        hp={gameState.enemyHP}
        maxHp={100}
        color="enemy"
      />

      <PlayerSprite x={playerX} y={290} phase={playerPhase} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          filter: gameState.phase === "death" ? "grayscale(1)" : "none",
          transition: "filter 0.5s ease-out",
        }}>
        <EnemySprite
          x={680}
          y={290}
          phase={displayEnemyPhase}
          isFlash={gameState.phase === "hitting"}
        />
      </div>

      <AttackPopup
        visible={showAttackPopup}
        onClose={() => setShowAttackPopup(false)}
      />

      {slashActive && (
        <div
          className="slash-effect"
          style={{
            left: `${slashPos.x}px`,
            top: `${slashPos.y}px`,
          }}
        />
      )}

      {flashWhite && (
        <div
          className="flash-white"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      )}

      {screenDarken && (
        <div
          className="darken-screen"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
