<script lang="ts" module>
	import { marked, type Token } from 'marked';
	import { Info, Lightbulb, Star, AlertTriangle, CircleAlert } from '@lucide/svelte';
	import type { Component } from 'svelte';

	type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

	interface AlertTheme {
		border: string;
		text: string;
		icon: Component;
	}

	export interface AlertData {
		type: AlertType;
		text: string;
		tokens: Token[];
	}

	const alertStyles: Record<AlertType, AlertTheme> = {
		NOTE: {
			border: 'border-sky-500',
			text: 'text-sky-500',
			icon: Info
		},
		TIP: {
			border: 'border-emerald-500',
			text: 'text-emerald-500',
			icon: Lightbulb
		},
		IMPORTANT: {
			border: 'border-purple-500',
			text: 'text-purple-500',
			icon: Star
		},
		WARNING: {
			border: 'border-yellow-500',
			text: 'text-yellow-500',
			icon: AlertTriangle
		},
		CAUTION: {
			border: 'border-rose-500',
			text: 'text-rose-500',
			icon: CircleAlert
		}
	};

	export function alertComponent(token: Token): AlertData | false {
		const regExpStr = `^(?:\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\\])\\s*?\\n*`;
		const regExp = new RegExp(regExpStr);
		const matches = (token as any).text?.match(regExp);

		if (matches && matches.length) {
			const alertType = matches[1] as AlertType;
			const newText = (token as any).text.replace(regExp, '');
			const newTokens = marked.lexer(newText);
			return {
				type: alertType,
				text: newText,
				tokens: newTokens
			};
		}
		return false;
	}
</script>

<script lang="ts">
	import MarkdownTokens from './MarkdownTokens.svelte';

	interface Props {
		token: Token;
		alert: AlertData;
		id?: string;
		tokenIdx?: number;
		onTaskClick?: (data: any) => void;
		onSourceClick?: (id: string) => void;
	}

	let { alert, id = '', tokenIdx = 0, onTaskClick, onSourceClick }: Props = $props();

	const theme = $derived(alertStyles[alert.type]);
	const IconComponent = $derived(theme.icon);
</script>

<div class={`border-l-4 pl-2.5 ${theme.border} my-0.5`}>
	<div class="{theme.text} items-center flex gap-1 py-1.5">
		<IconComponent class="inline-block size-4" />
		<span class=" font-medium">{alert.type}</span>
	</div>
	<div class="pb-2">
		<MarkdownTokens id={`${id}-${tokenIdx}`} tokens={alert.tokens} {onTaskClick} {onSourceClick} />
	</div>
</div>
