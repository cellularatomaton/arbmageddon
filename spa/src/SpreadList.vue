<template>
  <div class="flex-col">
	<div>
		<div class="flex-row">
			<div class="flex-col flex-grow">
				<span>Arb Types:</span>
				<div>
					<input 
						type="checkbox" 
						id="direct-checkbox" 
						value="false" 
						v-model="dash.showDirect">
					<label for="direct-checkbox">Direct</label>
				</div>
				<div>
					<input 
						type="checkbox" 
						id="conversion-checkbox" 
						value="true" 
						v-model="dash.showConversion">
					<label for="conversion-checkbox">Conversion</label>
				</div>
			</div>
			<div class="flex-col flex-grow">
				<span>On Chain:</span>
				<div>
					<input 
						type="checkbox" 
						id="cross-exchange-checkbox" 
						value="false" 
						v-model="dash.showCrossExchange">
					<label for="cross-exchange-checkbox">Cross Exchange</label>
				</div>
				<div>
					<input 
						type="checkbox" 
						id="same-exchange-checkbox" 
						value="true" 
						v-model="dash.showSameExchange">
					<label for="same-exchange-checkbox">Same Exchange</label>
				</div>
			</div>
		</div>
	</div>
	<div class="flex-grow overflow-y arb-list">
		<table class="spread-list">
			<thead>
				<th>Arb</th>
				<th>Spread</th>
				<th>%</th>
				<th>SPM</th>
				<th class="clickable" 
					v-on:click="dash.toggleArbSortDirection()">BPM</th>
			</thead>
			<tbody>
				<tr v-for="spread in dash.getFilteredArbs(dash.arbList)"
					class="clickable"
					:key="spread.id" 
					v-on:click="dash.setMulticharts(spread)" 
					v-bind:class="{ selected: spread.selected }">
					<td class="spread-id">{{ spread.id }}</td>
					<td>{{ spread.spread.toFixed(8) }}</td>
					<td>{{ (spread.spreadPercent * 100).toFixed(2) }}</td>
					<td>{{ spread.spreadsPerMinute }}</td>
					<td>{{ spread.basisPerMinute.toFixed(8) }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</div>
</template>

<script>
export default {
	props: ["dash"]
};
</script>

<style scoped>
td {
	white-space: nowrap;
}

.spread-list {
	width: 600px;
}

.spread-id {
	width: 360px;
}

.selected {
	background-color: aqua;
	color: black;
}

.clickable {
	cursor: pointer;
}
</style>
