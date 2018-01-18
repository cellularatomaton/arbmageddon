import { Asset } from "../assets";
import { Hub } from "./hub";
import { Graph, Ticker, TradeType } from "../markets";
import { TimeUnit, VolumeStatistics } from "./ticker";
import { InitiationType } from "../utils/enums";

export class Market {
	asset: Asset;
	vwapBuyStats: VolumeStatistics;
	vwapSellStats: VolumeStatistics;

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
			initiationType = this.graph.initiationType;
		}
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapSellStats.getVwap();
		} else {
			return this.vwapBuyStats.getVwap();
		}
	}

	getSellVwap(initiationType?: InitiationType) {
		if (!initiationType) {
			initiationType = this.graph.initiationType;
		}
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapBuyStats.getVwap();
		} else {
			return this.vwapSellStats.getVwap();
		}
	}

	getBuyDuration(initiationType?: InitiationType): number {
		if (!initiationType) {
			initiationType = this.graph.initiationType;
		}
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapSellStats.getDuration();
		} else {
			return this.vwapBuyStats.getDuration();
		}
	}

	getSellDuration(initiationType?: InitiationType) {
		if (!initiationType) {
			initiationType = this.graph.initiationType;
		}
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapBuyStats.getDuration();
		} else {
			return this.vwapSellStats.getDuration();
		}
	}

	updateVwap(ticker: Ticker) {
		// console.log(`Adding ticker: ${JSON.stringify(ticker)}`);
		if ((ticker.side as TradeType) === TradeType.BUY) {
			this.vwapBuyStats.handleTicker(ticker);
			// console.log(`Buy vwap: ${this.vwapBuyStats.getVwap()}`);
		} else {
			this.vwapSellStats.handleTicker(ticker);
			// console.log(`Sell vwap: ${this.vwapSellStats.getVwap()}`);
		}
	}
}
