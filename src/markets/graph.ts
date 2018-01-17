import { Hub, Market } from '../markets';
import { Asset } from '../assets';
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from '../exchanges';
import { ExecutionInstruction, Arb, ArbType } from '../strategies';
import { IEvent, EventImp } from '../utils';

import * as _ from "lodash";

export class Graph {
	public assetMap: Map<string, Asset>;
	public arbMap: Map<string, Arb>;
	public basisAssetSymbol: string = "BTC";
	public basisSize: number = 0.1;
	public basisAsset: Asset | undefined;
	exchanges: Exchange[];
	onArb: EventImp<ExecutionInstruction> = new EventImp<ExecutionInstruction>();
	public get arb(): IEvent<ExecutionInstruction> {
		return this.onArb.expose();
	};
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
		}
		arbFinder();
	}

	mapBasis() {
		// Gets called once for each exchange currently.
		if (!this.basisAsset) {
			this.basisAsset = this.assetMap.get(this.basisAssetSymbol);
		}
	}

	findArbs() {
		this.assetMap.forEach((asset: Asset, symbol: string) => {
			asset.markets.forEach((originMarket: Market, originIndex: number) => {
				asset.markets.forEach((destinationMarket: Market, destinationIndex: number) => {
					const arb = new Arb(originMarket, destinationMarket);
					const arbType = arb.type;
					if (arbType !== ArbType.NONE) {
						const id = arb.getId();
						if (!this.arbMap.has(id)) {
							// console.log(`Mapping Arb: ${id}`);
							arb.updated.on(
								_.throttle((inst?: ExecutionInstruction) => {
									if (inst) {
										// console.log(`Arb Triggered Instructions: ${JSON.stringify(inst)}`);
										this.onArb.trigger(inst);
									}
								}, 1000));
							this.arbMap.set(arb.getId(), arb);
							arb.subscribeToEvents();
						}
					} else {
						// console.log(`ArbType: NONE`);
					}
				});
			});
		});
	}
}