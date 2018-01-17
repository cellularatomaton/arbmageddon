import { Graph, Market } from '../markets';
import { IEvent, EventImp } from '../utils';

export enum TradeType {
	BUY,
	SELL
}

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

export interface VWAP {
	vwap: number,
	duration: number
}

export class VolumeStatistics {
	window: Ticker[] = [];
	vwapNumerator: number = 0;
	vwapDenominator: number = 0;

	onVwapUpdated: EventImp<VWAP> = new EventImp<VWAP>();
	get vwapUpdated(): IEvent<VWAP> {
		return this.onVwapUpdated.expose();
	};

	constructor(private market: Market) { }

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

	calcWindowSize(): number {
		const graph = this.market.graph;
		const basisSize = graph.basisSize;
		const basisAsset = graph.basisAsset;
		if (basisAsset) {
			const hubAsset = this.market.hub.asset;
			const alreadyPricedInBasis = hubAsset.symbol === basisAsset.symbol;
			const price = this.market.vwapSellStats.getVwap();
			if (alreadyPricedInBasis) {
				const size = basisSize / price;
				return size;
			} else {
				// Look through hub markets for conversion:
				const conversionMarket = this.market.hub.markets.get(basisAsset.symbol);
				if (conversionMarket) {
					const conversionPrice = conversionMarket.vwapSellStats.getVwap();
					const size = basisSize / conversionPrice / price;
					return size;
				} else {
					return Number.NaN;
				}
			}
		} else {
			return Number.NaN;
		}
	}

	handleTicker(ticker: Ticker) {
		const windowSize = this.calcWindowSize();
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
		const vwap: VWAP = {
			vwap: this.getVwap(),
			duration: this.getDuration()
		};
		// console.log(`Ticker Triggered VWAP: ${JSON.stringify(vwap)}`);
		this.onVwapUpdated.trigger(vwap);
	}

}