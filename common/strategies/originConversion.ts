import { Arb, FillHandler } from "./arb";
import { ArbType, TradeType, InitiationType } from "../utils/enums";
import { SpreadExecution, ExecutionOperation } from "../strategies";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";

export abstract class OriginConversion extends Arb {
	constructor(
		public originMarket: Market,
		public destinationMarket: Market,
		public conversionMarket: Market,
		public graph: Graph
	) {
		super(originMarket, destinationMarket, graph);
	}

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

	updateSpreads(spread: SpreadExecution): void {
		if (spread.convert && spread.convert.filled && spread.buy.filled && spread.sell.filled) {
			spread.entryBasisSize = spread.convert.basisSize;
			spread.entryHubSize = spread.convert.hubSize;
			spread.exitBasisSize = spread.sell.basisSize;
			spread.exitHubSize = spread.sell.hubSize;
			spread.filled = true;
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

	getNewSpread(ticker: Ticker): SpreadExecution {
		return {
			id: this.getId(),
			spread: Number.NaN,
			hubSpread: Number.NaN,
			spreadPercent: Number.NaN,
			spreadsPerMinute: 0,
			type: ArbType.MakerOriginConversion,
			convert: this.getOperation(
				this.conversionMarket.hub.exchange.id,
				this.conversionMarket.hub.asset.symbol,
				this.conversionMarket.asset.symbol,
				ticker.price,
				0,
				0,
				0,
				ticker.time
			),
			buy: this.getOperation(
				this.originMarket.hub.exchange.id,
				this.originMarket.hub.asset.symbol,
				this.originMarket.asset.symbol
			),
			sell: this.getOperation(
				this.destinationMarket.hub.exchange.id,
				this.destinationMarket.hub.asset.symbol,
				this.destinationMarket.asset.symbol
			),
			filled: false,
			spreadStatistics: []
		};
	}

	handleConversionTickers(ticker: Ticker, initiationType: InitiationType, legFilled: FillHandler) {
		const market = this.conversionMarket;
		const size: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		const basisRemainder = this.graph.parameters.basisSize - this.workingBasisPosition;
		if (0 < basisRemainder) {
			const basisTickerSize = market.asset.getBasisSize(size, price, initiationType, market);
			const basisTradableSize = Math.min(basisTickerSize, basisRemainder);
			if (Number.isNaN(basisTradableSize)) {
				return;
			}
			const marketTradableSize = market.asset.getMarketSize(initiationType, market, basisTradableSize);
			if (Number.isNaN(marketTradableSize)) {
				return;
			}
			if (!this.spread) {
				this.spread = this.getNewSpread(ticker);
			}
			if (this.spread.convert) {
				this.spread.convert.size += marketTradableSize;
				this.spread.convert.basisSize += basisTradableSize;
				this.spread.convert.hubSize += marketTradableSize * price;
				this.workingBasisPosition += basisTradableSize;
				this.spread.convert.filled = this.graph.parameters.basisSize <= this.workingBasisPosition;
				Logger.log({
					level: "debug",
					message: `Leg In [${this.getId()}]`,
					data: this.spread
				});
				if (this.spread.convert.filled) {
					legFilled(this.spread);
				}
			}
		}
	}

	handleOriginTickers(ticker: Ticker, initiationType: InitiationType, legFilled: FillHandler) {
		const buyMarketTickerSize: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		const spread = this.spread;
		if (spread && spread.convert) {
			const buyHubTickerSize = buyMarketTickerSize * price;
			const buyHubTradableSize = spread.convert.size - spread.buy.hubSize;
			const buyHubTradableTickerSize = Math.min(buyHubTradableSize, buyHubTickerSize);
			const buyHubNewSize = spread.buy.hubSize + buyHubTradableTickerSize;
			const buyBasisNewSize = this.originMarket.hub.asset.getBasisSize(
				buyHubNewSize,
				price,
				initiationType,
				this.originMarket
			);
			if (0 < buyHubTradableTickerSize && !Number.isNaN(buyHubNewSize) && !Number.isNaN(buyBasisNewSize)) {
				spread.buy.price = this.getVwapPrice(spread.buy, price, buyHubNewSize);
				spread.buy.hubSize = buyHubNewSize;
				spread.buy.size = buyHubNewSize / price;
				spread.buy.basisSize = buyBasisNewSize;
				spread.buy.filled = spread.convert.size <= buyHubNewSize;
				Logger.log({
					level: "debug",
					message: `Swing [${this.getId()}]`,
					data: this.spread
				});
				if (spread.buy.filled) {
					legFilled(spread);
				}
			}
		}
	}

	handleDestinationTickers(ticker: Ticker, initiationType: InitiationType, legFilled: FillHandler) {
		const sellMarketTickerSize: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		const spread = this.spread;
		if (spread) {
			const sellHubTickerSize = sellMarketTickerSize * price;
			const sellHubTradableSize = spread.buy.size * price - spread.sell.hubSize;
			const sellHubTradableTickerSize = Math.min(sellHubTradableSize, sellHubTickerSize);
			const sellHubNewSize = spread.sell.hubSize + sellHubTradableTickerSize;
			const sellBasisNewSize = this.destinationMarket.hub.asset.getBasisSize(
				sellHubNewSize,
				price,
				initiationType,
				this.destinationMarket
			);
			if (0 < sellHubTradableTickerSize && !Number.isNaN(sellHubNewSize) && !Number.isNaN(sellBasisNewSize)) {
				spread.sell.price = this.getVwapPrice(spread.sell, price, sellHubNewSize);
				spread.sell.hubSize = sellHubNewSize;
				spread.sell.size = sellHubNewSize / price;
				spread.sell.basisSize = sellBasisNewSize;
				spread.sell.filled = spread.buy.size <= spread.sell.size;
				Logger.log({
					level: "debug",
					message: `Leg Out [${this.getId()}]`,
					data: this.spread
				});
				if (spread.sell.filled) {
					legFilled(spread);
				}
			}
		}
	}
}
