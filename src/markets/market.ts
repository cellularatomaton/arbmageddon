import { Asset } from "../assets";
import { Hub } from "./hub";
import { Graph, Ticker } from "../markets";
import { TimeUnit, VolumeStatistics } from "./ticker";
import { InitiationType, TradeType } from "../utils/enums";
import { EventImp, IEvent } from "../utils/event";
import { Logger } from "../utils/logger";

export class Market {
	asset: Asset;
	vwapBuyStats: VolumeStatistics;
	vwapSellStats: VolumeStatistics;

	onBuy: EventImp<Ticker> = new EventImp<Ticker>();
	get buy(): IEvent<Ticker> {
		return this.onBuy.expose();
	}

	onSell: EventImp<Ticker> = new EventImp<Ticker>();
	get sell(): IEvent<Ticker> {
		return this.onSell.expose();
	}

	constructor(assetSymbol: string, public hub: Hub, public graph: Graph) {
		this.asset = Asset.getAsset(assetSymbol, graph.assetMap);
		this.asset.markets.push(this);
		this.vwapBuyStats = new VolumeStatistics(this);
		this.vwapSellStats = new VolumeStatistics(this);
	}
	getId() {
		return `${this.hub.getId()}_${this.asset.symbol}`;
	}

	getBuyVwap(initiationType?: InitiationType): number {
		if (!initiationType) {
			initiationType = this.graph.parameters.initiationType;
		}
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapSellStats.getVwap();
		} else {
			return this.vwapBuyStats.getVwap();
		}
	}

	getSellVwap(initiationType?: InitiationType): number {
		if (!initiationType) {
			initiationType = this.graph.parameters.initiationType;
		}
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapBuyStats.getVwap();
		} else {
			return this.vwapSellStats.getVwap();
		}
	}

	getBuyDuration(initiationType?: InitiationType): number {
		if (!initiationType) {
			initiationType = this.graph.parameters.initiationType;
		}
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapSellStats.getDuration();
		} else {
			return this.vwapBuyStats.getDuration();
		}
	}

	getSellDuration(initiationType?: InitiationType): number {
		if (!initiationType) {
			initiationType = this.graph.parameters.initiationType;
		}
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapBuyStats.getDuration();
		} else {
			return this.vwapSellStats.getDuration();
		}
	}

	updateTicker(ticker: Ticker) {
		Logger.log({
			level: "silly",
			message: `Adding ticker: ${JSON.stringify(ticker)}`
		});
		if ((ticker.side as TradeType) === TradeType.BUY) {
			this.onBuy.trigger(ticker);
			this.vwapBuyStats.handleTicker(ticker);
			Logger.log({
				level: "silly",
				message: `Buy vwap: ${this.vwapBuyStats.getVwap()}`
			});
		} else {
			this.onSell.trigger(ticker);
			this.vwapSellStats.handleTicker(ticker);
			Logger.log({
				level: "silly",
				message: `Sell vwap: ${this.vwapSellStats.getVwap()}`
			});
		}
	}

	getMarketSize(basisSize?: number): number {
		const graph = this.graph;
		if (!basisSize) {
			basisSize = graph.parameters.basisSize;
		}
		const basisAsset = graph.basisAsset;
		if (basisAsset) {
			const hubAsset = this.hub.asset;
			const alreadyPricedInBasis = hubAsset.symbol === basisAsset.symbol;
			const isBasis = this.asset.symbol === basisAsset.symbol;
			const price = this.getBuyVwap();
			if (isBasis) {
				const size = basisSize;
				Logger.log({
					level: "debug",
					message: `Market Size [Is Basis]  ${this.asset.symbol}:
	Market & Basis Size = ${size},
	Price = ${price},`
				});
				return size;
			} else if (alreadyPricedInBasis) {
				const size = basisSize / price;
				const s = this.asset.symbol;
				const hs = this.hub.asset.symbol;
				Logger.log({
					level: "debug",
					message: `Market Size [Priced In Basis] ${hs} -> ${s}:
	Basis Size = ${basisSize},
	Price = ${price},
	Market Size = ${size},`
				});
				return size;
			} else {
				// Look through hub markets for conversion:
				const conversionMarket = this.hub.markets.get(basisAsset.symbol);
				if (conversionMarket) {
					const conversionPrice = conversionMarket.getBuyVwap();
					const size = basisSize / conversionPrice / price;
					const s = this.asset.symbol;
					const hs = this.hub.asset.symbol;
					const chs = conversionMarket.asset.symbol;
					Logger.log({
						level: "debug",
						message: `Market Size [Converted To Basis] ${chs}->${hs}->${s}:
	Basis Size=${basisSize},
	Conversion Price=${conversionPrice},
	Price=${price},
	Market Size=${size},`
					});
					return size;
				} else {
					return Number.NaN;
				}
			}
		} else {
			return Number.NaN;
		}
	}

	getBasisSize(size: number): number {
		const graph = this.graph;
		const basisAsset = graph.basisAsset;
		if (basisAsset) {
			const hubAsset = this.hub.asset;
			const alreadyPricedInBasis = hubAsset.symbol === basisAsset.symbol;
			const price = this.getBuyVwap();
			if (alreadyPricedInBasis) {
				const basisSize = size * price;
				return basisSize;
			} else {
				// Look through hub markets for conversion:
				const conversionMarket = this.hub.markets.get(basisAsset.symbol);
				if (conversionMarket) {
					const conversionPrice = conversionMarket.getBuyVwap();
					const basisSize = size * conversionPrice * price;
					return basisSize;
				} else {
					return Number.NaN;
				}
			}
		} else {
			return Number.NaN;
		}
	}
}
