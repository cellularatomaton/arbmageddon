import { Exchange } from "./exchange";
import { Hub, Market, Graph } from "../markets";
import { Asset } from "../assets";
import { Logger } from "../utils/logger";
import { TradeType, SubscriptionType } from "../utils/enums";
import { Book } from "../markets/book";
import * as _ from "lodash";

// BinaMessage: [ product_id, sequence_number, messages ]
export type BinaMessage = [number, number, any[]];

// BinaSnapshot: [ sequence_number, BinaBookSnapshotData ]
export interface BinaBookSnapshotData {
	currencyPair: string;
	orderBook: [Map<string, string>, Map<string, string>]; // [asks, bids]
}
export type BinaSnapshot = [number, BinaBookSnapshotData];

// BinaBookUpdate: [ message_type, order_type, price, size ]
// message_type: "o"
// order_type: 0=ask, 1=bid
export type BinaBookUpdate = [string, number, string, string];

// BinaTicker: [ message_type, trade_id, side, price, time, size ]
// message_type: "t"
// side: 0=sell, 1=buy
export type BinaTicker = [string, string, number, string, string, number];

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
			this.setupWebsockets(this.symbolList);
			graph.exchangeReady(this);
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

	setupWebsockets(symbols: string[]) {
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

				_.throttle(
					() => {
						Logger.log({
							level: "info",
							message: "BINA still alive " + Date.now()
						});
					},
					1000,
					{ leading: true }
				);
			});
			// Call for snapshots
			symbols.forEach((symbol: any) => {
				const parsedSymbols = exchange.parseSymbols(symbol);
				const book: Book = new Book(this.id, parsedSymbols[0], parsedSymbols[1]);
				this.books.set(symbol, book);
				binance.depth(symbol, (error, depth, sym) => {
					const askDepth = _.toPairs(depth.asks);
					const bidDepth = _.toPairs(depth.bids);
					_.forEach(askDepth, function(level, key) {
						book.updateLevel(0, level[0], level[1]);
						Logger.log({
							level: "silly",
							message: symbol + " ASKS forEach Price " + level[0] + " Qty " + level[1]
						});
						//						console.log(symbol + " ASKS forEach Price " + level[0] + " Qty " + level[1]);
					});
					_.forEach(bidDepth, function(level, key) {
						Logger.log({
							level: "silly",
							message: symbol + " BIDS forEach Price " + level[0] + " Qty " + level[1]
						});
						book.updateLevel(1, level[0], level[1]);
						//						console.log(symbol + " BIDS forEach Price " + level[0] + " Qty " + level[1]);
					});
				});
			});

			// Joining for book updates
			binance.websockets.depth(symbols, depth => {
				let { e: eventType, E: eventTime, s: symbol, u: updateId, b: bidDepth, a: askDepth } = depth;
				const book: Book | undefined = this.books.get(symbol);
				//				console.log(symbol + " ASKS Updates ", askDepth);
				//				console.log(symbol + " BIDS Updates ", bidDepth);
				if (book) {
					askDepth.forEach((level: any) => {
						book.updateLevel(0, level[0], level[1]);
						Logger.log({
							level: "silly",
							message: symbol + " Ask Incremental Book Update - Price: " + level[0] + " Qty: " + level[1]
						});
						//						console.log(symbol + " Ask Incremental Book Update - Price: " + level[0] + " Qty: " + level[1]);
					});

					bidDepth.forEach((level: any) => {
						book.updateLevel(1, level[0], level[1]);
						Logger.log({
							level: "silly",
							message: symbol + " Bid Incremental Book Update - Price: " + level[0] + " Qty: " + level[1]
						});
						//						console.log(symbol + " Bid Incremental Book Update - Price: " + level[0] + " Qty: " + level[1]);
					});

					book.levels.forEach((level: any) => {
						console.log(symbol + " Book - Price: " + level[0] + " Qty: " + level[1]);
					});
				}
			});
		} catch (err) {
			Logger.log({
				level: "error",
				message: "BINA Websocket Error",
				data: err
			});
		}
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
