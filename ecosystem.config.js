module.exports = [{
  name: 'server',
  script: 'server.js',
  node_args: '-r esm',
}, {
  name: 'worker',
  script: 'worker.js',
  node_args: '-r esm',
}];
