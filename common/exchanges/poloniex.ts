import { Exchange, HubMarketPair } from "./exchange";
import { Hub, Market, Graph } from "../markets";
import { Asset } from "../assets";
import { Http } from "../utils";
import { symlink } from "fs";
import { Logger } from "../utils/logger";
import { TradeType, SubscriptionType } from "../utils/enums";
import { Book } from "../markets/book";

// PoloMessage: [ product_id, sequence_number, messages ]
export type PoloMessage = [number, number, any[]];

// PoloSnapshot: [ message_type, sequence_number, PoloBookSnapshotData ]
// message_type: "i"
export interface PoloBookSnapshotData {
	currencyPair: string;
	orderBook: [Map<string, string>, Map<string, string>]; // [asks, bids]
}
export type PoloSnapshot = [string, number, PoloBookSnapshotData];

// PoloBookUpdate: [ message_type, order_type, price, size ]
// message_type: "o"
// order_type: 0=ask, 1=bid
export type PoloBookUpdate = [string, number, string, string];

// PoloTicker: [ message_type, trade_id, side, price, time, size ]
// message_type: "t"
// side: 0=sell, 1=buy
export type PoloTicker = [string, string, number, string, string, number];

export class PoloniexExchange extends Exchange {
	symbolList: string[];
	// subscriptionConfirms: Map<number, boolean>;
	idToSymbolMap: Map<number, HubMarketPair>;
	books: Map<number, Book>;
	constructor(graph: Graph) {
		super("PLX", "POLONIEX", graph);
		this.symbolList = [];
		// this.subscriptionConfirms = new Map<number, boolean>();
		this.idToSymbolMap = new Map<number, HubMarketPair>();
		this.books = new Map<number, Book>();
		this.updateProducts()
			.then(() => {
				this.graph.mapBasis();
				return this.setupWebsocket();
			})
			.then(() => {
				graph.exchangeReady(this);
			});
	}

	updateProducts(): Promise<void> {
		const exchange = this;
		return new Promise((resolve, reject) => {
			Http.get(`https://poloniex.com/public?command=returnTicker`, (tickers: any) => {
				Logger.log({
					level: "silly",
					message: "POLO Update Products",
					data: tickers
				});
				this.symbolList = [];
				Object.keys(tickers).forEach(key => {
					const ticker = tickers[key];
					const symbols = key.split("_");
					const hubSymbol = symbols[0];
					const marketSymbol = symbols[1];
					exchange.mapMarket(hubSymbol, marketSymbol);
					this.idToSymbolMap.set(ticker.id, {
						hubSymbol,
						marketSymbol
					});
					// this.subscriptionConfirms.set(ticker.id, false);
					this.symbolList.push(key);
				});
				resolve();
			});
		});
	}

	setupWebsocket() {
		const polo = this;
		return new Promise((resolve, reject) => {
			Logger.log({
				level: "info",
				message: "Init POLO Websocket"
			});
			const WebSocket = require("ws");
			const ws = new WebSocket("wss://api2.poloniex.com/");

			ws.on("open", function open() {
				Logger.log({
					level: "info",
					message: "POLO Websocket opened"
				});
				polo.symbolList.forEach((symbol: string) => {
					const msg = {
						command: "subscribe",
						channel: symbol
					};
					ws.send(JSON.stringify(msg));
				});
				resolve();
			});

			ws.on("error", (err: any) => {
				Logger.log({
					level: "error",
					message: "POLO Websocket error",
					data: err
				});
			});

			ws.on("close", () => {
				Logger.log({
					level: "warn",
					message: "POLO Websocket closed."
				});
			});

			ws.on("message", function incoming(msg: string) {
				const data = JSON.parse(msg);
				if (data.length === 3) {
					const poloMessage = data as PoloMessage;
					const productId = poloMessage[0];
					// polo.subscriptionConfirms.set(productId, true);
					// const confirmedCount = Array.from(polo.subscriptionConfirms.values()).filter(b => b).length;
					// const unconfirmedCount = Array.from(polo.subscriptionConfirms.values()).filter(b => !b).length;
					// Logger.log({
					// 	level: "info",
					// 	message: `POLO subscription: confirmed=${confirmedCount}, uncomfirmed=${unconfirmedCount}`
					// });
					// const sequence = poloMessage[1];
					const messages = poloMessage[2];
					messages.forEach((m: any[]) => {
						const type = m[0];
						if (type === "i") {
							// Initialize:  Symbol mapping and initial book.
							const snap = m as PoloSnapshot;
							polo.handleBookSnapshot(productId, snap);
						} else if (type === "o") {
							// Book Update:
							const bookUpdate = m as PoloBookUpdate;
							polo.handleBookUpdate(productId, bookUpdate);
						} else if (type === "t") {
							// Ticker:
							const ticker = m as PoloTicker;
							polo.handleTicker(productId, ticker);
						}
					});
				}
			});
		});
	}

	handleBookSnapshot(productId: number, snapshot: PoloSnapshot) {
		const initial: any = snapshot[1];
		const symbol: string = initial.currencyPair;
		Logger.log({
			level: "silly",
			message: `POLO Book Snapshot ${productId}:${symbol}`
		});
		// const symbols = symbol.split("_");
		// this.idToSymbolMap.set(productId, {
		// 	hubSymbol: symbols[0],
		// 	marketSymbol: symbols[1]
		// });
		const pair: HubMarketPair | undefined = this.idToSymbolMap.get(productId);
		if (pair) {
			const market: Market | undefined = this.getMarket(pair.hubSymbol, pair.marketSymbol);
			if (market) {
				const book: Book = new Book(market);
				this.books.set(productId, book);
				this.updateBook(book);
			}
		}
	}

	handleBookUpdate(productId: number, update: PoloBookUpdate) {
		Logger.log({
			level: "silly",
			message: `POLO Book Update ${productId}`
		});
		const side: TradeType = update[1] ? TradeType.Buy : TradeType.Sell;
		const price: number = Number(update[2]);
		const size: number = Number(update[3]);
		const book: Book | undefined = this.books.get(productId);
		if (book) {
			book.updateLevel(side, price, size);
			this.updateBook(book);
		}
	}

	handleTicker(productId: number, ticker: PoloTicker) {
		const pair: HubMarketPair | undefined = this.idToSymbolMap.get(productId);
		if (pair) {
			Logger.log({
				level: "silly",
				message: `POLO Ticker ${productId}: Hub=${pair.hubSymbol} Market=${pair.marketSymbol}`,
				data: ticker
			});
			const tradeId: number = Number(ticker[1]);
			this.updateTicker({
				exchangeSymbol: this.id,
				hubSymbol: pair.hubSymbol,
				marketSymbol: pair.marketSymbol,
				side: ticker[2] ? TradeType.Buy : TradeType.Sell,
				price: Number(ticker[3]),
				time: new Date(ticker[5] * 1000),
				size: Number(ticker[4])
			});
		}
	}
}
