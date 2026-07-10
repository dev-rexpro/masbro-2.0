<script lang="ts">
	import { Square, SkipForward, MapPin, Braces, Terminal, Wrench, Link, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { ChatService } from '$lib/services';
	import {
		ChatFormActionsAdd,
		ChatFormActionTools,
		ChatFormActionModels,
		ChatFormActionRecord,
		ChatFormActionSubmit,
		ChatFormReasoningToggle
	} from '$lib/components/app';
	import { toolsConfigStore } from '$lib/stores/tools-config.svelte';
	import { FileTypeCategory } from '$lib/enums';
	import { mcpStore } from '$lib/stores/mcp.svelte';
	import { config } from '$lib/stores/settings.svelte';
	import { conversationsStore } from '$lib/stores/conversations.svelte';
	import { getFileTypeCategory } from '$lib/utils';
	import { goto } from '$app/navigation';
	import { ROUTES } from '$lib/constants/routes';

	interface Props {
		canSend?: boolean;
		canSubmit?: boolean;
		class?: string;
		disabled?: boolean;
		isLoading?: boolean;
		isReasoning?: boolean;
		isRecording?: boolean;
		showAddButton?: boolean;
		showModelSelector?: boolean;
		uploadedFiles?: ChatUploadedFile[];
		onFileUpload?: () => void;
		onMicClick?: () => void;
		onStop?: () => void;
		onSystemPromptClick?: () => void;
		onMcpPromptClick?: () => void;
		onMcpResourcesClick?: () => void;
		onVoiceModeClick?: () => void;
	}

	let {
		canSend = false,
		canSubmit = false,
		class: className = '',
		disabled = false,
		isLoading = false,
		isReasoning = false,
		isRecording = false,
		showAddButton = true,
		showModelSelector = true,
		uploadedFiles = [],
		onFileUpload,
		onMicClick,
		onStop,
		onSystemPromptClick,
		onMcpPromptClick,
		onMcpResourcesClick,
		onVoiceModeClick
	}: Props = $props();

	let isVoiceMode = $derived(!canSend);

	let currentConfig = $derived(config());

	let hasMcpPromptsSupport = $derived.by(() => {
		const perChatOverrides = conversationsStore.getAllMcpServerOverrides();

		return mcpStore.hasPromptsCapability(perChatOverrides);
	});

	let hasMcpResourcesSupport = $derived.by(() => {
		const perChatOverrides = conversationsStore.getAllMcpServerOverrides();

		return mcpStore.hasResourcesCapability(perChatOverrides);
	});

	let hasAudioModality = $state(false);
	let hasVideoModality = $state(false);
	let hasVisionModality = $state(false);
	let hasModelSelected = $state(false);
	let isSelectedModelInCache = $state(true);
	let submitTooltip = $state('');

	let hasAudioAttachments = $derived(
		uploadedFiles.some((file) => getFileTypeCategory(file.type) === FileTypeCategory.AUDIO)
	);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let shouldShowRecordButton = $derived(
		hasAudioModality && !canSubmit && !hasAudioAttachments && currentConfig.autoMicOnEmpty
	);

	let selectorModelRef: ChatFormActionModels | undefined = $state(undefined);

	export function openModelSelector() {
		selectorModelRef?.open();
	}
	// the streaming assistant message carries both the completion id and the model that
	// produced it, targeting reasoning control from the same source keeps them consistent
	let activeMessage = $derived(
		conversationsStore.activeMessages[conversationsStore.activeMessages.length - 1]
	);
</script>

<div
	class="flex w-full items-center gap-3 {className} {showAddButton ? '' : 'justify-end'}"
	style="container-type: inline-size"
>
	{#if showAddButton}
		<div class="mr-auto flex flex-wrap items-center gap-2">
			<ChatFormActionsAdd
				{disabled}
				{hasAudioModality}
				{hasVideoModality}
				{hasVisionModality}
				{hasMcpPromptsSupport}
				{hasMcpResourcesSupport}
				{onFileUpload}
				{onSystemPromptClick}
				{onMcpPromptClick}
				{onMcpResourcesClick}
				onMcpSettingsClick={() => goto(ROUTES.MCP_SERVERS)}
			/>

			<ChatFormActionTools {disabled} />

			{#if toolsConfigStore.googleMapsGroundingEnabled}
				<div
					class="flex items-center gap-1 px-2.5 py-0.5 text-[10px] md:text-xs font-semibold bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200/50 dark:border-red-900/50 rounded-full select-none shadow-xs transition-all duration-150"
				>
					<MapPin class="h-3 w-3 shrink-0" />
					<span class="max-w-[120px] truncate md:max-w-none">Grounding with Google Maps</span>
					<button
						type="button"
						class="rounded-full p-0.5 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 transition-colors"
						onclick={() => toolsConfigStore.toggleGoogleMapsGrounding()}
						title="Disable maps grounding"
					>
						<X class="h-2.5 w-2.5" />
					</button>
				</div>
			{/if}

			{#if toolsConfigStore.codeExecutionEnabled}
				<div
					class="flex items-center gap-1 px-2.5 py-0.5 text-[10px] md:text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/50 rounded-full select-none shadow-xs transition-all duration-150"
				>
					<Terminal class="h-3 w-3 shrink-0" />
					<span class="max-w-[120px] truncate md:max-w-none">Code execution</span>
					<button
						type="button"
						class="rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors"
						onclick={() => toolsConfigStore.toggleCodeExecution()}
						title="Disable code execution"
					>
						<X class="h-2.5 w-2.5" />
					</button>
				</div>
			{/if}

			{#if toolsConfigStore.structuredOutputsEnabled}
				<div
					class="flex items-center gap-1 px-2.5 py-0.5 text-[10px] md:text-xs font-semibold bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300 border border-violet-200/50 dark:border-violet-900/50 rounded-full select-none shadow-xs transition-all duration-150"
				>
					<Braces class="h-3 w-3 shrink-0" />
					<span class="max-w-[120px] truncate md:max-w-none">Structured outputs</span>
					<button
						type="button"
						class="rounded-full p-0.5 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-200 transition-colors"
						onclick={() => toolsConfigStore.toggleStructuredOutputs()}
						title="Disable structured outputs"
					>
						<X class="h-2.5 w-2.5" />
					</button>
				</div>
			{/if}

			{#if toolsConfigStore.functionCallingEnabled}
				<div
					class="flex items-center gap-1 px-2.5 py-0.5 text-[10px] md:text-xs font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50 rounded-full select-none shadow-xs transition-all duration-150"
				>
					<Wrench class="h-3 w-3 shrink-0" />
					<span class="max-w-[120px] truncate md:max-w-none">Function calling</span>
					<button
						type="button"
						class="rounded-full p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
						onclick={() => toolsConfigStore.toggleFunctionCalling()}
						title="Disable function calling"
					>
						<X class="h-2.5 w-2.5" />
					</button>
				</div>
			{/if}

			{#if toolsConfigStore.urlContextEnabled}
				<div
					class="flex items-center gap-1 px-2.5 py-0.5 text-[10px] md:text-xs font-semibold bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-900/50 rounded-full select-none shadow-xs transition-all duration-150"
				>
					<Link class="h-3 w-3 shrink-0" />
					<span class="max-w-[120px] truncate md:max-w-none">URL context</span>
					<button
						type="button"
						class="rounded-full p-0.5 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-500 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-200 transition-colors"
						onclick={() => toolsConfigStore.toggleUrlContext()}
						title="Disable URL context"
					>
						<X class="h-2.5 w-2.5" />
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<div class="flex items-center gap-2">
		<ChatFormReasoningToggle />

		{#if showModelSelector}
			<ChatFormActionModels
				{disabled}
				bind:this={selectorModelRef}
				bind:hasAudioModality
				bind:hasVideoModality
				bind:hasVisionModality
				bind:hasModelSelected
				bind:isSelectedModelInCache
				bind:submitTooltip
				forceForegroundText
				useGlobalSelection
			/>
		{/if}
	</div>

	{#if isReasoning}
		<Button
			type="button"
			variant="secondary"
			onclick={() =>
				ChatService.stopReasoning(activeMessage?.completionId ?? '', activeMessage?.model)}
			class="group h-8 w-8 rounded-lg p-0"
			title="Skip reasoning"
		>
			<span class="sr-only">Skip reasoning</span>

			<SkipForward class="h-4 w-4 stroke-muted-foreground group-hover:stroke-foreground" />
		</Button>
	{/if}

	{#if isLoading && !canSubmit}
		<Button
			type="button"
			variant="secondary"
			onclick={onStop}
			class="group h-8 w-8 rounded-lg p-0 hover:bg-destructive/10!"
		>
			<span class="sr-only">Stop</span>

			<Square
				class="h-8 w-8 fill-muted-foreground stroke-muted-foreground group-hover:fill-destructive group-hover:stroke-destructive hover:fill-destructive hover:stroke-destructive"
			/>
		</Button>
	{:else}
		<ChatFormActionRecord {disabled} {hasAudioModality} {isLoading} {isRecording} {onMicClick} />
		<ChatFormActionSubmit
			canSend={isVoiceMode
				? true
				: canSend && (showModelSelector ? hasModelSelected && isSelectedModelInCache : true)}
			{disabled}
			tooltipLabel={submitTooltip}
			showErrorState={showModelSelector && hasModelSelected && !isSelectedModelInCache}
			{isVoiceMode}
			onclickVoiceMode={onVoiceModeClick}
		/>
	{/if}
</div>
