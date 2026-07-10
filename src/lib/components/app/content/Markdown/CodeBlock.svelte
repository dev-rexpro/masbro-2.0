<script lang="ts">
	import hljs from 'highlight.js';
	import { Copy, Check } from '@lucide/svelte';
	import { copyToClipboard } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	interface Props {
		id: string;
		code: string;
		lang?: string;
		collapsed?: boolean;
		edit?: boolean;
	}

	let { code, lang = 'text', collapsed = false }: Props = $props();

	let copied = $state(false);
	let isCollapsed = $state(collapsed);

	$effect(() => {
		isCollapsed = collapsed;
	});

	const highlightedHtml = $derived.by(() => {
		if (!code) return '';
		try {
			const cleanLang = lang.toLowerCase();
			if (cleanLang && hljs.getLanguage(cleanLang)) {
				return hljs.highlight(code, { language: cleanLang }).value;
			}
			return hljs.highlightAuto(code).value;
		} catch {
			return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		}
	});

	const copyCode = async () => {
		copied = true;
		await copyToClipboard(code);
		toast.success('Copied code to clipboard');
		setTimeout(() => {
			copied = false;
		}, 1000);
	};
</script>

<div
	class="code-block-wrapper my-4 rounded-xl border border-border bg-code-background overflow-hidden shadow-sm relative {isCollapsed
		? 'h-10!'
		: ''}"
>
	<div
		class="code-block-header flex items-center justify-between px-4 py-2 border-b border-border/10 bg-muted/20 text-xs"
	>
		<span class="code-language font-mono font-bold uppercase text-muted-foreground"
			>{lang || 'text'}</span
		>
		<div class="flex items-center gap-2">
			<button
				class="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
				onclick={() => (isCollapsed = !isCollapsed)}
				type="button"
			>
				{isCollapsed ? 'Expand' : 'Collapse'}
			</button>
			<button
				class="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md flex items-center gap-1"
				onclick={copyCode}
				type="button"
			>
				{#if copied}
					<Check class="h-3.5 w-3.5 text-green-500" />
				{:else}
					<Copy class="h-3.5 w-3.5" />
				{/if}
				<span>{copied ? 'Copied' : 'Copy'}</span>
			</button>
		</div>
	</div>

	{#if !isCollapsed}
		<div class="code-block-scroll-container overflow-auto p-4 text-sm leading-relaxed max-h-[60vh]">
			<pre class="m-0 bg-transparent! p-0! border-0!"><code
					class="hljs bg-transparent! p-0! font-mono">{@html highlightedHtml}</code
				></pre>
		</div>
	{/if}
</div>
