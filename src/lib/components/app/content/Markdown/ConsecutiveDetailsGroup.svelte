<script lang="ts">
	import { decode } from 'html-entities';
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { ChevronUp, ChevronDown, Loader2, Sparkles, CircleCheck } from '@lucide/svelte';

	interface Props {
		id?: string;
		tokens?: Array<{
			summary?: string;
			attributes?: {
				type?: string;
				name?: string;
				done?: string;
				duration?: string;
				embeds?: string;
				arguments?: string;
			};
		}>;
		messageDone?: boolean;
		allowEmbeds?: boolean;
		content?: import('svelte').Snippet;
	}

	let { id = '', tokens = [], messageDone = true, allowEmbeds = true, content }: Props = $props();

	let open = $state(false);

	function parseJSONString(str: string) {
		try {
			return JSON.parse(str);
		} catch (e) {
			return str;
		}
	}

	const toolCallCount = $derived(tokens.filter((t) => t?.attributes?.type === 'tool_calls').length);
	const reasoningCount = $derived(tokens.filter((t) => t?.attributes?.type === 'reasoning').length);
	const hasPending = $derived(
		!messageDone &&
			tokens.some(
				(t) =>
					t?.attributes?.done !== undefined &&
					t?.attributes?.done !== 'false' &&
					t?.attributes?.done !== 'true'
			)
	);

	const codeInterpreterCount = $derived(
		tokens.filter((t) => t?.attributes?.type === 'code_interpreter').length
	);

	const allEmbeds = $derived.by(() => {
		if (!allowEmbeds) return [];

		const result: Array<{ name: string; embed: string; args: string }> = [];
		for (const t of tokens) {
			if (t?.attributes?.type !== 'tool_calls') continue;
			const raw = decode(t.attributes?.embeds ?? '');
			try {
				const parsed = parseJSONString(raw);
				if (Array.isArray(parsed) && parsed.length > 0) {
					for (const embed of parsed) {
						result.push({
							name: t.attributes?.name ?? '',
							embed,
							args: decode(t.attributes?.arguments ?? '')
						});
					}
				}
			} catch {}
		}
		return result;
	});

	const summaryText = $derived.by(() => {
		const parts: string[] = [];

		if (toolCallCount > 0) {
			const nameCounts: Record<string, number> = {};
			tokens
				.filter((t) => t?.attributes?.type === 'tool_calls')
				.forEach((t) => {
					const name = t?.attributes?.name ?? 'tool';
					nameCounts[name] = (nameCounts[name] || 0) + 1;
				});

			const toolParts = Object.entries(nameCounts).map(([name, count]) =>
				count > 1 ? `${count} ${name}` : name
			);
			parts.push(...toolParts);
		}

		if (codeInterpreterCount > 0) {
			if (codeInterpreterCount === 1) {
				parts.push(`Ran ${codeInterpreterCount} analysis`);
			} else {
				parts.push(`Ran ${codeInterpreterCount} analyses`);
			}
		}

		return parts.join(', ');
	});

	const prefixText = $derived(hasPending ? 'Exploring' : 'Explored');
</script>

<div {id} class="w-full">
	<button
		class="w-fit text-left text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer"
		aria-label="Toggle details"
		aria-expanded={open}
		onclick={() => {
			open = !open;
		}}
	>
		<div class="flex items-center gap-1.5">
			<!-- Status icon -->
			{#if hasPending}
				<div>
					<Loader2 class="size-4 animate-spin" />
				</div>
			{:else if toolCallCount > 0}
				<div class="text-emerald-500 dark:text-emerald-400">
					<CircleCheck class="size-4" strokeWidth="2" />
				</div>
			{:else}
				<div class="text-gray-400 dark:text-gray-500">
					<Sparkles class="size-3.5" />
				</div>
			{/if}

			<!-- Summary text -->
			<div class="flex-1 line-clamp-1">
				<span class="text-gray-600 dark:text-gray-300 {hasPending ? 'animate-pulse' : ''}"
					>{prefixText}</span
				>
				{#if summaryText}
					<span class="text-gray-400 dark:text-gray-500"> {summaryText}</span>
				{/if}
			</div>

			<!-- Chevron -->
			<div class="flex shrink-0 self-center text-gray-400 dark:text-gray-500">
				{#if open}
					<ChevronUp class="size-3" strokeWidth="3" />
				{:else}
					<ChevronDown class="size-3" strokeWidth="3" />
				{/if}
			</div>
		</div>
	</button>

	{#if open}
		<div transition:slide={{ duration: 300, easing: quintOut, axis: 'y' }}>
			<div class="mb-0.5 space-y-0.5">
				{@render content?.()}
			</div>
		</div>
	{/if}

	{#if allEmbeds.length > 0}
		{#each allEmbeds as embedItem, idx}
			<div id={`${id}-embed-${idx}`}>
				<iframe
					src={embedItem.embed}
					title={embedItem.name}
					class="w-full h-80 rounded-lg border border-border mt-2"
					sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
				></iframe>
			</div>
		{/each}
	{/if}
</div>
