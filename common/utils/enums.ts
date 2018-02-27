export enum TradeType {
	Buy,
	Sell
}

export enum InitiationType {
	Maker,
	Taker
}

export enum ArbType {
	MakerDirect,
	TakerDirect,
	MakerOriginConversion,
	TakerOriginConversion,
	MakerDestinationConversion,
	TakerDestinationConversion
}

export enum TimeUnit {
	Millisecond,
	Second,
	Minute,
	Hour
}

export enum SubscriptionType {
	Book,
	Ticker,
	Position
}
