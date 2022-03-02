module.exports = [{
  script: 'server.js',
  name: 'server',
  node_args: '-r esm',
}, {
  script: 'worker.js',
  node_args: '-r esm',
  name: 'worker'
}]