// PM2 ecosystem file for both development and production
// Run with: pm2 start ecosystem.config.cjs
// Stop with: pm2 stop all
// Restart with: pm2 restart all
// View logs: pm2 logs

module.exports = {
  apps: [
    {
      name: 'messagingmatrix-server',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false, // Set to true for development hot-reload
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3003
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3003
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Graceful shutdown - critical for proper cleanup
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: false,

      // Windows-specific: use SIGTERM for graceful shutdown
      kill_signal: 'SIGTERM',

      // Crash recovery settings
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,

      // Auto-restart on these exit codes
      autorestart: true,
      // Don't restart on these codes
      stop_exit_codes: [0],

      // Force kill if graceful shutdown fails
      force: true
    },
    {
      name: 'messagingmatrix-frontend',
      script: 'npm',
      args: 'run dev',
      interpreter: 'cmd',
      interpreter_args: '/c',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=4096'
      },
      error_file: './logs/vite-error.log',
      out_file: './logs/vite-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Frontend needs faster restart
      kill_timeout: 3000,
      listen_timeout: 10000,

      // Vite can crash more easily, be more aggressive with restarts
      min_uptime: '5s',
      max_restarts: 15,
      restart_delay: 1000,

      autorestart: true,
      stop_exit_codes: [0],
      force: true
    }
  ]
};
