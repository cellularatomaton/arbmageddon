import { Arb } from "./arb";
import { ArbType, InitiationType } from "../utils/enums";
import { ExecutionInstruction } from "./arbitrage";
import { Graph } from "../markets/graph";

export class DirectArb extends Arb {
	getId(): string {
		const originExchange = this.originMarket.hub.exchange.id;
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationMarket = this.destinationMarket.asset.symbol;
		return `DA.NA:${originExchange}.${originMarket}->${destinationExchange}.${destinationMarket}`;
	}

	getInstId(): string {
		const originExchange = this.originMarket.hub.exchange.id;
		const originHub = this.originMarket.hub.asset.symbol;
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationHub = this.destinationMarket.hub.asset.symbol;

		const oHub = `${originExchange}.${originHub}`;
		const oMkt = `${originExchange}.${originMarket}`;
		const dHub = `${destinationExchange}.${destinationHub}`;

		return `DA:${oHub}->${oMkt}->${dHub}`;
	}

	getInstruction(): ExecutionInstruction {
		const instruction = this.getDirectInstructions();
		return instruction;
	}

	getSpread(): number {
		const spread =
			this.destinationMarket.getSellVwap() - this.originMarket.getBuyVwap();
		return spread;
	}

	getSpreadPercent(): number {
		const spread = this.getSpread();
		if (this.originMarket.getBuyVwap() === 0) {
			return Number.NaN;
		} else {
			return spread / this.originMarket.getBuyVwap();
		}
	}

	subscribeToEvents(graph: Graph): void {
		if (
			(graph.parameters.initiationType as InitiationType) ===
			InitiationType.Maker
		) {
			this.subscribeToVwap(this.destinationMarket.vwapBuyStats.vwapUpdated);
			this.subscribeToVwap(this.originMarket.vwapSellStats.vwapUpdated);
		} else {
			this.subscribeToVwap(this.destinationMarket.vwapSellStats.vwapUpdated);
			this.subscribeToVwap(this.originMarket.vwapBuyStats.vwapUpdated);
		}
	}

	public getDirectInstructions(): ExecutionInstruction {
		const spread = this.getSpreadPercent();
		const buy = this.getBuyOperation();
		const sell = this.getSellOperation();
		const instructions = {
			id: this.getInstId(),
			spread,
			type: ArbType.Direct,
			buy,
			sell
		};
		return instructions;
	}
}
