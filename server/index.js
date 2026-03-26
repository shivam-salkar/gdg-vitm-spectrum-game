import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { CONFIG } from '../src/constants/gameConfig.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' },
  // Enable connection-state recovery so reconnecting clients resume seamlessly.
  connectionStateRecovery: { maxDisconnectionDuration: 30_000 },
});

// ---------------------------------------------------------------------------
// Optional Redis adapter – enables horizontal scaling across multiple Node
// processes (e.g. PM2 cluster mode).  Only activated when REDIS_URL is set.
// ---------------------------------------------------------------------------
if (process.env.REDIS_URL) {
  const pubClient = new Redis(process.env.REDIS_URL);
  const subClient = pubClient.duplicate();

  try {
    await Promise.all([
      new Promise((resolve, reject) => {
        pubClient.once('ready', resolve);
        pubClient.once('error', reject);
      }),
      new Promise((resolve, reject) => {
        subClient.once('ready', resolve);
        subClient.once('error', reject);
      }),
    ]);
  } catch (err) {
    console.error(
      `[startup] Failed to connect to Redis at ${process.env.REDIS_URL}.`,
      'Ensure Redis is running and REDIS_URL is correct.',
      err,
    );
    process.exit(1);
  }

  io.adapter(createAdapter(pubClient, subClient));
  console.log('[startup] Redis adapter active –', process.env.REDIS_URL);
} else {
  console.log('[startup] No REDIS_URL set – running single-process in-memory mode');
}

// ---------------------------------------------------------------------------
// In-memory game state
// ---------------------------------------------------------------------------
const games = {}; // { sessionId: { players, enemyHP, playerHP, phase, lastActivity, ... } }
const attackQueues = {}; // { sessionId: [attacks] }
const serverLogs = [];
const MAX_SERVER_LOGS = 2000;
const ADMIN_PASSWORD = process.env.NIMDA_PASSWORD || process.env.ADMIN_PASSWORD || 'nimda';

// Per-socket attack rate limiting – max attacks enqueued per RATE_WINDOW_MS.
const RATE_LIMIT_MAX = Number(process.env.ATTACK_RATE_LIMIT) || 10; // attacks per window
const RATE_WINDOW_MS = 1000; // 1-second sliding window
const socketAttackCounters = {}; // { socketId: { count, windowStart } }

// Idle session cleanup – sessions inactive for longer than this are removed.
const SESSION_IDLE_MS = (Number(process.env.SESSION_IDLE_MINUTES) || 30) * 60 * 1000;

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function addLog(type, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    type,
    payload,
  };

  serverLogs.push(entry);
  if (serverLogs.length > MAX_SERVER_LOGS) {
    serverLogs.shift();
  }

  console.log(`[${entry.ts}] ${type}`, payload);
}

/**
 * Check whether a socket is within the allowed attack rate.
 * Returns true when the attack should be allowed, false when it should be dropped.
 */
function allowAttack(socketId) {
  const now = Date.now();
  let counter = socketAttackCounters[socketId];

  if (!counter || now - counter.windowStart >= RATE_WINDOW_MS) {
    socketAttackCounters[socketId] = { count: 1, windowStart: now };
    return true;
  }

  counter.count += 1;
  if (counter.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

function normalizeGameState(game) {
  if (!game) return;

  if (!Array.isArray(game.players)) {
    game.players = [];
  }

  // Backward compatibility: migrate legacy per-player HP object to one shared HP value.
  if (typeof game.playerHP !== 'number') {
    if (game.playerHP && typeof game.playerHP === 'object') {
      const hpValues = Object.values(game.playerHP).filter((value) => typeof value === 'number');
      game.playerHP = hpValues.length > 0 ? Math.min(...hpValues) : CONFIG.PLAYER_MAX_HP;
    } else {
      game.playerHP = CONFIG.PLAYER_MAX_HP;
    }
  }

  game.playerHP = Math.max(0, Math.min(CONFIG.PLAYER_MAX_HP, game.playerHP));
}

/** Stamp the session's last-activity time to prevent premature cleanup. */
function touchSession(sessionId) {
  if (games[sessionId]) {
    games[sessionId].lastActivity = Date.now();
  }
}

function getAdminPasswordFromRequest(req) {
  const fromQuery = req.query.password;
  if (fromQuery) return String(fromQuery);

  const fromHeader = req.get('x-admin-password');
  if (fromHeader) return fromHeader;

  const authHeader = req.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return '';
}

function getSessionsSnapshot() {
  const now = Date.now();
  return Object.entries(games).map(([sessionId, game]) => ({
    sessionId,
    phase: game.phase,
    enemyHP: game.enemyHP,
    enemyMaxHP: CONFIG.ENEMY_MAX_HP,
    playerHP: game.playerHP,
    playerMaxHP: CONFIG.PLAYER_MAX_HP,
    attacksSinceEnemyCounter: game.attacksSinceEnemyCounter || 0,
    pendingQueue: attackQueues[sessionId]?.length || 0,
    players: [...game.players],
    idleSec: game.lastActivity ? Math.floor((now - game.lastActivity) / 1000) : null,
  }));
}

function renderAdminHtml(snapshot) {
  const sessionsRows = snapshot.sessions
    .map(
      (session) => `
        <tr>
          <td>${escapeHtml(session.sessionId)}</td>
          <td>${escapeHtml(session.phase)}</td>
          <td>${session.enemyHP}/${session.enemyMaxHP}</td>
          <td>${session.playerHP}/${session.playerMaxHP}</td>
          <td>${session.pendingQueue}</td>
          <td>${session.attacksSinceEnemyCounter}</td>
          <td>${session.idleSec !== null ? `${session.idleSec}s` : 'n/a'}</td>
          <td>${escapeHtml(session.players.join(' | '))}</td>
        </tr>`,
    )
    .join('');

  const logRows = snapshot.logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(log.ts)}</td>
          <td>${escapeHtml(log.type)}</td>
          <td><pre>${escapeHtml(JSON.stringify(log.payload, null, 2))}</pre></td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Nimda Dashboard</title>
    <style>
      body { font-family: monospace; margin: 16px; background: #111; color: #e6e6e6; }
      h1, h2 { margin: 0 0 10px; }
      .meta { margin-bottom: 16px; color: #9cc9ff; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { border: 1px solid #333; padding: 8px; vertical-align: top; text-align: left; }
      th { background: #1f1f1f; }
      tr:nth-child(even) { background: #161616; }
      pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
      .note { color: #bcbcbc; margin-bottom: 18px; }
      .toolbar { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; }
      .toolbar button { background: #222; color: #e6e6e6; border: 1px solid #444; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-family: inherit; font-size: 13px; }
      .toolbar button:hover { background: #333; }
    </style>
  </head>
  <body>
    <h1>/nimda admin dashboard</h1>
    <div class="meta">serverTime=${escapeHtml(snapshot.serverTime)} | sockets=${snapshot.connectedSockets} | sessions=${snapshot.sessions.length} | logs=${snapshot.logs.length}</div>
    <div class="toolbar">
      <button onclick="restartServer()">Restart Server</button>
      <span class="note">Use ?format=json for JSON output, and ?limit=500 to control log count. Newest logs appear at the top.</span>
    </div>
    <h2>Active Sessions</h2>
    <table>
      <thead>
        <tr>
          <th>Session</th>
          <th>Phase</th>
          <th>Enemy HP</th>
          <th>Shared Player HP</th>
          <th>Queued Attacks</th>
          <th>Counter Progress</th>
          <th>Idle</th>
          <th>Players</th>
        </tr>
      </thead>
      <tbody>${sessionsRows || '<tr><td colspan="8">No active sessions</td></tr>'}</tbody>
    </table>

    <h2>Recent Logs</h2>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Payload</th>
        </tr>
      </thead>
      <tbody>${logRows || '<tr><td colspan="3">No logs yet</td></tr>'}</tbody>
    </table>
    <script>
      function restartServer() {
        if (!confirm('Are you sure you want to restart the server?')) return;
        const url = window.location.pathname + '/restart' + window.location.search;
        fetch(url, { method: 'POST' })
          .then((res) => res.json().catch(() => ({})))
          .then((body) => {
            alert(body.message || 'Server restart requested. If running under a process manager (like nodemon), it should restart automatically.');
          })
          .catch((err) => {
            alert('Failed to contact server: ' + err);
          });
      }
    </script>
  </body>
</html>`;
}

// Health-check endpoint – used by Nginx upstream checks and monitoring tools.
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    sessions: Object.keys(games).length,
    sockets: io.engine.clientsCount,
  });
});

app.get('/nimda', (req, res) => {
  const providedPassword = getAdminPasswordFromRequest(req);
  if (providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: valid password is required',
      hint: 'Use query ?password=... or header x-admin-password',
    });
  }

  const limit = clamp(toInt(req.query.limit, 200), 1, 2000);
  const sessions = getSessionsSnapshot();
  // Show newest logs first (top of the table)
  const logs = serverLogs.slice(-limit).reverse();
  const snapshot = {
    ok: true,
    serverTime: new Date().toISOString(),
    connectedSockets: io.engine.clientsCount,
    sessions,
    logs,
  };

  if (req.query.format === 'json') {
    return res.json(snapshot);
  }

  return res.type('html').send(renderAdminHtml(snapshot));
});

app.post('/nimda/restart', (req, res) => {
  const providedPassword = getAdminPasswordFromRequest(req);
  if (providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: valid password is required',
      hint: 'Use query ?password=... or header x-admin-password',
    });
  }

  // Soft restart: clear all in-memory sessions and queues without
  // killing the Node process, so the HTTP server keeps running.
  const clearedSessions = Object.keys(games).length;
  Object.keys(games).forEach((id) => delete games[id]);
  Object.keys(attackQueues).forEach((id) => delete attackQueues[id]);

  addLog('server_soft_restart', {
    reason: 'Requested from /nimda dashboard',
    clearedSessions,
  });

  res.json({
    ok: true,
    message: 'Server soft-restarted: all sessions cleared, process still running.',
    clearedSessions,
  });
});

// Game room management
io.on('connection', (socket) => {
  addLog('socket_connected', { socketId: socket.id });

  // Join game room
  socket.on('joinGame', ({ sessionId, playerId }) => {
    socket.join(sessionId);
    addLog('player_join_request', { sessionId, playerId, socketId: socket.id });

    // Create game if doesn't exist
    if (!games[sessionId]) {
      games[sessionId] = {
        players: [playerId],
        enemyHP: CONFIG.ENEMY_MAX_HP,
        playerHP: CONFIG.PLAYER_MAX_HP,
        attacksSinceEnemyCounter: 0,
        phase: 'readyToAttack',
        lastActivity: Date.now(),
      };
      attackQueues[sessionId] = [];
      addLog('session_created', { sessionId, playerId });
    } else {
      normalizeGameState(games[sessionId]);
      if (!games[sessionId].players.includes(playerId)) {
        games[sessionId].players.push(playerId);
      }
      touchSession(sessionId);
      addLog('player_joined_existing_session', {
        sessionId,
        playerId,
        totalPlayers: games[sessionId].players.length,
      });
    }

    // Send current state to this player
    socket.emit('syncState', games[sessionId]);

    // Tell others a new player joined
    socket.to(sessionId).emit('playerJoined', {
      playerId,
      totalPlayers: games[sessionId].players.length,
    });

    addLog('player_joined', {
      sessionId,
      playerId,
      totalPlayers: games[sessionId].players.length,
      playerHP: games[sessionId].playerHP,
      enemyHP: games[sessionId].enemyHP,
    });
  });

  // Handle attack request
  socket.on('attack', ({ sessionId, playerId }) => {
    if (!games[sessionId]) return;

    // Rate-limit: drop excess attacks from a single socket to protect memory.
    if (!allowAttack(socket.id)) {
      addLog('attack_rate_limited', { sessionId, playerId, socketId: socket.id });
      return;
    }

    touchSession(sessionId);

    // Add to queue
    attackQueues[sessionId].push({
      playerId,
      damage: CONFIG.PLAYER_DAMAGE_PER_HIT,
    });
    addLog('attack_queued', {
      sessionId,
      playerId,
      damage: CONFIG.PLAYER_DAMAGE_PER_HIT,
      queueSize: attackQueues[sessionId].length,
    });
  });

  // Optional manual enemy counter attack trigger
  socket.on('enemyCounterAttack', ({ sessionId }) => {
    if (!games[sessionId]) return;

    const game = games[sessionId];
    normalizeGameState(game);
    touchSession(sessionId);

    // Apply shared damage once for all players.
    game.playerHP = Math.max(0, game.playerHP - CONFIG.ENEMY_DAMAGE_PER_HIT);
    if (game.playerHP <= 0 && game.phase !== 'playerDead') {
      game.phase = 'playerDead';
    }

    addLog('enemy_counter_manual', {
      sessionId,
      damagePerPlayer: CONFIG.ENEMY_DAMAGE_PER_HIT,
      playerHP: game.playerHP,
    });

    // Send updated state
    io.to(sessionId).emit('syncState', game);
  });

  // Handle game reset
  socket.on('resetGame', ({ sessionId }) => {
    if (games[sessionId]) {
      addLog('session_reset', {
        sessionId,
        finalEnemyHP: games[sessionId].enemyHP,
        finalPlayerHP: games[sessionId].playerHP,
      });
      delete games[sessionId];
      delete attackQueues[sessionId];
    }
  });

  socket.on('disconnect', () => {
    // Clean up per-socket rate-limit counter to avoid unbounded growth.
    delete socketAttackCounters[socket.id];
    addLog('socket_disconnected', { socketId: socket.id });
  });
});

// Process attacks from queue every 500ms
setInterval(() => {
  Object.keys(attackQueues).forEach((sessionId) => {
    const game = games[sessionId];
    const queue = attackQueues[sessionId];
    normalizeGameState(game);

    // Process ONE attack from queue (only affects enemy HP).
    if (queue.length > 0 && game) {
      const attack = queue.shift();
      const oldEnemyHP = game.enemyHP;
      game.enemyHP = Math.max(0, game.enemyHP - attack.damage);
      touchSession(sessionId);

      addLog('attack_processed', {
        sessionId,
        playerId: attack.playerId,
        damage: attack.damage,
        enemyHPBefore: oldEnemyHP,
        enemyHPAfter: game.enemyHP,
      });

      // Check if enemy died
      if (game.enemyHP <= 0 && game.phase !== 'death') {
        game.phase = 'death';
        addLog('enemy_defeated', { sessionId });
      }

      // Send updated state to all players in this session
      io.to(sessionId).emit('syncState', game);
    }
  });
}, 500); // Process attacks every 500ms

// Clean up sessions that have been idle for longer than SESSION_IDLE_MS.
setInterval(() => {
  const now = Date.now();
  Object.keys(games).forEach((sessionId) => {
    const game = games[sessionId];
    if (game.lastActivity && now - game.lastActivity > SESSION_IDLE_MS) {
      addLog('session_idle_cleanup', {
        sessionId,
        idleMs: now - game.lastActivity,
      });
      delete games[sessionId];
      delete attackQueues[sessionId];
    }
  });
}, 60_000); // Check every minute

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  addLog('server_started', {
    port: PORT,
    adminRoute: '/nimda',
    passwordSource: process.env.NIMDA_PASSWORD || process.env.ADMIN_PASSWORD ? 'env' : 'default(nimda)',
    attackRateLimit: RATE_LIMIT_MAX,
    sessionIdleMs: SESSION_IDLE_MS,
  });
});

// Graceful shutdown: finish in-flight work, then exit cleanly so that PM2
// or the OS process manager can restart the server without dropping data.
function gracefulShutdown(signal) {
  addLog('server_shutting_down', { signal });
  console.log(`[shutdown] Received ${signal} – closing HTTP server…`);
  server.close(() => {
    console.log('[shutdown] HTTP server closed. Exiting.');
    process.exit(0);
  });

  // Force-exit after 10 s if connections are still lingering.
  setTimeout(() => {
    console.error('[shutdown] Forced exit after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
