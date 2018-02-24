import { EventImp, IEvent } from "../utils/event";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Market } from "../markets/market";
import { ArbType, TradeType, InitiationType } from "../utils/enums";
import { Graph } from "../markets/graph";
import { Vwap, Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";

export type FillHandler = (spread: SpreadExecution | undefined) => void;

export abstract class Arb {
	static debugCount: number = 0;
	spread: SpreadExecution | undefined;
	statisticsWindow: SpreadExecution[];
	workingBasisPosition: number = 0;

	onUpdated: EventImp<SpreadExecution> = new EventImp<SpreadExecution>();
	get updated(): IEvent<SpreadExecution> {
		return this.onUpdated.expose();
	}

	constructor(public originMarket: Market, public destinationMarket: Market, public graph: Graph) {
		this.statisticsWindow = [];
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
			duration: Number.NaN,
			filled: false
		};
		Logger.log({
			level: "silly",
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

	getLegOutFilledHandler(): FillHandler {
		return (spread: SpreadExecution | undefined) => {
			if (spread) {
				this.updateSpreads(spread);
				if (spread.filled && spread.entryBasisSize) {
					this.workingBasisPosition -= spread.entryBasisSize;
					this.statisticsWindow.push(spread);
					this.pruneWindow(this.statisticsWindow);
					spread.spreadsPerMinute = this.statisticsWindow.length;
					spread.spread = this.getSpreadPercent(spread);
					spread.hubSpread = this.getHubSpread(spread);
					spread.spreadPercent = this.getHubSpreadPercent(spread);
					this.onUpdated.trigger(spread);
					this.spread = undefined;
				} else {
					Logger.log({
						level: "debug",
						message: `Spread Incomplete [${this.getId()}]`,
						data: spread
					});
				}
			}
		};
	}

	getLegConvertFilledHandler(): FillHandler {
		return (spread: SpreadExecution | undefined) => {
			// Logger.log({
			// 	level: "debug",
			// 	message: `Leg convert [${this.getId()}]`,
			// 	data: spread
			// });
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
				const then = this.getSpreadEnd(spread);
				const now = Date.now();
				const stale = then < now - windowLength;
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
