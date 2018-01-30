import { Hub, Market } from "../markets";
import "colors";

const logger = require("winston");

export class Asset {
	static getAsset(symbol: string, map: Map<string, Asset>): Asset {
		let asset: Asset;
		if (map.has(symbol)) {
			asset = map.get(symbol) as Asset;
		} else {
			asset = new Asset(symbol);
			map.set(symbol, asset);
		}
		return asset;
	}

	hubs: Hub[] = [];
	markets: Market[] = [];

	constructor(public symbol: string) {}

	public log() {
		logger.log({
			level: "debug",
			message: `Asset: ${this.symbol}`
		});
		logger.log({
			level: "debug",
			message: `Hub count: ${this.hubs.length}`
		});
		const exchanges = this.hubs.map(h => h.exchange.id).join(",");

		logger.log({
			level: "debug",
			message: `Exchanges: ${exchanges}`
		});
		logger.log({
			level: "debug",
			message: `Market Count: ${this.markets.length}`
		});
	}
}
