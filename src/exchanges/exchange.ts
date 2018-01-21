import { Hub, Market, Graph, Ticker, TradeType } from "../markets";
import { Asset } from "../assets";

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
			market.updateVwap(ticker);
		}
	}

	log() {
		console.log(`Exchange: ${this.id}`.green);
		this.hubs.forEach((hub: Hub, symbol: string) => {
			console.log(`Hub: ${symbol}`.blue);
			const marketList: string[] = [];
			hub.markets.forEach((market: Market, marketSymbol: string) => {
				marketList.push(marketSymbol);
			});
			console.log(`Markets: ${marketList.join(",")}`.magenta);
		});
	}
}
