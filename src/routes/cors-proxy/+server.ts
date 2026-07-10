import { error, type RequestEvent } from '@sveltejs/kit';
import { CORS_PROXY_HEADER_PREFIX } from '$lib/constants';

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

function buildForwardableHeaders(request: Request): Record<string, string> {
	const normalHeaders: Record<string, string> = {};
	const proxiedHeaders: Record<string, string> = {};
	const prefix = CORS_PROXY_HEADER_PREFIX.toLowerCase();

	request.headers.forEach((value, key) => {
		const lowered = key.toLowerCase();
		if (lowered.startsWith(prefix)) {
			const originalKey = lowered.slice(prefix.length);
			proxiedHeaders[originalKey] = value;
			return;
		}

		if (HOP_BY_HOP_HEADERS.has(lowered) || lowered === 'host' || lowered === 'origin') {
			return;
		}

		normalHeaders[lowered] = value;
	});

	const merged = {
		...normalHeaders,
		...proxiedHeaders
	};

	const currentAccept = merged['accept'] || '';
	if (!currentAccept) {
		merged['accept'] = 'application/json, text/event-stream, */*';
	} else if (!currentAccept.includes('application/json') || !currentAccept.includes('text/event-stream')) {
		merged['accept'] = 'application/json, text/event-stream, ' + currentAccept;
	}

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
	for (const [key, value] of Object.entries(merged)) {
		const standardKey = standardCasing[key] || key;
		if (standardKey === 'Content-Type' && value.toLowerCase().startsWith('application/json')) {
			capitalized[standardKey] = 'application/json';
		} else {
			capitalized[standardKey] = value;
		}
	}

	return capitalized;
}

async function readRequestBody(request: Request): Promise<ArrayBuffer> {
	return request.arrayBuffer();
}

async function handleCorsProxy(request: Request, url: URL) {
	const targetUrlStr = url.searchParams.get('url');
	if (!targetUrlStr) {
		throw error(400, 'Missing url parameter');
	}

	let targetUrl: URL;
	try {
		targetUrl = new URL(targetUrlStr);
	} catch {
		throw error(400, 'Invalid url parameter');
	}

	// =========================================================================
	// ROBUST MCP INTERCEPTOR FOR SEARXNG (FIX LOGIC ERROR)
	// =========================================================================
	const isSearXNG = targetUrl.host.includes('searxng') || targetUrlStr.includes('searxng');

	if (isSearXNG && request.method === 'POST') {
		let mcpBody: any = {};
		try {
			const rawBody = await request.text();
			mcpBody = JSON.parse(rawBody);
		} catch (e) {
			return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }), { headers: { 'Content-Type': 'application/json' } });
		}

		try {
			const method = mcpBody.method;

			// FASE 1: Handshake Initialize awal dari Client MCP
			if (method === 'initialize') {
				return new Response(JSON.stringify({
					jsonrpc: "2.0",
					id: mcpBody.id,
					result: {
						protocolVersion: "2024-11-05",
						capabilities: { tools: {} },
						serverInfo: { name: "searxng-mcp-bridge", version: "1.0.0" }
					}
				}), {
					status: 200,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}

			// FASE 2: Ketika Client meminta list Tools yang tersedia
			if (method === 'tools/list') {
				return new Response(JSON.stringify({
					jsonrpc: "2.0",
					id: mcpBody.id,
					result: {
						tools: [
							{
								name: "web_search",
								description: "Search the web using your self-hosted SearXNG instance for real-time information.",
								inputSchema: {
									type: "object",
									properties: {
										query: { type: "string", description: "The explicit search term" }
									},
									required: ["query"]
								}
							}
						]
					}
				}), {
					status: 200,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}

			// FASE 3: Ketika LLM mengeksekusi Pencarian (tools/call)
			if (method === 'tools/call') {
				const toolName = mcpBody.params?.name;
				const mcpArgs = mcpBody.params?.arguments || {};
				const searchQuery = mcpArgs.query || mcpArgs.q || mcpArgs.text || "latest updates";

				if (toolName === 'web_search') {
					let searchPath = targetUrl.pathname;
					if (searchPath.endsWith('/mcp')) {
						searchPath = searchPath.slice(0, -4);
					} else if (searchPath.endsWith('/mcp/')) {
						searchPath = searchPath.slice(0, -5);
					}

					if (!searchPath.endsWith('/search') && !searchPath.endsWith('/search/')) {
						searchPath = searchPath.replace(/\/$/, '') + '/search';
					}

					const searxngEndpoint = `${targetUrl.origin}${searchPath}?q=${encodeURIComponent(searchQuery)}&format=json`;
					console.log(`[CORS Proxy] Fetching SearXNG from: ${searxngEndpoint}`);
					const searxngRes = await fetch(searxngEndpoint);

					if (!searxngRes.ok) {
						throw new Error(`SearXNG upstream at ${searxngEndpoint} returned status ${searxngRes.status}`);
					}

					const searxngData = await searxngRes.json();
					const rawResults = searxngData.results || [];

					const simplifiedResults = Array.isArray(rawResults)
						? rawResults.slice(0, 6).map((r: any) => ({
							title: r?.title || 'No Title',
							url: r?.url || '',
							content: r?.content || r?.snippet || ''
						}))
						: [];

					return new Response(JSON.stringify({
						jsonrpc: "2.0",
						id: mcpBody.id,
						result: {
							content: [
								{
									type: "text",
									text: JSON.stringify(simplifiedResults)
								}
							]
						}
					}), {
						status: 200,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}
			}

			return new Response(JSON.stringify({ jsonrpc: "2.0", id: mcpBody.id || 1, result: {} }), {
				headers: { 'Content-Type': 'application/json' }
			});

		} catch (err: any) {
			console.error("MCP Interceptor Crash Detail: ", err);
			return new Response(JSON.stringify({
				jsonrpc: "2.0",
				id: mcpBody.id || 1,
				error: {
					code: -32603,
					message: `Internal interceptor logic error: ${err?.message || err}`
				}
			}), { status: 500, headers: { 'Content-Type': 'application/json' } });
		}
	}
	// =========================================================================

	const headers = buildForwardableHeaders(request);
	const body =
		request.method !== 'GET' && request.method !== 'HEAD'
			? await readRequestBody(request)
			: undefined;


	console.log(`[CORS Proxy] Forwarding ${request.method} request to: ${targetUrl.toString()}`);
	console.log(`[CORS Proxy] Forwarded Request Headers:`, JSON.stringify(headers));

	const fetchOptions: RequestInit = {
		method: request.method,
		headers,
		body: body as BodyInit,
		redirect: 'manual',
		signal: request.signal
	};

	const upstream = await fetch(targetUrl.toString(), fetchOptions);
	console.log(`[CORS Proxy] Upstream Response Status:`, upstream.status);
	console.log(`[CORS Proxy] Upstream Response Headers:`, JSON.stringify(Object.fromEntries(upstream.headers.entries())));

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

export async function POST({ request, url }: RequestEvent) {
	return handleCorsProxy(request, url);
}

export async function GET({ request, url }: RequestEvent) {
	return handleCorsProxy(request, url);
}

export async function PUT({ request, url }: RequestEvent) {
	return handleCorsProxy(request, url);
}

export async function DELETE({ request, url }: RequestEvent) {
	return handleCorsProxy(request, url);
}

export async function PATCH({ request, url }: RequestEvent) {
	return handleCorsProxy(request, url);
}