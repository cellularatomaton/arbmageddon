import { Hub, Market, Graph, Ticker } from "../markets";
import { Asset } from "../assets";
import { Logger } from "../utils/logger";

export interface HubMarketPair {
	hubSymbol: string;
	marketSymbol: string;
}

export class Exchange {
	hubs: Map<string, Hub>;
	constructor(public id: string, public name: string, public graph: Graph) {
		this.hubs = new Map<string, Hub>();
	}

	getId() {
		return this.id;
	}

	mapMarket(hubSymbol: string, marketSymbol: string): any {
		// if (hubSymbol === marketSymbol) {
		// 	log.warn(`Bad mapping ${marketSymbol}/${hubSymbol}`);
		// }
		const hub = this.getHub(hubSymbol);
		const market = hub.getMarket(marketSymbol);
		return market;
	}

	getHub(symbol: string): Hub {
		let hub = this.hubs.get(symbol);
		if (hub) {
			return hub;
		} else {
			hub = new Hub(symbol, this, this.graph);
			this.hubs.set(symbol, hub);
			return hub;
		}
	}

	updateTicker(ticker: Ticker) {
		const response = this.mapMarket(ticker.hubSymbol, ticker.marketSymbol);
		if (response) {
			const market = response;
			market.updateTicker(ticker);
		}
	}

	log() {
		Logger.log({
			level: "debug",
			message: `Exchange: ${this.id}`
		});
		this.hubs.forEach((hub: Hub, symbol: string) => {
			Logger.log({
				level: "debug",
				message: `Hub: ${symbol}`
			});
			const marketList: string[] = [];
			hub.markets.forEach((market: Market, marketSymbol: string) => {
				marketList.push(marketSymbol);
			});
			Logger.log({
				level: "debug",
				message: `Markets: ${marketList.join(",")}`
			});
		});
	}
}
