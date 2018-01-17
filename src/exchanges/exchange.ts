import { Hub, Market, Graph, Ticker, TradeType } from '../markets';
import { Asset } from '../assets';

export interface HubMarketPair {
	hubSymbol: string;
	marketSymbol: string;
}

export class Exchange {
	public hubs: Map<string, Hub>;
	constructor(
		public id: string,
		public name: string,
		public graph: Graph
	) {

		this.hubs = new Map<string, Hub>();
	}

	getId() {
		return this.id;
	}

	marketBuy() { }

	marketSell() { }

	fillHandler(callback: any) { }

	positionHandler(callback: any) { }

	mapMarket(
		hubSymbol: string,
		marketSymbol: string): any {
		if (!this.hubs.has(hubSymbol)) {
			this.hubs.set(
				hubSymbol,
				new Hub(
					hubSymbol,
					this,
					this.graph,
				)
			);
		}
		const hub = this.hubs.get(hubSymbol);
		if (hub && !hub.markets.has(marketSymbol)) {
			hub.markets.set(
				marketSymbol,
				new Market(
					marketSymbol,
					hub,
					this.graph
				)
			);
		}
		if (hub) {
			const market = hub.markets.get(marketSymbol);
			return market;
		}
	}

	// updateMarket(
	//     hubSymbol: string,
	//     marketSymbol: string,
	//     bestBid: number,
	//     bestAsk: number,
	// ){
	//     const response = this.mapMarket(
	//         hubSymbol,
	//         marketSymbol
	//     );
	//     if(response){
	//         const market = response;
	//         market.best_bid = Number(bestBid);
	//         market.best_ask = Number(bestAsk);
	//     }
	// }

	updateTicker(ticker: Ticker) {
		const response = this.mapMarket(
			ticker.hubSymbol,
			ticker.marketSymbol
		);
		if (response) {
			const market = response;
			// market.updateStatistics(ticker);
			market.updateVwap(ticker);
		}
	}

	public log() {
		console.log(`Exchange: ${this.id}`.green);
		this.hubs.forEach((hub: Hub, symbol: string) => {
			console.log(`Hub: ${symbol}`.blue);
			let marketList: string[] = [];
			hub.markets.forEach((market: Market, marketSymbol: string) => {
				marketList.push(marketSymbol);
			});
			console.log(`Markets: ${marketList.join(',')}`.magenta);
		});
	}
};