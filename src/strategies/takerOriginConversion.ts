import { Graph } from "../markets/graph";
import { Market } from "../markets/market";
import { Ticker } from "../markets/ticker";
import { Logger } from "../utils/logger";
import { SpreadExecution } from ".";
import { OriginConversion } from "./originConversion";
import { InitiationType } from "../utils/enums";

export class TakerOriginConversion extends OriginConversion {
	getId(): string {
		return `T${super.getId()}`;
	}

	subscribeToEvents(graph: Graph): void {
		this.conversionMarket.buy.on((ticker: Ticker) => {
			this.handleConversionTickers(ticker, InitiationType.Taker, (spread: SpreadExecution | undefined) => {
				// Leg filled.
			});
		});
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
