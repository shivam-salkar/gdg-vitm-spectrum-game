/**
 * PM2 Ecosystem Config – DigitalOcean VPS deployment
 *
 * Single-process mode (default, no Redis required):
 *   pm2 start ecosystem.config.cjs
 *
 * Multi-process cluster mode (requires Redis – see DEPLOYMENT.md):
 *   REDIS_URL=redis://127.0.0.1:6379 pm2 start ecosystem.config.cjs
 *
 * Management commands:
 *   pm2 list            – see running apps
 *   pm2 logs            – tail logs
 *   pm2 monit           – live CPU/memory dashboard
 *   pm2 restart all     – rolling restart
 *   pm2 save            – persist process list across reboots
 *   pm2 startup         – generate systemd unit for auto-start
 */
module.exports = {
  apps: [
    {
      name: 'spectrum-game-server',
      script: './server/index.js',
      cwd: './',

      // --- Scaling --------------------------------------------------------
      // Set to 'max' to use all CPU cores when REDIS_URL is configured.
      // Keep at 1 when running without Redis (socket.io state is in-memory).
      instances: process.env.REDIS_URL ? 'max' : 1,
      exec_mode: process.env.REDIS_URL ? 'cluster' : 'fork',

      // --- Environment ----------------------------------------------------
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // --- Resilience -----------------------------------------------------
      // Restart the process automatically if it crashes.
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Restart if the process uses more than 512 MB of RAM (safety net).
      max_memory_restart: '512M',

      // --- Logging --------------------------------------------------------
      // Merge stdout and stderr into a single file for easier log tailing.
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // --- Graceful reload ------------------------------------------------
      // Give the server up to 10 s to finish handling requests before a hard kill.
      kill_timeout: 10000,
      listen_timeout: 5000,
      shutdown_with_message: true,
    },
  ],
};
