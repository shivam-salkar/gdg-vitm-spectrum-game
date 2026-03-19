import { useState, useCallback } from "react";

const initialState = {
  screen: "loading", // "loading" | "intro" | "tutorial" | "combat" | "reward"
  enemyHP: 100,
  playerHP: 100,
  phase: "idle", // "idle" | "readyToAttack" | "running" | "attacking" | "hit" | "death" | "enemyAttacking" | "playerDead"
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

  const doPlayerDamage = useCallback((amount) => {
    setState((s) => {
      const newHP = Math.max(0, s.playerHP - amount);
      return {
        ...s,
        playerHP: newHP,
        phase: newHP <= 0 ? "playerDead" : s.phase,
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    setState({ ...initialState, screen: "loading" });
  }, []);

  return {
    ...state,
    setScreen,
    setPhase,
    setAttackType,
    doDamage,
    doPlayerDamage,
    resetGame,
  };
}
