<script lang="ts">
	import { copyToClipboard } from '$lib/utils';
	import { Copy, Check } from '@lucide/svelte';
	import MarkdownTokens from './MarkdownTokens.svelte';

	interface Props {
		id?: string;
		token: any;
		tokenIdx?: number;
		done?: boolean;
		editCodeBlock?: boolean;
		sourceIds?: string[];
		onTaskClick?: (data: any) => void;
		onSourceClick?: (id: string) => void;
	}

	let {
		id = '',
		token,
		tokenIdx = 0,
		done = true,
		editCodeBlock = true,
		sourceIds = [],
		onTaskClick = () => {},
		onSourceClick = () => {}
	}: Props = $props();

	const fenceType = $derived(token.fenceType ?? 'default');

	const label = $derived(
		fenceType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
	);

	let copied = $state(false);

	const copyText = async () => {
		copied = true;
		await copyToClipboard(token.text);
		setTimeout(() => {
			copied = false;
		}, 1000);
	};
</script>

<div class="relative group my-2 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3">
	<!-- Header row: type badge + copy button -->
	<div class="flex items-center justify-between mb-2">
		<span class="text-xs font-medium text-gray-500 dark:text-gray-400">
			{label}
		</span>

		<div class="invisible group-hover:visible flex gap-0.5">
			<button
				class="p-1 rounded-lg bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition"
				onclick={(e) => {
					e.stopPropagation();
					copyText();
				}}
				title={copied ? 'Copied' : 'Copy'}
			>
				{#if copied}
					<Check class="h-3.5 w-3.5 text-green-500" />
				{:else}
					<Copy class="h-3.5 w-3.5" />
				{/if}
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="prose-sm" dir="auto">
		<MarkdownTokens
			id={`${id}-${tokenIdx}-cf`}
			tokens={token.tokens}
			{done}
			{editCodeBlock}
			{sourceIds}
			{onTaskClick}
			{onSourceClick}
		/>
	</div>
</div>
