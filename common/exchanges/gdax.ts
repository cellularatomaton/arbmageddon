import { Exchange } from "./exchange";
import { Hub, Market, Graph, Ticker } from "../markets";
import { Asset } from "../assets";
import { Logger } from "../utils/logger";
import { TradeType, SubscriptionType } from "../utils/enums";

import * as Gdax from "gdax";
import { Book } from "../markets/book";

const PRODS = ["eth-btc", "ltc-btc"];
const URI = "wss://ws-feed.gdax.com/";
const AUTH = undefined;
const HEARTBEAT = false;
const CHANNELS = ["heartbeat", "ticker"];
const OPTS = {
	heartbeat: false,
	channels: CHANNELS
};
// const products = [];

export interface GdaxMessage {
	type: string;
	product_id: string;
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
	products: any[];
	ws: any;
	books: Map<string, Book>;
	constructor(graph: Graph) {
		super("GDX", "COINBASE", graph);
		this.products = [];
		this.books = new Map<string, Book>();
		this.updateProducts().then(() => {
			this.setupWebsocket();
			graph.exchangeReady(this);
		});
	}

	subscribe(market: string, type: SubscriptionType): void {
		if ((type as SubscriptionType) === SubscriptionType.Book) {
			this.subscribeLevel2(market);
		}
	}
	unsubscribe(market: string, type: SubscriptionType): void {
		if ((type as SubscriptionType) === SubscriptionType.Book) {
			this.unsubscribeLevel2(market);
		}
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
					Logger.log({
						level: "error",
						message: `Gdax products update error: ${error}`,
						data: error
					});
				});
		});
	}

	handleTicker(exchange: Exchange, data: any) {
		Logger.log({
			level: "silly",
			message: "GDAX Handle Ticker",
			data
		});
		const symbols = data.product_id.split("-");
		exchange.updateTicker({
			exchangeSymbol: this.id,
			hubSymbol: symbols[0],
			marketSymbol: symbols[1],
			bestAsk: Number(data.best_ask),
			bestBid: Number(data.best_bid),
			price: Number(data.price),
			side: data.side === "buy" ? TradeType.Buy : TradeType.Sell,
			time: new Date(data.time),
			size: Number(data.last_size)
		});
	}

	setupWebsocket(): any {
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
		});
		this.ws.on("message", (data: any) => {
			if (data.type === "ticker" && data.last_size) {
				exchange.handleTicker(exchange, data);
			} else if (data.type === "snapshot") {
				// Create new book
			} else if (data.type === "l2update") {
				// Update existing book
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

	// getBookFromSnapshot(snapshot: GdaxBookSnapshot): Book {
	// }

	// updateBook(update: GdaxBookUpdate): void {}

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
