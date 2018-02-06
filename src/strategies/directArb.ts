import { Arb, FillHandler } from "./arb";
import { ArbType, InitiationType, TradeType } from "../utils/enums";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";

export class DirectArb extends Arb {
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
		spread.entryBasisSize = spread.buy.basisSize;
		spread.entryHubSize = spread.buy.hubSize;
		if (spread.buy.size <= spread.sell.size) {
			spread.exitBasisSize = spread.sell.basisSize;
			spread.exitHubSize = spread.sell.hubSize;
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
			type: ArbType.Direct,
			buy: this.getOperation(
				this.originMarket.hub.exchange.name,
				this.originMarket.hub.asset.symbol,
				this.originMarket.asset.symbol,
				ticker.price,
				size,
				size * (ticker.price || Number.NaN),
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

	handleDestinationTickers(ticker: Ticker, initiationType: InitiationType, legFilled: FillHandler) {
		Logger.log({
			level: "silly",
			message: `Handling destination ticker for ${this.getId()}`
		});
		const sellMarketTickerSize: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		const sellHubTickerSize = sellMarketTickerSize * price;
		let sellHubRemainderTickerSize: number = sellHubTickerSize;
		let finished: boolean = false;
		while (!finished) {
			let spread;
			if ((initiationType as InitiationType) === InitiationType.Maker) {
				spread = this.makerSpreads[0];
			} else {
				spread = this.takerSpreads[0];
			}
			if (spread) {
				Logger.log({
					level: "debug",
					message: `Found spread for destination ticker. ${this.getId()}`,
					data: ticker
				});
				const buyBasisSize = spread.buy.basisSize;
				const buyMarketSize = spread.buy.size;
				const sellBasisSize = spread.sell.basisSize;
				const sellHubCurrentSize = spread.sell.hubSize;
				const sellHubSwingSize = buyMarketSize * price;
				const sellHubTradableSize = sellHubSwingSize - sellHubCurrentSize;
				const sellHubTradableTickerSize = Math.min(sellHubTradableSize, sellHubRemainderTickerSize);
				sellHubRemainderTickerSize -= sellHubTradableTickerSize;
				const sellHubNewSize = sellHubCurrentSize + sellHubTradableTickerSize;
				const sellBasisNewSize = this.destinationMarket.hub.asset.getBasisSize(
					sellHubNewSize,
					price,
					this.destinationMarket
				);
				// Log it:
				const buyLegName = `${spread.buy.exchange}:${spread.buy.market}`;
				const sellLegName = `${spread.sell.exchange}:${spread.sell.hub}`;
				Logger.log({
					level: "debug",
					message: `${this.getId()}
	Swing from ${buyLegName} to ${sellLegName},
	Ticker Price = ${price},
	Buy Market Size = ${buyMarketSize},
	Buy Basis Size = ${buyBasisSize},
	Sell Market Ticker Size  = ${sellMarketTickerSize},
	Sell Hub Ticker Size = ${sellHubTickerSize},
	Sell Hub Tradable Ticker Size = ${sellHubTradableTickerSize},
	Sell Hub Remainder Ticker Size = ${sellHubRemainderTickerSize},
	Sell Hub Current Size  = ${sellHubCurrentSize},
	Sell Hub New Size  = ${sellHubNewSize},
	Sell Basis Current Size = ${sellBasisSize},
	Sell Basis New Size = ${sellBasisNewSize},`
				});
				// Process it:
				if (0 < sellHubTradableTickerSize && !Number.isNaN(sellHubNewSize) && !Number.isNaN(sellBasisNewSize)) {
					spread.sell.price = this.getVwapPrice(spread.sell, price, sellHubNewSize);
					spread.sell.hubSize = sellHubNewSize;
					spread.sell.size = sellHubNewSize / price;
					spread.sell.basisSize = sellBasisNewSize;
					if (0 < sellHubRemainderTickerSize) {
						// Leg fully filled:
						legFilled(spread);
						// Continue looping to check other queued arbs.
					} else {
						// Leg only partially filled:
						finished = true;
					}
				} else {
					Logger.log({
						level: "debug",
						message: `Cannot process destination ticker. ${this.getId()}
	Sell Hub Tradable Ticker Size = ${sellHubTradableTickerSize},
	Sell Hub New Size = ${sellHubNewSize},
	Sell Basis New Size = ${sellBasisNewSize}`
					});
					finished = true;
				}
			} else {
				finished = true;
			}
		}
	}

	subscribeToEvents(graph: Graph): void {
		// Maker Spreads
		this.originMarket.sell.on((ticker: Ticker) => {
			this.legIn(ticker, InitiationType.Maker, this.originMarket);
		});
		this.destinationMarket.buy.on((ticker: Ticker) => {
			const legFilled = this.getLegOutFilledHandler(InitiationType.Maker);
			this.handleDestinationTickers(ticker, InitiationType.Maker, legFilled);
		});
		// Taker Spreads
		this.originMarket.buy.on((ticker: Ticker) => {
			this.legIn(ticker, InitiationType.Taker, this.originMarket);
		});
		this.destinationMarket.sell.on((ticker: Ticker) => {
			const legFilled = this.getLegOutFilledHandler(InitiationType.Taker);
			this.handleDestinationTickers(ticker, InitiationType.Taker, legFilled);
		});
	}
}
