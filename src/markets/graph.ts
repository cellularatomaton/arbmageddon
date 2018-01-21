import { Hub, Market } from "../markets";
import { Asset } from "../assets";
import {
	Exchange,
	GdaxExchange,
	BinanceExchange,
	PoloniexExchange
} from "../exchanges";
import { ExecutionInstruction } from "../strategies";
import { IEvent, EventImp } from "../utils";
import { InitiationType } from "../utils";
import { Arb } from "../strategies/arb";
import { ArbType } from "../utils/enums";
import * as _ from "lodash";
import { DestinationConversion } from "../strategies/destinationConversion";
import { DirectArb } from "../strategies/directArb";
import { OriginConversion } from "../strategies/originConversion";

export interface GraphParameters {
	basisAssetSymbol: string;
	basisSize: number;
	spreadTarget: number;
	initiationType: InitiationType;
}

export class Graph {
	public static getSupportedArbTypes(
		originMarket: Market,
		destinationMarket: Market
	): ArbType[] {
		const supportedTypes: ArbType[] = [];
		const originConversion = Graph.getOriginConversionMarket(
			originMarket,
			destinationMarket
		);
		const destinationConversion = Graph.getDestinationConversionMarket(
			originMarket,
			destinationMarket
		);
		if (
			originMarket.getBuyVwap() === 0 ||
			destinationMarket.getSellVwap() === 0
		) {
			return [];
		} else {
			if (Graph.isSimpleArb(originMarket, destinationMarket)) {
				supportedTypes.push(ArbType.Direct);
			}
			if (originConversion) {
				supportedTypes.push(ArbType.OriginConversion);
			}
			if (destinationConversion) {
				supportedTypes.push(ArbType.DestinationConversion);
			}
		}
		return supportedTypes;
	}

	public static getOriginConversionMarket(
		originMarket: Market,
		destinationMarket: Market
	): Market {
		const destinationHub = destinationMarket.hub.asset.symbol;
		const originHub = originMarket.hub.asset.symbol;
		const originExchange = originMarket.hub.exchange;
		const originConversionHub = originExchange.getHub(destinationHub);
		const originConversion = originConversionHub.getMarket(originHub);
		return originConversion;
	}

	public static getDestinationConversionMarket(
		originMarket: Market,
		destinationMarket: Market
	): Market {
		const originHub = originMarket.hub.asset.symbol;
		const destinationHub = destinationMarket.hub.asset.symbol;
		const destinationExchange = destinationMarket.hub.exchange;
		const destinationConversionHub = destinationExchange.getHub(originHub);
		const destinationConversion = destinationConversionHub.getMarket(
			destinationHub
		);
		return destinationConversion;
	}

	public static getArb(
		arbType: ArbType,
		originMarket: Market,
		destinationMarket: Market
	): Arb | undefined {
		if ((arbType as ArbType) === ArbType.Direct) {
			return new DirectArb(originMarket, destinationMarket);
		} else if ((arbType as ArbType) === ArbType.OriginConversion) {
			return new OriginConversion(originMarket, destinationMarket);
		} else if ((arbType as ArbType) === ArbType.DestinationConversion) {
			return new DestinationConversion(originMarket, destinationMarket);
		} else {
			return undefined;
		}
	}

	public static isSimpleArb(
		originMarket: Market,
		destinationMarket: Market
	): boolean {
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
		basisSize: 0.1,
		spreadTarget: 3.0,
		initiationType: InitiationType.Taker
	};
	exchanges: Exchange[];
	onArb: EventImp<ExecutionInstruction> = new EventImp<ExecutionInstruction>();
	get arb(): IEvent<ExecutionInstruction> {
		return this.onArb.expose();
	}
	constructor() {
		this.assetMap = new Map<string, Asset>();
		this.arbMap = new Map<string, Arb>();
		this.exchanges = [
			new GdaxExchange(this),
			new BinanceExchange(this),
			new PoloniexExchange(this)
		];
		const arbFinder = () => {
			this.findArbs();
			setTimeout(arbFinder, 1000);
		};
		arbFinder();
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
				asset.markets.forEach(
					(destinationMarket: Market, destinationIndex: number) => {
						const arbTypes = Graph.getSupportedArbTypes(
							originMarket,
							destinationMarket
						);
						arbTypes.forEach((type: ArbType) => {
							const arb = Graph.getArb(type, originMarket, destinationMarket);
							if (arb) {
								const id = arb.getId();
								if (!this.arbMap.has(id)) {
									console.log(`Mapping Arb: ${id}`);
									arb.updated.on(
										_.throttle((inst?: ExecutionInstruction) => {
											if (inst) {
												// console.log(
												// 	`Arb Triggered Instructions: ${JSON.stringify(inst)}`
												// );
												this.onArb.trigger(inst);
											}
										}, 1000)
									);
									this.arbMap.set(arb.getId(), arb);
									arb.subscribeToEvents(this);
								}
							}
						});
					}
				);
			});
		});
	}
}
