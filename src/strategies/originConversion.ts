import { Arb } from "./arb";
import { ArbType, InitiationType, TradeType } from "../utils/enums";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";

export class OriginConversion extends Arb {
	// public conversionMarket: Market;

	constructor(
		public originMarket: Market,
		public destinationMarket: Market,
		public conversionMarket: Market,
		public graph: Graph
	) {
		super(originMarket, destinationMarket, graph);
		// this.conversionMarket = Graph.getOriginConversionMarket(originMarket, destinationMarket);
	}

	// getId(): string {
	// 	const originExchange = this.originMarket.hub.exchange.id;
	// 	const originConvert = this.conversionMarket.asset.symbol;
	// 	const originMarket = this.originMarket.asset.symbol;
	// 	const destinationExchange = this.destinationMarket.hub.exchange.id;
	// 	const destinationMarket = this.destinationMarket.asset.symbol;
	// 	return `OC.${originExchange}.${originConvert}->${originMarket}->${destinationExchange}.${destinationMarket}`;
	// }

	getId(): string {
		const originExchange = this.originMarket.hub.exchange.id;
		const originHub = this.originMarket.hub.asset.symbol;
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationHub = this.destinationMarket.hub.asset.symbol;
		const destinationMarket = this.destinationMarket.asset.symbol;
		const originConvert = this.conversionMarket.asset.symbol;
		const originConvertHub = this.conversionMarket.hub.asset.symbol;

		const oMkt = `${originExchange}.${originMarket}`;
		const dHub = `${destinationExchange}.${destinationHub}`;
		const ocHub = `${originExchange}.${originConvertHub}`;
		const ocMkt = `${originExchange}.${originConvert}`;

		return `OC:${ocHub}->${ocMkt}->${oMkt}->${dHub}`;
	}

	// getInstruction(): SpreadExecution {
	// 	const instructions = this.getOriginConvertInstructions();
	// 	return instructions;
	// }

	// getSpread(spread: SpreadExecution): number {
	// 	// return (
	// 	// 	this.destinationMarket.getSellVwap() -
	// 	// 	this.originMarket.getBuyVwap() * this.conversionMarket.getBuyVwap()
	// 	// );
	// 	const basis = spread.convert ? spread.convert.basisSize : Number.NaN;
	// 	const basisSpread = spread.sell.basisSize - basis;
	// 	return basisSpread;
	// }

	// getSpreadPercent(spread: SpreadExecution): number {
	// 	// const initialValue =
	// 	// 	this.originMarket.getBuyVwap() * this.conversionMarket.getBuyVwap();
	// 	// if (initialValue === 0) {
	// 	// 	return Number.NaN;
	// 	// } else {
	// 	// 	return this.getSpread() / initialValue;
	// 	// }
	// 	const basisSpread = this.getSpread(spread);
	// 	const basis = spread.convert ? spread.convert.basisSize : Number.NaN;
	// 	return basisSpread / basis;
	// }

	updateSpreadBasis(spread: SpreadExecution): void {
		if (spread.convert) {
			spread.entryBasisSize = spread.convert.basisSize;
		}
		if (spread.buy.size <= spread.sell.size * spread.sell.price) {
			spread.exitBasisSize = spread.sell.basisSize;
		}
	}

	getSpreadStart(spread: SpreadExecution): number {
		if (spread.convert) {
			return spread.convert.start ? spread.convert.start.getTime() : Number.NaN;
		} else {
			return Number.NaN;
		}
	}

	getSpreadEnd(spread: SpreadExecution): number {
		return spread.sell.end ? spread.sell.end.getTime() : Number.NaN;
	}

	getNewSpread(ticker: Ticker, size: number, basisSize: number): SpreadExecution {
		return {
			id: this.getId(),
			spread: Number.NaN,
			spreadPercent: Number.NaN,
			spreadsPerMinute: 0,
			type: ArbType.OriginConversion,
			convert: this.getOperation(
				this.conversionMarket.hub.exchange.name,
				this.conversionMarket.hub.asset.symbol,
				this.conversionMarket.asset.symbol,
				ticker.price,
				size,
				basisSize,
				ticker.time
			),
			buy: this.getOperation(
				this.originMarket.hub.exchange.name,
				this.originMarket.hub.asset.symbol,
				this.originMarket.asset.symbol
			),
			sell: this.getOperation(
				this.destinationMarket.hub.exchange.name,
				this.destinationMarket.hub.asset.symbol,
				this.destinationMarket.asset.symbol
			)
		};
	}

	handleConversionTickers(ticker: Ticker, initiationType: InitiationType) {
		this.legIn(ticker, initiationType, this.conversionMarket);
	}

	handleOriginTickers(ticker: Ticker, initiationType: InitiationType) {
		this.legConvert(ticker, initiationType, this.originMarket, (spread: SpreadExecution) => {
			if (spread.convert) {
				return {
					fromLeg: spread.convert,
					toLeg: spread.buy,
					tradeType: TradeType.BUY
					// getSwingSize: (price: number, size: number): number => {
					// 	return size * price;
					// }
				};
			} else {
				return undefined;
			}
		});
	}

	handleDestinationTickers(ticker: Ticker, initiationType: InitiationType) {
		this.legOut(ticker, initiationType, this.destinationMarket, (spread: SpreadExecution) => {
			return {
				fromLeg: spread.buy,
				toLeg: spread.sell,
				tradeType: TradeType.SELL
				// getSwingSize: (price: number, size: number): number => {
				// 	return size / price;
				// }
			};
		});
	}

	subscribeToEvents(graph: Graph): void {
		// Maker Spreads
		this.conversionMarket.sell.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Maker);
		});
		this.originMarket.sell.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Maker);
		});
		this.destinationMarket.buy.on((ticker: Ticker) => {
			this.handleDestinationTickers(ticker, InitiationType.Maker);
		});
		// Taker Spreads
		this.conversionMarket.buy.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Taker);
		});
		this.originMarket.buy.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Taker);
		});
		this.destinationMarket.sell.on((ticker: Ticker) => {
			this.handleDestinationTickers(ticker, InitiationType.Taker);
		});

		// if (
		// 	(graph.parameters.initiationType as InitiationType) ===
		// 	InitiationType.Maker
		// ) {
		// 	this.subscribeToVwap(this.destinationMarket.vwapBuyStats.vwapUpdated);
		// 	this.subscribeToVwap(this.originMarket.vwapSellStats.vwapUpdated);
		// 	this.subscribeToVwap(this.conversionMarket.vwapSellStats.vwapUpdated);
		// } else {
		// 	this.subscribeToVwap(this.destinationMarket.vwapSellStats.vwapUpdated);
		// 	this.subscribeToVwap(this.originMarket.vwapBuyStats.vwapUpdated);
		// 	this.subscribeToVwap(this.conversionMarket.vwapBuyStats.vwapUpdated);
		// }
	}

	// public getOriginConvOperation(): ExecutionOperation {
	// 	return {
	// 		exchange: this.conversionMarket.hub.exchange.id,
	// 		hub: this.conversionMarket.hub.asset.symbol,
	// 		market: this.conversionMarket.asset.symbol,
	// 		price: this.conversionMarket.getBuyVwap(),
	// 		duration: this.conversionMarket.getBuyDuration()
	// 	};
	// }

	// public getOriginConvertInstructions(): SpreadExecution {
	// 	const buyConvertSpread = this.getSpreadPercent();
	// 	const buy = this.getBuyOperation();
	// 	const sell = this.getSellOperation();
	// 	const buyConvert = this.getOriginConvOperation();
	// 	const instructions = {
	// 		id: this.getInstId(),
	// 		spread: buyConvertSpread,
	// 		type: ArbType.OriginConversion,
	// 		buy,
	// 		sell,
	// 		convert: buyConvert
	// 	};
	// 	return instructions;
	// }
}
