module.exports = {
  apps: [{
    name: 'Retropilot Service',
    script: './server.js',

    env_development: {
      NODE_ENV: 'development',
    },
  }],
};
