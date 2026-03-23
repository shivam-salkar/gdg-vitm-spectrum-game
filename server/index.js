import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { CONFIG } from '../src/constants/gameConfig.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Simple game state (in-memory)
const games = {}; // { sessionId: { players, enemyHP, playerHP, phase, etc } }
const attackQueues = {}; // { sessionId: [attacks] }

// Game room management
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join game room
  socket.on('joinGame', ({ sessionId, playerId }) => {
    socket.join(sessionId);
    console.log(`${playerId} joined session ${sessionId}`);

    // Create game if doesn't exist
    if (!games[sessionId]) {
      games[sessionId] = {
        players: [playerId],
        enemyHP: CONFIG.ENEMY_MAX_HP,
        playerHP: { [playerId]: CONFIG.PLAYER_MAX_HP },
        phase: 'readyToAttack',
      };
      attackQueues[sessionId] = [];
      console.log('New game session created:', sessionId);
    } else {
      if (!games[sessionId].players.includes(playerId)) {
        games[sessionId].players.push(playerId);
      }
      games[sessionId].playerHP[playerId] = CONFIG.PLAYER_MAX_HP;
    }

    // Send current state to this player
    socket.emit('syncState', games[sessionId]);

    // Tell others a new player joined
    socket.to(sessionId).emit('playerJoined', {
      playerId,
      totalPlayers: games[sessionId].players.length,
    });
  });

  // Handle attack request
  socket.on('attack', ({ sessionId, playerId }) => {
    if (!games[sessionId]) return;
    
    // Add to queue
    attackQueues[sessionId].push({
      playerId,
      damage: CONFIG.PLAYER_DAMAGE_PER_HIT,
    });
    console.log(`Attack queued from ${playerId} in ${sessionId}`);
  });

  // Handle enemy counter attack (3 player attacks = 1 enemy attack)
  socket.on('enemyCounterAttack', ({ sessionId }) => {
    if (!games[sessionId]) return;

    const game = games[sessionId];
    
    // Apply damage to each player
    game.players.forEach(playerId => {
      const oldHP = game.playerHP[playerId];
      game.playerHP[playerId] = Math.max(0, oldHP - CONFIG.ENEMY_DAMAGE_PER_HIT);
    });

    // Send updated state
    io.to(sessionId).emit('syncState', game);
  });

  // Handle game reset
  socket.on('resetGame', ({ sessionId }) => {
    if (games[sessionId]) {
      delete games[sessionId];
      delete attackQueues[sessionId];
      console.log('Game session reset:', sessionId);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Process attacks from queue every 500ms
setInterval(() => {
  Object.keys(attackQueues).forEach((sessionId) => {
    const game = games[sessionId];
    const queue = attackQueues[sessionId];

    // Process ONE attack from queue
    if (queue.length > 0 && game) {
      const attack = queue.shift();
      const oldEnemyHP = game.enemyHP;
      game.enemyHP = Math.max(0, game.enemyHP - attack.damage);

      console.log(`Attack processed: ${oldEnemyHP} -> ${game.enemyHP} (damage: ${attack.damage})`);

      // Check if enemy died
      if (game.enemyHP <= 0 && game.phase !== 'death') {
        game.phase = 'death';
        console.log(`Enemy defeated in session ${sessionId}`);
      }

      // Send updated state to all players in this session
      io.to(sessionId).emit('syncState', game);
    }
  });
}, 500); // Process attacks every 500ms

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
