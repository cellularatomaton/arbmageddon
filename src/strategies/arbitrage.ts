import { ArbType } from "../utils";

export interface ExecutionOperation {
	exchange: string;
	hub: string;
	market: string;
	start?: Date;
	end?: Date;
	price: number;
	size: number;
	hubSize: number;
	basisSize: number;
	duration: number;
	filled: boolean;
}

export interface SpreadExecution {
	id: string | null;
	spread: number;
	hubSpread: number;
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
	entryHubSize?: number;
	exitHubSize?: number;
	filled: boolean;
}
