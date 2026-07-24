module.exports = {
  apps: [
    {
      name: "api",
      script: "dist/index.js",
      interpreter: "node",
      cwd: "/var/www/API",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
