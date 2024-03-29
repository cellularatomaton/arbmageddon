export interface IEvent<T> {
	on(handler: (data: T) => void): void;
	off(handler: (data: T) => void): void;
}

export class EventImp<T> implements IEvent<T> {
	private handlers: Array<(data: T) => void> = [];

	public on(handler: (data: T) => void): void {
		this.handlers.push(handler);
	}

	public off(handler: (data: T) => void): void {
		this.handlers = this.handlers.filter(h => h !== handler);
	}

	public trigger(data: T) {
		this.handlers.slice(0).forEach(h => h(data));
	}

	public expose(): IEvent<T> {
		return this;
	}
}
