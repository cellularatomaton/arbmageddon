import { Graph } from "../../src/markets";
import { Exchange } from "../../src/exchanges";

import express = require("express");
const router = express.Router();

module.exports = (graph: Graph) => {
	router.get("/exchanges", (req, res, next) => {
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
