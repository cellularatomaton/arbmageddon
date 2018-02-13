import { Arb, FillHandler } from "./arb";
import { ArbType, TradeType, InitiationType } from "../utils/enums";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";

export abstract class DirectArb extends Arb {
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

	updateSpreads(spread: SpreadExecution): void {
		if (spread.buy.filled && spread.sell.filled) {
			spread.entryBasisSize = spread.buy.basisSize;
			spread.entryHubSize = spread.buy.hubSize;
			spread.exitBasisSize = spread.sell.basisSize;
			spread.exitHubSize = spread.sell.hubSize;
			spread.filled = true;
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
			hubSpread: Number.NaN,
			spreadPercent: Number.NaN,
			spreadsPerMinute: 0,
			type: ArbType.MakerDirect,
			buy: this.getOperation(
				this.originMarket.hub.exchange.name,
				this.originMarket.hub.asset.symbol,
				this.originMarket.asset.symbol,
				ticker.price,
				0,
				0,
				0,
				ticker.time
			),
			sell: this.getOperation(
				this.destinationMarket.hub.exchange.name,
				this.destinationMarket.hub.asset.symbol,
				this.destinationMarket.asset.symbol
			),
			convert: undefined,
			filled: false
		};
	}

	handleOriginTickers(ticker: Ticker, initiationType: InitiationType, legFilled: FillHandler) {
		const size: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		const market = this.originMarket;
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
				this.spread = this.getNewSpread(ticker, marketTradableSize, basisTradableSize);
			}
			this.spread = this.spread;
			this.spread.buy.size += marketTradableSize;
			this.spread.buy.basisSize += basisTradableSize;
			this.spread.buy.hubSize += marketTradableSize * price;
			this.workingBasisPosition += basisTradableSize;
			this.spread.buy.filled = this.graph.parameters.basisSize <= this.workingBasisPosition;
			Logger.log({
				level: "debug",
				message: `Leg In [${this.getId()}]`,
				data: this.spread
			});
			if (this.spread.buy.filled) {
				legFilled(this.spread);
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
					data: spread
				});
				if (spread.sell.filled) {
					legFilled(spread);
				}
			}
		}
	}
}
