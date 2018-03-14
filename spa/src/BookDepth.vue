<template>
<!-- <div class="flex-grow"> -->
	<div v-if="book" class="flex-grow flex-col">
		<div class="flex-grow overflow-hide">
			<div class="flex-col-reverse">
				<div v-for="askLevel in book.askLevels"
					:key="askLevel.price"
					class="flex-row">
					<div class="depth-cell">
						<div class="ask-depth"
							v-bind:style="{width: `${getDepth(askLevel.size)}%`}">
						</div>
					</div>
					<div class="ask price-cell flex-grow">{{askLevel.price}}</div>
					<div class="ask size-cell flex-grow">{{askLevel.size}}</div>
				</div>
			</div>
		</div>
		<!-- <div>LTP: {{book.lastPrice}}</div> -->
		<div class="flex-grow overflow-hide">
			<div class="flex-col">
				<div v-for="bidLevel in book.bidLevels"
					class="flex-row"
					:key="bidLevel.price">
					<div class="depth-cell">
						<div class="bid-depth" v-bind:style="{width: `${getDepth(bidLevel.size)}%`}"></div>
					</div>
					<div class="bid price-cell flex-grow">{{bidLevel.price}}</div>
					<div class="bid size-cell flex-grow">{{bidLevel.size}}</div>
				</div>
			</div>
		</div>
	</div>
<!-- </div> -->
</template>

<script lang="ts">
export default {
	props: ["book"],
	methods: {
		getDepth(size: number) {
			const percent = Math.floor(size / Math.max(this.book.stats.maxBid, this.book.stats.maxAsk) * 100);
			return percent;
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
	width: 50px;
	/* background: #cccccc; */
	/* position: relative; */
}
.price-cell {
	width: 100px;
}
.size-cell {
	width: 100px;
}
.trades-cell {
	width: 50px;
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
</style>
