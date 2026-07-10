<script lang="ts">
	import { ArrowUp, AudioLines } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';

	interface Props {
		canSend?: boolean;
		disabled?: boolean;
		showErrorState?: boolean;
		tooltipLabel?: string;
		isVoiceMode?: boolean;
		onclickVoiceMode?: () => void;
	}

	let {
		canSend = false,
		disabled = false,
		showErrorState = false,
		tooltipLabel,
		isVoiceMode = false,
		onclickVoiceMode
	}: Props = $props();

	let isDisabled = $derived(disabled || (!isVoiceMode && !canSend));
</script>

{#snippet submitButton(props = {})}
	<Button
		type={isVoiceMode ? 'button' : 'submit'}
		disabled={isDisabled}
		onclick={(e) => {
			if (isVoiceMode) {
				e.preventDefault();
				onclickVoiceMode?.();
			}
		}}
		class={[
			'md:h-8 md:w-8 h-9 w-9 rounded-lg p-0',
			showErrorState &&
				'bg-red-400/10 text-red-400 hover:bg-red-400/20 hover:text-red-400 disabled:opacity-100'
		]}
		{...props}
	>
		<span class="sr-only">{isVoiceMode ? 'Voice Mode' : 'Send'}</span>
		{#if isVoiceMode}
			<AudioLines class="h-4 w-4" />
		{:else}
			<ArrowUp class="h-12 w-12" />
		{/if}
	</Button>
{/snippet}

{#if tooltipLabel}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{@render submitButton()}
		</Tooltip.Trigger>

		<Tooltip.Content>
			<p>{tooltipLabel}</p>
		</Tooltip.Content>
	</Tooltip.Root>
{:else}
	{@render submitButton()}
{/if}
