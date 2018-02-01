import { Arb } from "./arb";
import { ArbType, InitiationType, TradeType } from "../utils/enums";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";

export class DestinationConversion extends Arb {
	// public conversionMarket: Market;

	constructor(
		public originMarket: Market,
		public destinationMarket: Market,
		public conversionMarket: Market,
		public graph: Graph
	) {
		super(originMarket, destinationMarket, graph);
		// this.conversionMarket = Graph.getDestinationConversionMarket(originMarket, destinationMarket);
	}

	// getId(): string {
	// 	const originExchange = this.originMarket.hub.exchange.id;
	// 	const originMarket = this.originMarket.asset.symbol;
	// 	const destinationExchange = this.destinationMarket.hub.exchange.id;
	// 	const destinationMarket = this.destinationMarket.asset.symbol;
	// 	const destinationConvert = this.conversionMarket.asset.symbol;
	// 	return `DC.${originExchange}.${originMarket}->${destinationExchange}.${destinationConvert}->${destinationMarket}`;
	// }

	getId(): string {
		const originExchange = this.originMarket.hub.exchange.id;
		const originHub = this.originMarket.hub.asset.symbol;
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationHub = this.destinationMarket.hub.asset.symbol;
		const destinationMarket = this.destinationMarket.asset.symbol;
		const destinationConvert = this.conversionMarket.asset.symbol;
		const destinationConvertHub = this.conversionMarket.hub.asset.symbol;

		const oHub = `${originExchange}.${originHub}`;
		const dMkt = `${destinationExchange}.${destinationMarket}`;
		const dcHub = `${destinationExchange}.${destinationConvertHub}`;
		const dcMkt = `${destinationExchange}.${destinationConvert}`;

		return `DC:${oHub}->${dMkt}->${dcMkt}->${dcHub}`;
	}

	// getInstruction(): SpreadExecution {
	// 	const instruction = this.getDestinationConvertInstructions();
	// 	return instruction;
	// }

	// getSpread(spread: SpreadExecution): number {
	// 	// return (
	// 	// 	this.destinationMarket.getSellVwap() *
	// 	// 		this.conversionMarket.getSellVwap() -
	// 	// 	this.originMarket.getBuyVwap()
	// 	// );
	// 	const convertBasis = spread.convert ? spread.convert.basisSize : Number.NaN;
	// 	const basisSpread = convertBasis - spread.buy.basisSize;
	// 	return basisSpread;
	// }

	// getSpreadPercent(spread: SpreadExecution): number {
	// 	// const initialValue = this.originMarket.getBuyVwap();
	// 	// if (initialValue === 0) {
	// 	// 	return Number.NaN;
	// 	// } else {
	// 	// 	return this.getSpread() / initialValue;
	// 	// }
	// 	const basisSpread = this.getSpread(spread);
	// 	return basisSpread / spread.buy.basisSize;
	// }

	updateSpreadBasis(spread: SpreadExecution): void {
		spread.entryBasisSize = spread.buy.basisSize;
		if (spread.convert && spread.sell.size <= spread.convert.size * spread.convert.price) {
			spread.exitBasisSize = spread.convert.basisSize;
		}
	}

	getSpreadStart(spread: SpreadExecution): number {
		if (spread.buy) {
			return spread.buy.start ? spread.buy.start.getTime() : Number.NaN;
		} else {
			return Number.NaN;
		}
	}

	getSpreadEnd(spread: SpreadExecution): number {
		if (spread.convert) {
			return spread.convert.end ? spread.convert.end.getTime() : Number.NaN;
		} else {
			return Number.NaN;
		}
	}

	getNewSpread(ticker: Ticker, size: number, basisSize: number): SpreadExecution {
		return {
			id: this.getId(),
			spread: Number.NaN,
			spreadPercent: Number.NaN,
			spreadsPerMinute: 0,
			type: ArbType.DestinationConversion,
			buy: this.getOperation(
				this.originMarket.hub.exchange.name,
				this.originMarket.hub.asset.symbol,
				this.originMarket.asset.symbol,
				ticker.price,
				size,
				basisSize,
				ticker.time
			),
			sell: this.getOperation(
				this.destinationMarket.hub.exchange.name,
				this.destinationMarket.hub.asset.symbol,
				this.destinationMarket.asset.symbol
			),
			convert: this.getOperation(
				this.conversionMarket.hub.exchange.name,
				this.conversionMarket.hub.asset.symbol,
				this.conversionMarket.asset.symbol
			)
		};
	}

	handleOriginTickers(ticker: Ticker, initiationType: InitiationType) {
		this.legIn(ticker, initiationType, this.originMarket);
	}

	handleDestinationTickers(ticker: Ticker, initiationType: InitiationType) {
		this.legConvert(ticker, initiationType, this.destinationMarket, (spread: SpreadExecution) => {
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

	handleConversionTickers(ticker: Ticker, initiationType: InitiationType) {
		this.legOut(ticker, initiationType, this.conversionMarket, (spread: SpreadExecution) => {
			if (spread.convert) {
				return {
					fromLeg: spread.sell,
					toLeg: spread.convert,
					tradeType: TradeType.SELL
					// getSwingSize: (price: number, size: number): number => {
					// 	return size / price;
					// }
				};
			} else {
				return undefined;
			}
		});
	}

	subscribeToEvents(graph: Graph): void {
		// Maker Spreads
		this.originMarket.sell.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Maker);
		});
		this.destinationMarket.buy.on((ticker: Ticker) => {
			this.handleDestinationTickers(ticker, InitiationType.Maker);
		});
		this.conversionMarket.buy.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Maker);
		});
		// Taker Spreads
		this.originMarket.buy.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Taker);
		});
		this.destinationMarket.sell.on((ticker: Ticker) => {
			this.handleDestinationTickers(ticker, InitiationType.Taker);
		});
		this.conversionMarket.sell.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Taker);
		});

		// if (
		// 	(graph.parameters.initiationType as InitiationType) ===
		// 	InitiationType.Maker
		// ) {
		// 	this.subscribeToVwap(this.destinationMarket.vwapBuyStats.vwapUpdated);
		// 	this.subscribeToVwap(this.originMarket.vwapSellStats.vwapUpdated);
		// 	this.subscribeToVwap(this.conversionMarket.vwapBuyStats.vwapUpdated);
		// } else {
		// 	this.subscribeToVwap(this.destinationMarket.vwapSellStats.vwapUpdated);
		// 	this.subscribeToVwap(this.originMarket.vwapBuyStats.vwapUpdated);
		// 	this.subscribeToVwap(this.conversionMarket.vwapSellStats.vwapUpdated);
		// }
	}

	// public getDestinationConvOperation(): ExecutionOperation {
	// 	return {
	// 		exchange: this.conversionMarket.hub.exchange.id,
	// 		hub: this.conversionMarket.hub.asset.symbol,
	// 		market: this.conversionMarket.asset.symbol,
	// 		price: this.conversionMarket.getSellVwap(),
	// 		duration: this.conversionMarket.vwapBuyStats.getDuration()
	// 	};
	// }

	// public getDestinationConvertInstructions(): SpreadExecution {
	// 	const sellConvertSpread = this.getSpreadPercent();
	// 	const buy = this.getBuyOperation();
	// 	const sell = this.getSellOperation();
	// 	const sellConvert = this.getDestinationConvOperation();
	// 	const instructions = {
	// 		id: this.getInstId(),
	// 		spread: sellConvertSpread,
	// 		type: ArbType.DestinationConversion,
	// 		buy,
	// 		sell,
	// 		convert: sellConvert
	// 	};
	// 	return instructions;
	// }
}
