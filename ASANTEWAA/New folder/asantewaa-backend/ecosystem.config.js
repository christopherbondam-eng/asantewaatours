// PM2 Ecosystem config — production process management
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'asantewaa-api',
      script: './src/server.js',
      instances: 'max',           // one per CPU core
      exec_mode: 'cluster',       // Node cluster mode — zero downtime reloads
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file:  './logs/pm2-error.log',
      out_file:    './logs/pm2-out.log',
      merge_logs:  true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Graceful shutdown — finish in-flight requests
      kill_timeout: 5000,
      listen_timeout: 3000,
    },
  ],
};
