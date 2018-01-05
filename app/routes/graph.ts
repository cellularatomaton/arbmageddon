import { Graph } from '../../src/markets';

const express = require('express');
const router = express.Router();

module.exports = function(graph: Graph) {
  router.get('/', function(req, res, next) {
    const nodes_and_edges = graph.get_nodes_and_edges();
    res.send(JSON.stringify(nodes_and_edges));
  });

  return router;
};