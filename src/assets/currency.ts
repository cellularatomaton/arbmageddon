import { Asset } from './asset';

export class Currency extends Asset {
	constructor(public symbol: string) {
		super(symbol);
	}
}