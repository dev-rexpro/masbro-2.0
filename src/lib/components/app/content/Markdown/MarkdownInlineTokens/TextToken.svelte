<script lang="ts">
	interface Props {
		token: any;
		done?: boolean;
	}

	let { token, done = true }: Props = $props();
</script>

{#if done}
	{token?.raw}
{:else}
	{#each (token?.raw ?? '').split(' ') as text}
		<span class="fade-in-token">
			{text}{' '}
		</span>
	{/each}
{/if}
