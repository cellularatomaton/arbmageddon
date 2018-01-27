import { ArbType } from "../utils";

export interface ExecutionOperation {
	exchange: string;
	hub: string;
	market: string;
	start?: Date;
	price: number;
	size: number;
	basisSize: number;
	duration: number;
}

export interface SpreadExecution {
	id: string | null;
	spread: number;
	type: ArbType;
	buy: ExecutionOperation;
	sell: ExecutionOperation;
	convert?: ExecutionOperation;
}
