import { Hub, Market } from "../markets";
import { Logger } from "../utils/logger";
import "colors";

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
		Logger.log({
			level: "debug",
			message: `Asset: ${this.symbol}`
		});
		Logger.log({
			level: "debug",
			message: `Hub count: ${this.hubs.length}`
		});
		const exchanges = this.hubs.map(h => h.exchange.id).join(",");

		Logger.log({
			level: "debug",
			message: `Exchanges: ${exchanges}`
		});
		Logger.log({
			level: "debug",
			message: `Market Count: ${this.markets.length}`
		});
	}
}
