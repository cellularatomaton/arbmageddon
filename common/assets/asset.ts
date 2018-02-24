import { Hub, Market } from "../markets";
import { Logger } from "../utils/logger";
import "colors";
import { TradeType, InitiationType } from "../utils/enums";
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

	getMarketSize(initiationType: InitiationType, market: Market, basisSize?: number): number {
		const graph = market.graph;
		if (!basisSize) {
			basisSize = graph.parameters.basisSize;
		}
		const basisAsset = graph.basisAsset;
		if (basisAsset) {
			const hubAsset = market.hub.asset;
			const alreadyPricedInBasis = hubAsset.symbol === basisAsset.symbol;
			const isBasis = market.asset.symbol === basisAsset.symbol;
			const price = market.getBuyVwap(initiationType);
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
					let size: number = Number.NaN;
					const conversionPrice: number = conversionMarket.getBuyVwap(initiationType);
					const conversionSymbol: string = conversionMarket.hub.asset.symbol;
					const isHub = hubAsset.symbol === this.symbol;
					if (isHub) {
						// Convert to hub:
						size = basisSize / conversionPrice;
					} else {
						// Convert to hub, then market
						size = basisSize / conversionPrice / price;
					}
					const s = market.asset.symbol;
					const hs = market.hub.asset.symbol;
					const chs = conversionSymbol;
					Logger.log({
						level: "silly",
						message: `Market Size [Convertible From Basis] ${chs}->${hs}->${s}:
		Basis Size=${basisSize},
		Conversion Price=${conversionPrice},
		Price=${price},
		Market Size=${size},`
					});
					return size;
				}
			}
		}
		return Number.NaN;
	}

	getBasisSize(size: number, price: number, initiationType: InitiationType, market: Market): number {
		const graph = market.hub.graph;
		const basisAsset = graph.basisAsset;
		if (basisAsset) {
			const hubAsset = market.hub.asset;
			const alreadyPricedInBasis = hubAsset.symbol === basisAsset.symbol;
			const isBasis = this.symbol === basisAsset.symbol;
			if (isBasis) {
				Logger.log({
					level: "silly",
					message: `Basis Size [Is Basis]  ${this.symbol}:
	Basis Size = ${size}`
				});
				return size;
			} else if (alreadyPricedInBasis) {
				const basisSize = size * price;
				const s = market.asset.symbol;
				const hs = market.hub.asset.symbol;
				Logger.log({
					level: "silly",
					message: `Basis Size [Priced In Basis] ${hs} -> ${s}:
	Basis Size = ${basisSize},
	Price = ${price},
	Market Size = ${size},`
				});
				return basisSize;
			} else {
				// Look through hub markets for conversion:
				const conversionMarket: Market | undefined = Graph.getConversion(
					market.hub.exchange,
					basisAsset.symbol,
					hubAsset.symbol
				);
				if (conversionMarket) {
					let basisSize: number = Number.NaN;
					const conversionPrice = conversionMarket.getBuyVwap(initiationType);
					const conversionHubSymbol: string = conversionMarket.hub.asset.symbol;
					const isHub = hubAsset.symbol === this.symbol;
					if (isHub) {
						// Convert to basis:
						basisSize = size * conversionPrice;
					} else {
						// Convert to hub, then basis:
						basisSize = size * price * conversionPrice;
					}
					const s = market.asset.symbol;
					const hs = market.hub.asset.symbol;
					const chs = conversionHubSymbol;
					Logger.log({
						level: "silly",
						message: `Basis Size [Converted To Basis] ${s}->${hs}->${chs}:
		Basis Size=${basisSize},
		Conversion Price=${conversionPrice},
		Price=${price},
		Market Size=${size},`
					});
					return basisSize;
				}
			}
		}
		return Number.NaN;
	}

	public log() {
		Logger.log({
			level: "silly",
			message: `Asset: ${this.symbol}`
		});
		Logger.log({
			level: "silly",
			message: `Hub count: ${this.hubs.length}`
		});
		const exchanges = this.hubs.map(h => h.exchange.id).join(",");

		Logger.log({
			level: "silly",
			message: `Exchanges: ${exchanges}`
		});
		Logger.log({
			level: "silly",
			message: `Market Count: ${this.markets.length}`
		});
	}
}
