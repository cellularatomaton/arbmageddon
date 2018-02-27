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
import { Graph, GraphParameters as GraphProps } from "../../common/markets/graph";

export default Vue.extend({
	name: "dashboard",
	components: {
		"execution-operation": ExecutionOperation,
		"graph-parameters": GraphParameters,
		"multi-chart": MultiChart,
		"spread-list": SpreadList,
		"selected-spread": SelectedSpread
	},
	data() {
		return {
			ws: new WebSocket("ws://localhost:8080/"),
			directArbs: [ArbType.MakerDirect, ArbType.TakerDirect],
			originConversions: [ArbType.MakerOriginConversion, ArbType.TakerOriginConversion],
			destinationConversions: [ArbType.MakerDestinationConversion, ArbType.TakerDestinationConversion],
			exchMap: {},
			arbMap: {},
			arbList: [],
			selectedSpread: undefined,
			multichartsUrl:
				"https://www.multicoincharts.com/?chart=ETHBTC&chart=XRPETH&chart=XRPBTC&chart=XRPBTC/XRPETH-ETHBTC",
			showCrossExchange: false,
			showSameExchange: true,
			showDirect: true,
			showConversion: true,
			symbolFilter: "SYM",
			basisSize: 0,
			spreadTarget: 0
		};
	},
	mounted() {
		const dash = this;
		dash
			.getExchanges()
			.then(() => {
				return dash.setupWebsocket();
			})
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
				})
			);
		},
		setGraphProperties(props: GraphProps) {
			this.basisSize = props.basisSize;
			this.spreadTarget = props.spreadTarget;
		},
		getExchanges() {
			const dash = this;
			return new Promise(function(resolve, reject) {
				axios.get("http://localhost:3000/graph/exchanges").then(
					function(response: any) {
						dash.exchMap = response.data.reduce((map: any, exch: any) => {
							map[exch.id] = exch.name;
							return map;
						}, {});
						resolve();
					},
					(response: any) => {
						reject();
					}
				);
			});
		},
		getFilteredArbs() {
			const dash = this;
			if (dash) {
				return dash.arbList
					.filter((spread: SpreadExecution) => {
						const isCrossExchange = spread.buy.exchange !== spread.sell.exchange;
						const crossExchangePasses = dash.showCrossExchange && isCrossExchange;
						const sameExchangePasses = dash.showSameExchange && !isCrossExchange;
						const isDirect = dash.directArbs.includes(spread.type);
						const directPasses = dash.showDirect && isDirect;
						const isConversion = !isDirect;
						const conversionPasses = dash.showConversion && isConversion;
						return (crossExchangePasses || sameExchangePasses) && (directPasses || conversionPasses);
					})
					.slice(0, 30);
			} else {
				return [];
			}
		},
		getCoinigySymbol(op: Operation) {
			return `${op.exchange}:${op.market}${op.hub}`;
		},
		getMccQueryString(spread: SpreadExecution) {
			if (spread) {
				const buy = this.getCoinigySymbol(spread.buy);
				const sell = this.getCoinigySymbol(spread.sell);
				if (this.directArbs.includes(spread.type)) {
					// Buy Spread
					return `?chart=${buy}&chart=${sell}&chart=${sell}-${buy}`;
				} else if (spread.convert) {
					// Conversion
					const convert = this.getCoinigySymbol(spread.convert);
					if (this.originConversions.includes(spread.type)) {
						// Origin Conversion
						return `?chart=${buy}&chart=${sell}&chart=${convert}&chart=${sell}-${buy}*${convert}`;
					} else if (this.destinationConversions.includes(spread.type)) {
						// Destination Conversion
						return `?chart=${buy}&chart=${sell}&chart=${convert}&chart=${sell}*${convert}-${buy}`;
					}
				}
			}
			return null;
		},
		setMulticharts(spread: SpreadExecution) {
			const dash = this;
			if (spread) {
				const queryString = this.getMccQueryString(spread);
				this.multichartsUrl = `https://www.multicoincharts.com/${queryString}`;
				spread.selected = true;
				if (this.selectedSpread && this.selectedSpread.selected) {
					this.selectedSpread.selected = false;
				}
				this.selectedSpread = spread;
			}
		},
		sortLoop() {
			this.arbList.sort(function(a: SpreadExecution, b: SpreadExecution) {
				return b.basisPerMinute - a.basisPerMinute;
			});
			setTimeout(this.sortLoop, 1000);
		},
		updateArb(update: SpreadExecution) {
			// console.dir(update);
			if (update && update.spread && update.id) {
				update.basisPerMinute = (update.spreadsPerMinute || Number.NaN) * update.spread;
				const arb = this.arbMap[update.id];
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
					this.arbMap[update.id] = update;
					this.arbList.push(update);
				}
				// console.dir(arb);
				if (!this.selectedSpread) {
					this.setMulticharts(this.arbList[0]);
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
