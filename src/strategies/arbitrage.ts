import { ArbType } from "../utils";

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
	type: ArbType;
	buy: ExecutionOperation;
	sell: ExecutionOperation;
	convert?: ExecutionOperation;
}
