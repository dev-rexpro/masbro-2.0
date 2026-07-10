<script lang="ts">
	import { customMarked } from '../Markdown/marked-config';
	import MarkdownTokens from '../Markdown/MarkdownTokens.svelte';
	import type { DatabaseMessageExtra } from '$lib/types/database';

	interface Props {
		attachments?: DatabaseMessageExtra[];
		content: string;
		class?: string;
		disableMath?: boolean;
	}

	let { content = '', attachments = [], class: className = '' }: Props = $props();

	// Generate a unique ID for this instance
	const id = $derived(`md-${Math.random().toString(36).substring(2, 9)}`);

	// Extract sourceIds from attachments if available
	const sourceIds: string[] = [];

	// Parse content into tokens using marked
	const tokens = $derived(customMarked.lexer(content));
</script>

<div class="markdown-content prose dark:prose-invert max-w-none break-words {className}" {id}>
	<MarkdownTokens {id} {tokens} {sourceIds} done={true} />
</div>

<style>
	@import './markdown-content.css';
</style>
