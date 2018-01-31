import { ArbType } from "../utils";

export interface ExecutionOperation {
	exchange: string;
	hub: string;
	market: string;
	start?: Date;
	end?: Date;
	price: number;
	size: number;
	basisSize: number;
	duration: number;
}

export interface SpreadExecution {
	id: string | null;
	spread: number;
	spreadPercent: number;
	type: ArbType;
	buy: ExecutionOperation;
	sell: ExecutionOperation;
	convert?: ExecutionOperation;
	spreadsPerMinute?: number;
	start?: Date;
	end?: Date;
	entryBasisSize?: number;
	exitBasisSize?: number;
}
