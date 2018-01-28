import { Hub, Market } from "../markets";
import "colors";

const log = require("winston");

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
		log.debug(`Asset: ${this.symbol}`.yellow);
		log.debug(`Hub count: ${this.hubs.length}`.green);
		const exchanges = this.hubs.map(h => h.exchange.id).join(",");
		log.debug(`Exchanges: ${exchanges}`.green);
		log.debug(`Market Count: ${this.markets.length}`.blue);
	}
}
