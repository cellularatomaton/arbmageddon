<template>
<div>
	<div class="flex-col elbow-room ">
		<div>
			<strong v-if="side === 'buy'">{{ title }}: [{{ operation.exchange }}] {{ operation.market }} / {{ operation.hub }}</strong>
			<strong v-else>{{ title }}: [{{ operation.exchange }}] {{ operation.market }} / {{ operation.hub }}</strong>
		</div>
		<div>
			<div class="flex-row">
				<div>VWAP</div>
				<div>{{ operation.price.toFixed(8) }}</div>
			</div>
		</div>
		<div>
			<div class="flex-row flex-wrap">
				<div>
					<div>Market Size: {{ operation.size.toFixed(8) }}</div>
				</div>
				<div>
					<div>Hub Size: {{ operation.hubSize.toFixed(8) }}</div>
				</div>
				<div>
					<div>Basis Size: {{ operation.basisSize.toFixed(8) }}</div>
				</div>
			</div>
		</div>
		<div>
			<div class="flex-row flex-wrap">
				<div>
					<div>Hub Position: {{ operation.position }}</div>
				</div>
				<div>
					<div>Market Position: {{ operation.position }}</div>
				</div>
				<div>
					<div>Basis Position: {{ operation.position }}</div>
				</div>
			</div>
		</div>
	</div>
</div>
</template>

<script>
export default {
	props: ["title", "side", "operation"]
};
</script>

<style scoped>

</style>
