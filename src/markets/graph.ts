import { Hub, Market } from "../markets";
import { Asset } from "../assets";
import {
	Exchange,
	GdaxExchange,
	BinanceExchange,
	PoloniexExchange
} from "../exchanges";
import { ExecutionInstruction, Arb } from "../strategies";
import { IEvent, EventImp } from "../utils";
import { InitiationType, ArbType } from "../utils";

import * as _ from "lodash";

export interface GraphParameters {
	basisAssetSymbol: string;
	basisSize: number;
	spreadTarget: number;
	initiationType: InitiationType;
}

export class Graph {
	assetMap: Map<string, Asset>;
	arbMap: Map<string, Arb>;
	// basisAssetSymbol: string = "BTC";
	// basisSize: number = 0.1;
	basisAsset: Asset | undefined;
	// initiationType: InitiationType = InitiationType.Taker;
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
						const arb = new Arb(originMarket, destinationMarket);
						const arbType = arb.type;
						if ((arbType as ArbType) !== ArbType.None) {
							const id = arb.getId();
							if (!this.arbMap.has(id)) {
								// console.log(`Mapping Arb: ${id}`);
								arb.updated.on(
									_.throttle((inst?: ExecutionInstruction) => {
										if (inst) {
											// console.log(`Arb Triggered Instructions: ${JSON.stringify(inst)}`);
											this.onArb.trigger(inst);
										}
									}, 1000)
								);
								this.arbMap.set(arb.getId(), arb);
								arb.subscribeToEvents(this);
							}
						} else {
							// console.log(`ArbType: NONE`);
						}
					}
				);
			});
		});
	}
}
