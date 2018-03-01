import { TradeType } from "../utils/enums";
export interface BookOrder {
	price: number;
	size: number;
}

export type BookOrderSorter = (a: BookOrder, b: BookOrder) => number;
export function bookOrderSorter(a: BookOrder, b: BookOrder): number {
	// Ascending
	return a.price - b.price;
}

export interface BookLevel {
	price: number;
	ask: BookOrder;
	bid: BookOrder;
}

export class Book {
	lastUpdated: Date;
	levels: Map<number, BookLevel>;

	constructor(public exchangeSymbol: string, public hubSymbol: string, public marketSymbol: string) {
		this.lastUpdated = new Date();
		this.levels = new Map<number, BookLevel>();
	}

	addLevel(level: BookLevel) {
		this.levels.set(level.price, level);
	}

	updateLevel(type: TradeType, price: number, size: number) {
		const level = this.levels.get(price);
		if (!level) {
			// Create new level
		}
		if ((type as TradeType) === TradeType.Buy) {
			// Update bid
		} else {
			// Update ask
		}
	}
}
