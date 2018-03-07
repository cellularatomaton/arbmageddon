import { TradeType } from "../utils/enums";
import _ = require("lodash");

export type BookOrderSorter = (a: BookLevel, b: BookLevel) => number;
export function bookOrderSorter(a: BookLevel, b: BookLevel): number {
	// Ascending
	return a.price - b.price;
}

export interface BookLevel {
	price: number;
	size: number;
}

export interface BookSnapshot {
	bidLevels: BookLevel[];
	askLevels: BookLevel[];
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
		const levels = (type as TradeType) === TradeType.Buy ? this.bidLevels : this.askLevels;
		let level = levels.get(price);
		if (!level) {
			// Create new level
			level = { price, size };
			levels.set(price, level);
		} else {
			level.size = size;
		}
	}

	getGroupedLevels(precision: number, bookLevels: BookLevel[]): BookLevel[] {
		const groupedLevels: any = _.groupBy(bookLevels, (level: BookLevel) => {
			_.round(level.price, precision);
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
		const groupedBidLevels = this.getGroupedLevels(precision, Array.from(this.bidLevels.values()));
		const sortedBidLevels = _.sortBy(groupedBidLevels, (level: BookLevel) => -level.price); // Descending Bids
		const groupedAskLevels = this.getGroupedLevels(precision, Array.from(this.askLevels.values()));
		const sortedAskLevels = _.sortBy(groupedAskLevels, (level: BookLevel) => level.price); // Ascending Asks
		return {
			bidLevels: sortedBidLevels.slice(0, take),
			askLevels: sortedAskLevels.slice(0, take)
		};
	}
}
