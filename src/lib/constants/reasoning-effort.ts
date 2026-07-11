import { ReasoningEffort } from '$lib/enums';
import type { ReasoningEffortLevel } from '$lib/types';

/**
 * Reasoning effort UI labels.
 * Keys match the ReasoningEffort enum values for type-safe lookups.
 */
export const REASONING_EFFORT_LABELS: Record<string, string> = {
	[ReasoningEffort.MINIMAL]: 'Minimal',
	[ReasoningEffort.LOW]: 'Low',
	[ReasoningEffort.MEDIUM]: 'Medium',
	[ReasoningEffort.HIGH]: 'High',
	[ReasoningEffort.MAX]: 'Max'
};

export const REASONING_EFFORT_LEVELS: ReasoningEffortLevel[] = [
	{ value: 'off', label: 'Off', isOff: true },
	{ value: ReasoningEffort.MINIMAL, label: 'Minimal' },
	{ value: ReasoningEffort.LOW, label: 'Low' },
	{ value: ReasoningEffort.MEDIUM, label: 'Medium' },
	{ value: ReasoningEffort.HIGH, label: 'High' },
	{ value: ReasoningEffort.MAX, label: 'Max', hasInfo: true }
];

export const MODEL_REASONING_LEVELS: Record<string, string[]> = {
	'gemini-3.1-pro-preview': ['low', 'medium', 'high'],
	'gemini-3.1-flash-lite-image': ['minimal', 'high'],
	'gemini-3-flash-preview': ['minimal', 'low', 'medium', 'high'],
	'gemini-3-pro-preview': ['low', 'high'],
	'gemini-3.5-flash': ['minimal', 'low', 'medium', 'high'],
	'gemini-2.5-pro': ['low', 'medium', 'high'],
	'gemini-2.5-flash': ['low', 'medium', 'high'],
	'gemini-2.5-flash-lite': ['low', 'medium', 'high']
};

export function getReasoningLevelsForModel(modelId: string | null): ReasoningEffortLevel[] {
	const levels: ReasoningEffortLevel[] = [
		{ value: 'off', label: 'Off', isOff: true }
	];

	if (!modelId) {
		// Fallback for default levels (excluding Max for standard Gemini usage but keeping others)
		return [
			...levels,
			{ value: 'low', label: 'Low' },
			{ value: 'medium', label: 'Medium' },
			{ value: 'high', label: 'High' }
		];
	}

	const modelKey = Object.keys(MODEL_REASONING_LEVELS).find(
		(key) => modelId.includes(key) || key.includes(modelId)
	);

	if (!modelKey) {
		// If not in the list, fall back to standard non-gemini or general set
		return [
			...levels,
			{ value: 'low', label: 'Low' },
			{ value: 'medium', label: 'Medium' },
			{ value: 'high', label: 'High' }
		];
	}

	const supported = MODEL_REASONING_LEVELS[modelKey];
	for (const level of supported) {
		if (level === 'minimal') {
			levels.push({ value: ReasoningEffort.MINIMAL, label: 'Minimal' });
		} else if (level === 'low') {
			levels.push({ value: ReasoningEffort.LOW, label: 'Low' });
		} else if (level === 'medium') {
			levels.push({ value: ReasoningEffort.MEDIUM, label: 'Medium' });
		} else if (level === 'high') {
			levels.push({ value: ReasoningEffort.HIGH, label: 'High' });
		}
	}

	return levels;
}
