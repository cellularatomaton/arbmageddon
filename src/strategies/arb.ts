import { EventImp, IEvent } from "../utils/event";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Market } from "../markets/market";
import { ArbType, InitiationType, TradeType } from "../utils/enums";
import { Graph } from "../markets/graph";
import { Vwap, Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";

export interface Swing {
	fromLeg: ExecutionOperation;
	toLeg: ExecutionOperation;
	tradeType: TradeType;
	// getSwingSize: (price: number, size: number) => number;
}

export abstract class Arb {
	static debugCount: number = 0;
	makerSpreads: SpreadExecution[];
	makerStatisticsWindow: SpreadExecution[];
	workingMakerBasisPosition: number = 0;
	takerSpreads: SpreadExecution[];
	takerStatisticsWindow: SpreadExecution[];
	workingTakerBasisPosition: number = 0;

	onUpdated: EventImp<SpreadExecution> = new EventImp<SpreadExecution>();
	get updated(): IEvent<SpreadExecution> {
		return this.onUpdated.expose();
	}

	constructor(public originMarket: Market, public destinationMarket: Market, public graph: Graph) {
		this.makerSpreads = [];
		this.makerStatisticsWindow = [];
		this.takerSpreads = [];
		this.takerStatisticsWindow = [];
	}

	abstract getId(): string;
	// abstract getSpread(spread: SpreadExecution): number;
	// abstract getSpreadPercent(spread: SpreadExecution): number;
	abstract getSpreadStart(spread: SpreadExecution): number;
	abstract getSpreadEnd(spread: SpreadExecution): number;
	abstract updateSpreadBasis(spread: SpreadExecution): void;
	abstract subscribeToEvents(graph: Graph): void;
	abstract getNewSpread(ticker: Ticker, size: number, basisSize: number): SpreadExecution;
	// abstract getInstruction(): SpreadExecution;

	// subscribeToVwap(event: IEvent<Vwap>) {
	// 	event.on((vwap: Vwap | undefined) => {
	// 		const inst: SpreadExecution = this.getInstruction();
	// log.log({
	// 	level: "debug",
	// 	message: `VWAP Triggered Instructions: ${JSON.stringify(inst)}`
	// });
	// 		this.onUpdated.trigger(inst);
	// 	});
	// }

	// public getBuyOperation(): ExecutionOperation {
	// 	return {
	// 		exchange: this.originMarket.hub.exchange.id,
	// 		hub: this.originMarket.hub.asset.symbol,
	// 		market: this.originMarket.asset.symbol,
	// 		price: this.originMarket.getBuyVwap(),
	// 		duration: this.originMarket.getBuyDuration()
	// 	};
	// }

	// public getSellOperation(): ExecutionOperation {
	// 	return {
	// 		exchange: this.destinationMarket.hub.exchange.id,
	// 		hub: this.destinationMarket.hub.asset.symbol,
	// 		market: this.destinationMarket.asset.symbol,
	// 		price: this.destinationMarket.getSellVwap(),
	// 		duration: this.destinationMarket.getSellDuration()
	// 	};
	// }
	// getId(): string {
	// 	return this.getInstId();
	// }

	getSpread(spread: SpreadExecution): number {
		if (spread.entryBasisSize && spread.exitBasisSize) {
			const basisSpread = spread.exitBasisSize - spread.entryBasisSize;
			return basisSpread;
		} else {
			return Number.NaN;
		}
	}

	getSpreadPercent(spread: SpreadExecution): number {
		if (spread.entryBasisSize) {
			const basisSpread = this.getSpread(spread);
			return basisSpread / spread.entryBasisSize;
		} else {
			return Number.NaN;
		}
	}

	getOperation(
		exchange: string,
		hub: string,
		market: string,
		price?: number,
		size?: number,
		basisSize?: number,
		start?: Date
	): ExecutionOperation {
		return {
			exchange,
			hub,
			market,
			start: start || undefined,
			price: price || Number.NaN,
			size: size || 0,
			basisSize: basisSize || 0,
			duration: Number.NaN
		};
	}

	getToVwapPrice(swing: Swing, price: number, size: number): number {
		if (Number.isNaN(swing.toLeg.price)) {
			return price;
		} else {
			return (swing.toLeg.price * swing.toLeg.size + price * size) / (swing.toLeg.size + size);
		}
	}

	getFromVwapPrice(swing: Swing, price: number, size: number): number {
		if (Number.isNaN(swing.fromLeg.price)) {
			return price;
		} else {
			return (swing.fromLeg.price * swing.fromLeg.size + price * size) / (swing.fromLeg.size + size);
		}
	}

	legIn(ticker: Ticker, initiationType: InitiationType, market: Market) {
		const size: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		let basisRemainder = Number.NaN;
		let spreadCount;
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			basisRemainder = this.graph.parameters.basisSize - this.workingMakerBasisPosition;
		} else {
			basisRemainder = this.graph.parameters.basisSize - this.workingTakerBasisPosition;
		}
		const tradableBasisSize = Math.min(market.getBasisSize(size), basisRemainder);
		if (Number.isNaN(tradableBasisSize)) {
			return;
		}
		const tradableToSize = market.getMarketSize(tradableBasisSize);
		if (Number.isNaN(tradableToSize)) {
			return;
		}
		const spread = this.getNewSpread(ticker, tradableToSize, tradableBasisSize);
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			this.workingMakerBasisPosition += tradableBasisSize;
			this.makerSpreads.push(spread);
			spreadCount = this.makerSpreads.length;
		} else {
			this.workingTakerBasisPosition += tradableBasisSize;
			this.takerSpreads.push(spread);
			spreadCount = this.takerSpreads.length;
		}
		const mktName = `${market.hub.exchange.name}:${market.asset.symbol}`;
		const hubName = `${market.hub.exchange.name}:${market.hub.asset.symbol}`;
		Logger.log({
			level: "debug",
			message: `${this.getId()}#${spreadCount}
	Leg into ${mktName} from ${hubName},
	Ticker Price = ${price},
	Ticker To Size = ${size},
	Tradable To Size = ${tradableToSize},
	Tradable Basis Size = ${tradableBasisSize}`
		});
	}

	swingToFrom(
		ticker: Ticker,
		initiationType: InitiationType,
		market: Market,
		getSwing: (spread: SpreadExecution) => Swing | undefined,
		legFullyFilled: (spread: SpreadExecution) => void
	) {
		Arb.debugCount++;
		const size: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		const tickerFromSize = size * price;
		let remainderTickerToSize: number = size;
		let finished: boolean = false;
		while (!finished) {
			Logger.log({
				level: "silly",
				message: `swingToFrom while: ${Arb.debugCount}`
			});
			let spread;
			if ((initiationType as InitiationType) === InitiationType.Maker) {
				spread = this.makerSpreads[0];
			} else {
				spread = this.takerSpreads[0];
			}
			if (spread) {
				const swing = getSwing(spread);
				if (swing) {
					const fromBasisSize = swing.fromLeg.basisSize;
					const fromSize = swing.fromLeg.size;
					let swingSize;
					if ((swing.tradeType as TradeType) === TradeType.BUY) {
						swingSize = fromSize / price;
					} else {
						swingSize = fromSize * price;
					}
					const toBasisSize = swing.toLeg.basisSize;
					const currentToSize = swing.toLeg.size;
					const tradableToSize = swingSize - currentToSize;
					const tradableTickerToSize = Math.min(tradableToSize, remainderTickerToSize);
					remainderTickerToSize -= tradableTickerToSize;
					const newToSize = currentToSize + tradableTickerToSize;
					const newToBasisSize = market.getBasisSize(newToSize);
					if (0 < tradableTickerToSize && !Number.isNaN(newToSize) && !Number.isNaN(newToBasisSize)) {
						// Log it:
						let fromLegName;
						let toLegName;
						if ((swing.tradeType as TradeType) === TradeType.BUY) {
							fromLegName = `${swing.fromLeg.exchange}:${swing.fromLeg.market}`;
							toLegName = `${swing.toLeg.exchange}:${swing.toLeg.market}`;
						} else {
							fromLegName = `${swing.fromLeg.exchange}:${swing.fromLeg.market}`;
							toLegName = `${swing.toLeg.exchange}:${swing.toLeg.hub}`;
						}
						Logger.log({
							level: "debug",
							message: `${this.getId()}
	Swing from ${fromLegName} to ${toLegName},
	Ticker Price = ${price},
	Ticker To Size = ${size},
	Ticker From Size = ${tickerFromSize},
	Ticker Tradable Size = ${tradableTickerToSize},
	Ticker Remainder Size = ${remainderTickerToSize},
	From Basis Size = ${fromBasisSize},
	From Size = ${fromSize},
	To Basis Size Old = ${toBasisSize},
	To Size Old  = ${currentToSize},
	To Basis Size New = ${newToBasisSize},
	To Size New  = ${newToSize},`
						});
						// Process it:
						swing.toLeg.price = this.getToVwapPrice(swing, price, newToSize);
						swing.toLeg.size = newToSize;
						swing.toLeg.basisSize = newToBasisSize;
						if (0 < remainderTickerToSize) {
							// Leg fully filled:
							legFullyFilled(spread);
							// Continue looping to check other queued arbs.
						} else {
							// Leg only partially filled:
							finished = true;
						}
					} else {
						finished = true;
					}
				} else {
					finished = true;
				}
			} else {
				finished = true;
			}
		}
	}

	legConvert(
		ticker: Ticker,
		initiationType: InitiationType,
		market: Market,
		getSwing: (spread: SpreadExecution) => Swing | undefined
	) {
		this.swingToFrom(ticker, initiationType, market, getSwing, (spread: SpreadExecution) => {
			// Do nothing until spread fully filled.
		});
	}

	legOut(
		ticker: Ticker,
		initiationType: InitiationType,
		market: Market,
		getSwing: (spread: SpreadExecution) => Swing | undefined
	) {
		this.swingToFrom(ticker, initiationType, market, getSwing, (spread: SpreadExecution) => {
			this.updateSpreadBasis(spread);
			if (spread.entryBasisSize && spread.exitBasisSize) {
				if ((initiationType as InitiationType) === InitiationType.Maker) {
					this.workingMakerBasisPosition -= spread.entryBasisSize;
					this.makerSpreads.shift();
					this.makerStatisticsWindow.push(spread);
					this.pruneWindow(this.makerStatisticsWindow);
					spread.spreadsPerMinute = this.makerStatisticsWindow.length;
				} else {
					this.workingTakerBasisPosition -= spread.entryBasisSize;
					this.takerSpreads.shift();
					this.takerStatisticsWindow.push(spread);
					this.pruneWindow(this.takerStatisticsWindow);
					spread.spreadsPerMinute = this.takerStatisticsWindow.length;
				}
				spread.spread = this.getSpreadPercent(spread);
				spread.spreadPercent = this.getSpread(spread);
				this.onUpdated.trigger(spread);
			}
		});
	}

	getSpreadTime(spread: SpreadExecution): number {
		const start = this.getSpreadStart(spread);
		const end = this.getSpreadEnd(spread);
		const time = end - start;
		return time;
	}

	pruneWindow(window: SpreadExecution[]) {
		const windowLength = 60000;
		let rolling = true;
		while (rolling) {
			const spread = window[0];
			if (spread) {
				const start = this.getSpreadStart(spread);
				// const end = this.getSpreadEnd(window[window.length - 1]);
				const end = Date.now();
				const stale = start < end - windowLength;
				if (stale) {
					window.shift();
				} else {
					rolling = false;
				}
			} else {
				rolling = false;
			}
		}
	}
}
