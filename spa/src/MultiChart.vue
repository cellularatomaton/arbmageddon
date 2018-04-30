<template>
	<iframe :src="multichartsUrl" class="flex-grow"></iframe>
</template>

<script>
export default {
	name: "multiChart",
	props: ["multichartsUrl"]
};
</script>

<style>

</style>
