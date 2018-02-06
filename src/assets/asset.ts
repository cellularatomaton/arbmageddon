import { Hub, Market } from "../markets";
import { Logger } from "../utils/logger";
import "colors";
import { TradeType } from "../utils/enums";
import { Graph } from "../markets/graph";

export class Asset {
	static getAsset(symbol: string, map: Map<string, Asset>): Asset {
		let asset: Asset;
		if (map.has(symbol)) {
			asset = map.get(symbol) as Asset;
		} else {
			asset = new Asset(symbol);
			map.set(symbol, asset);
		}
		return asset;
	}

	hubs: Hub[] = [];
	markets: Market[] = [];

	constructor(public symbol: string) {}

	getMarketSize(market: Market, basisSize?: number): number {
		const graph = market.graph;
		if (!basisSize) {
			basisSize = graph.parameters.basisSize;
		}
		const basisAsset = graph.basisAsset;
		if (basisAsset) {
			const hubAsset = market.hub.asset;
			const alreadyPricedInBasis = hubAsset.symbol === basisAsset.symbol;
			const isBasis = market.asset.symbol === basisAsset.symbol;
			const price = market.getBuyVwap();
			if (isBasis) {
				const size = basisSize;
				Logger.log({
					level: "silly",
					message: `Market Size [Is Basis]  ${market.asset.symbol}:
	Market & Basis Size = ${size},
	Price = ${price},`
				});
				return size;
			} else if (alreadyPricedInBasis) {
				const size = basisSize / price;
				const s = market.asset.symbol;
				const hs = market.hub.asset.symbol;
				Logger.log({
					level: "silly",
					message: `Market Size [Priced In Basis] ${hs} -> ${s}:
	Basis Size = ${basisSize},
	Price = ${price},
	Market Size = ${size},`
				});
				return size;
			} else {
				// Look through hub markets for conversion:
				const conversionMarket = Graph.getConversion(market.hub.exchange, basisAsset.symbol, hubAsset.symbol);
				if (conversionMarket) {
					const conversionPrice = conversionMarket.getBuyVwap();
					const size = basisSize / conversionPrice / price;
					const s = market.asset.symbol;
					const hs = market.hub.asset.symbol;
					const chs = conversionMarket.asset.symbol;
					Logger.log({
						level: "silly",
						message: `Market Size [Convertible From Basis] ${chs}->${hs}->${s}:
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

	getBasisSize(size: number, price: number, market: Market): number {
		const graph = market.hub.graph;
		const basisAsset = graph.basisAsset;
		if (basisAsset) {
			const hubAsset = market.hub.asset;
			const alreadyPricedInBasis = hubAsset.symbol === basisAsset.symbol;
			const isBasis = this.symbol === basisAsset.symbol;
			if (isBasis) {
				Logger.log({
					level: "debug",
					message: `Basis Size [Is Basis]  ${this.symbol}:
	Basis Size = ${size}`
				});
				return size;
			} else if (alreadyPricedInBasis) {
				const basisSize = size * price;
				const s = market.asset.symbol;
				const hs = market.hub.asset.symbol;
				Logger.log({
					level: "debug",
					message: `Basis Size [Priced In Basis] ${hs} -> ${s}:
	Basis Size = ${basisSize},
	Price = ${price},
	Market Size = ${size},`
				});
				return basisSize;
			} else {
				// Look through hub markets for conversion:
				let basisSize: number = Number.NaN;
				let conversionMarket: Market | undefined;
				let conversionPrice: number = Number.NaN;
				conversionMarket = Graph.getConversion(market.hub.exchange, basisAsset.symbol, hubAsset.symbol);
				if (conversionMarket) {
					conversionPrice = conversionMarket.getBuyVwap();
					// if (hubAsset.symbol === this.symbol) {

					// } else {

					// }
					basisSize = size * price * conversionPrice;

					const s = market.asset.symbol;
					const hs = market.hub.asset.symbol;
					const chs = conversionMarket.hub.asset.symbol;
					Logger.log({
						level: "debug",
						message: `Basis Size [Converted To Basis] ${s}->${hs}->${chs}:
	Basis Size=${basisSize},
	Conversion Price=${conversionPrice},
	Price=${price},
	Market Size=${size},`
					});
					return basisSize;
				} else {
					return Number.NaN;
				}
			}
		} else {
			return Number.NaN;
		}
	}

	public log() {
		Logger.log({
			level: "debug",
			message: `Asset: ${this.symbol}`
		});
		Logger.log({
			level: "debug",
			message: `Hub count: ${this.hubs.length}`
		});
		const exchanges = this.hubs.map(h => h.exchange.id).join(",");

		Logger.log({
			level: "debug",
			message: `Exchanges: ${exchanges}`
		});
		Logger.log({
			level: "debug",
			message: `Market Count: ${this.markets.length}`
		});
	}
}
