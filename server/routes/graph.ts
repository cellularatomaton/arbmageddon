import { Graph } from "../../common/markets";
import { Exchange } from "../../common/exchanges";
import { GraphParameters } from "../../common/markets/graph";
import * as express from "express";

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
