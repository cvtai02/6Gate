// pm2 process definition for the 6Gate API.
//
//   pm2 start ecosystem.config.js
//   pm2 save                       # persist across reboots (after `pm2 startup`)
//
// IMPORTANT: instances must stay at 1 / fork mode. The job runner and SSE log
// emitters keep in-memory state, so cluster mode would break live job logs and
// duplicate the queue dispatcher.
module.exports = {
  apps: [
    {
      name: "6gate-api",
      cwd: __dirname, // run from app/ so it finds dist/main.js and .env
      script: "dist/main.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      // The app loads app/.env itself (DATABASE_URL, DATABASE_SSL, SYSTEM_SECRET).
      // Set NODE_ENV here; secrets stay in .env, never in this committed file.
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
