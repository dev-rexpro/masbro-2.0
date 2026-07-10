<script lang="ts" module>
	import type { renderToString as katexRenderToString } from 'katex';

	// Module-level singleton: load katex once, share across all KatexRenderer instances
	let katexRenderer: Promise<typeof katexRenderToString> | null = null;
	function getKatexRenderer(): Promise<typeof katexRenderToString> {
		if (!katexRenderer) {
			katexRenderer = Promise.all([
				import('katex'),
				// @ts-expect-error - katex mhchem doesn't have declarations
				import('katex/contrib/mhchem'),
				import('katex/dist/katex.min.css')
			]).then(([katex]) => katex.renderToString);
		}
		return katexRenderer;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { copyToClipboard } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	interface Props {
		content: string;
		displayMode?: boolean;
	}

	let { content, displayMode = false }: Props = $props();

	let renderToString = $state<typeof katexRenderToString | null>(null);

	onMount(async () => {
		renderToString = await getKatexRenderer();
	});
</script>

{#if renderToString}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svelte:element
		this={displayMode ? 'div' : 'span'}
		class="cursor-pointer"
		onclick={() => {
			copyToClipboard(content);
			toast.success('Copied to clipboard');
		}}
	>
		{@html renderToString(content, { displayMode, throwOnError: false })}
	</svelte:element>
{/if}
