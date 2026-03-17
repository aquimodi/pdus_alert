const path = require('path');

module.exports = {
  apps: [{
    name: 'energy-monitoring-api',
    script: './server.cjs',
    cwd: path.resolve(__dirname),

    instances: 2,
    exec_mode: 'cluster',

    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },

    watch: false,
    ignore_watch: ['node_modules', 'logs', 'dist', 'exports'],
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    kill_timeout: 15000,
    listen_timeout: 10000,
    shutdown_with_message: true,

    log_file: './logs/pm2-combined.log',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
    merge_logs: true,
    log_type: 'json',

    max_memory_restart: '500M',

    windowsHide: true,

    vizion: false,
    autorestart: true,
    exp_backoff_restart_delay: 1000,
  }]
};
