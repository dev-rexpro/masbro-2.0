<script lang="ts">
	interface Props {
		token: any;
	}

	let { token }: Props = $props();

	const triggerChar = $derived(token?.triggerChar ?? '@');
	const label = $derived(token?.label ?? token?.id ?? '');
</script>

<span class="mention">
	{triggerChar}{label}
</span>
