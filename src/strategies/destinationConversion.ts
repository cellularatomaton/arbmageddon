import { Arb, FillHandler } from "./arb";
import { ArbType, InitiationType, TradeType } from "../utils/enums";
import { SpreadExecution, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";

export class DestinationConversion extends Arb {
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
		const destinationConvert = this.conversionMarket.asset.symbol;
		const destinationConvertHub = this.conversionMarket.hub.asset.symbol;

		const oHub = `${originExchange}.${originHub}`;
		const dMkt = `${destinationExchange}.${destinationMarket}`;
		const dcHub = `${destinationExchange}.${destinationConvertHub}`;
		const dcMkt = `${destinationExchange}.${destinationConvert}`;

		return `DC:${oHub}->${dMkt}->${dcMkt}->${dcHub}`;
	}

	updateSpreads(spread: SpreadExecution): void {
		spread.entryBasisSize = spread.buy.basisSize;
		spread.entryHubSize = spread.buy.hubSize;
		if (spread.convert && spread.sell.size <= spread.convert.size * spread.convert.price) {
			spread.exitBasisSize = spread.convert.basisSize;
			spread.exitHubSize = spread.convert.hubSize;
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
			hubSpread: Number.NaN,
			spreadPercent: Number.NaN,
			spreadsPerMinute: 0,
			type: ArbType.DestinationConversion,
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
			convert: this.getOperation(
				this.conversionMarket.hub.exchange.name,
				this.conversionMarket.hub.asset.symbol,
				this.conversionMarket.asset.symbol
			)
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

	handleConversionTickers(ticker: Ticker, initiationType: InitiationType) {
		const legFullyFilled = this.getLegOutFilledHandler(initiationType);
		const convertMarketTickerSize: number = ticker.size || Number.NaN;
		const price: number = ticker.price || Number.NaN;
		const convertHubTickerSize = convertMarketTickerSize * price;
		let convertHubRemainderTickerSize: number = convertHubTickerSize;
		let finished: boolean = false;
		while (!finished) {
			let spread;
			if ((initiationType as InitiationType) === InitiationType.Maker) {
				spread = this.makerSpreads[0];
			} else {
				spread = this.takerSpreads[0];
			}
			if (spread && spread.convert) {
				const sellBasisSize = spread.sell.basisSize;
				const sellHubSize = spread.sell.hubSize;
				const convertBasisSize = spread.convert.basisSize;
				const convertHubCurrentSize = spread.convert.hubSize;
				const convertHubSwingSize = sellHubSize * price;
				const convertHubTradableSize = convertHubSwingSize - convertHubCurrentSize;
				const convertHubTradableTickerSize = Math.min(convertHubTradableSize, convertHubRemainderTickerSize);
				convertHubRemainderTickerSize -= convertHubTradableTickerSize;
				const convertHubNewSize = convertHubCurrentSize + convertHubTradableTickerSize;
				const convertBasisNewSize = this.conversionMarket.hub.asset.getBasisSize(
					convertHubNewSize,
					price,
					this.conversionMarket
				);
				// Log it:
				const buyLegName = `${spread.buy.exchange}:${spread.buy.market}`;
				const sellLegName = `${spread.sell.exchange}:${spread.sell.hub}`;
				Logger.log({
					level: "debug",
					message: `${this.getId()}
	Swing from ${buyLegName} to ${sellLegName},
	Price = ${price},
	Sell Hub Size = ${sellHubSize},
	Sell Basis Size = ${sellBasisSize},
	Convert Market Ticker Size  = ${convertMarketTickerSize},
	Convert Hub Ticker Size = ${convertHubTickerSize},
	Convert Hub Tradable Ticker Size = ${convertHubTradableTickerSize},
	Convert Hub Remainder Ticker Size = ${convertHubRemainderTickerSize},
	Convert Hub Current Size  = ${convertHubCurrentSize},
	Convert Hub New Size  = ${convertHubNewSize},
	Convert Basis Current Size = ${sellBasisSize},
	Convert Basis New Size = ${convertBasisNewSize},`
				});
				if (
					0 < convertHubTradableTickerSize &&
					!Number.isNaN(convertHubNewSize) &&
					!Number.isNaN(convertBasisNewSize)
				) {
					// Process it:
					spread.convert.price = this.getVwapPrice(spread.sell, price, convertHubNewSize);
					spread.convert.hubSize = convertHubNewSize;
					spread.convert.size = convertHubNewSize / price;
					spread.convert.basisSize = convertBasisNewSize;
					if (0 < convertHubRemainderTickerSize) {
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

	subscribeToEvents(graph: Graph): void {
		// Maker Spreads
		this.originMarket.sell.on((ticker: Ticker) => {
			this.legIn(ticker, InitiationType.Maker, this.originMarket);
		});
		this.destinationMarket.buy.on((ticker: Ticker) => {
			const legFilled = this.getLegConvertFilledHandler();
			this.handleDestinationTickers(ticker, InitiationType.Maker, legFilled);
		});
		this.conversionMarket.buy.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Maker);
		});
		// Taker Spreads
		this.originMarket.buy.on((ticker: Ticker) => {
			this.legIn(ticker, InitiationType.Taker, this.originMarket);
		});
		this.destinationMarket.sell.on((ticker: Ticker) => {
			const legFilled = this.getLegConvertFilledHandler();
			this.handleDestinationTickers(ticker, InitiationType.Taker, legFilled);
		});
		this.conversionMarket.sell.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Taker);
		});
	}
}
