import { Arb } from "./arb";
import { ArbType, InitiationType, TradeType } from "../utils/enums";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";

const SIMULATION_QUEUE_SIZE = 5;

export interface ExecutionSizes {
	buySize?: number;
	buyBasisSize?: number;
	sellSize?: number;
	sellBasisSize?: number;
	tickerSize: number;
	tickerBasisSize: number;
	remainderBasisSize: number;
	remainderSize: number;
}

export class DirectArb extends Arb {
	// getId(): string {
	// 	const originExchange = this.originMarket.hub.exchange.id;
	// 	const originMarket = this.originMarket.asset.symbol;
	// 	const destinationExchange = this.destinationMarket.hub.exchange.id;
	// 	const destinationMarket = this.destinationMarket.asset.symbol;
	// 	return `DA.NA:${originExchange}.${originMarket}->${destinationExchange}.${destinationMarket}`;
	// }

	getId(): string {
		const originExchange = this.originMarket.hub.exchange.id;
		const originHub = this.originMarket.hub.asset.symbol;
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationHub = this.destinationMarket.hub.asset.symbol;

		const oHub = `${originExchange}.${originHub}`;
		const oMkt = `${originExchange}.${originMarket}`;
		const dHub = `${destinationExchange}.${destinationHub}`;

		return `DA:${oHub}->${oMkt}->${dHub}`;
	}

	// getInstruction(): SpreadExecution {
	// 	const instruction = this.getDirectInstructions();
	// 	return instruction;
	// }

	updateSpreadBasis(spread: SpreadExecution): void {
		spread.entryBasisSize = spread.buy.basisSize;
		if (spread.buy.size <= spread.sell.size) {
			spread.exitBasisSize = spread.sell.basisSize;
		}
	}

	getSpreadStart(spread: SpreadExecution): number {
		return spread.buy.start ? spread.buy.start.getTime() : Number.NaN;
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
			type: ArbType.Direct,
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
			convert: undefined
		};
	}

	handleOriginTickers(ticker: Ticker, initiationType: InitiationType) {
		this.legIn(ticker, initiationType, this.originMarket);
	}

	handleDestinationTickers(ticker: Ticker, initiationType: InitiationType, market: Market) {
		this.legOut(ticker, initiationType, market, (spread: SpreadExecution) => {
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
		this.originMarket.sell.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Maker);
		});
		this.destinationMarket.buy.on((ticker: Ticker) => {
			this.handleDestinationTickers(ticker, InitiationType.Maker, this.destinationMarket);
		});
		// Taker Spreads
		this.originMarket.buy.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Taker);
		});
		this.destinationMarket.sell.on((ticker: Ticker) => {
			this.handleDestinationTickers(ticker, InitiationType.Taker, this.destinationMarket);
		});

		// Vwaps:
		// this.subscribeToVwap(this.destinationMarket.vwapBuyStats.vwapUpdated);
		// this.subscribeToVwap(this.originMarket.vwapSellStats.vwapUpdated);
		// this.subscribeToVwap(this.destinationMarket.vwapSellStats.vwapUpdated);
		// this.subscribeToVwap(this.originMarket.vwapBuyStats.vwapUpdated);
	}

	// public getDirectInstructions(): SpreadExecution {
	// 	const spread = this.getSpreadPercent();
	// 	const buy = this.getBuyOperation();
	// 	const sell = this.getSellOperation();
	// 	const instructions = {
	// 		id: this.getInstId(),
	// 		spread,
	// 		type: ArbType.Direct,
	// 		buy,
	// 		sell
	// 	};
	// 	return instructions;
	// }
}
