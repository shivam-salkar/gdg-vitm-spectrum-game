import React, { useState, useRef, useCallback, useEffect } from "react";
import Background from "./Background.jsx";
import PlayerSprite from "./PlayerSprite.jsx";
import EnemySprite from "./EnemySprite.jsx";
import HealthBar from "./HealthBar.jsx";
import AttackPopup from "./AttackPopup.jsx";
import { CONFIG, SPRITE_POSITIONS } from "../constants/gameConfig.js";
import { useMultiplayerGame } from "../hooks/useMultiplayerGame.js";
import "../game.css";

// ─── helpers ────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const ATTACKS = ["attack1", "attack2", "attack3"];
const randomAttack = () => ATTACKS[rand(0, 2)];

// ─── component ──────────────────────────────────────────────────────────────
export default function CombatScreen({
  gameState,
  sounds,
  multiplayerConfig = null,
}) {
  // Multiplayer support
  const multiplayerEnabled = !!multiplayerConfig;
  const {
    gameState: mpGameState,
    sendAttack,
    triggerEnemyCounterAttack,
    hasSyncedState,
    hasConnectionError,
    isConnected,
    lastSyncAt,
  } = useMultiplayerGame(
    multiplayerConfig?.sessionId,
    multiplayerConfig?.playerId,
    multiplayerEnabled,
  );
  const [localFallbackForced, setLocalFallbackForced] = useState(false);
  const lastSyncAtRef = useRef(null);
  const multiplayerReady =
    multiplayerEnabled && isConnected && hasSyncedState && !localFallbackForced;

  // Use multiplayer state if available, otherwise use local state
  const activeGameState =
    multiplayerReady && mpGameState ? mpGameState : gameState;
  const offlineMode = !multiplayerReady;
  const playerDamagePerHit = offlineMode
    ? CONFIG.OFFLINE_PLAYER_DAMAGE_PER_HIT
    : CONFIG.PLAYER_DAMAGE_PER_HIT;
  const enemyDamagePerHit = offlineMode
    ? CONFIG.OFFLINE_ENEMY_DAMAGE_PER_HIT
    : CONFIG.ENEMY_DAMAGE_PER_HIT;

  // Sprite positions stored as refs for smooth rAF movement (no re-render per frame)
  const playerXRef = useRef(SPRITE_POSITIONS.PLAYER_HOME_X);
  const enemyXRef = useRef(SPRITE_POSITIONS.ENEMY_HOME_X);

  // React state for positions only used to drive the DOM style (updated via rAF)
  const [playerPos, setPlayerPos] = useState(SPRITE_POSITIONS.PLAYER_HOME_X);
  const [enemyPos, setEnemyPos] = useState(SPRITE_POSITIONS.ENEMY_HOME_X);

  // Sprite animation phases
  const [, setPlayerPhase] = useState("idle");
  const [, setEnemyPhase] = useState("idle");

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

  const forceLocalFallback = useCallback((reason) => {
    setLocalFallbackForced((wasForced) => {
      if (!wasForced) {
        console.warn(`Falling back to local combat: ${reason}`);
      }
      return true;
    });
  }, []);

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

  useEffect(() => {
    lastSyncAtRef.current = lastSyncAt;
  }, [lastSyncAt]);

  useEffect(() => {
    setLocalFallbackForced(false);
  }, [multiplayerConfig?.playerId, multiplayerConfig?.sessionId]);

  useEffect(() => {
    if (!multiplayerEnabled || localFallbackForced) return undefined;
    if (hasConnectionError) {
      forceLocalFallback("server connection failed");
      return undefined;
    }
    if (hasSyncedState) return undefined;

    const timeoutId = window.setTimeout(() => {
      forceLocalFallback("server did not respond in time");
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [
    forceLocalFallback,
    hasConnectionError,
    hasSyncedState,
    localFallbackForced,
    multiplayerEnabled,
  ]);

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

  // ── multiplayer state sync ───────────────────────────────────────────────
  useEffect(() => {
    if (multiplayerReady && mpGameState) {
      // Sync enemy HP from multiplayer
      const currentEnemyHP = gameState.enemyHP;
      if (mpGameState.enemyHP !== currentEnemyHP) {
        // Server says enemy HP changed
        const damageAmount = currentEnemyHP - mpGameState.enemyHP;
        if (damageAmount > 0) {
          // Enemy took damage
          gameState.doDamage(damageAmount);
          showDmg(damageAmount, "enemy");
          sounds.enemyHit();
        }
      }

      // Sync phase. Some older server states may still send "combat".
      const syncedPhase =
        mpGameState.phase === "combat" ? "readyToAttack" : mpGameState.phase;
      if (syncedPhase !== gameState.phase) {
        gameState.setPhase(syncedPhase);
      }

      // Sync player HP. Prefer shared HP number from server; keep object fallback for older payloads.
      const syncedPlayerHP =
        typeof mpGameState.playerHP === "number"
          ? mpGameState.playerHP
          : (() => {
              const hpValues = Object.values(mpGameState.playerHP || {}).filter(
                (value) => typeof value === "number",
              );
              return hpValues.length > 0 ? Math.min(...hpValues) : undefined;
            })();

      if (
        typeof syncedPlayerHP === "number" &&
        syncedPlayerHP !== gameState.playerHP
      ) {
        const damage = gameState.playerHP - syncedPlayerHP;
        if (damage > 0) {
          gameState.doPlayerDamage(damage);
          showDmg(damage, "player");
        }
      }
    }
  }, [multiplayerReady, mpGameState]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-disable react-hooks/set-state-in-effect */

  // ── enemy-death watcher ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeGameState.phase === "death") {
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
  }, [activeGameState.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // ── player-dead watcher ─────────────────────────────────────────────────
  useEffect(() => {
    if (activeGameState.phase === "playerDead") {
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
  }, [clearAll, activeGameState.phase]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const applyLocalEnemyDamage = useCallback(
    (value) => {
      gameState.doDamage(value);
      showDmg(value, "enemy");
    },
    [gameState, showDmg],
  );

  const applyLocalPlayerDamage = useCallback(
    (value) => {
      gameState.doPlayerDamage(value);
      showDmg(value, "player");
    },
    [gameState, showDmg],
  );

  // ── enemy auto-attack when player stays idle ─────────────────────────────
  const runEnemyAttack = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    // Reset consecutive hit counter whenever enemy gets to attack
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
    const enemyTargetX = SPRITE_POSITIONS.ENEMY_ATTACK_X;
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
        const kbTick = (ts) => {
          if (!kbStart) kbStart = ts;
          const t = Math.min(1, (ts - kbStart) / knockbackDur);
          const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          const kbX = hitStartX - knockbackDist * ease;
          playerXRef.current = kbX;
          setPlayerPos(kbX);
          if (t < 1) requestAnimationFrame(kbTick);
          else {
            playerXRef.current = hitStartX;
            setPlayerPos(hitStartX);
          }
        };
        requestAnimationFrame(kbTick);

        after(1200, () => {
          if (!mounted.current) return;
          if (gameState.phase === "playerDead") return;
          setDisplayPlayerPhase("idle");
          setFreezePlayer(true);
        });
        setShakeClass("screen-shake");
        after(280, () => setShakeClass(""));

        const eDmg = enemyDamagePerHit;
        if (multiplayerReady) {
          // Multiplayer: tell server to apply shared damage when enemy attacks
          const sentAt = Date.now();
          triggerEnemyCounterAttack();
          after(900, () => {
            if ((lastSyncAtRef.current ?? 0) > sentAt) return;
            forceLocalFallback("enemy counter attack timed out");
            applyLocalPlayerDamage(eDmg);
          });
        } else {
          if (multiplayerEnabled) {
            forceLocalFallback("enemy attack started before server sync");
          }
          // Single-player: apply damage locally
          applyLocalPlayerDamage(eDmg);
        }
        // In multiplayer, server will broadcast enemy damage to all players via syncState
        if (navigator.vibrate) navigator.vibrate(120);

        after(50, () => {
          if (!multiplayerReady) {
            // Single-player: determine death locally based on pre-hit HP
            if (activeGameState.playerHP <= eDmg) {
              gameState.setPhase("playerDead");
              return;
            }
          }

          after(380, () => {
            setEnemyPhase("idle");
            setDisplayEnemyPhase("idle");

            const eRetStart = enemyXRef.current;
            const eHomeX = SPRITE_POSITIONS.ENEMY_HOME_X;
            let eRetS = null;
            const eRetTick = (ts) => {
              if (!eRetS) eRetS = ts;
              const t = Math.min(1, (ts - eRetS) / 320);
              const ease = 1 - Math.pow(1 - t, 3);
              const nx = eRetStart + (eHomeX - eRetStart) * ease;
              enemyXRef.current = nx;
              setEnemyPos(nx);
              if (t < 1) requestAnimationFrame(eRetTick);
              else setEnemyX(eHomeX);
            };
            requestAnimationFrame(eRetTick);

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
  }, [
    after,
    applyLocalPlayerDamage,
    activeGameState.playerHP,
    enemyDamagePerHit,
    forceLocalFallback,
    gameState,
    multiplayerReady,
    setEnemyX,
    setPlayerX,
    sounds,
    triggerEnemyCounterAttack,
  ]);

  useEffect(() => {
    if (idleAttackTimerRef.current) {
      clearTimeout(idleAttackTimerRef.current);
      idleAttackTimerRef.current = null;
    }

    if (gameState.phase === "readyToAttack" && !busyRef.current) {
      setFreezePlayer(true);
      // Enemy attacks again after a random interval (1-5 seconds),
      // independent of how many times the hero has attacked.
      const idleDelay = rand(1000, 5000);
      idleAttackTimerRef.current = after(idleDelay, () => {
        if (!mounted.current) return;
        if (gameState.phase !== "readyToAttack") return;
        runEnemyAttack();
      });
    }
  }, [after, gameState.phase, runEnemyAttack]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─────────────────────────────────────────────────────────────────────────
  //  FULL TURN SEQUENCE  (called once per player click)
  // ─────────────────────────────────────────────────────────────────────────
  const runTurn = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    // Track how many times the hero has attacked in a row without
    // giving the enemy a chance to respond.
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
    const targetX = SPRITE_POSITIONS.PLAYER_ATTACK_X;
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
        const dmg = playerDamagePerHit;
        if (multiplayerReady) {
          // Send attack to server
          const sentAt = Date.now();
          sendAttack();
          after(900, () => {
            if ((lastSyncAtRef.current ?? 0) > sentAt) return;
            forceLocalFallback("player attack timed out");
            applyLocalEnemyDamage(dmg);
          });
        } else {
          if (multiplayerEnabled) {
            forceLocalFallback("player attack started before server sync");
          }
          // Single-player: apply damage locally
          applyLocalEnemyDamage(dmg);
        }
        if (navigator.vibrate) navigator.vibrate(180);
        sounds.enemyHit();

        // Check if kill shot after a short frame
        after(50, () => {
          if (activeGameState.enemyHP <= dmg) {
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
            const retTick = (ts) => {
              if (!retStart) retStart = ts;
              const t = Math.min(1, (ts - retStart) / 300);
              const ease = 1 - Math.pow(1 - t, 3);
              const nx =
                playerReturnStart + (playerHomeX - playerReturnStart) * ease;
              playerXRef.current = nx;
              setPlayerPos(nx);
              if (t < 1) requestAnimationFrame(retTick);
              else {
                setPlayerX(playerHomeX);
                playerXRef.current = playerHomeX;
                setPlayerPos(playerHomeX);
                lockPlayerPosRef.current = false;
                setFreezePlayer(true);
                busyRef.current = false;
                // If the hero has attacked several times in a row
                // without the enemy hitting back, force an immediate
                // counter attack instead of letting them spam forever.
                const shouldForceCounter =
                  consecutivePlayerAttacksRef.current >= 3;
                if (shouldForceCounter) {
                  runEnemyAttack();
                } else {
                  gameState.setPhase("readyToAttack");
                  setShowAttackPopup(true);
                }
              }
            };
            requestAnimationFrame(retTick);
          });
        });
      });
    });
  }, [
    activeGameState.enemyHP,
    after,
    applyLocalEnemyDamage,
    clearAll,
    forceLocalFallback,
    gameState,
    multiplayerReady,
    playerDamagePerHit,
    runEnemyAttack,
    sendAttack,
    setPlayerX,
    sounds,
  ]);

  // ── click handler ────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (activeGameState.phase === "readyToAttack") runTurn();
  }, [activeGameState.phase, runTurn]);

  const isDead = activeGameState.phase === "death";
  const isPlayerDead = activeGameState.phase === "playerDead";

  return (
    <div
      className={shakeClass}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#0d1117",
        overflow: "hidden",
        contain: "layout paint",
        cursor:
          activeGameState.phase === "readyToAttack" ? "pointer" : "default",
        touchAction: "manipulation",
        userSelect: "none",
      }}
      onClick={handleClick}
    >
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
            }}
          >
            <div
              style={{
                width: "128px",
                height: "128px",
                backgroundImage: "url('/assets/hero-icon.webp')",
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
              }}
            >
              <div
                className="pixel-text pixel-text--soft"
                style={{
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginLeft: "30px",
                  letterSpacing: "1px",
                }}
              >
                THE GHOST (YOU)
              </div>
              <HealthBar
                hp={activeGameState.playerHP}
                maxHp={CONFIG.PLAYER_MAX_HP}
                color="green"
                width={270}
                height={22}
                style={{ marginLeft: "-12px" }}
              />
            </div>
          </div>

          {/* Enemy HUD */}
          <div
            style={{
              position: "absolute",
              right: "20px",
              top: "20px",
              display: "flex",
              flexDirection: "row-reverse",
              alignItems: "center",
              zIndex: 100,
            }}
          >
            <div
              style={{
                width: "128px",
                height: "128px",
                backgroundImage: "url('/assets/enemy-icon.webp')",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                transform: "scaleX(-1)",
                imageRendering: "pixelated",
                filter: "drop-shadow(0 0 5px rgba(255,0,0,0.5))",
                marginLeft: "-11px",
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
              }}
            >
              <div
                className="pixel-text pixel-text--soft"
                style={{
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginRight: "40px",
                  letterSpacing: "1px",
                }}
              >
                KHOTUN KHAN
              </div>
              <HealthBar
                hp={activeGameState.enemyHP}
                maxHp={CONFIG.ENEMY_MAX_HP}
                color="enemy"
                width={270}
                height={22}
                style={{ marginRight: "8px" }}
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
        }}
      >
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
          className="damage-popup pixel-text"
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
            textShadow: "0 0 10px currentColor, 2px 2px 0 #000",
            pointerEvents: "none",
            zIndex: 200,
            animation: "dmgFloat 0.9s ease-out forwards",
          }}
        >
          -{dmgPopup.value}
        </div>
      )}
    </div>
  );
}
