import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";
import { SpreadExecution } from ".";
import { OriginConversion } from "./originConversion";
import { InitiationType } from "../utils/enums";

export class MakerOriginConversion extends OriginConversion {
	getId(): string {
		return `M${super.getId()}`;
	}

	subscribeToEvents(graph: Graph): void {
		this.conversionMarket.sell.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Maker, (spread: SpreadExecution | undefined) => {
				// Leg filled.
			});
		});
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
