import { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';

export function useMultiplayerGame(sessionId, playerId, enabled = false) {
  const [gameState, setGameState] = useState(null);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !sessionId || !playerId) return;

    const SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL || "http://localhost:3000";

    // Connect to server
    const newSocket = io(SERVER_URL , {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('Connected to game server');
      newSocket.emit('joinGame', { sessionId, playerId });
    });

    // Receive state updates
    newSocket.on('syncState', (state) => {
      console.log('State synced:', state);
      setGameState(state);
    });

    // Player joined event
    newSocket.on('playerJoined', (data) => {
      console.log('Player joined:', data);
    });

    // Error handling
    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, playerId, enabled]);

  // Send attack to server
  const sendAttack = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('attack', { sessionId, playerId });
  }, [sessionId, playerId]);

  // Trigger enemy counter attack
  const triggerEnemyCounterAttack = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('enemyCounterAttack', { sessionId });
  }, [sessionId]);

  // Reset game
  const resetGame = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('resetGame', { sessionId });
  }, [sessionId]);

  return {
    gameState,
    sendAttack,
    triggerEnemyCounterAttack,
    resetGame,
    isConnected: socket?.connected || false,
  };
}
