/* eslint-disable @typescript-eslint/no-explicit-any */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.GEMINI_API_KEY || '';

	if (!apiKey) {
		return new Response(
			JSON.stringify({
				error: {
					message: 'GEMINI_API_KEY environment variable is not configured.'
				}
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}

	const ai = new GoogleGenAI({ apiKey });

	let requestBody;
	try {
		requestBody = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { messages, model, temperature, max_tokens, stream } = requestBody;
	if (!messages || !Array.isArray(messages)) {
		throw error(400, 'Missing or invalid messages array');
	}

	const modelName = model || 'gemini-3.5-flash';

	// Map OpenAI-like roles/messages to Gemini contents
	const contents = messages.map((msg) => {
		let role = msg.role;
		if (role === 'assistant') {
			role = 'model';
		}

		const parts: any[] = [];
		if (typeof msg.content === 'string') {
			parts.push({ text: msg.content });
		} else if (Array.isArray(msg.content)) {
			for (const part of msg.content) {
				if (part.type === 'text') {
					parts.push({ text: part.text });
				} else if (part.type === 'image_url') {
					const base64Parts = part.image_url.url.split(',');
					const base64Data = base64Parts[1] || base64Parts[0];
					let mimeType = 'image/jpeg';
					const mimeMatch = part.image_url.url.match(/data:(.*?);/);
					if (mimeMatch) {
						mimeType = mimeMatch[1];
					}
					parts.push({
						inlineData: {
							data: base64Data,
							mimeType: mimeType
						}
					});
				} else if (part.type === 'input_audio') {
					const mimeType = part.input_audio.format === 'wav' ? 'audio/wav' : 'audio/mp3';
					parts.push({
						inlineData: {
							data: part.input_audio.data,
							mimeType: mimeType
						}
					});
				} else if (part.type === 'input_video') {
					const mimeType = part.input_video.format === 'mp4' ? 'video/mp4' : 'video/ogg';
					parts.push({
						inlineData: {
							data: part.input_video.data,
							mimeType: mimeType
						}
					});
				}
			}
		}
		return { role, parts };
	});

	// Extract system instruction if present
	const systemMessage = messages.find((m) => m.role === 'system');
	const systemInstruction = systemMessage
		? typeof systemMessage.content === 'string'
			? systemMessage.content
			: systemMessage.content.map((p: any) => p.text).join('\n')
		: undefined;

	// Filter system messages from conversation history
	const chatContents = contents.filter((c) => c.role !== 'system');

	const isAgent = [
		'antigravity-preview-05-2026',
		'deep-research-preview-04-2026',
		'deep-research-max-preview-04-2026'
	].includes(modelName);

	const isOmni = modelName === 'gemini-omni-flash-preview';

	// Handle standard models with generateContent (streaming or non-streaming)
	if (!isAgent && !isOmni) {
		const config: any = {
			systemInstruction,
			temperature: temperature !== undefined ? temperature : 0.7,
			maxOutputTokens: max_tokens && max_tokens > 0 ? max_tokens : undefined,
			tools: [{ googleSearch: {} }] // Support default Google Search grounding for standard models
		};

		if (!stream) {
			try {
				const response = await ai.models.generateContent({
					model: modelName,
					contents: chatContents,
					config
				});

				let content = '';
				let reasoning = '';
				const candidate = response.candidates?.[0];
				if (candidate?.content?.parts) {
					for (const part of candidate.content.parts) {
						if ('thought' in part && part.thought) {
							reasoning += part.thought;
						} else if (part.text) {
							content += part.text;
						}
					}
				} else {
					content = response.text || '';
				}

				return new Response(
					JSON.stringify({
						id: `chatcmpl-${Date.now()}`,
						choices: [
							{
								message: {
									role: 'assistant',
									content,
									reasoning_content: reasoning || undefined
								}
							}
						]
					}),
					{ headers: { 'Content-Type': 'application/json' } }
				);
			} catch (err: any) {
				console.error('Error in standard Gemini generateContent:', err);
				return new Response(
					JSON.stringify({
						error: {
							message: err.message || 'Gemini API generateContent request failed.'
						}
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } }
				);
			}
		}

		// Streaming response for standard models
		const svelteStream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();
				let isClosed = false;
				const sendChunk = (dataObj: any) => {
					if (isClosed) return;
					try {
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(dataObj)}\n\n`));
					} catch (e) {
						isClosed = true;
					}
				};

				try {
					const geminiStream = await ai.models.generateContentStream({
						model: modelName,
						contents: chatContents,
						config
					});

					for await (const chunk of geminiStream) {
						let content = '';
						let reasoning = '';
						const candidate = chunk.candidates?.[0];
						if (candidate?.content?.parts) {
							for (const part of candidate.content.parts) {
								if ('thought' in part && part.thought) {
									reasoning += part.thought;
								} else if (part.text) {
									content += part.text;
								}
							}
						} else {
							content = chunk.text || '';
						}

						if (content || reasoning) {
							sendChunk({
								choices: [
									{
										delta: {
											content: content || undefined,
											reasoning_content: reasoning || undefined
										}
									}
								]
							});
						}
					}
				} catch (err: any) {
					console.error('Error during standard Gemini streaming:', err);
					sendChunk({
						error: {
							message: err.message || 'Streaming failed'
						}
					});
				} finally {
					if (!isClosed) {
						try {
							controller.enqueue(encoder.encode('data: [DONE]\n\n'));
						} catch (e) {}
						try {
							controller.close();
						} catch (e) {}
						isClosed = true;
					}
				}
			}
		});

		return new Response(svelteStream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive'
			}
		});
	}

	// Handle Agent and Omni models via interactions API
	const interactionParams: any = {
		system_instruction: systemInstruction,
		generation_config: {
			temperature: temperature !== undefined ? temperature : 0.7,
			max_output_tokens: max_tokens && max_tokens > 0 ? max_tokens : undefined
		},
		stream: stream || false
	};

	// Construct text-based single prompt for the interactions API
	let finalPrompt = '';
	if (chatContents.length > 1) {
		const history = chatContents
			.slice(0, -1)
			.map((c) => {
				const text = c.parts
					.filter((p: any) => p.text)
					.map((p: any) => p.text)
					.join('\n');
				return `[${c.role}]: ${text}`;
			})
			.join('\n\n');
		finalPrompt += `Here is the conversation history so far for context:\n\n${history}\n\n`;
	}
	const latest = chatContents[chatContents.length - 1];
	const latestText = latest
		? latest.parts
				.filter((p: any) => p.text)
				.map((p: any) => p.text)
				.join('\n')
		: '';
	finalPrompt += `Current user request: ${latestText}`;

	if (isAgent) {
		interactionParams.agent = modelName;
		interactionParams.environment = 'remote';
		interactionParams.input = finalPrompt;
	} else {
		// Omni model
		interactionParams.model = modelName;
		interactionParams.input = finalPrompt;
		interactionParams.tools = [{ type: 'google_search' }];
	}

	if (!stream) {
		// Non-streaming response for Agents/Omni models
		try {
			const result = await ai.interactions.create({
				...interactionParams,
				stream: false
			});

			let content = '';
			let reasoning = '';
			for (const step of result.steps || []) {
				if (step.type === 'thought') {
					reasoning += step.summary || '';
				} else if (step.type === 'model_output') {
					const textContent = step.content?.find((c: any) => c.type === 'text');
					if (textContent?.text) {
						content += textContent.text;
					}
				}
			}

			return new Response(
				JSON.stringify({
					id: result.id,
					choices: [
						{
							message: {
								role: 'assistant',
								content,
								reasoning_content: reasoning || undefined
							}
						}
					]
				}),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		} catch (err: any) {
			console.error('Error in Gemini interactions.create:', err);
			return new Response(
				JSON.stringify({
					error: {
						message: err.message || 'Interactions API request failed.'
					}
				}),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			);
		}
	}

	// Streaming response for Agents/Omni models
	const svelteStream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			let isClosed = false;
			const sendChunk = (dataObj: any) => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(dataObj)}\n\n`));
				} catch (e) {
					isClosed = true;
				}
			};

			try {
				const geminiStream = await ai.interactions.create(interactionParams);
				let currentStepType: string | null = null;

				for await (const event of geminiStream) {
					if (event.event_type === 'step.start') {
						currentStepType = event.step?.type || null;
						// Emit progress thoughts for visual "proof of work" feedback
						if (currentStepType === 'google_search_call') {
							sendChunk({
								choices: [
									{
										delta: {
											reasoning_content: '\n🔍 Searching Google... \n'
										}
									}
								]
							});
						} else if (currentStepType === 'code_execution_call') {
							sendChunk({
								choices: [
									{
										delta: {
											reasoning_content: '\n💻 Running sandbox code... \n'
										}
									}
								]
							});
						}
					} else if (event.event_type === 'step.delta') {
						if (event.delta?.type === 'text') {
							const text = event.delta.text;
							if (currentStepType === 'thought') {
								sendChunk({
									choices: [
										{
											delta: {
												reasoning_content: text
											}
										}
									]
								});
							} else {
								sendChunk({
									choices: [
										{
											delta: {
												content: text
											}
										}
									]
								});
							}
						}
					}
				}
			} catch (err: any) {
				console.error('Error during Gemini Interactions streaming:', err);
				sendChunk({
					error: {
						message: err.message || 'Streaming failed'
					}
				});
			} finally {
				if (!isClosed) {
					try {
						controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					} catch (e) {}
					try {
						controller.close();
					} catch (e) {}
					isClosed = true;
				}
			}
		}
	});

	return new Response(svelteStream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
