import { EventImp, IEvent } from "../utils/event";
import { ExecutionInstruction, ExecutionOperation } from "./arbitrage";
import { Market } from "../markets/market";
import { ArbType } from "../utils/enums";
import { Graph } from "../markets/graph";
import { VWAP } from "../markets/ticker";

export abstract class Arb {
	onUpdated: EventImp<ExecutionInstruction> = new EventImp<
		ExecutionInstruction
	>();
	get updated(): IEvent<ExecutionInstruction> {
		return this.onUpdated.expose();
	}

	constructor(public originMarket: Market, public destinationMarket: Market) {}

	abstract getId(): string;
	abstract getInstId(instType: ArbType): string | null;
	abstract getSpread(): number;
	abstract getSpreadPercent(): number;
	abstract subscribeToEvents(graph: Graph): void;
	abstract getInstruction(): ExecutionInstruction;

	subscribeToVwap(event: IEvent<VWAP>) {
		event.on((vwap: VWAP | undefined) => {
			const inst: ExecutionInstruction = this.getInstruction();
			// console.log(`VWAP Triggered Instructions: ${JSON.stringify(inst)}`);
			this.onUpdated.trigger(inst);
		});
	}

	public getBuyOperation(): ExecutionOperation {
		return {
			exchange: this.originMarket.hub.exchange.id,
			hub: this.originMarket.hub.asset.symbol,
			market: this.originMarket.asset.symbol,
			price: this.originMarket.getBuyVwap(),
			duration: this.originMarket.getBuyDuration()
		};
	}

	public getSellOperation(): ExecutionOperation {
		return {
			exchange: this.destinationMarket.hub.exchange.id,
			hub: this.destinationMarket.hub.asset.symbol,
			market: this.destinationMarket.asset.symbol,
			price: this.destinationMarket.getSellVwap(),
			duration: this.destinationMarket.getSellDuration()
		};
	}
}
