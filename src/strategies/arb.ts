import { EventImp, IEvent } from "../utils/event";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Market } from "../markets/market";
import { ArbType, InitiationType } from "../utils/enums";
import { Graph } from "../markets/graph";
import { Vwap, Ticker } from "../markets/ticker";

const logger = require("winston");

export interface Swing {
	fromLeg: ExecutionOperation;
	toLeg: ExecutionOperation;
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

	constructor(
		public originMarket: Market,
		public destinationMarket: Market,
		public graph: Graph
	) {
		this.makerSpreads = [];
		this.makerStatisticsWindow = [];
		this.takerSpreads = [];
		this.takerStatisticsWindow = [];
	}

	abstract getInstId(): string;
	abstract getSpread(spread: SpreadExecution): number;
	abstract getSpreadPercent(spread: SpreadExecution): number;
	abstract getSpreadStart(spread: SpreadExecution): number;
	abstract getSpreadEnd(spread: SpreadExecution): number;
	abstract subscribeToEvents(graph: Graph): void;
	abstract getNewSpread(
		ticker: Ticker,
		size: number,
		basisSize: number
	): SpreadExecution;
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
	getId(): string {
		return this.getInstId();
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
			return (
				(swing.toLeg.price * swing.toLeg.size + price * size) /
				(swing.toLeg.size + size)
			);
		}
	}

	getFromVwapPrice(swing: Swing, price: number, size: number): number {
		if (Number.isNaN(swing.fromLeg.price)) {
			return price;
		} else {
			return (
				(swing.fromLeg.price * swing.fromLeg.size + price * size) /
				(swing.fromLeg.size + size)
			);
		}
	}

	legIn(ticker: Ticker, initiationType: InitiationType, market: Market) {
		const size: number = ticker.size || Number.NaN;
		const tickerBasisSize = market.getBasisSize(size);
		let basisRemainder = Number.NaN;
		let marketRemainder = Number.NaN;
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			basisRemainder =
				this.graph.parameters.basisSize - this.workingMakerBasisPosition;
		} else {
			basisRemainder =
				this.graph.parameters.basisSize - this.workingTakerBasisPosition;
		}
		marketRemainder = market.getMarketSize(basisRemainder);
		// ***************** Debug *****************
		const legName = `${market.hub.exchange.name}:${market.asset.symbol}/${
			market.hub.asset.symbol
		}`;
		logger.log({
			level: "debug",
			message: `Leg into ${legName}:
	size=${size},
	basisSize=${tickerBasisSize},
	marketRemainder=${marketRemainder},
	basisRemainder=${basisRemainder}`
		});
		// ***************** End Debug *****************
		if (basisRemainder < tickerBasisSize) {
			// Won't used all of this ticker. Never want to have more than max basis size.
			const spread = this.getNewSpread(ticker, marketRemainder, basisRemainder);

			if ((initiationType as InitiationType) === InitiationType.Maker) {
				this.workingMakerBasisPosition = this.graph.parameters.basisSize;
				this.makerSpreads.push(spread);
			} else {
				this.workingTakerBasisPosition = this.graph.parameters.basisSize;
				this.takerSpreads.push(spread);
			}
			// this.onUpdated.trigger(spread);
		} else {
			// Use all of this ticker
			const spread = this.getNewSpread(ticker, size, tickerBasisSize);
			if ((initiationType as InitiationType) === InitiationType.Maker) {
				this.workingMakerBasisPosition += tickerBasisSize;
				this.makerSpreads.push(spread);
			} else {
				this.workingTakerBasisPosition += tickerBasisSize;
				this.takerSpreads.push(spread);
			}
			// this.onUpdated.trigger(spread);
		}
	}

	swingToFrom(
		ticker: Ticker,
		initiationType: InitiationType,
		market: Market,
		getSwing: (spread: SpreadExecution) => Swing | undefined,
		legFullyFilled: (spread: SpreadExecution) => void
	) {
		// Arb.debugCount++;
		const price: number = ticker.price || Number.NaN;
		const tickerMarketSize: number = ticker.size || Number.NaN;
		const tickerBasisSize = market.getBasisSize(tickerMarketSize);
		let finished: boolean = false;
		let remainderTickerBasisSize: number = tickerBasisSize;
		while (!finished) {
			logger.log({
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
					// Current Basis Size, "From" Leg:
					const fromBasisSize = swing.fromLeg.basisSize;
					if (0 < fromBasisSize) {
						// Current Basis Size, "To" Leg:
						const toBasisSize = swing.toLeg.basisSize;
						// How much to fill "From" Leg:
						// const tradableBasisSize = fromBasisSize - toBasisSize;
						// "How much of this ticker is tradable?"
						const tradableTickerBasisSize = Math.min(
							fromBasisSize,
							remainderTickerBasisSize
						);
						// And how much is left over?
						remainderTickerBasisSize -= tradableTickerBasisSize;
						const toNewBasisSize = toBasisSize + fromBasisSize;
						const toNewMarketSize = market.getMarketSize(toNewBasisSize);
						// ***************** Debug *****************
						const fromLegName = `${swing.fromLeg.exchange}:${
							swing.fromLeg.market
						}/${swing.fromLeg.hub}`;
						const toLegName = `${swing.toLeg.exchange}:${swing.toLeg.market}/${
							swing.toLeg.hub
						}`;
						logger.log({
							level: "debug",
							message: `Swing from ${fromLegName} to ${toLegName}:
	tickerMarketSize=${tickerMarketSize},
	tickerBasisSize=${tickerBasisSize},
	fromBasisSize=${fromBasisSize},
	toBasisSize=${toBasisSize},
	remainder=${remainderTickerBasisSize},
	tradableTicker=${tradableTickerBasisSize}`
						});
						// ***************** End Debug *****************
						if (toBasisSize < fromBasisSize) {
							if (0 < remainderTickerBasisSize) {
								// Fill:
								swing.toLeg.price = this.getToVwapPrice(
									swing,
									price,
									toNewMarketSize
								);
								swing.toLeg.size = toNewMarketSize;
								swing.toLeg.basisSize = toNewBasisSize;
								legFullyFilled(spread);
								// Continue Looping.
							} else {
								// Fill:
								swing.toLeg.price = this.getToVwapPrice(
									swing,
									price,
									tickerMarketSize
								);
								swing.toLeg.size = toNewMarketSize;
								swing.toLeg.basisSize = toNewBasisSize;
								// remainderTickerBasisSize = 0;
								finished = true;
							}
							// this.onUpdated.trigger(spread);
						} else {
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
		this.swingToFrom(
			ticker,
			initiationType,
			market,
			getSwing,
			(spread: SpreadExecution) => {
				// Do nothing until spread fully filled.
			}
		);
	}

	legOut(
		ticker: Ticker,
		initiationType: InitiationType,
		market: Market,
		getSwing: (spread: SpreadExecution) => Swing | undefined
	) {
		this.swingToFrom(
			ticker,
			initiationType,
			market,
			getSwing,
			(spread: SpreadExecution) => {
				if ((initiationType as InitiationType) === InitiationType.Maker) {
					this.makerSpreads.shift();
					this.makerStatisticsWindow.push(spread);
					this.pruneWindow(this.makerStatisticsWindow);
					spread.spreadsPerMinute = this.makerStatisticsWindow.length;
				} else {
					this.takerSpreads.shift();
					this.takerStatisticsWindow.push(spread);
					this.pruneWindow(this.takerStatisticsWindow);
					spread.spreadsPerMinute = this.takerStatisticsWindow.length;
				}
				spread.spread = this.getSpreadPercent(spread);
				spread.spreadPercent = this.getSpread(spread);
				this.onUpdated.trigger(spread);
			}
		);
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
