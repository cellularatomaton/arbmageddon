<template>
	<div class="app-container flex-row elbow-room">
		<spread-list :dash="this"></spread-list>
		<div class="flex-grow flex-col">
			<div>
				<selected-spread
				:basis-size="basisSize"
				:spread-target="spreadTarget"
				:selected-spread="selectedSpread"></selected-spread>
			</div>
			<div class="flex-row flex-stretch elbow-room">
				<div v-if="selectedSpread && originConversions.includes(selectedSpread.type)"
					class="flex-col">
					<execution-operation
						side="buy" class="buy-convert-op"
						title="Buy Convert"
						:operation="selectedSpread.convert"></execution-operation>
					<book-depth :book="conversionBook" :dash="this"></book-depth>
				</div>
				<div v-if="selectedSpread"
					class="flex-col">
					<execution-operation
						side="buy"
						class="buy-op"
						title="Buy"
						:operation="selectedSpread ? selectedSpread.buy : null"></execution-operation>
					<book-depth :book="originBook" :dash="this"></book-depth>
				</div>
				<div v-if="selectedSpread"
					class="flex-col">
					<execution-operation 
						side="sell"
						class="sell-op"
						title="Sell"
						:operation="selectedSpread ? selectedSpread.sell: null"></execution-operation>	
					<book-depth :book="destinationBook" :dash="this"></book-depth>
				</div>
				<div v-if="selectedSpread && destinationConversions.includes(selectedSpread.type)"
					class="flex-col">
					<execution-operation
						side="sell"
						class="sell-convert-op"
						title="Sell Convert"
						:operation="selectedSpread.convert"></execution-operation>
					<book-depth :book="conversionBook" :dash="this"></book-depth>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from "vue";
import * as axios from "axios/dist/axios";
import ExecutionOperation from "./ExecutionOperation.vue";
import GraphParameters from "./GraphParameters.vue";
import MultiChart from "./MultiChart.vue";
import SelectedSpread from "./SelectedSpread.vue";
import SpreadList from "./SpreadList.vue";
import BookDepth from "./BookDepth";
import { ArbType, SubscriptionType } from "../../common/utils/enums";
import { SpreadExecution, ExecutionOperation as Operation } from "../../common/strategies/arbitrage";
import { Graph, GraphParameters as GraphProps, WebsocketMessage } from "../../common/markets/graph";
import { BookSnapshot, BookStats } from "../../common/markets/book";
import { MarketInfo, MarketParameters } from "../../common/markets/market";
import { unescape } from "querystring";

export interface SpreadListItem extends SpreadExecution {
	selected: boolean;
	basisPerMinute?: number;
}

export interface DashboardModel {
	ws: Websocket;
	directArbs: ArbType[];
	originConversions: ArbType[];
	destinationConversions: ArbType[];
	exchMap: Map<string, string> | undefined;
	arbMap: Map<string, SpreadListItem>;
	arbList: SpreadListItem[];
	selectedSpread: SpreadListItem | undefined;
	originBook: BookSnapshot | undefined;
	destinationBook: BookSnapshot | undefined;
	conversionBook: BookSnapshot | undefined;
	showCrossExchange: boolean;
	showSameExchange: boolean;
	showDirect: boolean;
	showConversion: boolean;
	sortArbsAscending: boolean;
	basisSize: number;
	spreadTarget: number;
	recenterBooks: boolean;
}

export default Vue.extend({
	name: "dashboard",
	components: {
		"execution-operation": ExecutionOperation,
		"graph-parameters": GraphParameters,
		"multi-chart": MultiChart,
		"spread-list": SpreadList,
		"selected-spread": SelectedSpread,
		"book-depth": BookDepth
	},
	data() {
		return {
			ws: new WebSocket("ws://localhost:8081/"),
			directArbs: [ArbType.MakerDirect, ArbType.TakerDirect],
			originConversions: [ArbType.MakerOriginConversion, ArbType.TakerOriginConversion],
			destinationConversions: [ArbType.MakerDestinationConversion, ArbType.TakerDestinationConversion],
			exchMap: undefined,
			arbMap: new Map<string, SpreadListItem>(),
			arbList: [],
			selectedSpread: undefined,
			originBook: undefined,
			destinationBook: undefined,
			conversionBook: undefined,
			showCrossExchange: false,
			showSameExchange: true,
			showDirect: true,
			showConversion: true,
			basisSize: 0,
			spreadTarget: 0,
			sortArbsAscending: false,
			recenterBooks: false
		} as DashboardModel;
	},
	mounted() {
		const dash = this;
		dash;
		// .getExchanges()
		// .then(() => {
		// 	return dash.setupWebsocket();
		// })
		dash.setupWebsocket().then(() => {
			dash.sortLoop();
		});
	},
	watch: {
		basisSize(newBasis, oldBasis) {
			const basis = parseFloat(newBasis);
			if (!Number.isNaN(basis)) {
				this.basisSize = basis;
				this.updateGraphProperties();
			}
		},
		spreadTarget(newTarget, oldTarget) {
			const target = parseFloat(newTarget);
			if (!Number.isNaN(target)) {
				this.spreadTarget = target;
				this.updateGraphProperties();
			}
		},
		initiationType(newType, oldType) {
			const type = parseInt(newType);
			this.updateGraphProperties();
		}
	},
	methods: {
		updateGraphProperties() {
			const dash = this;
			dash.ws.send(
				JSON.stringify({
					action: "set",
					type: "graphparams",
					data: {
						basisSize: dash.basisSize,
						spreadTarget: dash.spreadTarget
					}
				} as WebsocketMessage<GraphProps>)
			);
		},
		getMarketParams(pricePrecision: number, sizePrecision: number, book: BookSnapshot) {
			return {
				exchange: book.exchange,
				hub: book.hub,
				market: book.market,
				pricePrecision,
				sizePrecision
			};
		},
		changeBookPrecision(book: BookSnapshot, pricePrecision: number, sizePrecision: number) {
			const dash = this;
			dash.ws.send(
				JSON.stringify({
					action: "set",
					type: "marketparams",
					data: dash.getMarketParams(pricePrecision, sizePrecision, book)
				} as WebsocketMessage<MarketParameters>)
			);
		},
		increasePricePrecision(book: BookSnapshot) {
			this.changeBookPrecision(book, book.stats.pricePrecision + 1, book.stats.sizePrecision);
		},
		decreasePricePrecision(book: BookSnapshot) {
			this.changeBookPrecision(book, book.stats.pricePrecision - 1, book.stats.sizePrecision);
		},
		increaseSizePrecision(book: BookSnapshot) {
			this.changeBookPrecision(book, book.stats.pricePrecision, book.stats.sizePrecision + 1);
		},
		decreaseSizePrecision(book: BookSnapshot) {
			this.changeBookPrecision(book, book.stats.pricePrecision, book.stats.sizePrecision - 1);
		},
		setGraphProperties(props: GraphProps) {
			this.basisSize = props.basisSize;
			this.spreadTarget = props.spreadTarget;
		},
		// getExchanges() {
		// 	const dash = this;
		// 	return new Promise(function(resolve, reject) {
		// 		axios.get("http://localhost:3000/graph/exchanges").then(
		// 			function(response: any) {
		// 				dash.exchMap = response.data.reduce((map: Map<string, string>, exch: any) => {
		// 					map.set(exch.id, exch.name);
		// 					return map;
		// 				}, new Map<string, string>());
		// 				resolve();
		// 			},
		// 			(response: any) => {
		// 				reject();
		// 			}
		// 		);
		// 	});
		// },
		getFilteredArbs() {
			const dash = this;
			if (dash) {
				return dash.arbList
					.filter((spread: SpreadListItem) => {
						const isCrossExchange = spread.buy.exchange !== spread.sell.exchange;
						const crossExchangePasses = dash.showCrossExchange && isCrossExchange;
						const sameExchangePasses = dash.showSameExchange && !isCrossExchange;
						const isDirect = dash.directArbs.includes(spread.type);
						const directPasses = dash.showDirect && isDirect;
						const isConversion = !isDirect;
						const conversionPasses = dash.showConversion && isConversion;
						return (crossExchangePasses || sameExchangePasses) && (directPasses || conversionPasses);
					})
					.slice(0, 50);
			} else {
				return [];
			}
		},
		toggleArbSortDirection() {
			this.sortArbsAscending = !this.sortArbsAscending;
		},
		selectSpread(spread: SpreadListItem) {
			const dash = this;
			if (this.selectedSpread) {
				this.unsubscribeFromBooks(this.selectedSpread);
			}
			if (spread) {
				spread.selected = true;
				if (this.selectedSpread && this.selectedSpread.selected) {
					this.selectedSpread.selected = false;
				}
				this.selectedSpread = spread;
				this.subscribeToBooks(this.selectedSpread);
			}
		},
		subscribeToBooks(spread: SpreadListItem) {
			this.subscribe(this.getSubscriptionData(spread.buy, SubscriptionType.Book));
			this.subscribe(this.getSubscriptionData(spread.sell, SubscriptionType.Book));
			if (spread.convert) {
				this.subscribe(this.getSubscriptionData(spread.convert, SubscriptionType.Book));
			}
		},
		unsubscribeFromBooks(spread: SpreadListItem) {
			this.unsubscribe(this.getSubscriptionData(spread.buy, SubscriptionType.Book));
			this.unsubscribe(this.getSubscriptionData(spread.sell, SubscriptionType.Book));
			if (spread.convert) {
				this.unsubscribe(this.getSubscriptionData(spread.convert, SubscriptionType.Book));
			}
			this.originBook = undefined;
			this.destinationBook = undefined;
			this.conversionBook = undefined;
		},
		subscribe(data: SubscriptionData) {
			const dash = this;
			dash.ws.send(
				JSON.stringify({
					action: "subscribe",
					type: "book",
					data
				} as WebsocketMessage<SubscriptionData>)
			);
		},
		unsubscribe(data: SubscriptionData) {
			const dash = this;
			dash.ws.send(
				JSON.stringify({
					action: "unsubscribe",
					type: "book",
					data
				} as WebsocketMessage<SubscriptionData>)
			);
		},
		getSubscriptionData(operation: ExecutionOperation, type: SubscriptionType): SubscriptionData {
			return {
				exchange: operation.exchange,
				hub: operation.hub,
				market: operation.market,
				type
			};
		},
		getMarketId(obj: MarketInfo): string {
			return `${obj.exchange}.${obj.hub}.${obj.market}`;
		},
		getBook(bookId: string) {
			if (this.selectedSpread) {
				const originOpId = this.getMarketId(this.selectedSpread.buy);
				if (originOpId === bookId) {
					return this.originBook;
				} else {
					const destinationOpId = this.getMarketId(this.selectedSpread.sell);
					if (destinationOpId === bookId) {
						return this.destinationBook;
					} else {
						const convertOpId = this.getMarketId(this.selectedSpread.convert);
						if (convertOpId === bookId) {
							return this.conversionBook;
						}
					}
				}
			}
		},
		setBook(book: BookSnapshot) {
			if (this.selectedSpread) {
				const bookId = this.getMarketId(book);
				const originOpId = this.getMarketId(this.selectedSpread.buy);
				if (originOpId === bookId) {
					this.recenterBooks = this.originBook === undefined;
					this.originBook = book;
				} else {
					const destinationOpId = this.getMarketId(this.selectedSpread.sell);
					if (destinationOpId === bookId) {
						this.recenterBooks = this.destinationBook === undefined;
						this.destinationBook = book;
					} else {
						const convertOpId = this.getMarketId(this.selectedSpread.convert);
						if (convertOpId === bookId) {
							this.recenterBooks = this.conversionBook === undefined;
							this.conversionBook = book;
						}
					}
				}
			}
		},
		updateBook(book: BookSnapshot) {
			this.setBook(book);
			// document.querySelectorAll(".scroller").forEach((element: any) => {
			// 	element.scrollIntoView();
			// });
			// document.querySelectorAll(".scroller").forEach((element: any) => {
			// 	element.scrollIntoView();
			// });
		},
		sortLoop() {
			const dash = this;
			dash.arbList.sort(function(a: SpreadListItem, b: SpreadListItem) {
				if (dash.sortArbsAscending) {
					return a.basisPerMinute - b.basisPerMinute;
				} else {
					return b.basisPerMinute - a.basisPerMinute;
				}
			});
			if (this.recenterBooks) {
				document.querySelectorAll(".scroller").forEach((element: any) => {
					element.scrollIntoView();
				});
			}
			setTimeout(this.sortLoop, 250);
		},
		updateArb(update: SpreadListItem) {
			// console.dir(update);
			if (update && update.spread && update.id) {
				update.basisPerMinute = (update.spreadsPerMinute || Number.NaN) * update.spread;
				const arb: SpreadListItem = this.arbMap.get(update.id);
				// console.dir(arb);
				if (arb) {
					const target = this.spreadTarget;
					arb.spread = update.spread;
					arb.hubSpread = update.hubSpread;
					arb.spreadPercent = update.spreadPercent;
					arb.spreadsPerMinute = update.spreadsPerMinute;
					arb.basisPerMinute = update.basisPerMinute;
					arb.buy.price = update.buy.price;
					arb.buy.size = update.buy.size;
					arb.buy.hubSize = update.buy.hubSize;
					arb.buy.basisSize = update.buy.basisSize;
					arb.sell.price = update.sell.price;
					arb.sell.size = update.sell.size;
					arb.sell.hubSize = update.sell.hubSize;
					arb.sell.basisSize = update.sell.basisSize;
					if (arb.convert && update.convert) {
						arb.convert.price = update.convert.price;
						arb.convert.size = update.convert.size;
						arb.convert.hubSize = update.convert.hubSize;
						arb.convert.basisSize = update.convert.basisSize;
					}
				} else {
					this.arbMap.set(update.id, update);
					this.arbList.push(update);
				}
				// console.dir(arb);
				if (!this.selectedSpread) {
					// this.setMulticharts(this.arbList[0]);
					this.selectSpread(this.arbList[0]);
				}
			} else {
				// Only update selected spread:
			}
		},
		setupWebsocket() {
			const dash = this;
			return new Promise(function(resolve, reject) {
				dash.ws.onclose = () => {
					console.log("Application Websocket closed.");
					setTimeout(dash.setupWebsocket, 1000);
				};

				dash.ws.onmessage = function(message: any) {
					const msg = JSON.parse(message.data);
					if (msg.type === "arb" && msg.action === "update") {
						dash.updateArb(msg.data);
					} else if (msg.type === "graphparams" && msg.action === "set") {
						dash.setGraphProperties(msg.data);
						console.log("Set graph params.");
					} else if (msg.type === "book" && msg.action === "update") {
						dash.updateBook(msg.data);
					}
				};

				dash.ws.onopen = function() {
					console.log("App Websocket opened.");
					dash.ws.send(
						JSON.stringify({
							type: "graphparams",
							action: "get"
						})
					);
					console.log("Graph params requested.");
				};

				// it's the least you could do!
				window.onbeforeunload = function() {
					dash.ws.close();
				};

				resolve();
			});
		}
	}
});
</script>

<style>
.app-container {
	position: absolute;
	top: 0px;
	bottom: 0px;
	left: 0px;
	right: 0px;
	background-color: black;
	color: white;
}

.flex-row {
	display: flex;
	flex-direction: row;
}

.flex-col {
	display: flex;
	flex-direction: column;
}

.flex-col-reverse {
	display: flex;
	flex-direction: column-reverse;
}

.flex-grow {
	flex-grow: 1;
}

.flex-wrap {
	flex-wrap: wrap;
}

.flex-stretch {
	align-items: stretch;
}

.flex-center {
	align-items: center;
}

.flex-start {
	align-items: flex-start;
}

.flex-justify {
	justify-content: space-around;
}

.center-contents {
	align-content: center;
}

.elbow-room > * {
	margin: 2px;
	padding: 2px;
}

.buy-convert-op {
	border: solid;
	border-width: 2px;
	border-color: greenyellow;
	color: greenyellow;
}

.buy-op {
	border: solid;
	border-width: 2px;
	border-color: aqua;
	color: aqua;
}

.sell-op {
	border: solid;
	border-width: 2px;
	border-color: red;
	color: red;
}

.sell-convert-op {
	border: solid;
	border-width: 2px;
	border-color: orange;
	color: orange;
}

.overflow-y {
	overflow-y: auto;
}
.overflow-hide {
	overflow: hidden;
}
</style>
