import { Hub } from "./hub";
import { Graph, Ticker } from "../markets";
import { VolumeStatistics } from "./ticker";
import { TimeUnit, InitiationType, TradeType, SubscriptionType } from "../utils/enums";
import { EventImp, IEvent } from "../utils/event";
import { Logger } from "../utils/logger";
import { Asset } from "../assets/asset";
import { Book } from "./book";

export interface MarketInfo {
	exchange: string;
	hub: string;
	market: string;
}

export interface MarketParameters extends MarketInfo {
	pricePrecision: number;
	sizePrecision: number;
}

export interface SubscriptionData extends MarketInfo {
	type: SubscriptionType;
}

export class Market {
	pricePrecision: number;
	sizePrecision: number;
	asset: Asset;

	public vwapBuyStats: VolumeStatistics;
	public vwapSellStats: VolumeStatistics;

	onBuy: EventImp<Ticker> = new EventImp<Ticker>();
	get buy(): IEvent<Ticker> {
		return this.onBuy.expose();
	}

	onSell: EventImp<Ticker> = new EventImp<Ticker>();
	get sell(): IEvent<Ticker> {
		return this.onSell.expose();
	}

	onBookUpdate: EventImp<Book> = new EventImp<Book>();
	get bookUpdate(): IEvent<Book> {
		return this.onBookUpdate.expose();
	}

	info: MarketInfo;
	get marketInfo(): MarketInfo {
		return this.info;
	}

	marketBook: Book | undefined;
	set book(b: Book) {
		this.marketBook = b;
	}

	constructor(assetSymbol: string, public hub: Hub, public graph: Graph) {
		this.pricePrecision = 8;
		this.sizePrecision = 4;
		this.info = {
			exchange: this.hub.exchange.id,
			hub: this.hub.symbol,
			market: assetSymbol
		};
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

	updateBook(book: Book) {
		// Handle exchange book updates:
		this.onBookUpdate.trigger(book);
	}

	updateMarketBook() {
		// Broadcast book update for this market:
		if (this.marketBook) {
			this.onBookUpdate.trigger(this.marketBook);
		}
	}
}
