<template>
<!-- <div class="flex-grow"> -->
	<div v-if="book" class="flex-grow flex-col overflow-y">
		<div class="flex-grow">
			<div class="flex-col-reverse">
				<div v-for="(askLevel, index) in book.askLevels"
					:key="askLevel.price"
					class="flex-row">
					<div v-if="index===10" class="scroller"></div>
					<div class="depth-cell">
						<div v-if="!aggregate"
							class="ask-depth"
							v-bind:style="{width: `${getDepth(askLevel.size)}%`}">
						</div>
						<div v-if="aggregate"
							class="ask-depth"
							v-bind:style="{width: `${getAggregateDepth(askLevel.aggregate)}%`}">
						</div>
					</div>
					<div class="ask price-cell flex-grow">{{getDisplayPrice(askLevel.price)}}</div>
					<div v-if="!aggregate" class="ask size-cell flex-grow">{{getDisplaySize(askLevel.size)}}</div>
					<div v-if="aggregate" 
						class="ask size-cell flex-grow">{{getDisplaySize(askLevel.aggregate)}}</div>
					<div class="vwap-cell">
						<div v-if="Number(askLevel.price) === book.buyVwap" 
							class="b-vwap">VWAP</div>
					</div>
				</div>
			</div>
		</div>
		<div>
			<div class="flex-row">
				<div class="depth-cell"
					v-on:click="toggleAggregate()">
					<funnel root-class="icon"
						class="elbow-room">
					</funnel>
				</div>
				<div class="price-cell flex-row">
					<div v-on:click="dash.decreasePricePrecision(book)">
						<remove-circle root-class="icon" 
							class="elbow-room"></remove-circle>
					</div>
					<div v-on:click="dash.increasePricePrecision(book)">
						<add-circle root-class="icon" 
							class="elbow-room"></add-circle>
					</div>
				</div>
				<div class="size-cell flex-row">
					<div v-on:click="dash.decreaseSizePrecision(book)">
						<remove-circle root-class="icon" 
							class="elbow-room"></remove-circle>
					</div>
					<div v-on:click="dash.increaseSizePrecision(book)">
						<add-circle root-class="icon" 
							class="elbow-room"></add-circle>
					</div>
				</div>
			</div>
		</div>
		<div class="flex-grow">
			<div class="flex-col">
				<div v-for="(bidLevel, index) in book.bidLevels"
					class="flex-row"
					:key="bidLevel.price">
					<!-- <div v-if="index===10" class="scroller"></div> -->
					<div class="depth-cell">
						<div v-if="!aggregate" 
							class="bid-depth" 
							v-bind:style="{width: `${getDepth(bidLevel.size)}%`}"></div>
						<div v-if="aggregate" 
							class="bid-depth"
							v-bind:style="{width: `${getAggregateDepth(bidLevel.aggregate)}%`}"></div>
					</div>
					<div class="bid price-cell flex-grow">{{getDisplayPrice(bidLevel.price)}}</div>
					<div v-if="!aggregate" 
						class="bid size-cell flex-grow">{{getDisplaySize(bidLevel.size)}}</div>
					<div v-if="aggregate" 
						class="bid size-cell flex-grow">{{getDisplaySize(bidLevel.aggregate)}}</div>
					<div class="vwap-cell">
						<div v-if="Number(bidLevel.price) === book.sellVwap" 
							class="s-vwap">VWAP</div>
					</div>
				</div>
			</div>
		</div>
	</div>
<!-- </div> -->
</template>

<script lang="ts">
import PlusIcon from "vue-ionicons/dist/ios-add-circle.vue";
import MinusIcon from "vue-ionicons/dist/ios-remove-circle.vue";
import FunnelIcon from "vue-ionicons/dist/ios-funnel.vue";

import { BookSnapshot, BookLevel } from "../../common/markets/book";

export default {
	name: "bookDepth",
	props: ["book", "dash"],
	components: {
		"add-circle": PlusIcon,
		"remove-circle": MinusIcon,
		funnel: FunnelIcon
	},
	data() {
		return {
			aggregate: true
		};
	},
	methods: {
		getDepth(size: number) {
			const percent = Math.floor(size / Math.max(this.book.stats.maxBid, this.book.stats.maxAsk) * 100);
			return percent;
		},
		getAggregateDepth(size: number) {
			const percent = Math.floor(size / Math.max(this.book.stats.totalBids, this.book.stats.totalAsks) * 100);
			return percent;
		},
		toggleAggregate() {
			this.aggregate = !this.aggregate;
		},
		getDisplayPrice(price: string): string {
			return parseFloat(price).toFixed(this.book.stats.pricePrecision);
		},
		getDisplaySize(size: string): string {
			return parseFloat(size).toFixed(this.book.stats.sizePrecision);
		}
	}
};
</script>

<style scoped>
.bid {
	color: aqua;
}
.ask {
	color: red;
}
.depth-cell {
	width: 25%;
	margin-left: 3px;
	/* background: #cccccc; */
	/* position: relative; */
}
.price-cell {
	width: 25%;
	margin-left: 3px;
}
.size-cell {
	width: 25%;
	margin-left: 3px;
}
.vwap-cell {
	width: 25%;
	margin-left: 3px;
}
.b-vwap {
	background: aqua;
	color: black;
}
.s-vwap {
	background: red;
	color: white;
}
.ask-depth {
	background: red;
	/* padding: 5px 0px; */
	/* color: #FFF; */
	/* text-align: center; */
	height: 100%;
}
.bid-depth {
	background: aqua;
	/* padding: 5px 0px; */
	/* color: #FFF; */
	/* text-align: center; */
	height: 100%;
}
.reverse-flow-fix {
	position: sticky;
	bottom: 0px;
}
.depth-controls {
	height: 20px;
}
.icon {
	fill: white;
	cursor: pointer;
}
</style>
