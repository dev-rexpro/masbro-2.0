<script lang="ts">
	interface Props {
		noteId: string;
		href: string;
	}

	let { noteId, href }: Props = $props();
</script>

<a
	class="inline-block border border-border px-2 py-0.5 rounded text-xs bg-muted/30"
	{href}
	target="_blank"
>
	Note: {noteId}
</a>
