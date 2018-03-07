<template>
	<div class="app-container flex-row elbow-room">
		<spread-list :dash="this"></spread-list>
		<div class="flex-grow flex-col">
			<div class="flex-row flex-stretch elbow-room">
				<execution-operation
					v-if="selectedSpread && originConversions.includes(selectedSpread.type)" 
					side="buy" class="buy-convert-op flex-grow"
				 	title="Buy Convert"
					:operation="selectedSpread.convert"></execution-operation>
				<execution-operation
					v-if="selectedSpread"
					side="buy"
					class="buy-op flex-grow"
					title="Buy"
					:operation="selectedSpread ? selectedSpread.buy : null"></execution-operation>
				<execution-operation 
					v-if="selectedSpread"
					side="sell"
					class="sell-op flex-grow"
					title="Sell"
					:operation="selectedSpread ? selectedSpread.sell: null"></execution-operation>
				<execution-operation
					v-if="selectedSpread && destinationConversions.includes(selectedSpread.type)"
					side="sell"
					class="sell-convert-op flex-grow"
					title="Sell Convert"
					:operation="selectedSpread.convert"></execution-operation>
			</div>
			<selected-spread
				:basis-size="basisSize"
				:spread-target="spreadTarget"
				:selected-spread="selectedSpread"></selected-spread>
			<multi-chart :multicharts-url="multichartsUrl"></multi-chart>
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
import { ArbType } from "../../common/utils/enums";
import { SpreadExecution, ExecutionOperation as Operation } from "../../common/strategies/arbitrage";
import { Graph, GraphParameters as GraphProps, WebsocketMessage } from "../../common/markets/graph";
import { BookSnapshot } from "../../common/markets/book";

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
	selectedSpread: SpreadListItem;
	originConversionBook: BookSnapshot;
	originBook: BookSnapshot;
	destinationBook: BookSnapshot;
	destinationConversionBook: BookSnapshot;
	showCrossExchange: boolean;
	showSameExchange: boolean;
	showDirect: boolean;
	showConversion: boolean;
	sortArbsAscending: boolean;
	basisSize: number;
	spreadTarget: number;
}

export default Vue.extend({
	name: "dashboard",
	components: {
		"execution-operation": ExecutionOperation,
		"graph-parameters": GraphParameters,
		"multi-chart": MultiChart,
		"spread-list": SpreadList,
		"selected-spread": SelectedSpread
	},
	data(): DashboardModel {
		return {
			ws: new WebSocket("ws://localhost:8081/"),
			directArbs: [ArbType.MakerDirect, ArbType.TakerDirect],
			originConversions: [ArbType.MakerOriginConversion, ArbType.TakerOriginConversion],
			destinationConversions: [ArbType.MakerDestinationConversion, ArbType.TakerDestinationConversion],
			exchMap: undefined,
			arbMap: new Map<string, SpreadListItem>(),
			arbList: [],
			selectedSpread: undefined,
			originConversionBook: undefined,
			originBook: undefined,
			destinationBook: undefined,
			destinationConversionBook: undefined,
			showCrossExchange: false,
			showSameExchange: true,
			showDirect: true,
			showConversion: true,
			basisSize: 0,
			spreadTarget: 0,
			sortArbsAscending: false
		};
	},
	mounted() {
		const dash = this;
		dash
			// .getExchanges()
			// .then(() => {
			// 	return dash.setupWebsocket();
			// })
			dash.setupWebsocket()
			.then(() => {
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
					type: "params",
					data: {
						basisSize: dash.basisSize,
						spreadTarget: dash.spreadTarget
					}
				} as WebsocketMessage<GraphProps>)
			);
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
		// getCoinigySymbol(op: Operation) {
		// 	return `${op.exchange}:${op.market}${op.hub}`;
		// },
		// getMccQueryString(spread: SpreadListItem) {
		// 	if (spread) {
		// 		const buy = this.getCoinigySymbol(spread.buy);
		// 		const sell = this.getCoinigySymbol(spread.sell);
		// 		if (this.directArbs.includes(spread.type)) {
		// 			// Buy Spread
		// 			return `?chart=${buy}&chart=${sell}&chart=${sell}-${buy}`;
		// 		} else if (spread.convert) {
		// 			// Conversion
		// 			const convert = this.getCoinigySymbol(spread.convert);
		// 			if (this.originConversions.includes(spread.type)) {
		// 				// Origin Conversion
		// 				return `?chart=${buy}&chart=${sell}&chart=${convert}&chart=${sell}-${buy}*${convert}`;
		// 			} else if (this.destinationConversions.includes(spread.type)) {
		// 				// Destination Conversion
		// 				return `?chart=${buy}&chart=${sell}&chart=${convert}&chart=${sell}*${convert}-${buy}`;
		// 			}
		// 		}
		// 	}
		// 	return null;
		// },
		// setMulticharts(spread: SpreadListItem) {
		// 	const dash = this;
		// 	if (spread) {
		// 		const queryString = this.getMccQueryString(spread);
		// 		this.multichartsUrl = `https://www.multicoincharts.com/${queryString}`;
		// 		spread.selected = true;
		// 		if (this.selectedSpread && this.selectedSpread.selected) {
		// 			this.selectedSpread.selected = false;
		// 		}
		// 		this.selectedSpread = spread;
		// 	}
		// },
		selectSpread(spread: SpreadListItem) {
			const dash = this;
			if(this.selectedSpread){
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
			if(spread.convert) {
				this.subscribe(this.getSubscriptionData(spread.convert, SubscriptionType.Book));
			}
		},
		unsubscribeFromBooks(spread: SpreadListItem) {
			this.subscribe(this.getSubscriptionData(spread.buy, SubscriptionType.Book));
			this.subscribe(this.getSubscriptionData(spread.sell, SubscriptionType.Book));
			if(spread.convert) {
				this.subscribe(this.getSubscriptionData(spread.convert, SubscriptionType.Book));
			}
		},
		subscribe(data: SubscriptionData){
			const dash = this;
			dash.ws.send(
				JSON.stringify({
					action: "subscribe",
					type: "book",
					data
				} as WebsocketMessage<SubscriptionData>)
			);
		},
		unsubscribe(data: SubscriptionData){
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
		sortLoop() {
			const dash = this;
			dash.arbList.sort(function(a: SpreadListItem, b: SpreadListItem) {
				if (dash.sortArbsAscending) {
					return a.basisPerMinute - b.basisPerMinute;
				} else {
					return b.basisPerMinute - a.basisPerMinute;
				}
			});
			setTimeout(this.sortLoop, 1000);
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

				dash.ws.onmessage = function(message) {
					const msg = JSON.parse(message.data);
					if (msg.type === "arb" && msg.action === "update") {
						dash.updateArb(msg.data);
					} else if (msg.type === "params" && msg.action === "set") {
						dash.setGraphProperties(msg.data);
						console.log("Set graph params.");
					}
				};

				dash.ws.onopen = function() {
					console.log("App Websocket opened.");
					dash.ws.send(
						JSON.stringify({
							type: "params",
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
</style>
