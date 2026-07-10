<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { createAutoScrollController } from '$lib/hooks/use-auto-scroll.svelte';
	import { useThrottle } from '$lib/hooks/use-throttle.svelte';
	import { formatReasoningPreview } from '$lib/utils';
	import { config } from '$lib/stores/settings.svelte';
	import type { Snippet } from 'svelte';
	import type { Component } from 'svelte';

	interface Props {
		open?: boolean;
		class?: string;
		icon?: Component;
		iconClass?: string;
		title: string;
		subtitle?: string;
		preview?: string;
		rawContent?: string;
		isStreaming?: boolean;
		onToggle?: () => void;
		classContent?: string;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		class: className = '',
		icon: IconComponent,
		iconClass = 'h-4 w-4',
		title,
		subtitle,
		preview,
		rawContent,
		isStreaming = false,
		onToggle,
		classContent = 'whitespace-pre-wrap break-words leading-8',
		children
	}: Props = $props();

	let contentContainer: HTMLDivElement | undefined = $state();

	const showThoughtInProgress = $derived(config().showThoughtInProgress as boolean);

	let previewKey = useThrottle(() => rawContent ?? preview ?? '', 500);
	let displayedPreview = $state('');
	let displayedOverflow = $state(0);

	$effect(() => {
		void previewKey.key;
		const content = rawContent ?? preview ?? '';
		const result = formatReasoningPreview(content);
		displayedPreview = result.preview;
		displayedOverflow = result.overflow;
	});

	const autoScroll = createAutoScrollController();

	$effect(() => {
		autoScroll.setContainer(contentContainer);
	});

	$effect(() => {
		autoScroll.updateInterval(open && isStreaming);
	});

	function handleScroll() {
		autoScroll.handleScroll();
	}
</script>

<Collapsible.Root
	{open}
	onOpenChange={(value) => {
		open = value;
		onToggle?.();
	}}
	class={className}
>
	<Collapsible.Trigger
		class="group flex w-full cursor-pointer items-center gap-1.5 py-1 text-left select-none"
	>
		{#if IconComponent}
			<IconComponent class={iconClass} />
		{/if}

		<div class="flex items-center gap-1.5 min-w-0">
			<span class="truncate text-[15px] font-medium text-muted-foreground">{title}</span>

			{#if subtitle}
				<span class="text-[15px] text-muted-foreground shrink-0">{subtitle}</span>
			{/if}

			<div class="transition-transform duration-200 shrink-0" class:rotate-180={open}>
				<ChevronDown class="h-4 w-4 text-muted-foreground" />
			</div>
		</div>
	</Collapsible.Trigger>

	{#if displayedPreview && !open}
		<div class="text-[13px] text-muted-foreground mt-0.5 line-clamp-1">
			{displayedPreview}
		</div>
	{/if}

	<Collapsible.Content>
		<div
			class="ml-2 mt-3 border-l border-border pl-4"
			bind:this={contentContainer}
			class:overflow-y-auto={open}
			onscroll={handleScroll}
			style="min-height: var(--min-message-height); max-height: var(--max-message-height);"
		>
			<div class={classContent}>
				{@render children()}
			</div>
		</div>
	</Collapsible.Content>
</Collapsible.Root>
