import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";
import { SpreadExecution } from ".";
import { DestinationConversion } from "./destinationConversion";
import { InitiationType } from "../utils/enums";

export class TakerDestinationConversion extends DestinationConversion {
	getId(): string {
		return `T${super.getId()}`;
	}

	subscribeToEvents(graph: Graph): void {
		// Taker Spreads
		this.originMarket.buy.on((ticker: Ticker) => {
			this.handleOriginTickers(
				ticker,
				InitiationType.Taker,
				this.originMarket,
				(spread: SpreadExecution | undefined) => {
					// Leg filled.
				}
			);
		});
		this.destinationMarket.sell.on((ticker: Ticker) => {
			const legFilled = this.getLegConvertFilledHandler();
			this.handleDestinationTickers(ticker, InitiationType.Taker, legFilled);
		});
		this.conversionMarket.sell.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Taker);
		});
	}
}
