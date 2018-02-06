import { Market, Graph } from "../markets";
import { Asset } from "../assets";
import { Exchange } from "../exchanges";
import { Logger } from "../utils/logger";

export class Hub {
	asset: Asset;
	markets: Map<string, Market>;
	constructor(symbol: string, public exchange: Exchange, public graph: Graph) {
		this.asset = Asset.getAsset(symbol, graph.assetMap);
		this.asset.hubs.push(this);
		this.markets = new Map<string, Market>();
	}
	getId() {
		return `${this.exchange.getId()}_${this.asset.symbol}`;
	}

	getMarket(symbol: string): Market {
		if (symbol === this.asset.symbol) {
			Logger.log({
				level: "warn",
				message: `Bad hub -> market mapping: ${symbol}/${this.asset.symbol}`
			});
		}
		let market = this.markets.get(symbol);
		if (market) {
			return market;
		} else {
			market = new Market(symbol, this, this.graph);
			this.markets.set(symbol, market);
			return market;
		}
	}
}
