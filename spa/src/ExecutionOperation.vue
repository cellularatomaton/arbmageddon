<template>
	<div class="flex-col elbow-room ">
		<div class="center-contents">
			<strong v-if="side === 'buy'">{{ title }}: [{{ operation.exchange }}] {{ operation.market }} / {{ operation.hub }}</strong>
			<strong v-else>{{ title }}: [{{ operation.exchange }}] {{ operation.market }} / {{ operation.hub }}</strong>
		</div>
		<div class="flex-grow flex-row flex-wrap flex-stretch">
			<div class="flex-grow">
				<span>VWAP</span>
				<span>{{ operation.price.toFixed(8) }}</span>
			</div>
		</div>
		<div class="flex-grow flex-row flex-wrap flex-stretch">
			<div class="flex-grow">
				<span>Market Size: </span>
				<span>{{ operation.size.toFixed(8) }}</span>
			</div>
			<div class="flex-grow">
				<span>Hub Size: </span>
				<span>{{ operation.hubSize.toFixed(8) }}</span>
			</div>
			<div class="flex-grow">
				<span>Basis Size: </span>
				<span>{{ operation.basisSize.toFixed(8) }}</span>
			</div>
		</div>
		<div class="flex-grow flex-row flex-wrap flex-stretch">
			<div class="flex-grow">
				<span>Hub Position</span>
				<span>{{ operation.position }}</span>
			</div>
			<div class="flex-grow">
				<span>Market Position</span>
				<span>{{ operation.position }}</span>
			</div>
			<div class="flex-grow">
				<span>Basis Position</span>
				<span>{{ operation.position }}</span>
			</div>
		</div>
		<button>Execute!</button>
	</div>
</template>

<script>
export default {
  props: ["title", "side", "operation"]
};
</script>

<style scoped>

</style>
