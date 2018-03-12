import { TradeType } from "../utils/enums";
import { Logger } from "../utils/logger";
import * as _ from "lodash";

export type BookOrderSorter = (a: BookLevel, b: BookLevel) => number;
export function bookOrderSorter(a: BookLevel, b: BookLevel): number {
	// Ascending
	return a.price - b.price;
}

export interface BookLevel {
	price: number;
	size: number;
}

export interface BookStats {
	maxAsk: number;
	maxBid: number;
	totalAsks: number;
	totalBids: number;
}

export interface BookSnapshot {
	exchange: string;
	hub: string;
	market: string;
	bidLevels: BookLevel[];
	askLevels: BookLevel[];
	stats: BookStats;
}

export class Book {
	lastUpdated: Date;
	bidLevels: Map<number, BookLevel>;
	askLevels: Map<number, BookLevel>;

	constructor(public exchangeSymbol: string, public hubSymbol: string, public marketSymbol: string) {
		this.lastUpdated = new Date();
		this.bidLevels = new Map<number, BookLevel>();
		this.askLevels = new Map<number, BookLevel>();
	}

	updateLevel(type: TradeType, price: number, size: number) {
		if (0 < size) {
			const levels = (type as TradeType) === TradeType.Buy ? this.bidLevels : this.askLevels;
			let level: BookLevel | undefined = levels.get(price);
			if (!level) {
				// Create new level
				level = { price, size } as BookLevel;
				levels.set(price, level);
			} else {
				level.size = size;
			}
		}
	}

	getGroupedLevels(precision: number, bookLevels: BookLevel[]): BookLevel[] {
		const groupedLevels: any = _.groupBy(bookLevels, (level: BookLevel) => {
			return _.round(level.price, precision);
		});
		const mappedValues: any = _.mapValues(groupedLevels, (levels: BookLevel[], price: number): BookLevel => {
			return _.reduce(
				levels,
				(agg: BookLevel, current: BookLevel) => {
					agg.size += current.size;
					return agg;
				},
				{ price, size: 0 }
			);
		});
		const values: BookLevel[] = _.values(mappedValues);
		return values;
	}

	// Grab the top [take] levels after aggregating to [precision].
	getAggregateBook(precision: number, take: number): BookSnapshot {
		Logger.log({
			level: "silly",
			message: `Ask levels: ${this.exchangeSymbol}.${this.hubSymbol}.${this.marketSymbol}`,
			data: this.askLevels
		});
		Logger.log({
			level: "silly",
			message: `Bid levels: ${this.exchangeSymbol}.${this.hubSymbol}.${this.marketSymbol}`,
			data: this.bidLevels
		});
		const groupedBidLevels = this.getGroupedLevels(precision, Array.from(this.bidLevels.values()));
		const sortedBidLevels = _.sortBy(groupedBidLevels, (level: BookLevel) => -level.price); // Descending Bids
		const groupedAskLevels = this.getGroupedLevels(precision, Array.from(this.askLevels.values()));
		const sortedAskLevels = _.sortBy(groupedAskLevels, (level: BookLevel) => level.price); // Ascending Asks
		const topBidLevels = sortedBidLevels.slice(0, take);
		const topAskLevels = sortedAskLevels.slice(0, take);
		const askStats = topBidLevels.reduce(
			(agg: BookStats, level: BookLevel) => {
				agg.maxBid = Math.max(agg.maxBid, level.size);
				agg.totalBids += level.size;
				return agg;
			},
			{ maxAsk: 0, maxBid: 0, totalAsks: 0, totalBids: 0 }
		);
		const combinedStats = topAskLevels.reduce((agg: BookStats, level: BookLevel) => {
			agg.maxAsk = Math.max(agg.maxAsk, level.size);
			agg.totalAsks += level.size;
			return agg;
		}, askStats);
		const snapshot: BookSnapshot = {
			exchange: this.exchangeSymbol,
			hub: this.hubSymbol,
			market: this.marketSymbol,
			bidLevels: topBidLevels,
			askLevels: topAskLevels,
			stats: combinedStats
		};
		Logger.log({
			level: "silly",
			message: `Snapshot: ${this.exchangeSymbol}.${this.hubSymbol}.${this.marketSymbol}`,
			data: snapshot
		});
		return snapshot;
	}
}
