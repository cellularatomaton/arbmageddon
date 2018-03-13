import { Exchange } from "./exchange";
import { Hub, Market, Graph } from "../markets";
import { Asset } from "../assets";
import { Logger } from "../utils/logger";
import { TradeType, SubscriptionType } from "../utils/enums";
import { Book } from "../markets/book";

export type BinaBookUpdateLevel = [string, string, any[]];
export type BinaBookSnapshotLevel = [string, string];
export interface BinaBookSnapshot {
	asks: any;
	bids: any;
}
export interface BinaBookUpdate {
	e: number;
	E: number;
	s: string;
	U: number;
	b: BinaBookUpdateLevel[];
	a: BinaBookUpdateLevel[];
}
const _ = require("lodash");
const binance = require("node-binance-api");
const hubSymbols = new Set(["BTC", "ETH", "BNB", "USDT"]);

binance.options({
	reconnect: true,
	test: true,
	recvWindow: 60000
});

export class BinanceExchange extends Exchange {
	symbolList: string[];
	books: Map<string, Book>;
	constructor(graph: Graph) {
		super("BIN", "BINANCE", graph);
		this.symbolList = [];
		this.books = new Map<string, Book>();
		this.updateExchangeInfo().then(() => {
			this.setupWebsockets(this.symbolList).then(() => {
				this.initSnapshots(this.symbolList).then(() => {
					graph.exchangeReady(this);
				});
			});
		});
	}

	updateExchangeInfo(): Promise<void> {
		const exchange = this;
		return new Promise((resolve, reject) => {
			binance.exchangeInfo((error: any, info: any) => {
				const markets = info.symbols;
				markets.forEach((market: any) => {
					const hubSymbol = market.quoteAsset;
					const marketSymbol = market.baseAsset;
					Logger.log({
						level: "silly",
						message: `BINA mapping symbols: Hub ${hubSymbol} -> Market ${marketSymbol}`
					});
					exchange.mapMarket(hubSymbol, marketSymbol);
				});
				this.symbolList = markets.map((m: any) => m.symbol);
				this.graph.mapBasis();
				resolve();
			});
		});
	}

	parseSymbols(key: string): string[] {
		let marketSymbol = `NOMARKET`;
		let hubSymbol = `NOHUB`;

		const lastThree = key.slice(key.length - 3, key.length);
		const foundThree = hubSymbols.has(lastThree);
		if (foundThree) {
			marketSymbol = key.slice(0, key.length - 3);
			hubSymbol = lastThree;
		} else {
			const lastFour = key.slice(key.length - 4, key.length);
			const foundFour = hubSymbols.has(lastFour);
			if (foundFour) {
				marketSymbol = key.slice(0, key.length - 4);
				hubSymbol = lastFour;
			}
		}
		return [hubSymbol, marketSymbol];
	}

	initSnapshots(symbols: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const exchange = this;
			symbols.forEach((symbol: string) => {
				const parsedSymbols = exchange.parseSymbols(symbol);
				const book: Book = new Book(this.id, parsedSymbols[0], parsedSymbols[1]);
				this.books.set(symbol, book);
				try {
					binance.depth(symbol, (error: any, depth: BinaBookSnapshot, sym: string) => {
						const askDepth: BinaBookSnapshotLevel[] = _.toPairs(depth.asks);
						const bidDepth: BinaBookSnapshotLevel[] = _.toPairs(depth.bids);
						_.forEach(askDepth, (level: BinaBookUpdateLevel) => {
							book.updateLevel(TradeType.Sell, Number(level[0]), Number(level[1]));
						});
						_.forEach(bidDepth, (level: BinaBookUpdateLevel) => {
							book.updateLevel(TradeType.Buy, Number(level[0]), Number(level[1]));
						});
						this.updateBook(book);
						Logger.log({
							level: "silly",
							message: `BINA Snapshot: ${this.id}.${parsedSymbols[0]}.${parsedSymbols[1]}`,
							data: book
						});
						if (this.books.size === symbols.length) {
							resolve();
						}
					});
				} catch (err) {
					Logger.log({
						level: "error",
						message: "BINA Snapshot Error",
						data: err
					});
					reject();
				}
			});
		});
	}

	setupWebsocketTickers(symbols: string[]) {
		binance.websockets.trades(symbols, (trades: any) => {
			const parsedSymbols = this.parseSymbols(trades.s);
			Logger.log({
				level: "silly",
				message: `BINA Ticker: ${this.id}.${parsedSymbols[0]}.${parsedSymbols[1]}`,
				data: trades
			});
			this.updateTicker({
				exchangeSymbol: this.id,
				hubSymbol: parsedSymbols[0],
				marketSymbol: parsedSymbols[1],
				price: Number(trades.p),
				side: trades.m ? TradeType.Sell : TradeType.Buy,
				time: new Date(trades.T),
				size: Number(trades.q)
			});
		});
	}

	setupWebsocketBooks(symbols: string[]) {
		binance.websockets.depth(symbols, (depth: BinaBookUpdate) => {
			const book: Book | undefined = this.books.get(depth.s);
			if (book) {
				depth.a.forEach((binaBookUpdateLevel: BinaBookUpdateLevel) => {
					book.updateLevel(TradeType.Sell, Number(binaBookUpdateLevel[0]), Number(binaBookUpdateLevel[1]));
				});
				depth.b.forEach((binaBookUpdateLevel: BinaBookUpdateLevel) => {
					book.updateLevel(TradeType.Buy, Number(binaBookUpdateLevel[0]), Number(binaBookUpdateLevel[1]));
				});
				this.updateBook(book);
				Logger.log({
					level: "silly",
					message: `BINA BookUpdate: ${this.id}.${depth.s}`,
					data: book
				});
			}
		});
	}

	setupWebsockets(symbols: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			Logger.log({
				level: "info",
				message: "Init BINA Websocket"
			});
			const exchange = this;
			const binaUpdates = 0;
			try {
				this.setupWebsocketTickers(symbols);
				this.setupWebsocketBooks(symbols);
				resolve();
			} catch (err) {
				Logger.log({
					level: "error",
					message: "BINA Websocket Error",
					data: err
				});
				reject();
			}
		});
	}
}
