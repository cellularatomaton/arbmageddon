import { Hub, Market, Graph, Ticker } from "../markets";
import { Asset } from "../assets";
import { Logger } from "../utils/logger";
import { SubscriptionType } from "../utils/enums";
import { Book } from "../markets/book";

export interface HubMarketPair {
	hubSymbol: string;
	marketSymbol: string;
}

export abstract class Exchange {
	hubs: Map<string, Hub>;
	constructor(public id: string, public name: string, public graph: Graph) {
		this.hubs = new Map<string, Hub>();
	}

	// abstract subscribe(market: string, type: SubscriptionType): void;
	// abstract unsubscribe(market: string, type: SubscriptionType): void;

	getId() {
		return this.id;
	}

	mapMarket(hubSymbol: string, marketSymbol: string): Market {
		// if (hubSymbol === marketSymbol) {
		// 	log.warn(`Bad mapping ${marketSymbol}/${hubSymbol}`);
		// }
		const hub = this.getHub(hubSymbol);
		const market = hub.mapMarket(marketSymbol);
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
		const market = this.mapMarket(ticker.hubSymbol, ticker.marketSymbol);
		if (market) {
			market.updateTicker(ticker);
		}
	}

	updateBook(book: Book) {
		const market = this.mapMarket(book.hubSymbol, book.marketSymbol);
		if (market) {
			market.updateBook(book);
		}
	}

	log() {
		Logger.log({
			level: "info",
			message: `Exchange: ${this.id}`
		});
		this.hubs.forEach((hub: Hub, symbol: string) => {
			Logger.log({
				level: "info",
				message: `Hub: ${symbol}`
			});
			const marketList: string[] = [];
			hub.markets.forEach((market: Market, marketSymbol: string) => {
				marketList.push(marketSymbol);
			});
			Logger.log({
				level: "info",
				message: `Markets: ${marketList.join(",")}`
			});
		});
	}
}
