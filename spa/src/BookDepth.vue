<template>
	<div class="flex-col">
		<div class="flex-col-reverse">
			<div v-for="bidLevel in book.bidLevels"
				:key="bidLevel.price">
				<div>{{bidLevel.price}}</div>
				<div>{{bidLevel.size}}</div>
			</div>
		</div>
		<div>LTP: {{book.lastPrice}}</div>
		<div class="flex-col">
			<div v-for="bidLevel in book.bidLevels"
				:key="bidLevel.price">
				<div>{{bidLevel.price}}</div>
				<div>{{bidLevel.size}}</div>
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

</style>
