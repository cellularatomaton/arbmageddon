import { Hub } from "./hub";
import { Graph, Ticker } from "../markets";
import { TimeUnit, VolumeStatistics } from "./ticker";
import { InitiationType, TradeType } from "../utils/enums";
import { EventImp, IEvent } from "../utils/event";
import { Logger } from "../utils/logger";
import { Asset } from "../assets/asset";

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

	getBuyVwap(initiationType: InitiationType): number {
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapSellStats.getVwap();
		} else {
			return this.vwapBuyStats.getVwap();
		}
	}

	getSellVwap(initiationType: InitiationType): number {
		if ((initiationType as InitiationType) === InitiationType.Maker) {
			return this.vwapBuyStats.getVwap();
		} else {
			return this.vwapSellStats.getVwap();
		}
	}

	// getBuyDuration(initiationType?: InitiationType): number {
	// 	if (!initiationType) {
	// 		initiationType = this.graph.parameters.initiationType;
	// 	}
	// 	if ((initiationType as InitiationType) === InitiationType.Maker) {
	// 		return this.vwapSellStats.getDuration();
	// 	} else {
	// 		return this.vwapBuyStats.getDuration();
	// 	}
	// }

	// getSellDuration(initiationType?: InitiationType): number {
	// 	if (!initiationType) {
	// 		initiationType = this.graph.parameters.initiationType;
	// 	}
	// 	if ((initiationType as InitiationType) === InitiationType.Maker) {
	// 		return this.vwapBuyStats.getDuration();
	// 	} else {
	// 		return this.vwapSellStats.getDuration();
	// 	}
	// }

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
}
