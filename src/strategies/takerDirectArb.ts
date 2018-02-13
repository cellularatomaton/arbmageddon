import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";
import { DirectArb } from "./directArb";
import { SpreadExecution } from ".";
import { InitiationType } from "../utils/enums";

export class TakerDirectArb extends DirectArb {
	getId(): string {
		return `T${super.getId()}`;
	}

	subscribeToEvents(graph: Graph): void {
		this.originMarket.buy.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Taker, (spread: SpreadExecution | undefined) => {
				// Leg filled.
			});
		});
		this.destinationMarket.sell.on((ticker: Ticker) => {
			const legFilled = this.getLegOutFilledHandler();
			this.handleDestinationTickers(ticker, InitiationType.Taker, legFilled);
		});
	}
}
