import { Market } from "../markets";
import { TradeType, VWAP } from "../markets/ticker";
import {
	IEvent,
	EventImp,
	ArbType,
	ArbConversionType,
	InstructionType
} from "../utils";
import "colors";
import { Graph } from "../markets/graph";
import { InitiationType } from "../utils/enums";

export interface ExecutionOperation {
	exchange: string;
	hub: string;
	market: string;
	price: number;
	duration: number;
}

export interface ExecutionInstruction {
	id: string | null;
	spread: number;
	type: InstructionType;
	buy: ExecutionOperation;
	sell: ExecutionOperation;
	convert?: ExecutionOperation;
}

export class Arb {
	type: ArbType;
	conversionType: ArbConversionType;
	originConversion: Market | null | undefined;
	destinationConversion: Market | null | undefined;
	onUpdated: EventImp<ExecutionInstruction> = new EventImp<
		ExecutionInstruction
	>();
	get updated(): IEvent<ExecutionInstruction> {
		return this.onUpdated.expose();
	}
	constructor(public originMarket: Market, public destinationMarket: Market) {
		// Find buy conversion market
		const originExchange = originMarket.hub.exchange;
		const originConversionHub = originExchange.hubs.get(
			destinationMarket.hub.asset.symbol
		);
		this.originConversion = originConversionHub
			? originConversionHub.markets.get(originMarket.hub.asset.symbol)
			: null;
		// Find sell conversion market
		const destinationExchange = destinationMarket.hub.exchange;
		const destinationConversionHub = destinationExchange.hubs.get(
			originMarket.hub.asset.symbol
		);
		this.destinationConversion = destinationConversionHub
			? destinationConversionHub.markets.get(destinationMarket.hub.asset.symbol)
			: null;
		if (
			originMarket.getBuyVwap() === 0 ||
			destinationMarket.getSellVwap() === 0
		) {
			this.type = ArbType.None;
			this.conversionType = ArbConversionType.None;
		} else if (this.originConversion || this.destinationConversion) {
			this.type = ArbType.Complex;
			if (this.originConversion && this.destinationConversion) {
				this.conversionType = ArbConversionType.EitherSide;
			} else if (this.originConversion) {
				this.conversionType = ArbConversionType.BuySide;
			} else if (this.destinationConversion) {
				this.conversionType = ArbConversionType.SellSide;
			} else {
				this.conversionType = ArbConversionType.None;
			}
		} else if (this.isSimpleArb()) {
			this.type = ArbType.Simple;
			this.conversionType = ArbConversionType.None;
		} else {
			this.type = ArbType.None;
			this.conversionType = ArbConversionType.None;
		}
	}

	subscribeToVwap(event: IEvent<VWAP>) {
		event.on((vwap: VWAP | undefined) => {
			const instructions: ExecutionInstruction[] = this.getInstructions();
			instructions.forEach((inst: ExecutionInstruction) => {
				// console.log(`VWAP Triggered Instructions: ${JSON.stringify(inst)}`);
				this.onUpdated.trigger(inst);
			});
		});
	}

	subscribeToEvents(graph: Graph) {
		if ((graph.initiationType as InitiationType) === InitiationType.Maker) {
			this.subscribeToVwap(this.destinationMarket.vwapBuyStats.vwapUpdated);
			this.subscribeToVwap(this.originMarket.vwapSellStats.vwapUpdated);
			if (this.originConversion) {
				this.subscribeToVwap(this.originConversion.vwapSellStats.vwapUpdated);
			}
			if (this.destinationConversion) {
				this.subscribeToVwap(
					this.destinationConversion.vwapBuyStats.vwapUpdated
				);
			}
		} else {
			this.subscribeToVwap(this.destinationMarket.vwapSellStats.vwapUpdated);
			this.subscribeToVwap(this.originMarket.vwapBuyStats.vwapUpdated);
			if (this.originConversion) {
				this.subscribeToVwap(this.originConversion.vwapBuyStats.vwapUpdated);
			}
			if (this.destinationConversion) {
				this.subscribeToVwap(
					this.destinationConversion.vwapSellStats.vwapUpdated
				);
			}
		}
	}

	getId(): string {
		const originExchange = this.originMarket.hub.exchange.id;
		const originConvert = this.originConversion
			? this.originConversion.asset.symbol
			: "NULL";
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationMarket = this.destinationMarket.asset.symbol;
		const destinationConvert = this.destinationConversion
			? this.destinationConversion.asset.symbol
			: "NULL";
		return `${this.type}.${
			this.conversionType
		}.${originExchange}.${originConvert}.${originMarket}.${destinationExchange}${destinationConvert}${destinationMarket}`;
	}

	getInstId(instType: InstructionType): string | null {
		const originExchange = this.originMarket.hub.exchange.id;
		const originHub = this.originMarket.hub.asset.symbol;
		const originMarket = this.originMarket.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const destinationHub = this.destinationMarket.hub.asset.symbol;
		const destinationMarket = this.destinationMarket.asset.symbol;
		const originConvert = this.originConversion
			? this.originConversion.asset.symbol
			: null;
		const originConvertHub = this.originConversion
			? this.originConversion.hub.asset.symbol
			: null;
		const destinationConvert = this.destinationConversion
			? this.destinationConversion.asset.symbol
			: null;
		const destinationConvertHub = this.destinationConversion
			? this.destinationConversion.hub.asset.symbol
			: null;

		const oHub = `${originExchange}.${originHub}`;
		const oMkt = `${originExchange}.${originMarket}`;
		const dHub = `${destinationExchange}.${destinationHub}`;
		const dMkt = `${destinationExchange}.${destinationMarket}`;
		const ocHub = `${originExchange}.${originConvertHub}`;
		const ocMkt = `${originExchange}.${originConvert}`;
		const dcHub = `${destinationExchange}.${destinationConvertHub}`;
		const dcMkt = `${destinationExchange}.${destinationConvert}`;

		if ((instType as InstructionType) === InstructionType.Direct) {
			// Direct Arb
			return `DA:${oHub}->${oMkt}->${dHub}`;
		} else if (
			(instType as InstructionType) === InstructionType.OriginConversion
		) {
			// Origin Conversion
			return `OC:${ocHub}->${ocMkt}->${oMkt}->${dHub}`;
		} else if (
			(instType as InstructionType) === InstructionType.DestinationConversion
		) {
			// Destination Conversion
			return `DC:${oHub}->${dMkt}->${dcMkt}->${dcHub}`;
		}
		return null;
	}

	isSimpleArb(): boolean {
		const originHub = this.originMarket.hub.asset.symbol;
		const originExchange = this.originMarket.hub.exchange.id;
		const destinationHub = this.destinationMarket.hub.asset.symbol;
		const destinationExchange = this.destinationMarket.hub.exchange.id;
		const isSameHub = originHub === destinationHub;
		const isSameExchange = originExchange === destinationExchange;
		const isSimple = isSameHub && !isSameExchange;
		return isSimple;
	}

	getSpread() {
		const spread =
			this.destinationMarket.getSellVwap() - this.originMarket.getBuyVwap();
		return spread;
	}

	getSpreadPercent() {
		const spread = this.getSpread();
		if (this.originMarket.getBuyVwap() === 0) {
			return Number.NaN;
		} else {
			return spread / this.originMarket.getBuyVwap();
		}
	}

	getOriginConversionSpread() {
		if (this.originConversion) {
			return (
				this.destinationMarket.getSellVwap() -
				this.originMarket.getBuyVwap() * this.originConversion.getBuyVwap()
			);
		} else {
			return Number.NaN;
		}
	}

	getOriginConversionSpreadPercent() {
		if (this.originConversion) {
			const initialValue =
				this.originMarket.getBuyVwap() * this.originConversion.getBuyVwap();
			if (initialValue === 0) {
				return Number.NaN;
			} else {
				return this.getOriginConversionSpread() / initialValue;
			}
		} else {
			return Number.NaN;
		}
	}

	getDestinationConversionSpread() {
		if (this.destinationConversion) {
			return (
				this.destinationMarket.getSellVwap() *
					this.destinationConversion.getSellVwap() -
				this.originMarket.getBuyVwap()
			);
		} else {
			return Number.NaN;
		}
	}

	getDestinationConversionSpreadPercent() {
		if (this.destinationConversion) {
			const initialValue = this.originMarket.getBuyVwap();
			if (initialValue === 0) {
				return Number.NaN;
			} else {
				return this.getDestinationConversionSpread() / initialValue;
			}
		} else {
			return Number.NaN;
		}
	}

	getConversionSpreadPercent() {
		const originConversionSpread = this.getOriginConversionSpreadPercent();
		const destinationConversionSpread = this.getDestinationConversionSpreadPercent();
		return this.getBetterSpread(
			originConversionSpread,
			destinationConversionSpread
		);
	}

	getConversionSpread() {
		const originConversionSpread = this.getOriginConversionSpread();
		const destinationConversionSpread = this.getDestinationConversionSpread();
		return this.getBetterSpread(
			originConversionSpread,
			destinationConversionSpread
		);
	}

	getBetterSpread(
		originConversionSpread: number,
		destinationConversionSpread: number
	) {
		const hasOriginConversion = !Number.isNaN(originConversionSpread);
		const hasDestinationConversion = !Number.isNaN(destinationConversionSpread);

		if (this.conversionType === ArbConversionType.EitherSide) {
			if (
				Math.abs(destinationConversionSpread) < Math.abs(originConversionSpread)
			) {
				return originConversionSpread;
			} else {
				return destinationConversionSpread;
			}
		} else if (this.conversionType === ArbConversionType.BuySide) {
			return originConversionSpread;
		} else if (this.conversionType === ArbConversionType.SellSide) {
			return destinationConversionSpread;
		} else {
			console.log(`Missing conversion markets!`);
			return Number.NaN;
		}
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

	public getOriginConvOperation(): ExecutionOperation | null {
		if (this.originConversion) {
			return {
				exchange: this.originConversion.hub.exchange.id,
				hub: this.originConversion.hub.asset.symbol,
				market: this.originConversion.asset.symbol,
				price: this.originConversion.getBuyVwap(),
				duration: this.originConversion.getBuyDuration()
			};
		} else {
			return null;
		}
	}

	public getDestinationConvOperation(): ExecutionOperation | null {
		if (this.destinationConversion) {
			return {
				exchange: this.destinationConversion.hub.exchange.id,
				hub: this.destinationConversion.hub.asset.symbol,
				market: this.destinationConversion.asset.symbol,
				price: this.destinationConversion.getSellVwap(),
				duration: this.destinationConversion.vwapBuyStats.getDuration()
			};
		} else {
			return null;
		}
	}

	public getDirectInstructions(): ExecutionInstruction | null {
		const spread = this.getSpreadPercent();
		const buy = this.getBuyOperation();
		const sell = this.getSellOperation();
		const instructions = {
			id: this.getInstId(InstructionType.Direct),
			spread,
			type: InstructionType.Direct,
			buy,
			sell
		};
		return instructions;
	}

	public getOriginConvertInstructions(): ExecutionInstruction | null {
		const buyConvertSpread = this.getOriginConversionSpreadPercent();
		const buy = this.getBuyOperation();
		const sell = this.getSellOperation();
		const buyConvert = this.getOriginConvOperation();
		if (buyConvert) {
			const instructions = {
				id: this.getInstId(InstructionType.OriginConversion),
				spread: buyConvertSpread,
				type: InstructionType.OriginConversion,
				buy,
				sell,
				convert: buyConvert
			};
			return instructions;
		} else {
			return null;
		}
	}

	public getDestinationConvertInstructions(): ExecutionInstruction | null {
		const sellConvertSpread = this.getDestinationConversionSpreadPercent();
		const buy = this.getBuyOperation();
		const sell = this.getSellOperation();
		const sellConvert = this.getDestinationConvOperation();
		if (sellConvert) {
			const instructions = {
				id: this.getInstId(InstructionType.DestinationConversion),
				spread: sellConvertSpread,
				type: InstructionType.DestinationConversion,
				buy,
				sell,
				convert: sellConvert
			};
			return instructions;
		} else {
			return null;
		}
	}

	public getInstructions(): ExecutionInstruction[] {
		const instructions: ExecutionInstruction[] = [];
		if (this.type === ArbType.Simple) {
			const instruction = this.getDirectInstructions();
			if (instruction && !Number.isNaN(instruction.spread)) {
				instructions.push(instruction);
			}
		} else if (this.type === ArbType.Complex) {
			if (this.conversionType === ArbConversionType.EitherSide) {
				const sellConvertInstruction = this.getDestinationConvertInstructions();
				if (
					sellConvertInstruction &&
					!Number.isNaN(sellConvertInstruction.spread)
				) {
					instructions.push(sellConvertInstruction);
				}
				const buyConvertInstruction = this.getOriginConvertInstructions();
				if (
					buyConvertInstruction &&
					!!Number.isNaN(buyConvertInstruction.spread)
				) {
					instructions.push(buyConvertInstruction);
				}
			} else if (this.conversionType === ArbConversionType.BuySide) {
				const buyConvertInstruction = this.getOriginConvertInstructions();
				if (
					buyConvertInstruction &&
					!Number.isNaN(buyConvertInstruction.spread)
				) {
					instructions.push(buyConvertInstruction);
				}
			} else if (this.conversionType === ArbConversionType.SellSide) {
				const sellConvertInstruction = this.getDestinationConvertInstructions();
				if (
					sellConvertInstruction &&
					!Number.isNaN(sellConvertInstruction.spread)
				) {
					instructions.push(sellConvertInstruction);
				}
			} else {
				console.log(`No Conversion Type.`);
			}
		} else {
			console.log(`No Arb Type.`);
		}
		return instructions;
	}
}
