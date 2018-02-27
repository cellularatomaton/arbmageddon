export interface BookOrder {
	price: number;
	size: number;
}

export interface BookLevel {
	price: number;
	asks: BookOrder[];
	bids: BookOrder[];
}

export interface Book {
	exchangeSymbol: string;
	hubSymbol: string;
	marketSymbol: string;
	time: Date;
	levels: BookLevel[];
}
