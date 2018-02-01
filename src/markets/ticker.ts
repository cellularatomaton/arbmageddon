import { Graph, Market } from "../markets";
import { IEvent, EventImp } from "../utils";
import { Logger } from "../utils/logger";
import { TradeType } from "../utils/enums";

export interface Ticker {
	exchangeSymbol: string;
	hubSymbol: string;
	marketSymbol: string;
	time: Date;
	bestAsk?: number;
	bestBid?: number;
	price?: number;
	side?: TradeType;
	size?: number;
}

export enum TimeUnit {
	MILLISECOND,
	SECOND,
	MINUTE,
	HOUR
}

export interface Vwap {
	vwap: number;
	duration: number;
}

export class VolumeStatistics {
	window: Ticker[] = [];
	vwapNumerator: number = 0;
	vwapDenominator: number = 0;

	onVwapUpdated: EventImp<Vwap> = new EventImp<Vwap>();
	get vwapUpdated(): IEvent<Vwap> {
		return this.onVwapUpdated.expose();
	}

	constructor(private market: Market) {}

	getVwap() {
		return this.vwapNumerator / this.vwapDenominator;
	}

	getDuration() {
		if (this.window.length) {
			const oldest = this.window[0].time.getTime();
			const newest = this.window[this.window.length - 1].time.getTime();
			return newest - oldest;
		} else {
			return Number.NaN;
		}
	}

	addTicker(ticker: Ticker) {
		this.window.push(ticker);
		if (ticker.size && ticker.price) {
			this.vwapNumerator += ticker.size * ticker.price;
			this.vwapDenominator += ticker.size;
		}
	}

	removeTicker(ticker: Ticker | undefined) {
		if (ticker) {
			if (ticker.size && ticker.price) {
				this.vwapNumerator -= ticker.size * ticker.price;
				this.vwapDenominator -= ticker.size;
			}
		}
	}

	handleTicker(ticker: Ticker) {
		const windowSize = this.market.getMarketSize();
		if (!Number.isNaN(this.vwapDenominator) && !Number.isNaN(windowSize)) {
			let rolling = true;
			while (rolling) {
				const stale = windowSize < this.vwapDenominator;
				if (stale) {
					const oldTicker = this.window.shift();
					this.removeTicker(oldTicker);
				} else {
					rolling = false;
				}
			}
		}
		this.addTicker(ticker);
		const vwap: Vwap = {
			vwap: this.getVwap(),
			duration: this.getDuration()
		};
		Logger.log({
			level: "silly",
			message: `Ticker Triggered VWAP`,
			data: vwap
		});
		this.onVwapUpdated.trigger(vwap);
	}
}
