import { describe, it, expect, beforeEach } from 'vitest';
import { resolveApiUrl } from './api-headers';
import { config } from '$lib/stores/settings.svelte';
import { SETTINGS_KEYS } from '$lib/constants';

describe('resolveApiUrl', () => {
	beforeEach(() => {
		config()[SETTINGS_KEYS.PROVIDER_MODE] = 'local';
		config()[SETTINGS_KEYS.PROVIDER_BASE_URL] = '';
		config()[SETTINGS_KEYS.PROVIDER_API_KEY] = '';
		config()[SETTINGS_KEYS.PROVIDER_MODEL] = '';
	});

	it('uses the provider base URL for OpenAI-compatible chat paths', () => {
		config()[SETTINGS_KEYS.PROVIDER_MODE] = 'openai-compatible';
		config()[SETTINGS_KEYS.PROVIDER_NAME] = 'groq';
		config()[SETTINGS_KEYS.PROVIDER_BASE_URL] = 'https://api.groq.com/openai/v1';

		expect(resolveApiUrl('./v1/chat/completions')).toBe(
			'https://api.groq.com/openai/v1/chat/completions'
		);
	});

	it('falls back to the local base path when provider mode is off', () => {
		expect(resolveApiUrl('./v1/chat/completions')).toContain('/v1/chat/completions');
	});
});
