import { Graph, Market } from "../../src/markets";
import { SpreadExecution } from "../../src/strategies";
import { Asset } from "../../src/assets";
import { ExecutionOperation } from "../../src/strategies/arbitrage";

import express = require("express");
const router = express.Router();

module.exports = (graph: Graph) => {
	router.get("/", (req, res, next) => {
		res.send(JSON.stringify([]));
	});
	return router;
};
