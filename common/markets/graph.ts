import { Hub, Market } from "../markets";
import { Asset } from "../assets";
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from "../exchanges";
import { SpreadExecution } from "../strategies";
import { IEvent, EventImp } from "../utils";
import { Arb } from "../strategies/arb";
import { ArbType, InitiationType } from "../utils/enums";
import * as _ from "lodash";
import { Logger } from "../utils/logger";
import { MakerDirectArb } from "../strategies/makerDirectArb";
import { MakerOriginConversion } from "../strategies/makerOriginConversion";
import { MakerDestinationConversion } from "../strategies/makerDestinationConversion";
import { TakerDirectArb } from "../strategies/takerDirectArb";
import { TakerOriginConversion } from "../strategies/takerOriginConversion";
import { TakerDestinationConversion } from "../strategies/takerDestinationConversion";

export interface GraphParameters {
	basisAssetSymbol: string;
	basisSize: number;
	spreadTarget: number;
}

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
	basisAsset: Asset | undefined;
	parameters: GraphParameters = {
		basisAssetSymbol: "BTC",
		basisSize: 0.01,
		spreadTarget: 3.0
	};
	exchanges: Exchange[];
	onArb: EventImp<SpreadExecution> = new EventImp<SpreadExecution>();

	get arb(): IEvent<SpreadExecution> {
		return this.onArb.expose();
	}
	constructor() {
		this.assetMap = new Map<string, Asset>();
		this.arbMap = new Map<string, Arb>();
		this.exchanges = [new GdaxExchange(this), /*new BinanceExchange(this),*/ new PoloniexExchange(this)];
	}

	exchangeReady(exchange: Exchange) {
		this.findArbs();
		Logger.log({
			level: "info",
			message: `Exchange Ready [${exchange.name}]
	Exchange Count: ${this.exchanges.length},
	Asset Count: ${this.assetMap.size},
	Arb Count: ${this.arbMap.size}`
		});
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
										level: "debug",
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
}
