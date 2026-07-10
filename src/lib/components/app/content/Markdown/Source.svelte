<script lang="ts">
	interface Props {
		id: string;
		title?: string;
		onClick?: (id: string) => void;
	}

	let { id, title = 'N/A', onClick = () => {} }: Props = $props();

	// Helper function to return only the domain from a URL
	function getDomain(url: string): string {
		const domain = url.replace('http://', '').replace('https://', '').split(/[/?#]/)[0];

		if (domain.startsWith('www.')) {
			return domain.slice(4);
		}
		return domain;
	}

	const getDisplayTitle = (titleText: string) => {
		if (!titleText) return 'N/A';
		if (titleText.length > 30) {
			return titleText.slice(0, 15) + '...' + titleText.slice(-10);
		}
		return titleText;
	};

	// Helper function to check if text is a URL and return the domain
	function formattedTitle(titleText: string): string {
		if (titleText.startsWith('http')) {
			return getDomain(titleText);
		}

		return titleText;
	}

	function decodeString(str: string): string {
		try {
			return decodeURIComponent(str);
		} catch (e) {
			return str;
		}
	}

	const titleDecoded = $derived(formattedTitle(decodeString(title)));
</script>

{#if title !== 'N/A'}
	<button
		aria-label={`View source: ${titleDecoded}`}
		class="text-[10px] w-fit translate-y-[2px] px-2 py-0.5 dark:bg-white/5 dark:text-white/80 dark:hover:text-white bg-gray-50 text-black/80 hover:text-black transition rounded-xl"
		onclick={() => {
			onClick(id);
		}}
	>
		<span class="line-clamp-1">
			{getDisplayTitle(titleDecoded)}
		</span>
	</button>
{/if}
