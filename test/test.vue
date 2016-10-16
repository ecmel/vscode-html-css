<style>
	.internal {
		color: red;
	}
	
	.internal-test1 .internal-test2 {
		color: red;
	}
	
	#internal_id {
		color: red;
	}
	
	#internal_id-test1 #internal_id-test2 {
		color: red;
	}
</style>

<template>
	<div id="internal_id" class="internal"></div>
</template>

<script>
  console.log("Hello World!");
</script>