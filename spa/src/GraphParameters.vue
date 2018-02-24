<template>
<div class="flex-col flex-grow">
	<div>
		<span>Basis Size (BTC): </span>
		<input v-model="basisSize" type="number" min="0.001" max="10" step="0.001">
	</div>
	<div>
		<span>Spread Target (%): </span>
		<input v-model="spreadTarget" type="number" min="2" max="20" step="0.5">
	</div>
</div>
</template>

<script>
export default {
  props: ["basisSize", "spreadTarget"]
};
</script>

<style>

</style>
