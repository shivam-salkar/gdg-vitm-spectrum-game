import React, { useState, useRef, useCallback, useEffect } from "react";
import Background from "./Background.jsx";
import PlayerSprite from "./PlayerSprite.jsx";
import EnemySprite from "./EnemySprite.jsx";
import HealthBar from "./HealthBar.jsx";
import AttackPopup from "./AttackPopup.jsx";
import { SPRITE_POSITIONS } from "../constants/gameConfig.js";
import "../game.css";

// ─── helpers ────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const ATTACKS = ["attack1", "attack2", "attack3"];
const randomAttack = () => ATTACKS[rand(0, 2)];

// Smooth linear move using rAF. Returns a cancel fn.
function smoothMove(getX, setX, targetX, durationMs, onDone) {
  let start = null;
  let id;
  const tick = (ts) => {
    if (!start) start = ts;
    const t = Math.min(1, (ts - start) / durationMs);
    // ease-out cubic
    const ease = 1 - Math.pow(1 - t, 3);
    setX(getX() + (targetX - getX()) * ease);
    if (t < 1) {
      id = requestAnimationFrame(tick);
    } else {
      setX(targetX);
      onDone?.();
    }
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}

// ─── component ──────────────────────────────────────────────────────────────
export default function CombatScreen({ gameState, sounds }) {
  // Sprite positions stored as refs for smooth rAF movement (no re-render per frame)
  const playerXRef = useRef(SPRITE_POSITIONS.PLAYER_HOME_X);
  const enemyXRef = useRef(SPRITE_POSITIONS.ENEMY_HOME_X);

  // React state for positions only used to drive the DOM style (updated via rAF)
  const [playerPos, setPlayerPos] = useState(SPRITE_POSITIONS.PLAYER_HOME_X);
  const [enemyPos, setEnemyPos] = useState(SPRITE_POSITIONS.ENEMY_HOME_X);

  // Sprite animation phases
  const [playerPhase, setPlayerPhase] = useState("idle");
  const [enemyPhase, setEnemyPhase] = useState("idle");

  // Visual FX
  const [slashActive, setSlashActive] = useState(false);
  const [slashPos, setSlashPos] = useState({ x: 0, y: 0 });
  const [flashWhite, setFlashWhite] = useState(false);
  const [screenDarken, setScreenDarken] = useState(false);
  const [shakeClass, setShakeClass] = useState(""); // "" | "screen-shake" | "player-shake"
  const [showAttackPopup, setShowAttackPopup] = useState(false);

  // Display overrides (hit / death overlays)
  const [displayPlayerPhase, setDisplayPlayerPhase] = useState("idle");
  const [displayEnemyPhase, setDisplayEnemyPhase] = useState("idle");
  const [freezePlayer, setFreezePlayer] = useState(false);

  // Damage numbers
  const [dmgPopup, setDmgPopup] = useState(null); // { value, side: "player"|"enemy", id }

  const busyRef = useRef(false); // prevent double-click during sequence
  const lockPlayerPosRef = useRef(false); // prevent hero position changes during enemy attack
  const idleAttackTimerRef = useRef(null);
  const consecutivePlayerAttacksRef = useRef(0);
  const cancelMove = useRef(null);
  const timers = useRef([]);
  const mounted = useRef(true);

  // ── safe timer helpers ───────────────────────────────────────────────────
  const after = useCallback((ms, fn) => {
    const id = setTimeout(() => {
      if (mounted.current) fn();
    }, ms);
    timers.current.push(id);
    return id;
  }, []);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelMove.current?.();
    if (idleAttackTimerRef.current) {
      clearTimeout(idleAttackTimerRef.current);
      idleAttackTimerRef.current = null;
    }
  }, []);

  // ── mount / unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    sounds.startFightMusic();

    // Open combat with the attack prompt after a short intro pause
    after(800, () => {
      gameState.setPhase("readyToAttack");
      setShowAttackPopup(true);
    });

    return () => {
      mounted.current = false;
      sounds.stopFightMusic();
      clearAll();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── enemy-death watcher ──────────────────────────────────────────────────
  useEffect(() => {
    if (gameState.phase === "death") {
      lockPlayerPosRef.current = false;
      setFreezePlayer(false);
      setPlayerPhase("idle");
      setDisplayPlayerPhase("idle");
      setDisplayEnemyPhase("death");
      setScreenDarken(true);
      after(3200, () => {
        sounds.victory();
        gameState.setScreen("reward");
      });
    }
  }, [gameState.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── player-dead watcher ─────────────────────────────────────────────────
  useEffect(() => {
    if (gameState.phase === "playerDead") {
      clearAll();
      busyRef.current = false;
      lockPlayerPosRef.current = false;
      setFreezePlayer(false);
      setEnemyPhase("idle");
      setDisplayEnemyPhase("idle");
      setDisplayPlayerPhase("death");
      setScreenDarken(true);
      after(3200, () => {
        gameState.resetGame();
        gameState.setScreen("intro");
      });
    }
  }, [clearAll, gameState.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── helpers to keep refs+state in sync during movement ──────────────────
  const setPlayerX = useCallback((v) => {
    if (lockPlayerPosRef.current) return; // Don't move player when locked
    const val = typeof v === "function" ? v(playerXRef.current) : v;
    playerXRef.current = val;
    setPlayerPos(val);
  }, []);

  const setEnemyX = useCallback((v) => {
    const val = typeof v === "function" ? v(enemyXRef.current) : v;
    enemyXRef.current = val;
    setEnemyPos(val);
  }, []);

  // ── show floating damage number ──────────────────────────────────────────
  const showDmg = useCallback(
    (value, side) => {
      const id = Date.now();
      setDmgPopup({ value, side, id });
      after(900, () => setDmgPopup(null));
    },
    [after],
  );

  // ── enemy auto-attack when player stays idle ─────────────────────────────
  const runEnemyAttack = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    consecutivePlayerAttacksRef.current = 0;
    setShowAttackPopup(false);
    gameState.setPhase("enemyAttacking");

    // Force player to steady home position
    lockPlayerPosRef.current = false;
    setFreezePlayer(false);
    setPlayerX(SPRITE_POSITIONS.PLAYER_HOME_X);
    playerXRef.current = SPRITE_POSITIONS.PLAYER_HOME_X;
    setPlayerPos(SPRITE_POSITIONS.PLAYER_HOME_X);
    lockPlayerPosRef.current = true;
    setFreezePlayer(true);

    const atk2 = randomAttack();
    setEnemyPhase("run");
    setDisplayEnemyPhase("run");

    const enemyStartX = enemyXRef.current;
    const enemyTargetX = 400; // Mirror distance from player
    const enemyRunDur = 150;
    let eRunStart = null;
    let eRunId;
    const eRunTick = (ts) => {
      if (!eRunStart) eRunStart = ts;
      const t = Math.min(1, (ts - eRunStart) / enemyRunDur);
      const ease = 1 - Math.pow(1 - t, 3);
      const nx = enemyStartX + (enemyTargetX - enemyStartX) * ease;
      enemyXRef.current = nx;
      setEnemyPos(nx);
      if (t < 1) eRunId = requestAnimationFrame(eRunTick);
      else setEnemyX(enemyTargetX);
    };
    eRunId = requestAnimationFrame(eRunTick);

    after(enemyRunDur + 40, () => {
      cancelAnimationFrame(eRunId);
      setEnemyX(enemyTargetX);

      setEnemyPhase(atk2);
      setDisplayEnemyPhase(atk2);
      sounds.swordSlice();

      after(60, () => {
        setSlashActive(true);
        setFlashWhite(true);
        setSlashPos({ x: playerXRef.current + 30, y: 200 });
        after(280, () => setSlashActive(false));
        after(160, () => setFlashWhite(false));

        setFreezePlayer(true);
        setDisplayPlayerPhase("hit");

        // Knockback effect
        const hitStartX = playerXRef.current;
        const knockbackDist = 40;
        const knockbackDur = 150;
        let kbStart = null;
        let kbId;
        const kbTick = (ts) => {
          if (!kbStart) kbStart = ts;
          const t = Math.min(1, (ts - kbStart) / knockbackDur);
          const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          const kbX = hitStartX - knockbackDist * ease;
          playerXRef.current = kbX;
          setPlayerPos(kbX);
          if (t < 1) kbId = requestAnimationFrame(kbTick);
          else {
            playerXRef.current = hitStartX;
            setPlayerPos(hitStartX);
          }
        };
        kbId = requestAnimationFrame(kbTick);

        after(1200, () => {
          if (!mounted.current) return;
          if (gameState.phase === "playerDead") return;
          setDisplayPlayerPhase("idle");
          setFreezePlayer(true);
        });
        setShakeClass("screen-shake");
        after(280, () => setShakeClass(""));

        const eDmg = 14;
        gameState.doPlayerDamage(eDmg);
        showDmg(eDmg, "player");
        if (navigator.vibrate) navigator.vibrate(120);

        after(50, () => {
          if (gameState.playerHP <= eDmg) {
            gameState.setPhase("playerDead");
            return;
          }

          after(380, () => {
            setEnemyPhase("idle");
            setDisplayEnemyPhase("idle");

            const eRetStart = enemyXRef.current;
            const eHomeX = SPRITE_POSITIONS.ENEMY_HOME_X;
            let eRetS = null;
            let eRetId;
            const eRetTick = (ts) => {
              if (!eRetS) eRetS = ts;
              const t = Math.min(1, (ts - eRetS) / 320);
              const ease = 1 - Math.pow(1 - t, 3);
              const nx = eRetStart + (eHomeX - eRetStart) * ease;
              enemyXRef.current = nx;
              setEnemyPos(nx);
              if (t < 1) eRetId = requestAnimationFrame(eRetTick);
              else setEnemyX(eHomeX);
            };
            eRetId = requestAnimationFrame(eRetTick);

            after(500, () => {
              setPlayerPhase("idle");
              setDisplayPlayerPhase("idle");
              lockPlayerPosRef.current = false;
              setFreezePlayer(true);
              busyRef.current = false;
              gameState.setPhase("readyToAttack");
              setShowAttackPopup(true);
            });
          });
        });
      });
    });
  }, [after, gameState, setEnemyX, setPlayerX, showDmg, sounds]);

  useEffect(() => {
    if (idleAttackTimerRef.current) {
      clearTimeout(idleAttackTimerRef.current);
      idleAttackTimerRef.current = null;
    }

    if (gameState.phase === "readyToAttack" && !busyRef.current) {
      setFreezePlayer(true);
      const idleDelay = 1500;
      idleAttackTimerRef.current = after(idleDelay, () => {
        if (!mounted.current) return;
        if (gameState.phase !== "readyToAttack") return;
        runEnemyAttack();
      });
    }
  }, [after, gameState.phase, runEnemyAttack]);

  // ─────────────────────────────────────────────────────────────────────────
  //  FULL TURN SEQUENCE  (called once per player click)
  // ─────────────────────────────────────────────────────────────────────────
  const runTurn = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    consecutivePlayerAttacksRef.current += 1;
    lockPlayerPosRef.current = false;
    setFreezePlayer(false);
    if (idleAttackTimerRef.current) {
      clearTimeout(idleAttackTimerRef.current);
      idleAttackTimerRef.current = null;
    }
    setShowAttackPopup(false);
    clearAll();

    // ── 1. Player runs toward enemy ────────────────────────────────────────
    setPlayerPhase("run");
    setDisplayPlayerPhase("run");
    setDisplayEnemyPhase("protect"); // enemy braces
    setEnemyPhase("protect");

    const startX = playerXRef.current;
    const targetX = 730; // Move toward center
    const runDur = 170; // ms

    let moveStart = null;
    let moveId;
    const moveTick = (ts) => {
      if (!moveStart) moveStart = ts;
      const t = Math.min(1, (ts - moveStart) / runDur);
      const ease = 1 - Math.pow(1 - t, 3);
      const newX = startX + (targetX - startX) * ease;
      playerXRef.current = newX;
      setPlayerPos(newX);
      if (t < 1) {
        moveId = requestAnimationFrame(moveTick);
      }
    };
    moveId = requestAnimationFrame(moveTick);
    cancelMove.current = () => cancelAnimationFrame(moveId);

    // ── 2. Player attacks (after run arrives) ──────────────────────────────
    after(runDur + 60, () => {
      cancelAnimationFrame(moveId);
      setPlayerX(targetX);

      const atk = randomAttack();
      setPlayerPhase(atk);
      setDisplayPlayerPhase(atk);
      sounds.swordSlice();

      // Slash FX on enemy
      after(80, () => {
        setSlashActive(true);
        setFlashWhite(true);
        setSlashPos({ x: enemyXRef.current - 60, y: 200 });
        after(280, () => setSlashActive(false));
        after(160, () => setFlashWhite(false));

        // Enemy hit reaction
        setDisplayEnemyPhase("hit");
        setShakeClass("screen-shake");
        after(300, () => setShakeClass(""));

        // Deal damage
        const dmg = 15;
        gameState.doDamage(dmg);
        showDmg(dmg, "enemy");
        if (navigator.vibrate) navigator.vibrate(180);
        sounds.enemyHit();

        // Check if kill shot after a short frame
        after(50, () => {
          if (gameState.enemyHP <= dmg) {
            // Enemy dies – let the death watcher handle the screen
            sounds.enemyDeath();
            gameState.setPhase("death");
            return;
          }

          // ── 3. Reset and return control to player ───────────────────────
          after(400, () => {
            setEnemyPhase("idle");
            setDisplayEnemyPhase("idle");
            setPlayerPhase("idle");
            setDisplayPlayerPhase("idle");

            const playerReturnStart = playerXRef.current;
            const playerHomeX = SPRITE_POSITIONS.PLAYER_HOME_X;
            let retStart = null;
            let retId;
            const retTick = (ts) => {
              if (!retStart) retStart = ts;
              const t = Math.min(1, (ts - retStart) / 300);
              const ease = 1 - Math.pow(1 - t, 3);
              const nx =
                playerReturnStart + (playerHomeX - playerReturnStart) * ease;
              playerXRef.current = nx;
              setPlayerPos(nx);
              if (t < 1) retId = requestAnimationFrame(retTick);
              else {
                setPlayerX(playerHomeX);
                playerXRef.current = playerHomeX;
                setPlayerPos(playerHomeX);
                lockPlayerPosRef.current = false;
                setFreezePlayer(true);
                busyRef.current = false;
                const shouldCounter = consecutivePlayerAttacksRef.current >= 3;
                if (shouldCounter) {
                  runEnemyAttack();
                } else {
                  gameState.setPhase("readyToAttack");
                  setShowAttackPopup(true);
                }
              }
            };
            retId = requestAnimationFrame(retTick);
          });
        });
      });
    });
  }, [gameState, sounds, after, clearAll, setPlayerX, setEnemyX, showDmg, runEnemyAttack]);

  // ── click handler ────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (gameState.phase === "readyToAttack") runTurn();
  }, [gameState.phase, runTurn]);

  const isDead = gameState.phase === "death";
  const isPlayerDead = gameState.phase === "playerDead";

  return (
    <div
      className={shakeClass}
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

      {/* Shake animation is applied to container via className */}

      {/* HUD */}
      {!isDead && !isPlayerDead && (
        <>
          {/* Player HUD */}
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
                filter: "drop-shadow(0 0 5px rgba(255,255,255,0.5))",
                marginRight: "-30px",
                position: "relative",
                zIndex: 10,
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
                  marginLeft: "30px",
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
              />
            </div>
          </div>

          {/* Enemy HUD */}
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
                filter: "drop-shadow(0 0 5px rgba(255,0,0,0.5))",
                marginLeft: "-40px",
                position: "relative",
                zIndex: 10,
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
                  marginRight: "40px",
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
              />
            </div>
          </div>
        </>
      )}

      {/* Player sprite */}
      <PlayerSprite
        x={playerPos}
        y={SPRITE_POSITIONS.SPRITE_Y}
        phase={displayPlayerPhase}
        freeze={freezePlayer}
      />

      {/* Enemy sprite */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          filter: isDead ? "grayscale(1)" : "none",
          transition: "filter 0.6s ease-out",
          willChange: "filter",
        }}>
        <EnemySprite
          x={enemyPos}
          y={SPRITE_POSITIONS.SPRITE_Y}
          phase={displayEnemyPhase}
          isFlash={false}
        />
      </div>

      {/* Attack popup */}
      {!isDead && !isPlayerDead && (
        <AttackPopup visible={showAttackPopup} onClick={handleClick} />
      )}

      {/* Slash VFX */}
      {slashActive && (
        <div
          className="slash-effect"
          style={{ left: `${slashPos.x}px`, top: `${slashPos.y}px` }}
        />
      )}

      {/* Flash overlay */}
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

      {/* Darken overlay (death) */}
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

      {/* Floating damage number */}
      {dmgPopup && (
        <div
          key={dmgPopup.id}
          className="damage-popup"
          style={{
            position: "absolute",
            left:
              dmgPopup.side === "enemy"
                ? `${enemyPos - 20}px`
                : `${playerPos + 20}px`,
            top: "230px",
            color: dmgPopup.side === "enemy" ? "#ff4444" : "#ffaa00",
            fontSize: "40px",
            fontWeight: "900",
            fontFamily: "'Press Start 2P', monospace",
            textShadow: "0 0 10px currentColor, 2px 2px 0 #000",
            pointerEvents: "none",
            zIndex: 200,
            animation: "dmgFloat 0.9s ease-out forwards",
          }}>
          -{dmgPopup.value}
        </div>
      )}
    </div>
  );
}
