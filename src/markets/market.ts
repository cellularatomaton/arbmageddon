import { Asset } from "../assets";
import { Hub } from "./hub";
import { Graph, Ticker, TradeType } from "../markets";
import { TimeUnit, VolumeStatistics } from "./ticker";
import { InitiationType } from "../utils/enums";
import { EventImp, IEvent } from "../utils/event";

const log = require("winston");

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
		// log.debug(`Adding ticker: ${JSON.stringify(ticker)}`);
		if ((ticker.side as TradeType) === TradeType.BUY) {
			this.onBuy.trigger(ticker);
			this.vwapBuyStats.handleTicker(ticker);
			// log.debug(`Buy vwap: ${this.vwapBuyStats.getVwap()}`);
		} else {
			this.onSell.trigger(ticker);
			this.vwapSellStats.handleTicker(ticker);
			// log.debug(`Sell vwap: ${this.vwapSellStats.getVwap()}`);
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
			const price = this.getBuyVwap();
			if (alreadyPricedInBasis) {
				const size = basisSize / price;
				// ***************** Debug *****************
				log.debug(
					`Market size for ${this.asset.symbol}/${this.hub.asset.symbol}:
	basisSize=${basisSize},
	price=${price},
	marketSize=${size},`
				);
				// ***************** End Debug *****************
				return size;
			} else {
				// Look through hub markets for conversion:
				const conversionMarket = this.hub.markets.get(basisAsset.symbol);
				if (conversionMarket) {
					const conversionPrice = conversionMarket.getBuyVwap();
					const size = basisSize / conversionPrice / price;
					// ***************** Debug *****************
					log.debug(
						`Market size for ${this.asset.symbol}/${this.hub.asset.symbol}:
	basisSize=${basisSize},
	conversionPrice=${conversionPrice},
	price=${price},
	marketSize=${size},`
					);
					// ***************** End Debug *****************
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
