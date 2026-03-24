import { useEffect, useState, useCallback, useRef } from "react";
import io from "socket.io-client";

export function useMultiplayerGame(sessionId, playerId, enabled = false) {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasSyncedState, setHasSyncedState] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !sessionId || !playerId) return undefined;

    const SERVER_URL =
      import.meta.env.VITE_GAME_SERVER_URL || "http://localhost:3000";
    let disposed = false;

    setGameState(null);
    setIsConnected(false);
    setHasSyncedState(false);
    setConnectionError(null);
    setLastSyncAt(null);

    // Connect to server
    const newSocket = io(SERVER_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      if (disposed) return;
      console.log("Connected to game server");
      setIsConnected(true);
      setConnectionError(null);
      newSocket.emit("joinGame", { sessionId, playerId });
    });

    // Receive state updates
    newSocket.on("syncState", (state) => {
      if (disposed) return;
      console.log("State synced:", state);
      setGameState(state);
      setHasSyncedState(true);
      setLastSyncAt(Date.now());
      setConnectionError(null);
    });

    // Player joined event
    newSocket.on("playerJoined", (data) => {
      if (disposed) return;
      console.log("Player joined:", data);
    });

    // Error handling
    newSocket.on("connect_error", (error) => {
      if (disposed) return;
      console.error("Connection error:", error);
      setIsConnected(false);
      setConnectionError(error);
    });

    newSocket.on("disconnect", (reason) => {
      if (disposed) return;
      console.warn("Disconnected from game server:", reason);
      setIsConnected(false);
      if (reason !== "io client disconnect") {
        setConnectionError(new Error(`Socket disconnected: ${reason}`));
      }
    });

    socketRef.current = newSocket;

    return () => {
      disposed = true;
      socketRef.current = null;
      newSocket.disconnect();
    };
  }, [sessionId, playerId, enabled]);

  // Send attack to server
  const sendAttack = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit("attack", { sessionId, playerId });
  }, [sessionId, playerId]);

  // Trigger enemy counter attack
  const triggerEnemyCounterAttack = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit("enemyCounterAttack", { sessionId });
  }, [sessionId]);

  // Reset game
  const resetGame = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit("resetGame", { sessionId });
  }, [sessionId]);

  return {
    gameState,
    sendAttack,
    triggerEnemyCounterAttack,
    resetGame,
    isConnected,
    hasSyncedState,
    hasConnectionError: !!connectionError,
    connectionError,
    lastSyncAt,
  };
}
