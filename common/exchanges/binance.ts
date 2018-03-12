import { Exchange } from "./exchange";
import { Hub, Market, Graph } from "../markets";
import { Asset } from "../assets";
import { Logger } from "../utils/logger";
import { TradeType, SubscriptionType } from "../utils/enums";
import { Book } from "../markets/book";

// BinaMessage: [ product_id, sequence_number, messages ]
export type BinaMessage = [number, number, any[]];
export type BinaBookUpdateLevel = [number, number];

// BinaSnapshot: [ sequence_number, BinaBookSnapshotData ]
export interface BinaBookSnapshotData {
	currencyPair: string;
	orderBook: [Map<string, string>, Map<string, string>]; // [asks, bids]
}

export interface BinaBookSnapshot {
	asks: Map<number, string>;
	bids: Map<number, string>;
}
export type BinaSnapshot = [number, BinaBookSnapshotData];

// BinaTicker: [ message_type, trade_id, side, price, time, size ]
// message_type: "t"
// side: 0=sell, 1=buy
export type BinaTicker = [string, string, number, string, string, number];
export interface BinaBookUpdate {
	eventType: number;
	eventTime: number;
	symbol: string;
	updateId: number;
	bidDepth: BinaBookUpdateLevel[];
	askDepth: BinaBookUpdateLevel[];
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
				graph.exchangeReady(this);
			});
		});
	}

	subscribe(market: string, type: SubscriptionType): void {
		throw new Error("Method not implemented.");
	}
	unsubscribe(market: string, type: SubscriptionType): void {
		throw new Error("Method not implemented.");
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

	setupWebsockets(symbols: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			Logger.log({
				level: "info",
				message: "Init BINA Websocket"
			});
			const exchange = this;
			const binaUpdates = 0;
			try {
				binance.websockets.trades(symbols, (trades: any) => {
					Logger.log({
						level: "silly",
						message: `BINA  ${trades.s} trade update. price:  ${trades.p}, quantity:  ${trades.q}, maker: ${trades.m}`
					});
					const parsedSymbols = exchange.parseSymbols(trades.s);

					exchange.updateTicker({
						exchangeSymbol: exchange.id,
						hubSymbol: parsedSymbols[0],
						marketSymbol: parsedSymbols[1],
						price: Number(trades.p),
						side: trades.m ? TradeType.Sell : TradeType.Buy,
						time: new Date(trades.T),
						size: Number(trades.q)
					});
				});
				// Call for snapshots
				this.initSnapshots(symbols).then(() => {
					// Joining for book updates
					binance.websockets.depth(symbols, depth => {
						const book: Book | undefined = this.books.get(depth.s);
						//					console.log(depth.s + " ASKS Updates ");
						//				console.log(symbol + " BIDS Updates ", bidDepth);
						if (book) {
							//							book.askLevels.forEach((BookLevel: any) => {
							//								console.log(depth.s + " ASK Update Price " + BookLevel.price + " Qty " + BookLevel.size);
							//							});
							depth.askDepth.forEach((BinaBookUpdateLevel: any) => {
								book.updateLevel(TradeType.Sell, BinaBookUpdateLevel[0], BinaBookUpdateLevel[1]);
							});
							depth.bidDepth.forEach((BinaBookUpdateLevel: any) => {
								book.updateLevel(TradeType.Buy, BinaBookUpdateLevel[0], BinaBookUpdateLevel[1]);
							});
							Logger.log({
								level: "silly",
								message: `BookUpdate asks: ${this.id}.${depth.symbol}`,
								data: depth.askDepth
							});
							Logger.log({
								level: "silly",
								message: `BookUpdate bids: ${this.id}.${depth.symbol}`,
								data: depth.bidDepth
							});
						}
					});
				});
				resolve();
			} catch (err) {
				Logger.log({
					level: "error",
					message: "BINA Websocket Error",
					data: err
				});
			}
		});
	}

	initSnapshots(symbols: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const exchange = this;
			symbols.forEach((symbol: any) => {
				const parsedSymbols = exchange.parseSymbols(symbol);
				const book: Book = new Book(this.id, parsedSymbols[0], parsedSymbols[1]);
				this.books.set(symbol, book);
				try {
					binance.depth(symbol, (error: any, depth: BinaBookSnapshot, sym: string) => {
						const askDepth = _.toPairs(depth.asks);
						const bidDepth = _.toPairs(depth.bids);
						_.forEach(askDepth, (level: BinaBookUpdateLevel) => {
							book.updateLevel(TradeType.Sell, level[0], level[1]);
							//							console.log(symbol + " ASKS forEach Price " + level[0] + " Qty " + level[1]);
						});
						_.forEach(bidDepth, (level: BinaBookUpdateLevel) => {
							book.updateLevel(TradeType.Buy, level[0], level[1]);
							//							console.log(symbol + " BIDS forEach Price " + level[0] + " Qty " + level[1]);
						});
						//						book.askLevels.forEach((BookLevel: any) => {
						//							console.log(symbol + " ASK Snapshot Price " + BookLevel.price + " Qty " + BookLevel.size);
						//						});

						Logger.log({
							level: "silly",
							message: `Snapshot asks: ${this.id}.${parsedSymbols[0]}.${parsedSymbols[1]}`,
							data: askDepth
						});
						Logger.log({
							level: "silly",
							message: `Snapshot bids: ${this.id}.${parsedSymbols[0]}.${parsedSymbols[1]}`,
							data: bidDepth
						});
					});
				} catch (err) {
					Logger.log({
						level: "error",
						message: "BINA Snapshot Error",
						data: err
					});
				}
			});

			resolve();
		});
	}
	// static binaMarketUpdateLoop(exchange: BinanceExchange){
	//     // const exchange = this;
	//     binance.bookTickers(function(tickers: any) {
	// log.log({
	// 	level: "debug",
	// 	message: "bookTickers",
	// 	data: ticker
	// });
	//         exchange.handleTickers(tickers);
	//     });
	//     setTimeout(() => {BinanceExchange.binaMarketUpdateLoop(exchange);}, 1000);
	// }

	// handleTickers(tickers: any){
	//     const exchange = this;
	//     Object.keys(tickers).forEach((key) => {
	//         const ticker = tickers[key];
	//         const parsedSymbols = this.parseSymbols(key);
	//         const hubSymbol = parsedSymbols[0];
	//         const marketSymbol = parsedSymbols[1];
	//         if(hubSymbol === `NOHUB`){
	// log.log({
	// 	level: "debug",
	// 	message: `Binance malformed symbol ${key}`
	// });
	//         }else{
	//             exchange.updateMarket(
	//                 hubSymbol,
	//                 marketSymbol,
	//                 Number(ticker.bid),
	//                 Number(ticker.ask)
	//             );

	//         }
	//     });
	// }
}
