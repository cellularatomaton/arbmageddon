<template>
	<div v-if="selectedSpread" class="spread elbow-room flex-row flex-justify">
		<div>
			<strong>Arb: {{ selectedSpread.id }}</strong>
		</div>
		<div v-bind:class="{ 'arb-good': arbIsGood(selectedSpread), 'arb-bad': !arbIsGood(selectedSpread) }">
			<strong>Spreads Per Minute: {{ selectedSpread.spreadsPerMinute }}</strong>
		</div>
		<div v-bind:class="{ 'arb-good': arbIsGood(selectedSpread), 'arb-bad': !arbIsGood(selectedSpread) }">
			<strong>Basis Per Minute: {{ (selectedSpread.spreadsPerMinute * selectedSpread.spread).toFixed(4) }}</strong>
		</div>
	</div>
</template>

<script>
export default {
  props: ["selectedSpread", "basisSize", "spreadTarget"],
  methods: {
    arbIsGood(spread) {
      if (spread) {
        return 0 < spread.spreadsPerMinute;
      } else {
        return false;
      }
    }
  }
};
</script>

<style scoped>

</style>

