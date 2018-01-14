import { Graph, Market } from '../../src/markets';
import { Arb, ArbType, ExecutionInstruction } from '../../src/strategies';
import { Asset } from '../../src/assets';
import { ExecutionOperation } from '../../src/strategies/arbitrage';

const express = require('express');
const router = express.Router();

module.exports = function(graph: Graph) {
  router.get('/', function(req, res, next) {
    res.send(JSON.stringify([]));
  });
  return router;
};