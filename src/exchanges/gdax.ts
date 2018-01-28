import { Exchange } from "./exchange";
import { Hub, Market, Graph, Ticker, TradeType } from "../markets";
import { Asset } from "../assets";

import Gdax = require("gdax");
const log = require("winston");
const PRODS = ["eth-btc", "ltc-btc"];
const URI = "wss://ws-feed.gdax.com/";
const AUTH = undefined;
const HEARTBEAT = false;
const CHANNELS = ["heartbeat", "ticker"];
const OPTS = {
	heartbeat: false,
	channels: CHANNELS
};
const products = [];

export class GdaxExchange extends Exchange {
	products: any[];
	constructor(graph: Graph) {
		super("GDX", "COINBASE", graph);
		this.updateProducts().then(() => {
			this.setupWebsocket();
		});
	}

	updateProducts(): Promise<void> {
		return new Promise((resolve, reject) => {
			const publicClient = new Gdax.PublicClient();
			publicClient
				.getProducts()
				.then((data: any) => {
					this.products = data;
					this.products.forEach((prod: any) => {
						this.mapMarket(prod.quote_currency, prod.base_currency);
					});
					this.graph.mapBasis();
					resolve();
				})
				.catch((error: any) => {
					log.error(`Gdax products update error: ${error}`);
				});
		});
	}

	handleTicker(exchange: Exchange, data: any) {
		// log.debug(data);
		const symbols = data.product_id.split("-");
		exchange.updateTicker({
			exchangeSymbol: this.id,
			hubSymbol: symbols[0],
			marketSymbol: symbols[1],
			bestAsk: Number(data.best_ask),
			bestBid: Number(data.best_bid),
			price: Number(data.price),
			side: data.side === "buy" ? TradeType.BUY : TradeType.SELL,
			time: new Date(data.time),
			size: Number(data.last_size)
		});
	}

	setupWebsocket(): any {
		log.info("Init GDAX websocket");
		const ws = new Gdax.WebsocketClient(PRODS, URI, AUTH, OPTS);
		const exchange = this;
		ws.on("open", () => {
			log.info("GDAX websocket opened.");
		});
		ws.on("message", (data: any) => {
			if (data.type === "ticker" && data.last_size) {
				exchange.handleTicker(exchange, data);
			}
		});
		ws.on("error", (err: any) => {
			log.error("GDAX Websocket error", err);
		});

		ws.on("close", () => {
			log.warn("GDAX Websocket closed.");
		});
	}

	// handleBook(
	//     hubSymbol: string,
	//     marketSymbol: string,
	//     book: any)
	// {
	//     const bestBid = book.bids && book.bids.length && book.bids[0].length ? Number(book.bids[0][0]) : Number.NaN;
	//         const bestAsk = book.asks && book.asks[0] && book.asks[0].length ? Number(book.asks[0][0]) : Number.NaN;
	//         if(!Number.isNaN(bestBid) && !Number.isNaN(bestAsk)){
	//             this.updateMarket(
	//                 hubSymbol,
	//                 marketSymbol,
	//                 Number(bestBid),
	//                 Number(bestAsk));
	//         }
	// }

	// getTickerAndUpdateMarket(
	//     hubSymbol: string,
	//     marketSymbol: string,
	// ){
	//     const publicClient = new Gdax.PublicClient(`${marketSymbol}-${hubSymbol}`);
	//     publicClient.getProductOrderBook()
	//     .then((book: any)=>{
	//         this.handleBook(hubSymbol, marketSymbol, book);
	//     })
	//     .catch((error: any)=>{
	//         log.error(`Gdax book update error: ${error}`);
	//     });
	// };
}
