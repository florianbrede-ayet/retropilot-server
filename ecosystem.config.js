module.exports = [{
  name: 'server',
  script: 'src/server',
  node_args: '-r esm',
}, {
  name: 'worker',
  script: 'src/worker',
  node_args: '-r esm',
}];
