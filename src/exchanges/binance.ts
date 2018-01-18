import { Exchange } from "./exchange";
import { Hub, Market, Graph, TradeType } from "../markets";
import { Asset } from "../assets";

const _ = require("lodash");
const binance = require("node-binance-api");
const hubSymbols = new Set(["BTC", "ETH", "BNB", "USDT"]);

binance.options({
	reconnect: false,
	test: true,
	recvWindow: 60000
});

export class BinanceExchange extends Exchange {
	symbolList: string[];
	constructor(graph: Graph) {
		super("BIN", "BINANCE", graph);
		this.updateExchangeInfo().then(() => {
			this.setupWebsockets(this.symbolList);
		});
	}

	updateExchangeInfo(): Promise<void> {
		const exchange = this;
		return new Promise((resolve, reject) => {
			binance.exchangeInfo((info: any) => {
				const markets = info.symbols;
				markets.forEach((market: any) => {
					const hubSymbol = market.quoteAsset;
					const marketSymbol = market.baseAsset;
					// console.log(`Binance mapping symbols: Hub ${hubSymbol} -> Market ${marketSymbol}`);
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
		console.log("Init BINA Websocket");
		const exchange = this;
		const binaUpdates = 0;
		try {
			binance.websockets.trades(symbols, (trades: any) => {
				// let {e:eventType, E:eventTime, s:symbol, p:price, q:quantity, m:maker, a:tradeId} = trades;
				// console.log(symbol+" trade update. price: "+price+", quantity: "+quantity+", maker: "+maker);
				const parsedSymbols = exchange.parseSymbols(trades.s);

				exchange.updateTicker({
					exchangeSymbol: exchange.id,
					hubSymbol: parsedSymbols[0],
					marketSymbol: parsedSymbols[1],
					price: Number(trades.p),
					side: trades.m ? TradeType.SELL : TradeType.BUY,
					time: new Date(trades.T),
					size: Number(trades.q)
				});

				_.throttle(
					() => {
						console.log("BINA still alive " + Date.now());
					},
					1000,
					{ leading: true }
				);
			});
		} catch (err) {
			console.log(err);
		}
	}

	// static binaMarketUpdateLoop(exchange: BinanceExchange){
	//     // const exchange = this;
	//     binance.bookTickers(function(tickers: any) {
	//         // console.log("bookTickers", ticker);
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
	//             console.log(`Binance malformed symbol ${key}`);
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
