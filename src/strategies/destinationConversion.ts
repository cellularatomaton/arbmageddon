import { Arb } from "./arb";
import { ArbType, InitiationType } from "../utils/enums";
import { ExecutionInstruction, ExecutionOperation } from "./arbitrage";
import { Graph } from "../markets/graph";
import { Market } from "../markets/market";

export class DestinationConversion extends Arb {
	public conversionMarket: Market;

	constructor(public originMarket: Market, public destinationMarket: Market) {
		super(originMarket, destinationMarket);
		this.conversionMarket = Graph.getDestinationConversionMarket(
			originMarket,
			destinationMarket
		);
	}

	getId(): string {
		const originExchange = this.originMarket.hub.exchange.id;
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationMarket = this.destinationMarket.asset.symbol;
		const destinationConvert = this.conversionMarket.asset.symbol;
		return `DC.${originExchange}.${originMarket}->${destinationExchange}.${destinationConvert}->${destinationMarket}`;
	}

	getInstId(): string {
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

	getInstruction(): ExecutionInstruction {
		const instruction = this.getDestinationConvertInstructions();
		return instruction;
	}

	getSpread(): number {
		return (
			this.destinationMarket.getSellVwap() *
				this.conversionMarket.getSellVwap() -
			this.originMarket.getBuyVwap()
		);
	}

	getSpreadPercent(): number {
		const initialValue = this.originMarket.getBuyVwap();
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
			this.subscribeToVwap(this.conversionMarket.vwapBuyStats.vwapUpdated);
		} else {
			this.subscribeToVwap(this.destinationMarket.vwapSellStats.vwapUpdated);
			this.subscribeToVwap(this.originMarket.vwapBuyStats.vwapUpdated);
			this.subscribeToVwap(this.conversionMarket.vwapSellStats.vwapUpdated);
		}
	}

	public getDestinationConvOperation(): ExecutionOperation {
		return {
			exchange: this.conversionMarket.hub.exchange.id,
			hub: this.conversionMarket.hub.asset.symbol,
			market: this.conversionMarket.asset.symbol,
			price: this.conversionMarket.getSellVwap(),
			duration: this.conversionMarket.vwapBuyStats.getDuration()
		};
	}

	public getDestinationConvertInstructions(): ExecutionInstruction {
		const sellConvertSpread = this.getSpreadPercent();
		const buy = this.getBuyOperation();
		const sell = this.getSellOperation();
		const sellConvert = this.getDestinationConvOperation();
		const instructions = {
			id: this.getInstId(),
			spread: sellConvertSpread,
			type: ArbType.DestinationConversion,
			buy,
			sell,
			convert: sellConvert
		};
		return instructions;
	}
}
