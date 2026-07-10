<script lang="ts">
	import { ChevronDown, Loader2, Package } from '@lucide/svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import { useModelsSelector } from '$lib/hooks/use-models-selector.svelte';
	import {
		DialogModelInformation,
		ModelId,
		ModelsSelectorList,
		SearchInput
	} from '$lib/components/app';
	import ModelLoadHighlight from './ModelLoadHighlight.svelte';
	import { ServerModelStatus } from '$lib/enums';
	import { modelsStore, routerModels } from '$lib/stores/models.svelte';
	import { modelLoadFraction } from '$lib/utils';

	interface Props {
		class?: string;
		currentModel?: string | null;
		/** Callback when model changes. Return false to keep menu open (e.g., for validation failures) */
		onModelChange?: (modelId: string, modelName: string) => Promise<boolean> | boolean | void;
		disabled?: boolean;
		forceForegroundText?: boolean;
		/** When true, user's global selection takes priority over currentModel (for form selector) */
		useGlobalSelection?: boolean;
	}

	let {
		class: className = '',
		currentModel = null,
		onModelChange,
		disabled = false,
		forceForegroundText = false,
		useGlobalSelection = false
	}: Props = $props();

	let sheetOpen = $state(false);

	const ms = useModelsSelector({
		currentModel: () => currentModel,
		useGlobalSelection: () => useGlobalSelection,
		onModelChange: () => onModelChange,
		onOpenChange: (open) => {
			sheetOpen = open;
		}
	});

	export function open() {
		ms.handleOpenChange(true);
	}

	function handleSheetOpenChange(open: boolean) {
		if (!open) {
			ms.handleOpenChange(false);
		}
	}
</script>

<div class={['relative inline-flex flex-col items-end gap-1', className]}>
	{#if ms.loading && ms.options.length === 0 && (ms.isRouter || ms.isProvider)}
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<Loader2 class="h-3.5 w-3.5 animate-spin" />
			Loading models…
		</div>
	{:else if ms.options.length === 0 && (ms.isRouter || ms.isProvider)}
		<p class="text-xs text-muted-foreground">No models available.</p>
	{:else}
		{@const selectedOption = ms.getDisplayOption()}
		{@const triggerModel = selectedOption?.model}
		{@const triggerStatus = triggerModel
			? routerModels().find((m) => m.id === triggerModel)?.status?.value
			: undefined}
		{@const triggerLoading =
			!!triggerModel &&
			(triggerStatus === ServerModelStatus.LOADING ||
				modelsStore.isModelOperationInProgress(triggerModel))}
		{@const triggerLoadPercent = triggerLoading
			? Math.round(modelLoadFraction(modelsStore.getLoadProgress(triggerModel)) * 100)
			: 0}

		{#if ms.isRouter || ms.isProvider}
			<button
				type="button"
				class={[
					'relative inline-flex items-center gap-1 cursor-pointer text-xs font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-colors',
					!ms.isCurrentModelInCache
						? 'text-red-500 hover:text-red-600'
						: forceForegroundText
							? 'text-foreground hover:text-foreground/80'
							: 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
					sheetOpen && 'text-foreground',
					'max-w-[min(calc(100cqw - 9rem),20rem)]'
				]}
				disabled={disabled || ms.updating}
				onclick={() => ms.handleOpenChange(true)}
			>
				{#if !selectedOption}
					<span class="min-w-0 font-medium">Select model</span>
				{:else}
					<ModelId
						class="text-xs font-semibold"
						modelId={selectedOption?.model || ''}
						hideQuantization
						hideTags
						hideOrgName={true}
						hideExtra={true}
						aliases={selectedOption?.aliases}
						tags={selectedOption?.tags}
					/>
				{/if}

				{#if ms.updating || ms.isLoadingModel}
					<Loader2 class="h-3 w-3 shrink-0 animate-spin" />
				{:else}
					<ChevronDown class="h-3 w-3 shrink-0" />
				{/if}

				{#if triggerLoading}
					<ModelLoadHighlight percent={triggerLoadPercent} />
				{/if}
			</button>

			<Sheet.Root bind:open={sheetOpen} onOpenChange={handleSheetOpenChange}>
				<Sheet.Content side="bottom" class="max-h-[85vh] gap-1">
					<Sheet.Header>
						<Sheet.Title>Select Model</Sheet.Title>

						<Sheet.Description class="sr-only">
							Choose a model to use for the conversation
						</Sheet.Description>
					</Sheet.Header>

					<div class="flex flex-col gap-1 pb-4">
						<div class="mb-3 px-4">
							<SearchInput
								placeholder="Search models..."
								value={ms.searchTerm}
								onInput={(v) => ms.setSearchTerm(v)}
							/>
						</div>

						<div class="max-h-[60vh] overflow-y-auto px-2">
							{#if ms.filteredOptions.length === 0}
								<p class="px-3 py-3 text-center text-sm text-muted-foreground">No models found.</p>
							{/if}

							<ModelsSelectorList
								groups={ms.groupedFilteredOptions}
								{currentModel}
								activeId={ms.activeId}
								sectionHeaderClass="px-2 py-2 text-xs font-semibold text-muted-foreground/60 select-none"
								orgHeaderClass="px-2 py-2 text-xs font-semibold text-muted-foreground/60 select-none [&:not(:first-child)]:mt-2"
								onSelect={ms.handleSelect}
								onInfoClick={ms.handleInfoClick}
							/>
						</div>
					</div>
				</Sheet.Content>
			</Sheet.Root>
		{:else}
			<button
				class={[
					'inline-flex items-center gap-1 cursor-pointer text-xs font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-colors',
					!ms.isCurrentModelInCache
						? 'text-red-500 hover:text-red-600'
						: forceForegroundText
							? 'text-foreground hover:text-foreground/80'
							: 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
				]}
				style="max-width: min(calc(100cqw - 6.5rem), 32rem)"
				onclick={() => ms.handleOpenChange(true)}
				disabled={disabled || ms.updating}
			>
				<ModelId
					modelId={selectedOption?.model || ''}
					class="font-semibold"
					hideQuantization
					hideOrgName={true}
					hideExtra={true}
					aliases={selectedOption?.aliases}
					tags={selectedOption?.tags}
				/>

				{#if ms.updating}
					<Loader2 class="h-3 w-3 shrink-0 animate-spin" />
				{:else}
					<ChevronDown class="h-3 w-3 shrink-0" />
				{/if}
			</button>
		{/if}
	{/if}
</div>

{#if ms.showModelDialog}
	<DialogModelInformation
		open={ms.showModelDialog}
		onOpenChange={(v) => ms.setShowModelDialog(v)}
		modelId={ms.infoModelId}
	/>
{/if}
