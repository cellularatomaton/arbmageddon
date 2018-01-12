import { Graph } from '../../src/markets';
import { Exchange } from '../../src/exchanges';

const express = require('express');
const router = express.Router();

module.exports = function(graph: Graph) {
  router.get('/', function(req, res, next) {
    const nodes_and_edges = graph.get_nodes_and_edges();
    res.send(JSON.stringify(nodes_and_edges));
  });

  router.get('/exchanges', function(req, res, next) {
    const exchanges = graph.exchanges.map((exch: Exchange) => {
      return {
        id: exch.id,
        name: exch.name
      };
    });
    res.send(JSON.stringify(exchanges));
  });

  return router;
};