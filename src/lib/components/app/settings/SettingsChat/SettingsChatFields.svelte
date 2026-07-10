<script lang="ts">
	import { RotateCcw, FlaskConical } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Select from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import { SETTING_CONFIG_INFO, SETTINGS_KEYS } from '$lib/constants';
	import { SettingsFieldType } from '$lib/enums/settings.enums';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { serverStore } from '$lib/stores/server.svelte';
	import {
		modelsStore,
		modelOptions,
		selectedModelName,
		propsCacheVersion
	} from '$lib/stores/models.svelte';
	import { normalizeFloatingPoint } from '$lib/utils/precision';
	import { SettingsChatParameterSourceIndicator } from '$lib/components/app/settings';
	import type { Component } from 'svelte';

	interface Props {
		fields: SettingsFieldConfig[];
		localConfig: SettingsConfigType;
		onConfigChange: (key: string, value: string | boolean) => void;
		onThemeChange?: (theme: string) => void;
	}

	let { fields, localConfig, onConfigChange, onThemeChange }: Props = $props();

	let currentModelParams = $derived.by(() => {
		propsCacheVersion();

		if (serverStore.isRouterMode) {
			const currentModelName = selectedModelName();

			if (currentModelName) {
				const currentModelProps = modelsStore.getModelProps(currentModelName);

				return (currentModelProps?.default_generation_settings?.params ?? {}) as Record<
					string,
					unknown
				>;
			}
		}
		return (serverStore.defaultParams ?? {}) as Record<string, unknown>;
	});
</script>

{#each fields as field (field.key)}
	{@const isVisible =
		!field.visibleWhen ||
		(() => {
			const val = localConfig[field.visibleWhen.key];
			if (Array.isArray(field.visibleWhen.value)) {
				return field.visibleWhen.value.includes(String(val));
			}
			return String(val) === String(field.visibleWhen.value);
		})()}
	{#if isVisible}
		<div class="space-y-2">
			{#if field.type === SettingsFieldType.INPUT}
				{@const currentValue = String(localConfig[field.key] ?? '')}
				{@const serverDefault = currentModelParams[field.key]}
				{@const isCustomRealTime = (() => {
					if (serverDefault == null) return false;
					if (currentValue === '') return false;

					const numericInput = parseFloat(currentValue);
					const normalizedInput = !isNaN(numericInput)
						? Math.round(numericInput * 1000000) / 1000000
						: currentValue;
					const normalizedDefault =
						typeof serverDefault === 'number'
							? Math.round(serverDefault * 1000000) / 1000000
							: serverDefault;

					return normalizedInput !== normalizedDefault;
				})()}

				<div class="flex items-center gap-2">
					<Label for={field.key} class="flex items-center gap-1.5 text-sm font-medium">
						{field.label}

						{#if field.isExperimental}
							<FlaskConical class="h-3.5 w-3.5 text-muted-foreground" />
						{/if}
					</Label>
					{#if isCustomRealTime}
						<SettingsChatParameterSourceIndicator />
					{/if}
				</div>

				<div class="relative w-full">
					<Input
						id={field.key}
						type={field.isPositiveInteger ? 'number' : 'text'}
						{...field.isPositiveInteger ? { min: '1', step: '1' } : {}}
						value={currentValue}
						oninput={(e) => {
							// Update local config immediately for real-time badge feedback
							onConfigChange(field.key, e.currentTarget.value);
						}}
						placeholder={currentModelParams[field.key] != null
							? `Default: ${normalizeFloatingPoint(currentModelParams[field.key])}`
							: ''}
						class="w-full {isCustomRealTime ? 'pr-8' : ''}"
					/>
					{#if isCustomRealTime}
						<button
							type="button"
							onclick={() => {
								settingsStore.resetParameterToServerDefault(field.key);
								onConfigChange(field.key, '');
							}}
							class="absolute top-1/2 right-2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-colors hover:bg-muted"
							aria-label="Reset to default"
							title="Reset to default"
						>
							<RotateCcw class="h-3 w-3" />
						</button>
					{/if}
				</div>
				{#if field.help || SETTING_CONFIG_INFO[field.key]}
					<p class="mt-1 text-xs text-muted-foreground">
						{@html field.help || SETTING_CONFIG_INFO[field.key]}
					</p>
				{/if}

				{#if field.key === SETTINGS_KEYS.PROVIDER_MODEL}
					<div class="mt-2">
						<button
							type="button"
							class="inline-flex items-center gap-2 rounded border px-3 py-1 text-sm"
							onclick={async () => {
								try {
									// Persist provider-related local settings so fetch uses them immediately
									const updates: Partial<SettingsConfigType> = {} as any;
									updates[SETTINGS_KEYS.PROVIDER_NAME] =
										localConfig[SETTINGS_KEYS.PROVIDER_NAME] ?? '';
									updates[SETTINGS_KEYS.PROVIDER_BASE_URL] =
										localConfig[SETTINGS_KEYS.PROVIDER_BASE_URL] ?? '';
									updates[SETTINGS_KEYS.PROVIDER_API_KEY] =
										localConfig[SETTINGS_KEYS.PROVIDER_API_KEY] ?? '';
									settingsStore.updateMultipleConfig(updates);
									await modelsStore.fetch(true);
									toast.success('Models fetched');
								} catch (err) {
									const msg = err instanceof Error ? err.message : String(err);
									toast.error('Failed to fetch models: ' + msg);
								}
							}}
							disabled={modelsStore.loading}
						>
							<RotateCcw class="h-4 w-4" />
							Fetch Models
						</button>
					</div>
				{/if}

				{#if field.key === SETTINGS_KEYS.PROVIDER_MODEL}
					{@const available = modelOptions()}
					{#if available && available.length > 0}
						<div class="mt-3">
							<Label for="providerModelSelect" class="block text-sm font-medium mb-1"
								>Choose fetched model</Label
							>
							<select
								id="providerModelSelect"
								class="w-full rounded border p-2"
								value={String(localConfig[SETTINGS_KEYS.PROVIDER_MODEL] ?? '')}
								onchange={(e) =>
									onConfigChange(SETTINGS_KEYS.PROVIDER_MODEL, e.currentTarget.value)}
							>
								<option value="">-- Select model --</option>
								{#each available as opt (opt.id)}
									<option value={opt.model}>{opt.name}</option>
								{/each}
							</select>
						</div>
					{:else}
						<p class="mt-2 text-xs text-muted-foreground">
							No provider models cached — click Fetch Models.
						</p>
					{/if}
				{/if}
			{:else if field.type === SettingsFieldType.TEXTAREA}
				{#if field.label}
					<Label for={field.key} class="block flex items-center gap-1.5 text-sm font-medium">
						{field.label}

						{#if field.isExperimental}
							<FlaskConical class="h-3.5 w-3.5 text-muted-foreground" />
						{/if}
					</Label>
				{/if}

				<Textarea
					id={field.key}
					value={String(localConfig[field.key] ?? '')}
					onchange={(e) => onConfigChange(field.key, e.currentTarget.value)}
					placeholder=""
					class="min-h-[10rem] w-full md:max-w-3xl"
				/>

				{#if field.help || SETTING_CONFIG_INFO[field.key]}
					<p class="mt-1 text-xs text-muted-foreground">
						{field.help || SETTING_CONFIG_INFO[field.key]}
					</p>
				{/if}

				{#if field.key === SETTINGS_KEYS.SYSTEM_MESSAGE}
					<div class="mt-3 flex items-center gap-2">
						<Checkbox
							id="showSystemMessage"
							checked={Boolean(localConfig.showSystemMessage ?? true)}
							onCheckedChange={(checked) =>
								onConfigChange(SETTINGS_KEYS.SHOW_SYSTEM_MESSAGE, Boolean(checked))}
						/>

						<Label for="showSystemMessage" class="cursor-pointer text-sm font-normal">
							Show system message in conversations
						</Label>
					</div>
				{/if}
			{:else if field.type === SettingsFieldType.SELECT}
				{@const selectedOption = field.options?.find(
					(opt: { value: string; label: string; icon?: Component }) =>
						opt.value === localConfig[field.key]
				)}
				{@const currentValue = localConfig[field.key]}
				{@const serverDefault = currentModelParams[field.key]}
				{@const isCustomRealTime = (() => {
					if (serverDefault == null) return false;
					if (currentValue === '' || currentValue === undefined) return false;
					return currentValue !== serverDefault;
				})()}

				<div class="flex items-center gap-2">
					<Label for={field.key} class="flex items-center gap-1.5 text-sm font-medium">
						{field.label}

						{#if field.isExperimental}
							<FlaskConical class="h-3.5 w-3.5 text-muted-foreground" />
						{/if}
					</Label>
					{#if isCustomRealTime}
						<SettingsChatParameterSourceIndicator />
					{/if}
				</div>

				<Select.Root
					type="single"
					value={currentValue}
					onValueChange={(value) => {
						if (field.key === SETTINGS_KEYS.THEME && value && onThemeChange) {
							onThemeChange(value);
						} else {
							onConfigChange(field.key, value);
						}
					}}
				>
					<div class="relative w-full md:w-auto">
						<Select.Trigger class="w-full">
							<div class="flex items-center gap-2">
								{#if selectedOption?.icon}
									{@const IconComponent = selectedOption.icon}
									<IconComponent class="h-4 w-4" />
								{/if}

								{selectedOption?.label || `Select ${field.label.toLowerCase()}`}
							</div>
						</Select.Trigger>
						{#if isCustomRealTime}
							<button
								type="button"
								onclick={() => {
									settingsStore.resetParameterToServerDefault(field.key);
									onConfigChange(field.key, '');
								}}
								class="absolute top-1/2 right-8 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-colors hover:bg-muted"
								aria-label="Reset to default"
								title="Reset to default"
							>
								<RotateCcw class="h-3 w-3" />
							</button>
						{/if}
					</div>
					<Select.Content>
						{#if field.options}
							{#each field.options as option (option.value)}
								<Select.Item value={option.value} label={option.label}>
									<div class="flex items-center gap-2">
										{#if option.icon}
											{@const IconComponent = option.icon}
											<IconComponent class="h-4 w-4" />
										{/if}
										{option.label}
									</div>
								</Select.Item>
							{/each}
						{/if}
					</Select.Content>
				</Select.Root>
				{#if field.help || SETTING_CONFIG_INFO[field.key]}
					<p class="mt-1 text-xs text-muted-foreground">
						{field.help || SETTING_CONFIG_INFO[field.key]}
					</p>
				{/if}
			{:else if field.type === SettingsFieldType.CHECKBOX}
				<div class="flex items-start space-x-3">
					<Checkbox
						id={field.key}
						checked={Boolean(localConfig[field.key])}
						onCheckedChange={(checked) => onConfigChange(field.key, checked)}
						class="mt-1"
					/>

					<div class="space-y-1">
						<label
							for={field.key}
							class="flex cursor-pointer items-center gap-1.5 pt-1 pb-0.5 text-sm leading-none font-medium"
						>
							{field.label}

							{#if field.isExperimental}
								<FlaskConical class="h-3.5 w-3.5 text-muted-foreground" />
							{/if}
						</label>

						{#if field.help || SETTING_CONFIG_INFO[field.key]}
							<p class="text-xs text-muted-foreground">
								{field.help || SETTING_CONFIG_INFO[field.key]}
							</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/each}
