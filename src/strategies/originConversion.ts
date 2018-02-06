import { Arb, FillHandler } from "./arb";
import { ArbType, InitiationType, TradeType } from "../utils/enums";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";

export class OriginConversion extends Arb {
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
		if (spread.convert) {
			spread.entryBasisSize = spread.convert.basisSize;
			spread.entryHubSize = spread.convert.hubSize;
		}
		if (spread.buy.size <= spread.sell.size * spread.sell.price) {
			spread.exitBasisSize = spread.sell.basisSize;
			spread.exitHubSize = spread.sell.hubSize;
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
			hubSpread: Number.NaN,
			spreadPercent: Number.NaN,
			spreadsPerMinute: 0,
			type: ArbType.OriginConversion,
			convert: this.getOperation(
				this.conversionMarket.hub.exchange.name,
				this.conversionMarket.hub.asset.symbol,
				this.conversionMarket.asset.symbol,
				ticker.price,
				size,
				size * (ticker.price || Number.NaN),
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

	handleOriginTickers(ticker: Ticker, initiationType: InitiationType) {
		const legFullyFilled = this.getLegConvertFilledHandler();
		const buyMarketTickerSize: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		const buyHubTickerSize = buyMarketTickerSize * price;
		let buyHubRemainderTickerSize: number = buyHubTickerSize;
		let finished: boolean = false;
		while (!finished) {
			let spread;
			if ((initiationType as InitiationType) === InitiationType.Maker) {
				spread = this.makerSpreads[0];
			} else {
				spread = this.takerSpreads[0];
			}
			if (spread && spread.convert) {
				const convertBasisSize = spread.convert.basisSize;
				const convertMarketSize = spread.convert.size;
				const buyBasisCurrentSize = spread.buy.basisSize;
				const buyHubCurrentSize = spread.buy.hubSize;
				const buyMarketCurrentSize = spread.buy.size;
				const buyHubTradableSize = convertMarketSize - buyHubCurrentSize;
				const buyHubTradableTickerSize = Math.min(buyHubTradableSize, buyHubRemainderTickerSize);
				buyHubRemainderTickerSize -= buyHubTradableTickerSize;
				const buyHubNewSize = buyHubCurrentSize + buyHubTradableTickerSize;
				const buyBasisNewSize = this.originMarket.hub.asset.getBasisSize(buyHubNewSize, price, this.originMarket);
				// Log it:
				const convertLegName = `${spread.convert.exchange}:${spread.convert.market}`;
				const buyLegName = `${spread.buy.exchange}:${spread.buy.market}`;
				Logger.log({
					level: "debug",
					message: `${this.getId()}
	Swing from ${convertLegName} to ${buyLegName},
	Price = ${price},
	Convert Market Size = ${convertMarketSize},
	Convert Basis Size = ${convertBasisSize},
	Buy Hub Ticker Size = ${buyHubTickerSize},
	Buy Market Ticker Size  = ${buyMarketTickerSize},
	Buy Hub Tradable Ticker Size = ${buyHubTradableTickerSize},
	Buy Hub Remainder Ticker Size = ${buyHubRemainderTickerSize},
	Buy Market Current Size  = ${buyMarketCurrentSize},
	Buy Hub New Size  = ${buyHubNewSize},
	Buy Basis Current Size = ${buyBasisCurrentSize},
	Buy Basis New Size = ${buyBasisNewSize},`
				});
				if (0 < buyHubTradableTickerSize && !Number.isNaN(buyHubNewSize) && !Number.isNaN(buyBasisNewSize)) {
					// Process it:
					spread.buy.price = this.getVwapPrice(spread.buy, price, buyHubNewSize);
					spread.buy.hubSize = buyHubNewSize;
					spread.buy.size = buyHubNewSize / price;
					spread.buy.basisSize = buyBasisNewSize;
					if (0 < buyHubRemainderTickerSize) {
						// Leg fully filled:
						legFullyFilled(spread);
						// Continue looping to check other queued arbs.
					} else {
						// Leg only partially filled:
						finished = true;
					}
				} else {
					finished = true;
				}
			} else {
				finished = true;
			}
		}
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
		this.conversionMarket.sell.on((ticker: Ticker) => {
			this.legIn(ticker, InitiationType.Maker, this.conversionMarket);
		});
		this.originMarket.sell.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Maker);
		});
		this.destinationMarket.buy.on((ticker: Ticker) => {
			const legFilled = this.getLegOutFilledHandler(InitiationType.Maker);
			this.handleDestinationTickers(ticker, InitiationType.Maker, legFilled);
		});
		// Taker Spreads
		this.conversionMarket.buy.on((ticker: Ticker) => {
			this.legIn(ticker, InitiationType.Taker, this.conversionMarket);
		});
		this.originMarket.buy.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Taker);
		});
		this.destinationMarket.sell.on((ticker: Ticker) => {
			const legFilled = this.getLegOutFilledHandler(InitiationType.Taker);
			this.handleDestinationTickers(ticker, InitiationType.Taker, legFilled);
		});
	}
}
