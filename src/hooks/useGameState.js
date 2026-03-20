import { useState, useCallback } from "react";

const VALID_START_SCREENS = new Set(["loading", "intro"]);

const envStartScreen = String(import.meta.env.VITE_START_SCREEN || "")
  .trim()
  .toLowerCase();

const fallbackStartScreen = import.meta.env.DEV ? "intro" : "loading";

const INITIAL_SCREEN = VALID_START_SCREENS.has(envStartScreen)
  ? envStartScreen
  : fallbackStartScreen;

const initialState = {
  screen: INITIAL_SCREEN, // "loading" | "intro" | "tutorial" | "combat" | "reward"
  enemyHP: 100,
  playerHP: 100,
  phase: "idle", // "idle" | "readyToAttack" | "running" | "attacking" | "hit" | "death"
  attackType: null, // "attack1" | "attack2" | "attack3"
  clickCount: 0,
};

export function useGameState() {
  const [state, setState] = useState(initialState);

  const setScreen = useCallback((screen) => {
    setState((s) => ({ ...s, screen, phase: "idle" }));
  }, []);

  const setPhase = useCallback((phase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setAttackType = useCallback((attackType) => {
    setState((s) => ({ ...s, attackType }));
  }, []);

  const doDamage = useCallback((amount) => {
    setState((s) => {
      const newHP = Math.max(0, s.enemyHP - amount);
      return {
        ...s,
        enemyHP: newHP,
        clickCount: s.clickCount + 1,
        phase: newHP <= 0 ? "death" : s.phase,
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    setState({ ...initialState, screen: INITIAL_SCREEN });
  }, []);

  return {
    ...state,
    setScreen,
    setPhase,
    setAttackType,
    doDamage,
    resetGame,
  };
}
