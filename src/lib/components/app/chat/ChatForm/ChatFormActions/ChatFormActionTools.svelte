<script lang="ts">
	import { onMount } from 'svelte';
	import {
		LayoutGrid,
		MapPin,
		Braces,
		Terminal,
		Wrench,
		Link,
		X,
		Check,
		AlertCircle,
		Search
	} from '@lucide/svelte';
	import { toolsConfigStore } from '$lib/stores/tools-config.svelte';
	import { modelsStore } from '$lib/stores/models.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/components/ui/utils';

	interface Props {
		disabled?: boolean;
	}

	let { disabled = false }: Props = $props();

	let isOpen = $state(false);
	let menuRef = $state<HTMLElement | null>(null);

	// Derived capabilities checks for selected model
	const supportsSearchGrounding = $derived(modelsStore.selectedModel ? (modelsStore.selectedModel.capabilitiesSupported?.includes('Search grounding') ?? true) : true);
	const supportsGoogleMaps = $derived(modelsStore.selectedModel ? (modelsStore.selectedModel.capabilitiesSupported?.includes('Grounding with Google Maps') ?? true) : true);
	const supportsCodeExecution = $derived(modelsStore.selectedModel ? (modelsStore.selectedModel.capabilitiesSupported?.includes('Code execution') ?? true) : true);
	const supportsStructuredOutputs = $derived(modelsStore.selectedModel ? (modelsStore.selectedModel.capabilitiesSupported?.includes('Structured outputs') ?? true) : true);
	const supportsFunctionCalling = $derived(modelsStore.selectedModel ? (modelsStore.selectedModel.capabilitiesSupported?.includes('Function calling') ?? true) : true);
	const supportsUrlContext = $derived(modelsStore.selectedModel ? (modelsStore.selectedModel.capabilitiesSupported?.includes('URL context') ?? true) : true);

	// Automatically disable tools when model changes to one that doesn't support them
	$effect(() => {
		const model = modelsStore.selectedModel;
		if (model && model.capabilitiesSupported) {
			if (toolsConfigStore.googleSearchGroundingEnabled && !model.capabilitiesSupported.includes('Search grounding')) {
				toolsConfigStore.googleSearchGroundingEnabled = false;
				toolsConfigStore.save();
			}
			if (toolsConfigStore.googleMapsGroundingEnabled && !model.capabilitiesSupported.includes('Grounding with Google Maps')) {
				toolsConfigStore.googleMapsGroundingEnabled = false;
				toolsConfigStore.save();
			}
			if (toolsConfigStore.codeExecutionEnabled && !model.capabilitiesSupported.includes('Code execution')) {
				toolsConfigStore.codeExecutionEnabled = false;
				toolsConfigStore.save();
			}
			if (toolsConfigStore.structuredOutputsEnabled && !model.capabilitiesSupported.includes('Structured outputs')) {
				toolsConfigStore.structuredOutputsEnabled = false;
				toolsConfigStore.save();
			}
			if (toolsConfigStore.functionCallingEnabled && !model.capabilitiesSupported.includes('Function calling')) {
				toolsConfigStore.functionCallingEnabled = false;
				toolsConfigStore.save();
			}
			if (toolsConfigStore.urlContextEnabled && !model.capabilitiesSupported.includes('URL context')) {
				toolsConfigStore.urlContextEnabled = false;
				toolsConfigStore.save();
			}
		}
	});

	// Editing schema states
	let editingType = $state<'structured' | 'function' | null>(null);
	let tempSchemaValue = $state('');
	let jsonError = $state<string | null>(null);

	function toggleMenu(e: MouseEvent) {
		e.stopPropagation();
		if (disabled) return;
		isOpen = !isOpen;
		editingType = null; // Reset editing when toggled
	}

	// Close menu on click outside
	function handleClickOutside(event: MouseEvent) {
		if (isOpen && menuRef && !menuRef.contains(event.target as Node)) {
			isOpen = false;
			editingType = null;
		}
	}

	onMount(() => {
		window.addEventListener('click', handleClickOutside);
		return () => {
			window.removeEventListener('click', handleClickOutside);
		};
	});

	function openEdit(type: 'structured' | 'function', event: MouseEvent) {
		event.stopPropagation();
		editingType = type;
		if (type === 'structured') {
			tempSchemaValue =
				toolsConfigStore.structuredOutputsSchema ||
				'{\n  "type": "object",\n  "properties": {\n    "result": {\n      "type": "string"\n    }\n  },\n  "required": ["result"]\n}';
		} else {
			tempSchemaValue =
				toolsConfigStore.functionCallingSchema ||
				'[\n  {\n    "name": "get_current_weather",\n    "description": "Get the current weather for a location",\n    "parameters": {\n      "type": "object",\n      "properties": {\n        "location": {\n          "type": "string"\n        }\n      },\n      "required": ["location"]\n    }\n  }\n]';
		}
		validateJson();
	}

	function validateJson() {
		if (!tempSchemaValue.trim()) {
			jsonError = null;
			return;
		}
		try {
			JSON.parse(tempSchemaValue);
			jsonError = null;
		} catch (e) {
			jsonError = (e as Error).message;
		}
	}

	function saveSchema() {
		validateJson();
		if (jsonError) return;

		if (editingType === 'structured') {
			toolsConfigStore.setStructuredOutputsSchema(tempSchemaValue);
			if (!toolsConfigStore.structuredOutputsEnabled) {
				toolsConfigStore.toggleStructuredOutputs();
			}
		} else if (editingType === 'function') {
			toolsConfigStore.setFunctionCallingSchema(tempSchemaValue);
			if (!toolsConfigStore.functionCallingEnabled) {
				toolsConfigStore.toggleFunctionCalling();
			}
		}
		editingType = null;
	}

	function cancelEdit() {
		editingType = null;
		jsonError = null;
	}
</script>

<div class="relative inline-block" bind:this={menuRef}>
	<!-- Trigger Button -->
	<Button
		type="button"
		variant="ghost"
		class={cn(
			'relative h-8 w-8 rounded-full p-0 hover:bg-accent!',
			isOpen && 'bg-accent text-accent-foreground'
		)}
		onclick={toggleMenu}
		{disabled}
		title="Tools & Capabilities"
	>
		<LayoutGrid class="h-4 w-4" />

		<!-- Active Tools Notification Dots -->
		<div class="absolute -top-0.5 -right-0.5 flex -space-x-1 items-center">
			{#if toolsConfigStore.googleSearchGroundingEnabled}
				<span class="h-2.5 w-2.5 rounded-full bg-blue-500 border border-background shadow-xs" title="Google Search active"></span>
			{/if}
			{#if toolsConfigStore.googleMapsGroundingEnabled}
				<span class="h-2.5 w-2.5 rounded-full bg-red-500 border border-background shadow-xs" title="Google Maps active"></span>
			{/if}
			{#if toolsConfigStore.codeExecutionEnabled}
				<span class="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-background shadow-xs" title="Code execution active"></span>
			{/if}
			{#if toolsConfigStore.structuredOutputsEnabled}
				<span class="h-2.5 w-2.5 rounded-full bg-violet-500 border border-background shadow-xs" title="Structured outputs active"></span>
			{/if}
			{#if toolsConfigStore.functionCallingEnabled}
				<span class="h-2.5 w-2.5 rounded-full bg-amber-500 border border-background shadow-xs" title="Function calling active"></span>
			{/if}
			{#if toolsConfigStore.urlContextEnabled}
				<span class="h-2.5 w-2.5 rounded-full bg-teal-500 border border-background shadow-xs" title="URL context active"></span>
			{/if}
		</div>
	</Button>

	<!-- Popover Content Menu -->
	{#if isOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute bottom-11 left-0 z-50 w-[260px] rounded-xl border border-border bg-popover p-3.5 shadow-xl text-popover-foreground transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 duration-150"
			onclick={(e) => e.stopPropagation()}
		>
			{#if editingType === null}
				<!-- Main Tools Options -->
				<div class="mb-3 flex items-center justify-between pb-2 border-b border-border/50">
					<h3 class="text-xs font-bold text-foreground">Tools & Capabilities</h3>
					<button
						type="button"
						class="rounded-full p-1 text-muted-foreground hover:bg-muted"
						onclick={() => (isOpen = false)}
					>
						<X class="h-3.5 w-3.5" />
					</button>
				</div>

				<div class="space-y-3">
					<!-- Row 1: Grounding with Google Search -->
					<div 
						class={cn("flex items-center justify-between gap-3", !supportsSearchGrounding && "opacity-50 select-none")}
						title={!supportsSearchGrounding ? "Not supported by the selected model" : ""}
					>
						<div class="flex items-center gap-2.5">
							<Search class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-xs font-medium text-foreground">Google Search</span>
						</div>
						<button
							type="button"
							aria-label="Toggle Google Search grounding"
							disabled={disabled || !supportsSearchGrounding}
							class={cn(
								'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden',
								toolsConfigStore.googleSearchGroundingEnabled
									? 'bg-primary'
									: 'bg-neutral-300 dark:bg-neutral-700',
								!supportsSearchGrounding ? 'cursor-not-allowed' : 'cursor-pointer'
							)}
							onclick={() => toolsConfigStore.toggleGoogleSearchGrounding()}
						>
							<span
								class={cn(
									'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
									toolsConfigStore.googleSearchGroundingEnabled ? 'translate-x-4' : 'translate-x-0'
								)}
							></span>
						</button>
					</div>

					<!-- Row 2: Grounding with Google Maps -->
					<div 
						class={cn("flex items-center justify-between gap-3", !supportsGoogleMaps && "opacity-50 select-none")}
						title={!supportsGoogleMaps ? "Not supported by the selected model" : ""}
					>
						<div class="flex items-center gap-2.5">
							<MapPin class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-xs font-medium text-foreground">Google Maps</span>
						</div>
						<button
							type="button"
							aria-label="Toggle Google Maps grounding"
							disabled={disabled || !supportsGoogleMaps}
							class={cn(
								'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden',
								toolsConfigStore.googleMapsGroundingEnabled
									? 'bg-primary'
									: 'bg-neutral-300 dark:bg-neutral-700',
								!supportsGoogleMaps ? 'cursor-not-allowed' : 'cursor-pointer'
							)}
							onclick={() => toolsConfigStore.toggleGoogleMapsGrounding()}
						>
							<span
								class={cn(
									'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
									toolsConfigStore.googleMapsGroundingEnabled ? 'translate-x-4' : 'translate-x-0'
								)}
							></span>
						</button>
					</div>

					<!-- Row 3: Code Execution -->
					<div 
						class={cn("flex items-center justify-between gap-3", !supportsCodeExecution && "opacity-50 select-none")}
						title={!supportsCodeExecution ? "Not supported by the selected model" : ""}
					>
						<div class="flex items-center gap-2.5">
							<Terminal class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-xs font-medium text-foreground">Code execution</span>
						</div>
						<button
							type="button"
							aria-label="Toggle Code execution"
							disabled={disabled || !supportsCodeExecution}
							class={cn(
								'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden',
								toolsConfigStore.codeExecutionEnabled
									? 'bg-primary'
									: 'bg-neutral-300 dark:bg-neutral-700',
								!supportsCodeExecution ? 'cursor-not-allowed' : 'cursor-pointer'
							)}
							onclick={() => toolsConfigStore.toggleCodeExecution()}
						>
							<span
								class={cn(
									'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
									toolsConfigStore.codeExecutionEnabled ? 'translate-x-4' : 'translate-x-0'
								)}
							></span>
						</button>
					</div>

					<!-- Row 4: Structured Outputs -->
					<div 
						class={cn("flex items-center justify-between gap-3", !supportsStructuredOutputs && "opacity-50 select-none")}
						title={!supportsStructuredOutputs ? "Not supported by the selected model" : ""}
					>
						<div class="flex items-center gap-2.5 overflow-hidden">
							<Braces class="h-4 w-4 text-muted-foreground shrink-0" />
							<div class="flex items-center gap-1.5 min-w-0">
								<span class="text-xs font-medium text-foreground truncate">Structured outputs</span>
								<button
									type="button"
									disabled={disabled || !supportsStructuredOutputs}
									class={cn(
										"text-[10px] text-primary hover:underline shrink-0",
										(!supportsStructuredOutputs || disabled) && "pointer-events-none text-muted-foreground"
									)}
									onclick={(e) => openEdit('structured', e)}
								>
									Edit
								</button>
							</div>
						</div>
						<button
							type="button"
							aria-label="Toggle Structured outputs"
							disabled={disabled || !supportsStructuredOutputs}
							class={cn(
								'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden',
								toolsConfigStore.structuredOutputsEnabled
									? 'bg-primary'
									: 'bg-neutral-300 dark:bg-neutral-700',
								!supportsStructuredOutputs ? 'cursor-not-allowed' : 'cursor-pointer'
							)}
							onclick={() => toolsConfigStore.toggleStructuredOutputs()}
						>
							<span
								class={cn(
									'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
									toolsConfigStore.structuredOutputsEnabled ? 'translate-x-4' : 'translate-x-0'
								)}
							></span>
						</button>
					</div>

					<!-- Row 5: Function Calling -->
					<div 
						class={cn("flex items-center justify-between gap-3", !supportsFunctionCalling && "opacity-50 select-none")}
						title={!supportsFunctionCalling ? "Not supported by the selected model" : ""}
					>
						<div class="flex items-center gap-2.5 overflow-hidden">
							<Wrench class="h-4 w-4 text-muted-foreground shrink-0" />
							<div class="flex items-center gap-1.5 min-w-0">
								<span class="text-xs font-medium text-foreground truncate">Function calling</span>
								<button
									type="button"
									disabled={disabled || !supportsFunctionCalling}
									class={cn(
										"text-[10px] text-primary hover:underline shrink-0",
										(!supportsFunctionCalling || disabled) && "pointer-events-none text-muted-foreground"
									)}
									onclick={(e) => openEdit('function', e)}
								>
									Edit
								</button>
							</div>
						</div>
						<button
							type="button"
							aria-label="Toggle Function calling"
							disabled={disabled || !supportsFunctionCalling}
							class={cn(
								'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden',
								toolsConfigStore.functionCallingEnabled
									? 'bg-primary'
									: 'bg-neutral-300 dark:bg-neutral-700',
								!supportsFunctionCalling ? 'cursor-not-allowed' : 'cursor-pointer'
							)}
							onclick={() => toolsConfigStore.toggleFunctionCalling()}
						>
							<span
								class={cn(
									'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
									toolsConfigStore.functionCallingEnabled ? 'translate-x-4' : 'translate-x-0'
								)}
							></span>
						</button>
					</div>

					<!-- Row 6: URL Context -->
					<div 
						class={cn("flex items-center justify-between gap-3", !supportsUrlContext && "opacity-50 select-none")}
						title={!supportsUrlContext ? "Not supported by the selected model" : ""}
					>
						<div class="flex items-center gap-2.5">
							<Link class="h-4 w-4 text-muted-foreground shrink-0" />
							<span class="text-xs font-medium text-foreground">URL context</span>
						</div>
						<button
							type="button"
							aria-label="Toggle URL context"
							disabled={disabled || !supportsUrlContext}
							class={cn(
								'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden',
								toolsConfigStore.urlContextEnabled
									? 'bg-primary'
									: 'bg-neutral-300 dark:bg-neutral-700',
								!supportsUrlContext ? 'cursor-not-allowed' : 'cursor-pointer'
							)}
							onclick={() => toolsConfigStore.toggleUrlContext()}
						>
							<span
								class={cn(
									'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
									toolsConfigStore.urlContextEnabled ? 'translate-x-4' : 'translate-x-0'
								)}
							></span>
						</button>
					</div>
				</div>
			{:else}
				<!-- Schema / Declarations JSON Editor View -->
				<div class="mb-3 flex items-center justify-between pb-2 border-b border-border/50">
					<div>
						<h3 class="text-xs font-bold text-foreground">
							{editingType === 'structured'
								? 'Structured Outputs JSON Schema'
								: 'Function Declarations JSON'}
						</h3>
						<p class="text-[9px] text-muted-foreground">Provide valid JSON definitions</p>
					</div>
					<button
						type="button"
						class="rounded-full p-1 text-muted-foreground hover:bg-muted"
						onclick={cancelEdit}
					>
						<X class="h-4 w-4" />
					</button>
				</div>

				<div class="space-y-3">
					<textarea
						bind:value={tempSchemaValue}
						oninput={validateJson}
						rows="10"
						class="w-full rounded-lg border border-border bg-neutral-50 dark:bg-neutral-950 p-2 font-mono text-[10px] leading-relaxed text-foreground focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
						placeholder={editingType === 'structured'
							? '{\n  "type": "object",\n  "properties": {...}\n}'
							: '[\n  {\n    "name": "function_name",\n    "description": "...",\n    "parameters": {...}\n  }\n]'}
					></textarea>

					{#if jsonError}
						<div class="flex items-start gap-1.5 text-[10px] text-red-500">
							<AlertCircle class="h-3.5 w-3.5 shrink-0 mt-0.5" />
							<span class="leading-normal">{jsonError}</span>
						</div>
					{:else if tempSchemaValue.trim()}
						<div class="flex items-center gap-1.5 text-[10px] text-green-500">
							<Check class="h-3.5 w-3.5 shrink-0" />
							<span>Valid JSON representation</span>
						</div>
					{/if}

					<div class="flex items-center justify-end gap-2 pt-1">
						<Button variant="outline" size="sm" class="h-7 text-[10px] px-2.5" onclick={cancelEdit}>
							Cancel
						</Button>
						<Button
							size="sm"
							class="h-7 text-[10px] px-3 bg-primary hover:bg-primary/95 text-primary-foreground"
							onclick={saveSchema}
							disabled={!!jsonError}
						>
							Save & Enable
						</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
