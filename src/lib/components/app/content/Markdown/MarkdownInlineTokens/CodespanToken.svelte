<script lang="ts">
	import { copyToClipboard } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	interface Props {
		token: any;
		done?: boolean;
	}

	let { token, done = true }: Props = $props();

	const unescapeHtml = (str: string) =>
		str
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'");
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<code
	class="codespan cursor-pointer {!done ? 'fade-in-token' : ''}"
	onclick={() => {
		copyToClipboard(unescapeHtml(token.text));
		toast.success('Copied to clipboard');
	}}
	role="cell">{unescapeHtml(token.text)}</code
>
