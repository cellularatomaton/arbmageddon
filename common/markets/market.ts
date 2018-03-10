import { Hub } from "./hub";
import { Graph, Ticker } from "../markets";
import { VolumeStatistics } from "./ticker";
import { TimeUnit, InitiationType, TradeType } from "../utils/enums";
import { EventImp, IEvent } from "../utils/event";
import { Logger } from "../utils/logger";
import { Asset } from "../assets/asset";
import { Book } from "./book";

export class Market {
	asset: Asset;
	vwapBuyStats: VolumeStatistics;
	vwapSellStats: VolumeStatistics;

	onBuy: EventImp<Ticker> = new EventImp<Ticker>();
	get buy(): IEvent<Ticker> {
		return this.onBuy.expose();
	}

	onSell: EventImp<Ticker> = new EventImp<Ticker>();
	get sell(): IEvent<Ticker> {
		return this.onSell.expose();
	}

	onBook: EventImp<Book> = new EventImp<Book>();
	get book(): IEvent<Book> {
		return this.onBook.expose();
	}

	constructor(assetSymbol: string, public hub: Hub, public graph: Graph) {
		this.asset = Asset.getAsset(assetSymbol, graph.assetMap);
		this.asset.markets.push(this);
		this.vwapBuyStats = new VolumeStatistics(this);
		this.vwapSellStats = new VolumeStatistics(this);
	}
	getId() {
		return `${this.hub.getId()}_${this.asset.symbol}`;
	}

	getBuyVwap(initiationType: InitiationType): number {
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapSellStats.getVwap();
		} else {
			return this.vwapBuyStats.getVwap();
		}
	}

	getSellVwap(initiationType: InitiationType): number {
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapBuyStats.getVwap();
		} else {
			return this.vwapSellStats.getVwap();
		}
	}

	updateTicker(ticker: Ticker) {
		Logger.log({
			level: "silly",
			message: `Update ticker: ${this.getId()}`,
			data: ticker
		});
		if ((ticker.side as TradeType) === TradeType.Buy) {
			this.onBuy.trigger(ticker);
			this.vwapBuyStats.handleTicker(ticker);
			Logger.log({
				level: "silly",
				message: `Buy vwap: ${this.vwapBuyStats.getVwap()}`
			});
		} else {
			this.onSell.trigger(ticker);
			this.vwapSellStats.handleTicker(ticker);
			Logger.log({
				level: "silly",
				message: `Sell vwap: ${this.vwapSellStats.getVwap()}`
			});
		}
	}

	// subscribeBook() {
	// 	// Subscribe to book
	// }

	// unsubscribeBook() {
	// 	// Unsubscribe from book
	// }

	updateBook(book: Book) {
		// Handle exchange book updates.
		this.onBook.trigger(book);
	}
}
