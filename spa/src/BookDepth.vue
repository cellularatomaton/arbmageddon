<template>
	<div v-if="book" class="flex-col">
		<div class="flex-col-reverse">
			<div v-for="askLevel in book.askLevels"
				:key="askLevel.price"
				class="flex-row">
				<div class="ask flex-grow">{{askLevel.price}}</div>
				<div class="ask flex-grow">{{askLevel.size}}</div>
			</div>
		</div>
		<div>LTP: {{book.lastPrice}}</div>
		<div class="flex-col">
			<div v-for="bidLevel in book.bidLevels"
				class="flex-row"
				:key="bidLevel.price">
				<div class="bid flex-grow">{{bidLevel.price}}</div>
				<div class="bid flex-grow">{{bidLevel.size}}</div>
			</div>
		</div>
	</div>
</template>

<script>
export default {
	props: ["book"]
};
</script>

<style scoped>
.bid {
	color: aqua;
}
.ask {
	color: red;
}
</style>
