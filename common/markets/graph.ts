import { Hub, Market } from "../markets";
import { Asset } from "../assets";
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from "../exchanges";
import { SpreadExecution } from "../strategies";
import { IEvent, EventImp } from "../utils";
import { Arb } from "../strategies/arb";
import { ArbType, InitiationType, SubscriptionType } from "../utils/enums";
import * as _ from "lodash";
import { Logger } from "../utils/logger";
import { MakerDirectArb } from "../strategies/makerDirectArb";
import { MakerOriginConversion } from "../strategies/makerOriginConversion";
import { MakerDestinationConversion } from "../strategies/makerDestinationConversion";
import { TakerDirectArb } from "../strategies/takerDirectArb";
import { TakerOriginConversion } from "../strategies/takerOriginConversion";
import { TakerDestinationConversion } from "../strategies/takerDestinationConversion";
import { Book } from "./book";
import { MarketParameters, SubscriptionData, MarketInfo } from "./market";

export interface GraphParameters {
	basisAssetSymbol: string;
	basisSize: number;
	spreadTarget: number;
}

export interface WebsocketMessage<T> {
	type: string;
	action: string;
	data: T;
}

export type BookHandler = (book: Book) => void;

export class Graph {
	public static getSupportedArbTypes(originMarket: Market, destinationMarket: Market): ArbType[] {
		const supportedTypes: ArbType[] = [];
		const originConversion = Graph.getOriginMarketConversion(originMarket, destinationMarket);
		const destinationConversion = Graph.getDestinationMarketConversion(originMarket, destinationMarket);
		if (Graph.isSimpleArb(originMarket, destinationMarket)) {
			supportedTypes.push(ArbType.MakerDirect);
			supportedTypes.push(ArbType.TakerDirect);
		} else {
			if (originConversion) {
				supportedTypes.push(ArbType.MakerOriginConversion);
				supportedTypes.push(ArbType.TakerOriginConversion);
			}
			if (destinationConversion) {
				supportedTypes.push(ArbType.MakerDestinationConversion);
				supportedTypes.push(ArbType.TakerDestinationConversion);
			}
		}
		return supportedTypes;
	}

	public static getOriginMarketConversion(originMarket: Market, destinationMarket: Market): Market | undefined {
		return Graph.getConversion(
			originMarket.hub.exchange,
			destinationMarket.hub.asset.symbol,
			originMarket.hub.asset.symbol
		);
	}

	public static getDestinationMarketConversion(originMarket: Market, destinationMarket: Market): Market | undefined {
		return Graph.getConversion(
			destinationMarket.hub.exchange,
			originMarket.hub.asset.symbol,
			destinationMarket.hub.asset.symbol
		);
	}

	public static getConversion(exchange: Exchange, hub: string, market: string): Market | undefined {
		const conversionHub = exchange.getHub(hub);
		if (conversionHub.asset.symbol !== market) {
			return conversionHub.getMarket(market);
		} else {
			return undefined;
		}
	}

	public static isSimpleArb(originMarket: Market, destinationMarket: Market): boolean {
		const originHub = originMarket.hub.asset.symbol;
		const originExchange = originMarket.hub.exchange.id;
		const destinationHub = destinationMarket.hub.asset.symbol;
		const destinationExchange = destinationMarket.hub.exchange.id;
		const isSameHub = originHub === destinationHub;
		const isSameExchange = originExchange === destinationExchange;
		const isSimple = isSameHub && !isSameExchange;
		return isSimple;
	}

	assetMap: Map<string, Asset>;
	arbMap: Map<string, Arb>;
	bookSubscriptionMap: Map<string, BookHandler>;
	basisAsset: Asset | undefined;
	parameters: GraphParameters = {
		basisAssetSymbol: "BTC",
		basisSize: 0.01,
		spreadTarget: 3.0
	};
	exchanges: Exchange[];
	exchangeMap: Map<string, Exchange>;
	exchangeReadyCount: number;

	onArb: EventImp<SpreadExecution> = new EventImp<SpreadExecution>();
	get arb(): IEvent<SpreadExecution> {
		return this.onArb.expose();
	}

	onBook: EventImp<Book> = new EventImp<Book>();
	get book(): IEvent<Book> {
		return this.onBook.expose();
	}

	constructor() {
		this.assetMap = new Map<string, Asset>();
		this.arbMap = new Map<string, Arb>();
		this.bookSubscriptionMap = new Map<string, BookHandler>();
		this.exchangeReadyCount = 0;
		this.exchangeMap = new Map<string, Exchange>();
		this.exchanges = [new PoloniexExchange(this), new GdaxExchange(this), new BinanceExchange(this)];
		this.exchanges.forEach((exchange: Exchange) => {
			this.exchangeMap.set(exchange.id, exchange);
		});
	}

	exchangeReady(exchange: Exchange) {
		Logger.log({
			level: "info",
			message: `Exchange Ready [${exchange.id}]
	Exchange Count: ${this.exchanges.length},
	Asset Count: ${this.assetMap.size},
	Arb Count: ${this.arbMap.size}`
		});
		this.exchangeReadyCount++;
		if (this.exchangeReadyCount === this.exchanges.length) {
			this.findArbs();
		}
	}

	getArb(arbType: ArbType, originMarket: Market, destinationMarket: Market): Arb | undefined {
		if ((arbType as ArbType) === ArbType.MakerDirect) {
			return new MakerDirectArb(originMarket, destinationMarket, this);
		} else if ((arbType as ArbType) === ArbType.TakerDirect) {
			return new TakerDirectArb(originMarket, destinationMarket, this);
		} else if ((arbType as ArbType) === ArbType.MakerOriginConversion) {
			const conversionMarket = Graph.getOriginMarketConversion(originMarket, destinationMarket);
			if (conversionMarket) {
				return new MakerOriginConversion(originMarket, destinationMarket, conversionMarket, this);
			}
		} else if ((arbType as ArbType) === ArbType.TakerOriginConversion) {
			const conversionMarket = Graph.getOriginMarketConversion(originMarket, destinationMarket);
			if (conversionMarket) {
				return new TakerOriginConversion(originMarket, destinationMarket, conversionMarket, this);
			}
		} else if ((arbType as ArbType) === ArbType.MakerDestinationConversion) {
			const conversionMarket = Graph.getDestinationMarketConversion(originMarket, destinationMarket);
			if (conversionMarket) {
				return new MakerDestinationConversion(originMarket, destinationMarket, conversionMarket, this);
			}
		} else if ((arbType as ArbType) === ArbType.TakerDestinationConversion) {
			const conversionMarket = Graph.getDestinationMarketConversion(originMarket, destinationMarket);
			if (conversionMarket) {
				return new TakerDestinationConversion(originMarket, destinationMarket, conversionMarket, this);
			}
		}
		return undefined;
	}

	mapBasis() {
		// Gets called once for each exchange currently.
		if (!this.basisAsset) {
			this.basisAsset = this.assetMap.get(this.parameters.basisAssetSymbol);
		}
	}

	updateParams(params: GraphParameters) {
		this.parameters = params;
		this.mapBasis();
	}

	updateMarketParams(data: MarketParameters) {
		const market: Market | undefined = this.getMarket(data);
		if (market) {
			market.pricePrecision = data.pricePrecision;
			market.sizePrecision = data.sizePrecision;
			market.updateMarketBook();
		}
	}

	findArbs() {
		this.assetMap.forEach((asset: Asset, symbol: string) => {
			asset.markets.forEach((originMarket: Market, originIndex: number) => {
				asset.markets.forEach((destinationMarket: Market, destinationIndex: number) => {
					if (originMarket !== destinationMarket) {
						const arbTypes = Graph.getSupportedArbTypes(originMarket, destinationMarket);
						arbTypes.forEach((type: ArbType) => {
							const arb = this.getArb(type, originMarket, destinationMarket);
							if (arb) {
								const id = arb.getId();
								if (!this.arbMap.has(id)) {
									Logger.log({
										level: "info",
										message: `Mapping Arb: ${id}`
									});
									arb.updated.on((spread: SpreadExecution) => {
										Logger.log({
											level: "debug",
											message: `Arb Triggered`,
											data: spread
										});
										this.onArb.trigger(spread);
									});
									this.arbMap.set(arb.getId(), arb);
									arb.subscribeToEvents(this);
								}
							}
						});
					}
				});
			});
		});
	}

	subscribe(data: SubscriptionData) {
		if ((data.type as SubscriptionType) === SubscriptionType.Book) {
			this.subscribeToBook(data);
		} else if ((data.type as SubscriptionType) === SubscriptionType.Ticker) {
			// ToDo
		} else if ((data.type as SubscriptionType) === SubscriptionType.Position) {
			// ToDo
		}
	}

	unsubscribe(data: SubscriptionData) {
		if ((data.type as SubscriptionType) === SubscriptionType.Book) {
			this.unsubscribeFromBook(data);
		} else if ((data.type as SubscriptionType) === SubscriptionType.Ticker) {
			// ToDo
		} else if ((data.type as SubscriptionType) === SubscriptionType.Position) {
			// ToDo
		}
	}

	getMarket(info: MarketInfo): Market | undefined {
		const graph = this;
		const exchange = this.exchangeMap.get(info.exchange);
		if (exchange) {
			const market: Market | undefined = exchange.getMarket(info.hub, info.market);
			if (market) {
				return market;
			}
		}
		return undefined;
	}

	subscribeToBook(data: SubscriptionData) {
		const market = this.getMarket(data);
		if (market) {
			// GUI book updates can be throttled to every 250ms.
			const handler: BookHandler = _.throttle(
				(book: Book) => {
					this.onBook.trigger(book);
				},
				250,
				{ leading: true }
			);
			market.bookUpdate.on(handler);
			this.bookSubscriptionMap.set(market.getId(), handler);
		}
	}

	unsubscribeFromBook(data: SubscriptionData) {
		const market = this.getMarket(data);
		if (market) {
			const handler = this.bookSubscriptionMap.get(market.getId());
			if (handler) {
				market.bookUpdate.off(handler);
			}
			this.bookSubscriptionMap.delete(market.getId());
		}
	}
}
