import { Exchange, HubMarketPair } from "./exchange";
import { Hub, Market, Graph } from "../markets";
import { Asset } from "../assets";
import { Http } from "../utils";
import { symlink } from "fs";
import { Logger } from "../utils/logger";
import { TradeType } from "../utils/enums";

export class PoloniexExchange extends Exchange {
	symbolList: string[];
	idToSymbolMap: Map<number, HubMarketPair>;
	constructor(graph: Graph) {
		super("PLX", "POLONIEX", graph);
		this.idToSymbolMap = new Map<number, HubMarketPair>();
		this.updateProducts().then(() => {
			this.setupWebsocket();
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
					this.symbolList.push(key);
				});
				this.graph.mapBasis();
				resolve();
			});
		});
	}

	setupWebsocket() {
		Logger.log({
			level: "info",
			message: "Init POLO Websocket"
		});
		const WebSocket = require("ws");

		const exchange = this;
		const ws = new WebSocket("wss://api2.poloniex.com/");

		ws.on("open", function open() {
			Logger.log({
				level: "info",
				message: "POLO Websocket opened"
			});
			exchange.symbolList.forEach((symbol: string) => {
				const msg = {
					command: "subscribe",
					channel: symbol
				};
				ws.send(JSON.stringify(msg));
			});
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
				const productId = data[0];
				const sequence = data[1];
				const messages = data[2];
				messages.forEach((m: any[]) => {
					const type = m[0];
					if (type === "i") {
						// Initialize:  Symbol mapping and initial book.
						const initial: any = m[1];
						const symbol: string = initial.currencyPair;
						const symbols = symbol.split("_");
						exchange.idToSymbolMap.set(productId, {
							hubSymbol: symbols[0],
							marketSymbol: symbols[1]
						});
					} else if (type === "o") {
						// Order:
						const side: TradeType = m[1] ? TradeType.BUY : TradeType.SELL;
						const price: number = Number(m[2]);
						const quantity: number = Number(m[3]);
					} else if (type === "t") {
						// Trade:
						const pair: HubMarketPair | undefined = exchange.idToSymbolMap.get(productId);
						if (pair) {
							const tradeId: number = Number(m[1]);
							exchange.updateTicker({
								exchangeSymbol: exchange.id,
								hubSymbol: pair.hubSymbol,
								marketSymbol: pair.marketSymbol,
								side: m[2] ? TradeType.BUY : TradeType.SELL,
								price: Number(m[3]),
								time: new Date(m[5] * 1000),
								size: Number(m[4])
							});
						}
					}
				});
			}
		});
	}
}