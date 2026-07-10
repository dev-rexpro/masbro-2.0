<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { File, MessageSquare, Zap, FolderOpen } from '@lucide/svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { TOOLTIP_DELAY_DURATION } from '$lib/constants';
	import { ATTACHMENT_FILE_ITEMS } from '$lib/constants/attachment-menu';
	import { useAttachmentMenu } from '$lib/hooks/use-attachment-menu.svelte';
	import { useToolsPanel } from '$lib/hooks/use-tools-panel.svelte';
	import { conversationsStore } from '$lib/stores/conversations.svelte';
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import { HealthCheckStatus } from '$lib/enums';
	import { AttachmentAction } from '$lib/enums/attachment.enums';

	interface Props {
		class?: string;
		disabled?: boolean;
		hasAudioModality?: boolean;
		hasVideoModality?: boolean;
		hasVisionModality?: boolean;
		hasMcpPromptsSupport?: boolean;
		hasMcpResourcesSupport?: boolean;
		onFileUpload?: () => void;
		onSystemPromptClick?: () => void;
		onMcpPromptClick?: () => void;
		onMcpResourcesClick?: () => void;
		trigger: Snippet<[{ disabled: boolean; onclick?: () => void }]>;
	}

	let {
		class: className = '',
		disabled = false,
		hasAudioModality = false,
		hasVisionModality = false,
		hasVideoModality = false,
		hasMcpPromptsSupport = false,
		hasMcpResourcesSupport = false,
		onFileUpload,
		onSystemPromptClick,
		onMcpPromptClick,
		onMcpResourcesClick,
		trigger
	}: Props = $props();

	let sheetOpen = $state(false);
	let filesExpanded = $state(true);
	const attachmentMenu = useAttachmentMenu(
		() => ({
			hasVisionModality,
			hasAudioModality,
			hasVideoModality,
			hasMcpPromptsSupport: false,
			hasMcpResourcesSupport: false
		}),
		() => ({ onFileUpload, onSystemPromptClick, onMcpPromptClick, onMcpResourcesClick }),
		() => {
			sheetOpen = false;
		}
	);

	const sheetItemClass =
		'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent active:bg-accent disabled:cursor-not-allowed disabled:opacity-50';

	const sheetItemRowClass =
		'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent';
</script>

<div class="flex items-center gap-1 {className}">
	<Sheet.Root bind:open={sheetOpen}>
		{@render trigger({ disabled, onclick: () => (sheetOpen = true) })}

		<Sheet.Content side="bottom" class="max-h-[85vh] gap-0 overflow-y-auto">
			<Sheet.Header>
				<Sheet.Title>Add to chat</Sheet.Title>

				<Sheet.Description class="sr-only">
					Add files, system prompt or configure MCP servers
				</Sheet.Description>
			</Sheet.Header>

			<div class="flex flex-col gap-1 px-1.5 pb-2">
				<Collapsible.Root open={filesExpanded} onOpenChange={(open) => (filesExpanded = open)}>
					<Collapsible.Trigger class={sheetItemClass}>
						{#if filesExpanded}
							<ChevronDown class="h-4 w-4 shrink-0" />
						{:else}
							<ChevronRight class="h-4 w-4 shrink-0" />
						{/if}

						<File class="h-4 w-4 shrink-0" />

						<span class="flex-1">Add files</span>
					</Collapsible.Trigger>

					<Collapsible.Content>
						<div class="flex flex-col gap-0.5 pl-4">
							{#each ATTACHMENT_FILE_ITEMS as item (item.id)}
								{@const enabled = attachmentMenu.isItemEnabled(item.enabledWhen)}
								{#if enabled}
									<button
										type="button"
										class={sheetItemClass}
										onclick={() => attachmentMenu.callbacks[item.action]()}
									>
										<item.icon class="h-4 w-4 shrink-0" />

										<span>{item.label}</span>
									</button>
								{:else if item.disabledTooltip}
									<Tooltip.Root delayDuration={TOOLTIP_DELAY_DURATION}>
										<Tooltip.Trigger>
											<button type="button" class={sheetItemClass} disabled>
												<item.icon class="h-4 w-4 shrink-0" />

												<span>{item.label}</span>
											</button>
										</Tooltip.Trigger>

										<Tooltip.Content side="right">
											<p>{item.disabledTooltip}</p>
										</Tooltip.Content>
									</Tooltip.Root>
								{/if}
							{/each}
						</div>
					</Collapsible.Content>
				</Collapsible.Root>

				<button
					type="button"
					class={sheetItemClass}
					onclick={() => attachmentMenu.callbacks[AttachmentAction.SYSTEM_PROMPT_CLICK]()}
				>
					<MessageSquare class="h-4 w-4 shrink-0" />

					<span>System Message</span>
				</button>
			</div>
		</Sheet.Content>
	</Sheet.Root>
</div>
