<script lang="ts">
	import DOMPurify from 'dompurify';
	import type { Token } from 'marked';
	import { goto } from '$app/navigation';

	import KatexRenderer from './KatexRenderer.svelte';
	import Source from './Source.svelte';
	import HtmlToken from './HTMLToken.svelte';
	import TextToken from './MarkdownInlineTokens/TextToken.svelte';
	import CodespanToken from './MarkdownInlineTokens/CodespanToken.svelte';
	import MentionToken from './MarkdownInlineTokens/MentionToken.svelte';
	import NoteLinkToken from './MarkdownInlineTokens/NoteLinkToken.svelte';
	import SourceToken from './SourceToken.svelte';
	import MarkdownInlineTokens from './MarkdownInlineTokens.svelte';

	interface Props {
		id: string;
		done?: boolean;
		tokens: Token[];
		sourceIds?: string[];
		onSourceClick?: (id: string) => void;
	}

	let { id, done = true, tokens = [], sourceIds = [], onSourceClick = () => {} }: Props = $props();

	const unescapeHtml = (str: string) =>
		str
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'");

	/**
	 * Check if a URL is a same-origin note link and return the note ID if so.
	 */
	const getNoteIdFromHref = (href: string): string | null => {
		try {
			const url = new URL(href, window.location.origin);
			if (url.origin === window.location.origin) {
				const match = url.pathname.match(/^\/notes\/([^/]+)$/);
				if (match) {
					return match[1];
				}
			}
		} catch {
			// Invalid URL
		}
		return null;
	};

	/**
	 * Handle link clicks - intercept same-origin app URLs for in-app navigation
	 */
	const handleLinkClick = (e: MouseEvent, href: string) => {
		try {
			const url = new URL(href, window.location.origin);
			// Check if same origin and an in-app route
			if (
				url.origin === window.location.origin &&
				(url.pathname.startsWith('/notes/') ||
					url.pathname.startsWith('/c/') ||
					url.pathname.startsWith('/channels/'))
			) {
				e.preventDefault();
				goto(url.pathname + url.search + url.hash);
			}
		} catch {
			// Invalid URL, let browser handle it
		}
	};
</script>

{#each tokens as token, tokenIdx (tokenIdx)}
	{#if token.type === 'escape'}
		{unescapeHtml(token.text)}
	{:else if token.type === 'html'}
		<HtmlToken {id} {token} />
	{:else if token.type === 'link'}
		{@const noteId = getNoteIdFromHref(token.href)}
		{#if noteId}
			<NoteLinkToken {noteId} href={token.href} />
		{:else if token.tokens}
			<a
				href={token.href}
				target="_blank"
				rel="nofollow"
				title={token.title}
				onclick={(e) => handleLinkClick(e, token.href)}
			>
				<MarkdownInlineTokens id={`${id}-a`} tokens={token.tokens} {onSourceClick} {done} />
			</a>
		{:else}
			<a
				href={token.href}
				target="_blank"
				rel="nofollow"
				title={token.title}
				onclick={(e) => handleLinkClick(e, token.href)}>{token.text}</a
			>
		{/if}
	{:else if token.type === 'image'}
		<img class="max-w-full h-auto rounded-lg my-2" src={token.href} alt={token.text} />
	{:else if token.type === 'strong'}
		<strong><MarkdownInlineTokens id={`${id}-strong`} tokens={token.tokens} {onSourceClick} /></strong>
	{:else if token.type === 'em'}
		<em><MarkdownInlineTokens id={`${id}-em`} tokens={token.tokens} {onSourceClick} /></em>
	{:else if token.type === 'codespan'}
		<CodespanToken {token} {done} />
	{:else if token.type === 'br'}
		<br />
	{:else if token.type === 'del'}
		<del><MarkdownInlineTokens id={`${id}-del`} tokens={token.tokens} {onSourceClick} /></del>
	{:else if token.type === 'inlineKatex'}
		{#if token.text}
			<KatexRenderer content={token.text} displayMode={(token as any)?.displayMode ?? false} />
		{/if}
	{:else if token.type === 'iframe'}
		<iframe
			src="/api/v1/files/{(token as any).fileId}/content"
			title={(token as any).fileId}
			style="width: 100%; border: 0;"
			onload={(e) => {
				try {
					const el = e.currentTarget as HTMLIFrameElement;
					el.style.height = (el.contentWindow?.document.body.scrollHeight ?? 300) + 20 + 'px';
				} catch {}
			}}
		></iframe>
	{:else if token.type === 'mention'}
		<MentionToken {token} />
	{:else if token.type === 'footnote'}
		{@html DOMPurify.sanitize(
			`<sup class="footnote-ref footnote-ref-text">${(token as any).escapedText}</sup>`
		) || ''}
	{:else if token.type === 'citation'}
		{#if (sourceIds ?? []).length > 0}
			<SourceToken {id} {token} {sourceIds} onClick={onSourceClick} />
		{:else}
			<TextToken {token} {done} />
		{/if}
	{:else if token.type === 'text'}
		<TextToken {token} {done} />
	{/if}
{/each}
