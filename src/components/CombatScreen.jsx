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
    sounds.startFightMusic();
    return () => {
      cleanupRef.current = true;
      sounds.stopFightMusic();
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
      }, 3000); // Give death animation time to play before reward screen (3s)
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

      if (gameState.enemyHP <= 25) {
        sounds.enemyDeath();
      }

      setTimeout(() => {
        if (!cleanupRef.current) {
          if (gameState.enemyHP > 25) {
            setPlayerPhase("idle");
            setEnemyPhase("idle");
            setPlayerX(300); // Reset player position
            gameState.setPhase("idle");
          } else {
            setPlayerPhase("idle");
          }
        }
      }, 600);
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
  let displayEnemyPhase = enemyPhase;
  if (gameState.phase === "attacking") displayEnemyPhase = "hit";
  if (gameState.phase === "death") displayEnemyPhase = "death";

  const isDead = gameState.phase === "death";

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

      {!isDead && (
        <>
          <div
            style={{
              position: "absolute",
              left: "50px",
              top: "20px",
              display: "flex",
              alignItems: "center",
              zIndex: 100,
            }}>
            <div
              style={{
                width: "128px",
                height: "128px",
                backgroundImage: "url('/assets/hero-icon.png')",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                imageRendering: "pixelated",
                filter: "drop-shadow(0 0 5px rgba(255, 255, 255, 0.5))",
                marginRight: "-30px", // Pull healthbar to touch center
                position: "relative",
                zIndex: 10, // Ensure icon is on TOP
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                zIndex: 1,
              }}>
              <div
                style={{
                  color: "white",
                  fontSize: "20px",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  fontWeight: "bold",
                  textShadow: "2px 2px 4px black",
                  marginLeft: "30px", // Pushed in to clear icon
                  letterSpacing: "1px",
                }}>
                THE GHOST (YOU)
              </div>
              <HealthBar
                hp={gameState.playerHP}
                maxHp={100}
                color="green"
                width={320}
                height={22}
                style={{ zIndex: 1 }}
              />
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              right: "20px",
              top: "4px",
              display: "flex",
              flexDirection: "row-reverse",
              alignItems: "center",
              zIndex: 100,
            }}>
            <div
              style={{
                width: "160px",
                height: "160px",
                backgroundImage: "url('/assets/enemy-icon.png')",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                transform: "scaleX(-1)",
                imageRendering: "pixelated",
                filter: "drop-shadow(0 0 5px rgba(255, 0, 0, 0.5))",
                marginLeft: "-40px", // Pull healthbar to touch center
                position: "relative",
                zIndex: 10, // Ensure icon is on TOP
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                alignItems: "flex-end",
                zIndex: 1,
              }}>
              <div
                style={{
                  color: "white",
                  fontSize: "20px",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  fontWeight: "bold",
                  textShadow: "2px 2px 4px black",
                  marginRight: "40px", // Pushed in to clear icon
                  letterSpacing: "1px",
                }}>
                SAMURAI COMMANDER
              </div>
              <HealthBar
                hp={gameState.enemyHP}
                maxHp={100}
                color="enemy"
                width={320}
                height={22}
                style={{ zIndex: 1 }}
              />
            </div>
          </div>
        </>
      )}

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

      {!isDead && (
        <AttackPopup visible={showAttackPopup} onClick={handleClick} />
      )}

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
