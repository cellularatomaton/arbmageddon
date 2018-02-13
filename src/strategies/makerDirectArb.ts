import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";
import { DirectArb } from "./directArb";
import { SpreadExecution } from ".";
import { InitiationType } from "../utils/enums";

export class MakerDirectArb extends DirectArb {
	getId(): string {
		return `M${super.getId()}`;
	}

	subscribeToEvents(graph: Graph): void {
		this.originMarket.sell.on((ticker: Ticker) => {
			this.handleOriginTickers(ticker, InitiationType.Maker, (spread: SpreadExecution | undefined) => {
				// Leg filled.
			});
		});
		this.destinationMarket.buy.on((ticker: Ticker) => {
			const legFilled = this.getLegOutFilledHandler();
			this.handleDestinationTickers(ticker, InitiationType.Maker, legFilled);
		});
	}
}
