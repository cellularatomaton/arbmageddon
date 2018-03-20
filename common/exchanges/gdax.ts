import { Exchange } from "./exchange";
import { Hub, Market, Graph, Ticker } from "../markets";
import { Asset } from "../assets";
import { Logger } from "../utils/logger";
import { TradeType, SubscriptionType } from "../utils/enums";
import { Book, bookOrderSorter, BookLevel } from "../markets/book";

import * as Gdax from "gdax";
import * as _ from "lodash";

const PRODS = ["eth-btc", "ltc-btc"];
const URI = "wss://ws-feed.gdax.com/";
const AUTH = undefined;
const HEARTBEAT = false;
const CHANNELS = ["heartbeat", "ticker"];
const OPTS = {
	heartbeat: false,
	channels: CHANNELS
};

export interface GdaxProduct {
	id: string;
	base_currency: string;
	quote_currency: string;
	base_min_size: string;
	base_max_size: string;
	quote_increment: string;
}

export interface GdaxMessage {
	type: string;
	product_id: string;
}

export interface GdaxTicker extends GdaxMessage {
	trade_id: number;
	sequence: number;
	time: Date;
	price: string;
	side: string;
	last_size: string;
	best_bid: string;
	best_ask: string;
}

export type GdaxSnapshotLevel = [number, number];
export type GdaxUpdateLevel = [string, number, number];

export interface GdaxBookSnapshot extends GdaxMessage {
	bids: GdaxSnapshotLevel[];
	asks: GdaxSnapshotLevel[];
}

export interface GdaxBookUpdate extends GdaxMessage {
	changes: GdaxUpdateLevel[];
}

export class GdaxExchange extends Exchange {
	products: GdaxProduct[];
	ws: any;
	books: Map<string, Book>;
	constructor(graph: Graph) {
		super("GDX", "COINBASE", graph);
		this.products = [];
		this.books = new Map<string, Book>();
		this.updateProducts()
			.then(() => {
				return this.setupWebsocket();
			})
			.then(() => {
				this.subscribeBookFeeds();
				this.graph.exchangeReady(this);
			});
	}

	updateProducts(): Promise<void> {
		return new Promise((resolve, reject) => {
			const publicClient = new Gdax.PublicClient();
			publicClient
				.getProducts()
				.then((data: GdaxProduct[]) => {
					this.products = data;
					this.products.forEach((prod: GdaxProduct) => {
						this.mapMarket(prod.quote_currency, prod.base_currency);
					});
					this.graph.mapBasis();
					resolve();
				})
				.catch((error: any) => {
					Logger.log({
						level: "error",
						message: `Gdax products update error: ${error}`,
						data: error
					});
				});
		});
	}

	setupWebsocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			Logger.log({
				level: "info",
				message: "Init GDAX websocket"
			});
			this.ws = new Gdax.WebsocketClient(PRODS, URI, AUTH, OPTS);
			const exchange = this;
			this.ws.on("open", () => {
				Logger.log({
					level: "info",
					message: "GDAX websocket opened."
				});
				resolve();
			});
			this.ws.on("message", (data: GdaxMessage) => {
				if (data.type === "ticker") {
					this.handleTicker(data as GdaxTicker);
				} else if (data.type === "snapshot") {
					this.handleBookSnapshot(data as GdaxBookSnapshot);
				} else if (data.type === "l2update") {
					this.handleBookUpdate(data as GdaxBookUpdate);
				}
			});
			this.ws.on("error", (err: any) => {
				Logger.log({
					level: "error",
					message: "GDAX Websocket error",
					data: err
				});
			});

			this.ws.on("close", () => {
				Logger.log({
					level: "warn",
					message: "GDAX Websocket closed."
				});
			});
		});
	}

	subscribeBookFeeds() {
		this.products.forEach((prod: GdaxProduct) => {
			this.subscribeLevel2(`${prod.base_currency}-${prod.quote_currency}`);
		});
	}

	subscribeLevel2(ticker: string) {
		this.ws.subscribe({
			channels: [
				{
					name: "level2",
					product_ids: [ticker]
				}
			]
		});
	}

	unsubscribeLevel2(ticker: string) {
		this.ws.unsubscribe({
			channels: [
				{
					name: "level2",
					product_ids: [ticker]
				}
			]
		});
	}

	handleTicker(ticker: GdaxTicker) {
		if (ticker.last_size) {
			Logger.log({
				level: "silly",
				message: "GDAX Handle Ticker",
				data: ticker
			});
			const symbols = ticker.product_id.split("-");
			this.updateTicker({
				exchangeSymbol: this.id,
				hubSymbol: symbols[0],
				marketSymbol: symbols[1],
				bestAsk: Number(ticker.best_ask),
				bestBid: Number(ticker.best_bid),
				price: Number(ticker.price),
				side: ticker.side === "buy" ? TradeType.Buy : TradeType.Sell,
				time: new Date(ticker.time),
				size: Number(ticker.last_size)
			});
		}
	}

	handleBookSnapshot(snapshot: GdaxBookSnapshot) {
		const book: Book | undefined = this.getBookFromSnapshot(snapshot);
		if (book) {
			this.books.set(snapshot.product_id, book);
			this.updateBook(book);
		}
	}

	getBookFromSnapshot(snapshot: GdaxBookSnapshot): Book | undefined {
		const symbols = snapshot.product_id.split("-");
		const market: Market | undefined = this.getMarket(symbols[0], symbols[1]);
		if (market) {
			const book: Book = new Book(market);
			snapshot.bids.forEach((level: GdaxSnapshotLevel) => {
				book.updateLevel(TradeType.Buy, level[0], level[1]);
			});
			snapshot.asks.forEach((level: GdaxSnapshotLevel) => {
				book.updateLevel(TradeType.Sell, level[0], level[1]);
			});
			return book;
		} else {
			return undefined;
		}
	}

	handleBookUpdate(update: GdaxBookUpdate) {
		const book: Book | undefined = this.books.get(update.product_id);
		if (book) {
			update.changes.forEach((level: GdaxUpdateLevel) => {
				const tradeType = level[0] === "buy" ? TradeType.Buy : TradeType.Sell;
				book.updateLevel(tradeType, level[1], level[2]);
			});
			this.updateBook(book);
		}
	}
}
