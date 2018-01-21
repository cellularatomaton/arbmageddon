import { Arb } from "./arb";
import { ArbType, InitiationType } from "../utils/enums";
import { ExecutionInstruction, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";

export class OriginConversion extends Arb {
	public conversionMarket: Market;

	constructor(public originMarket: Market, public destinationMarket: Market) {
		super(originMarket, destinationMarket);
		this.conversionMarket = Graph.getOriginConversionMarket(
			originMarket,
			destinationMarket
		);
	}

	getId(): string {
		const originExchange = this.originMarket.hub.exchange.id;
		const originConvert = this.conversionMarket.asset.symbol;
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationMarket = this.destinationMarket.asset.symbol;
		return `OC.${originExchange}.${originConvert}->${originMarket}->${destinationExchange}.${destinationMarket}`;
	}

	getInstId(): string {
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

	getInstruction(): ExecutionInstruction {
		const instructions = this.getOriginConvertInstructions();
		return instructions;
	}

	getSpread(): number {
		return (
			this.destinationMarket.getSellVwap() -
			this.originMarket.getBuyVwap() * this.conversionMarket.getBuyVwap()
		);
	}

	getSpreadPercent(): number {
		const initialValue =
			this.originMarket.getBuyVwap() * this.conversionMarket.getBuyVwap();
		if (initialValue === 0) {
			return Number.NaN;
		} else {
			return this.getSpread() / initialValue;
		}
	}

	subscribeToEvents(graph: Graph): void {
		if (
			(graph.parameters.initiationType as InitiationType) ===
			InitiationType.Maker
		) {
			this.subscribeToVwap(this.destinationMarket.vwapBuyStats.vwapUpdated);
			this.subscribeToVwap(this.originMarket.vwapSellStats.vwapUpdated);
			this.subscribeToVwap(this.conversionMarket.vwapSellStats.vwapUpdated);
		} else {
			this.subscribeToVwap(this.destinationMarket.vwapSellStats.vwapUpdated);
			this.subscribeToVwap(this.originMarket.vwapBuyStats.vwapUpdated);
			this.subscribeToVwap(this.conversionMarket.vwapBuyStats.vwapUpdated);
		}
	}

	public getOriginConvOperation(): ExecutionOperation {
		return {
			exchange: this.conversionMarket.hub.exchange.id,
			hub: this.conversionMarket.hub.asset.symbol,
			market: this.conversionMarket.asset.symbol,
			price: this.conversionMarket.getBuyVwap(),
			duration: this.conversionMarket.getBuyDuration()
		};
	}

	public getOriginConvertInstructions(): ExecutionInstruction {
		const buyConvertSpread = this.getSpreadPercent();
		const buy = this.getBuyOperation();
		const sell = this.getSellOperation();
		const buyConvert = this.getOriginConvOperation();
		const instructions = {
			id: this.getInstId(),
			spread: buyConvertSpread,
			type: ArbType.OriginConversion,
			buy,
			sell,
			convert: buyConvert
		};
		return instructions;
	}
}
