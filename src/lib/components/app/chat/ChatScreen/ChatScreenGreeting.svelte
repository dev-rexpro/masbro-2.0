<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		isEmpty: boolean;
	}

	let { isEmpty = false }: Props = $props();

	const phrases = [
		"What’s on your mind today?",
		"How can I help you today?",
		"What should we create today?"
	];

	let phraseIndex = $state(0);

	onMount(() => {
		if (!isEmpty) return;
		const interval = setInterval(() => {
			phraseIndex = (phraseIndex + 1) % phrases.length;
		}, 4000);
		return () => clearInterval(interval);
	});
</script>

<div
	class={[
		'pointer-events-none mb-4 hidden px-4 text-center text-balance',
		isEmpty && 'mb-[calc(50dvh-8rem)] md:mb-6 pointer-events-auto block!'
	]}
>
	{#if isEmpty}
		<div class="relative h-12 flex items-center justify-center overflow-hidden">
			{#key phraseIndex}
				<h1
					class="animate-in fade-in slide-in-from-bottom-3 duration-1000 text-2xl font-normal tracking-tight md:text-3xl text-foreground"
				>
					{phrases[phraseIndex]}
				</h1>
			{/key}
		</div>
	{/if}
</div>
