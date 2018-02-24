import { Graph, Market } from "../../common/markets";
import { SpreadExecution } from "../../common/strategies";
import { Asset } from "../../common/assets";
import { ExecutionOperation } from "../../common/strategies/arbitrage";

import express = require("express");
const router = express.Router();

module.exports = (graph: Graph) => {
	router.get("/", (req, res, next) => {
		res.send(JSON.stringify([]));
	});
	return router;
};
