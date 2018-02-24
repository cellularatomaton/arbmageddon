import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";
import { SpreadExecution } from ".";
import { DestinationConversion } from "./destinationConversion";
import { InitiationType } from "../utils/enums";

export class MakerDestinationConversion extends DestinationConversion {
	getId(): string {
		return `M${super.getId()}`;
	}

	subscribeToEvents(graph: Graph): void {
		this.originMarket.sell.on((ticker: Ticker) => {
			this.handleOriginTickers(
				ticker,
				InitiationType.Maker,
				this.originMarket,
				(spread: SpreadExecution | undefined) => {
					// Leg filled.
				}
			);
		});
		this.destinationMarket.buy.on((ticker: Ticker) => {
			const legFilled = this.getLegConvertFilledHandler();
			this.handleDestinationTickers(ticker, InitiationType.Maker, legFilled);
		});
		this.conversionMarket.buy.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Maker);
		});
	}
}
