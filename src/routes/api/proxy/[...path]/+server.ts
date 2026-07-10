import { error, type RequestEvent } from '@sveltejs/kit';
import { getProviderBaseUrl } from '$lib/utils/api-headers';

const FORWARD_STRIP_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

function stripForwardedHeaders(headers: Headers): Headers {
	for (const [key] of headers) {
		if (FORWARD_STRIP_HEADERS.has(key.toLowerCase())) {
			headers.delete(key);
		}
	}
	return headers;
}

const HOP_BY_HOP_HEADERS = new Set([
	'connection',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailers',
	'transfer-encoding',
	'upgrade'
]);

function buildTargetUrl(provider: string, remainingPath: string, request: Request): URL {
	const baseUrl =
		request.headers.get('x-provider-base-url')?.trim() || getProviderBaseUrl(provider);

	if (!baseUrl) {
		throw error(400, 'Missing base URL for provider: ' + provider);
	}

	const normalized = remainingPath.replace(/^\/+/, '') || '/';
	const target = new URL(normalized, baseUrl.replace(/\/$/, ''));

	if (provider === 'azure') {
		const pathname = target.pathname.replace(/^\/?v1\//, '/');
		target.pathname = pathname.startsWith('/') ? pathname : '/' + pathname;
	}

	return target;
}

function buildForwardableHeaders(request: Request): Record<string, string> {
	const headers: Record<string, string> = {};

	request.headers.forEach((value, key) => {
		const lowered = key.toLowerCase();
		if (HOP_BY_HOP_HEADERS.has(lowered) || lowered === 'host' || lowered === 'origin') {
			return;
		}

		headers[lowered] = value;
	});

	const standardCasing: Record<string, string> = {
		'content-type': 'Content-Type',
		'authorization': 'Authorization',
		'accept': 'Accept',
		'user-agent': 'User-Agent',
		'content-length': 'Content-Length',
		'accept-encoding': 'Accept-Encoding',
		'accept-language': 'Accept-Language',
		'cache-control': 'Cache-Control',
		'connection': 'Connection'
	};

	const capitalized: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		const standardKey = standardCasing[key] || key;
		capitalized[standardKey] = value;
	}

	return capitalized;
}

async function readRequestBody(request: Request): Promise<ArrayBuffer> {
	return request.arrayBuffer();
}

async function handleProxy(request: Request, params: RequestEvent['params']) {
	const path = ((params as Record<string, string>).path ?? '').replace(/^\/+/, '');
	const segments = path.split('/').filter(Boolean);

	if (segments.length === 0) {
		throw error(400, 'Proxy requires a provider as the first path segment');
	}

	const provider = segments[0];
	const remainingPath = segments.slice(1).join('/');
	const targetUrl = buildTargetUrl(provider, remainingPath, request);
	const headers = buildForwardableHeaders(request);
	const body =
		request.method !== 'GET' && request.method !== 'HEAD'
			? await readRequestBody(request)
			: undefined;

	const fetchOptions: RequestInit = {
		method: request.method,
		headers,
		body: body as BodyInit,
		redirect: 'manual',
		signal: request.signal
	};

	const upstream = await fetch(targetUrl.toString(), fetchOptions);
	const contentType = upstream.headers.get('content-type') || '';
	const isStream = contentType.includes('text/event-stream');

	if (isStream) {
		const responseHeaders = stripForwardedHeaders(new Headers(upstream.headers));
		responseHeaders.set('Content-Type', 'text/event-stream');
		responseHeaders.set('Cache-Control', 'no-cache');
		responseHeaders.set('Connection', 'keep-alive');

		return new Response(upstream.body, {
			status: upstream.status,
			headers: responseHeaders
		});
	}

	const responseBody = await upstream.text();

	return new Response(responseBody, {
		status: upstream.status,
		headers: Object.fromEntries(stripForwardedHeaders(new Headers(upstream.headers)).entries())
	});
}

export async function POST({ request, params }: RequestEvent) {
	return handleProxy(request, params);
}

export async function GET({ request, params }: RequestEvent) {
	return handleProxy(request, params);
}

export async function PUT({ request, params }: RequestEvent) {
	return handleProxy(request, params);
}

export async function DELETE({ request, params }: RequestEvent) {
	return handleProxy(request, params);
}

export async function PATCH({ request, params }: RequestEvent) {
	return handleProxy(request, params);
}
