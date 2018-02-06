import { EventImp, IEvent } from "../utils/event";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Market } from "../markets/market";
import { ArbType, InitiationType, TradeType } from "../utils/enums";
import { Graph } from "../markets/graph";
import { Vwap, Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";

export type FillHandler = (spread: SpreadExecution) => void;

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
	abstract getSpreadStart(spread: SpreadExecution): number;
	abstract getSpreadEnd(spread: SpreadExecution): number;
	abstract updateSpreads(spread: SpreadExecution): void;
	abstract subscribeToEvents(graph: Graph): void;
	abstract getNewSpread(ticker: Ticker, size: number, basisSize: number): SpreadExecution;

	getSpread(spread: SpreadExecution): number {
		if (spread.entryBasisSize && spread.exitBasisSize) {
			const basisSpread = spread.exitBasisSize - spread.entryBasisSize;
			return basisSpread;
		} else {
			return Number.NaN;
		}
	}

	getHubSpread(spread: SpreadExecution): number {
		if (spread.entryHubSize && spread.exitHubSize) {
			const hubSpread = spread.exitHubSize - spread.entryHubSize;
			return hubSpread;
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

	getHubSpreadPercent(spread: SpreadExecution): number {
		if (spread.entryHubSize) {
			const hubSpread = this.getSpread(spread);
			return hubSpread / spread.entryHubSize;
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
		hubSize?: number,
		basisSize?: number,
		start?: Date
	): ExecutionOperation {
		const operation = {
			exchange,
			hub,
			market,
			start: start || undefined,
			price: price || Number.NaN,
			size: size || 0,
			hubSize: hubSize || 0,
			basisSize: basisSize || 0,
			duration: Number.NaN
		};
		Logger.log({
			level: "debug",
			message: `${this.getId()} Operation`,
			data: operation
		});
		return operation;
	}

	getVwapPrice(operation: ExecutionOperation, price: number, size: number): number {
		if (Number.isNaN(operation.price)) {
			return price;
		} else {
			return (operation.price * operation.size + price * size) / (operation.size + size);
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
		if (0 < basisRemainder) {
			const basisTickerSize = market.asset.getBasisSize(size, price, market);
			const basisTradableSize = Math.min(basisTickerSize, basisRemainder);
			if (Number.isNaN(basisTradableSize)) {
				return;
			}
			const marketTradableSize = market.asset.getMarketSize(market, basisTradableSize);
			if (Number.isNaN(marketTradableSize)) {
				return;
			}
			const spread = this.getNewSpread(ticker, marketTradableSize, basisTradableSize);
			if ((initiationType as InitiationType) === InitiationType.Maker) {
				this.workingMakerBasisPosition += basisTradableSize;
				this.makerSpreads.push(spread);
				spreadCount = this.makerSpreads.length;
			} else {
				this.workingTakerBasisPosition += basisTradableSize;
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
	Ticker Size = ${size},
	Market Tradable Size= ${marketTradableSize},
	Basis Tradable Size = ${basisTradableSize}`
			});
		}
	}

	getLegOutFilledHandler(initiationType: InitiationType): FillHandler {
		return (spread: SpreadExecution) => {
			this.updateSpreads(spread);
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
				spread.hubSpread = this.getHubSpread(spread);
				spread.spreadPercent = this.getHubSpreadPercent(spread);
				this.onUpdated.trigger(spread);
			} else {
				Logger.log({
					level: "debug",
					message: `Spread not complete: ${this.getId()}`,
					data: spread
				});
			}
		};
	}

	getLegConvertFilledHandler(): FillHandler {
		return (spread: SpreadExecution) => {
			// Do nothing until spread fully filled.
		};
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
