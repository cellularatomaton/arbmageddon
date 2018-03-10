import { Exchange } from "./exchange";
import { Hub, Market, Graph } from "../markets";
import { Asset } from "../assets";
import { Logger } from "../utils/logger";
import { TradeType, SubscriptionType } from "../utils/enums";

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
	constructor(graph: Graph) {
		super("BIN", "BINANCE", graph);
		this.symbolList = [];
		this.updateExchangeInfo().then(() => {
			this.setupWebsockets(this.symbolList);
			graph.exchangeReady(this);
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
