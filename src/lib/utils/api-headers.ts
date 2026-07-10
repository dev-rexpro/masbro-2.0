import { base } from '$app/paths';
import { config } from '$lib/stores/settings.svelte';
import { CORS_PROXY_HEADER_PREFIX, REDACTED_HEADERS, SETTINGS_KEYS } from '$lib/constants';
import { redactValue } from './redact';

export const PROVIDER_DEFAULT_BASE_URLS: Record<string, string> = {
	openrouter: 'https://openrouter.ai/api/v1',
	groq: 'https://api.groq.com/openai/v1',
	huggingface: 'https://router.huggingface.co/v1',
	together: 'https://api.together.xyz/v1',
	gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
	openai: 'https://api.openai.com/v1',
	anthropic: 'https://api.anthropic.com/v1',
	mistral: 'https://api.mistral.ai/v1',
	google: 'https://generativelanguage.googleapis.com/v1beta/openai/v1',
	deepseek: 'https://api.deepseek.com/v1',
	qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
	cohere: 'https://api.cohere.com/v1',
	perplexity: 'https://api.perplexity.ai',
	azure: 'https://{resource-name}.services.ai.azure.com/models',
	bedrock: '',
	nvidia: 'https://integrate.api.nvidia.com/v1',
	llamacpp: 'http://localhost:8080/v1',
	lmstudio: 'http://localhost:1234/v1',
	ollama: 'http://localhost:11434/v1',
	vllm: 'http://localhost:8000/v1',
	custom: ''
};

export const PROVIDERS_REQUIRING_CORS_PROXY = new Set(['nvidia']);

/**
 * Get authorization headers for API requests
 * Includes provider-specific auth headers
 */
export function getAuthHeaders(): Record<string, string> {
	const currentConfig = config();
	const providerName = currentConfig[SETTINGS_KEYS.PROVIDER_NAME]?.toString() || 'openrouter';
	const providerApiKey = currentConfig[SETTINGS_KEYS.PROVIDER_API_KEY]?.toString().trim();
	const providerBaseUrl = currentConfig[SETTINGS_KEYS.PROVIDER_BASE_URL]?.toString().trim();

	const headers: Record<string, string> = {};

	const baseUrl = providerBaseUrl || PROVIDER_DEFAULT_BASE_URLS[providerName] || '';
	if (baseUrl) {
		headers['x-provider-base-url'] = baseUrl;
	}

	if (providerApiKey) {
		if (providerName === 'anthropic') {
			headers['x-api-key'] = providerApiKey;
			headers['anthropic-version'] = '2023-06-01';
			headers['Content-Type'] = 'application/json';
		} else {
			headers['Authorization'] = `Bearer ${providerApiKey}`;
		}
	}

	return headers;
}

export function getProviderConfig() {
	const currentConfig = config();
	const providerName = currentConfig[SETTINGS_KEYS.PROVIDER_NAME]?.toString() || 'openrouter';
	const baseUrl = currentConfig[SETTINGS_KEYS.PROVIDER_BASE_URL]?.toString().trim();
	const apiKey = currentConfig[SETTINGS_KEYS.PROVIDER_API_KEY]?.toString().trim();
	const model = currentConfig[SETTINGS_KEYS.PROVIDER_MODEL]?.toString().trim();

	return {
		providerName,
		baseUrl: baseUrl || PROVIDER_DEFAULT_BASE_URLS[providerName] || '',
		apiKey,
		model
	};
}

export function resolveApiUrl(path: string): string {
	if (path.startsWith('http://') || path.startsWith('https://')) {
		return path;
	}

	const currentConfig = config();
	const providerMode = currentConfig[SETTINGS_KEYS.PROVIDER_MODE]?.toString();
	const providerName = currentConfig[SETTINGS_KEYS.PROVIDER_NAME]?.toString() || 'openrouter';

	const normalizedPath = path.replace(/^\.\//, '').replace(/^\/+/, '/');
	
	// If providerMode is openai-compatible, return direct URL
	if (providerMode === 'openai-compatible') {
		const providerBaseUrl = currentConfig[SETTINGS_KEYS.PROVIDER_BASE_URL]?.toString().trim();
		if (providerBaseUrl) {
			const cleanPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
			const target = new URL(cleanPath, providerBaseUrl.replace(/\/$/, ''));
			return target.toString();
		}
	}

	// Route to SvelteKit's local API completions ONLY for google/gemini providers
	const comparePath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
	if (
		(providerName === 'google' || providerName === 'gemini') &&
		(comparePath === 'chat/completions' || comparePath === 'v1/chat/completions')
	) {
		return `${base}/api/chat/completions`;
	}

	const providerConfig = getProviderConfig();
	if (!providerConfig) {
		return path;
	}

	return (
		'/api/proxy/' +
		providerConfig.providerName +
		(normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath)
	);
}

export function getProviderBaseUrl(providerName: string): string {
	return PROVIDER_DEFAULT_BASE_URLS[providerName] || '';
}

export function isRemoteProvider(providerName: string): boolean {
	return !!PROVIDER_DEFAULT_BASE_URLS[providerName] && providerName !== 'custom';
}

export function isCorsProxyRequired(providerName: string): boolean {
	return PROVIDERS_REQUIRING_CORS_PROXY.has(providerName);
}

/**
 * Get standard JSON headers with optional authorization
 */
export function getJsonHeaders(): Record<string, string> {
	return {
		'Content-Type': 'application/json',
		...getAuthHeaders()
	};
}

/**
 * Sanitize HTTP headers by redacting sensitive values.
 * Known sensitive headers (from REDACTED_HEADERS) and any extra headers
 * specified by the caller are fully redacted. Headers listed in
 * `partialRedactHeaders` are partially redacted, showing only the
 * specified number of trailing characters.
 *
 * @param headers - Headers to sanitize
 * @param extraRedactedHeaders - Additional header names to fully redact
 * @param partialRedactHeaders - Map of header name -> number of trailing chars to keep visible
 * @returns Object with header names as keys and (possibly redacted) values
 */
export function sanitizeHeaders(
	headers?: HeadersInit,
	extraRedactedHeaders?: Iterable<string>,
	partialRedactHeaders?: Map<string, number>
): Record<string, string> {
	if (!headers) {
		return {};
	}

	const normalized = new Headers(headers);
	const sanitized: Record<string, string> = {};
	const redactedHeaders = new Set(
		Array.from(extraRedactedHeaders ?? [], (header) => header.toLowerCase())
	);

	for (const [key, value] of normalized.entries()) {
		const normalizedKey = key.toLowerCase();
		const unproxiedKey = normalizedKey.startsWith(CORS_PROXY_HEADER_PREFIX)
			? normalizedKey.slice(CORS_PROXY_HEADER_PREFIX.length)
			: normalizedKey;
		const partialChars =
			partialRedactHeaders?.get(normalizedKey) ?? partialRedactHeaders?.get(unproxiedKey);

		if (partialChars !== undefined) {
			sanitized[key] = redactValue(value, partialChars);
		} else if (
			REDACTED_HEADERS.has(normalizedKey) ||
			REDACTED_HEADERS.has(unproxiedKey) ||
			redactedHeaders.has(normalizedKey) ||
			redactedHeaders.has(unproxiedKey)
		) {
			sanitized[key] = redactValue(value);
		} else {
			sanitized[key] = value;
		}
	}

	return sanitized;
}

export function resolveProxyApiUrl(path: string): string {
	const currentConfig = config();
	const providerName = currentConfig[SETTINGS_KEYS.PROVIDER_NAME]?.toString() || 'openrouter';
	const normalized = path.replace(/^\.\//, '').replace(/^\/+/, '/');
	
	const comparePath = normalized.startsWith('/') ? normalized.slice(1) : normalized;
	if (
		(providerName === 'google' || providerName === 'gemini') &&
		(comparePath === 'chat/completions' || comparePath === 'v1/chat/completions')
	) {
		return `${base}/api/chat/completions`;
	}

	const providerConfig = getProviderConfig();
	if (!providerConfig || !isRemoteProvider(providerConfig.providerName)) {
		return resolveApiUrl(path);
	}

	return (
		'/api/proxy/' +
		providerConfig.providerName +
		(normalized.startsWith('/') ? normalized : '/' + normalized)
	);
}
