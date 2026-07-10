<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import {
		Video,
		VideoOff,
		Mic,
		MicOff,
		MonitorUp,
		X,
		Sparkles,
		Zap,
		SwitchCamera
	} from '@lucide/svelte';
	import { liveConversationStore } from '$lib/stores/live-conversation.svelte';
	import { config } from '$lib/stores/settings.svelte';
	import { browser } from '$app/environment';
	import { cn } from '$lib/components/ui/utils';

	// Component Props
	let isOpen = $derived(liveConversationStore.isActive);

	// State Runes
	let isVideoMode = $state(false);
	let isMuted = $state(false);
	let isScreenSharing = $state(false);
	let isTorchOn = $state(false);
	let subtitlesText = $state('');

	// Web Audio & WebSocket References
	let audioContext: AudioContext | null = null;
	let micStream: MediaStream | null = null;
	let videoStream: MediaStream | null = null;
	let scriptProcessor: ScriptProcessorNode | null = null;
	let ws: WebSocket | null = null;
	let nextPlayTime = 0;
	let aiAnalyser: AnalyserNode | null = null;
	let micAnalyser: AnalyserNode | null = null;

	// Video Element Binding
	let videoElement: HTMLVideoElement | null = $state(null);

	// Canvas Binding
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let gl: WebGLRenderingContext | null = null;
	let animationFrameId: number | null = null;

	// Intervals for capturing video/screen frames
	let captureIntervalId: any = null;

	// WebGL Shader Setup References
	let uTime: WebGLUniformLocation | null = null;
	let uResolution: WebGLUniformLocation | null = null;
	let uAudio: WebGLUniformLocation | null = null;
	let uAudioPunch: WebGLUniformLocation | null = null;
	let shaderProgram: WebGLProgram | null = null;

	// Audio Level Calculations for WebGL Animation
	let audioLevel = 0;
	let audioPunch = 0;

	// Helper to convert ArrayBuffer to Base64
	function base64ArrayBuffer(arrayBuffer: ArrayBufferLike): string {
		let binary = '';
		const bytes = new Uint8Array(arrayBuffer);
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	// Resample browser microphone audio buffer to 16kHz 16-bit Mono PCM
	function resampleAndConvertTo16BitPCM(
		audioBuffer: AudioBuffer,
		targetSampleRate: number,
		incomingSampleRate: number
	): Int16Array {
		const inputData = audioBuffer.getChannelData(0);
		const ratio = incomingSampleRate / targetSampleRate;
		const newLength = Math.round(inputData.length / ratio);
		const result = new Int16Array(newLength);

		let offsetResult = 0;
		let offsetInput = 0;

		while (offsetResult < result.length) {
			const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
			let accum = 0;
			let count = 0;
			for (let i = offsetInput; i < nextOffsetBuffer && i < inputData.length; i++) {
				accum += inputData[i];
				count++;
			}
			let sample = count > 0 ? accum / count : 0;
			sample = Math.max(-1, Math.min(1, sample));
			result[offsetResult] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

			offsetResult++;
			offsetInput = nextOffsetBuffer;
		}

		return result;
	}

	// Play 24kHz Mono 16-bit PCM Audio chunks from Gemini API
	function playAudioChunk(pcmDataArrayBuffer: ArrayBuffer) {
		if (!audioContext) return;

		const int16Array = new Int16Array(pcmDataArrayBuffer);
		const float32Array = new Float32Array(int16Array.length);
		for (let i = 0; i < int16Array.length; i++) {
			float32Array[i] = int16Array[i] / 32768.0;
		}

		if (audioContext.state === 'suspended') {
			audioContext.resume();
		}

		const buffer = audioContext.createBuffer(1, float32Array.length, 24000);
		buffer.copyToChannel(float32Array, 0);

		const source = audioContext.createBufferSource();
		source.buffer = buffer;

		// Connect to AI analyser node for animating WebGL orb
		if (aiAnalyser) {
			source.connect(aiAnalyser);
		} else {
			source.connect(audioContext.destination);
		}

		const now = audioContext.currentTime;
		if (nextPlayTime < now) {
			nextPlayTime = now;
		}
		source.start(nextPlayTime);
		nextPlayTime += buffer.duration;
	}

	// Fetch API Key (either client side settings or server side env via api endpoint)
	async function getGeminiApiKey(): Promise<string> {
		const clientKey = (config().providerApiKey as string | undefined)?.trim();
		if (clientKey) return clientKey;

		try {
			const response = await fetch('/api/live-key');
			const data = await response.json();
			return data.apiKey || '';
		} catch (err) {
			console.error('[LiveConversation] Failed to fetch API key:', err);
			return '';
		}
	}

	// Initialize WebGL Shaders & Program
	function initWebGL() {
		if (!canvasElement) return;

		gl =
			canvasElement.getContext('webgl') ||
			(canvasElement.getContext('experimental-webgl') as WebGLRenderingContext | null);
		if (!gl) {
			console.error('WebGL is not supported in this browser.');
			return;
		}

		const vertSrc = `
			attribute vec2 aPos;
			void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
		`;

		const fragSrc = `
			precision highp float;
			uniform float uTime;
			uniform vec2 uResolution;
			uniform float uAudio;      // smoothed 0..1
			uniform float uAudioPunch; // fast-attack transient 0..1

			float hash(vec2 p) {
				return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
			}

			float noise(vec2 p) {
				vec2 i = floor(p);
				vec2 f = fract(p);
				float a = hash(i);
				float b = hash(i + vec2(1.0,0.0));
				float c = hash(i + vec2(0.0,1.0));
				float d = hash(i + vec2(1.0,1.0));
				vec2 u = f*f*(3.0-2.0*f);
				return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
			}

			float fbm(vec2 p) {
				float v = 0.0;
				float amp = 0.5;
				for (int i=0; i<6; i++) {
					v += amp * noise(p);
					p *= 2.02;
					amp *= 0.5;
				}
				return v;
			}

			void main() {
				vec2 uv = gl_FragCoord.xy / uResolution.xy;
				vec2 p = uv - 0.5;
				float dist = length(p);
				float radius = 0.478;
				float edge = smoothstep(radius, radius - 0.012, dist);
				if (edge <= 0.001) { discard; }

				float x = uv.x;
				float speed = 0.045 + uAudio * 0.22;
				float t = uTime * speed;

				float n1 = fbm(vec2(x*1.15 + t*0.7, t*0.35));
				float n2 = fbm(vec2(x*2.3  - t*0.5, t*0.55 + 4.0));
				float voiceWave = uAudioPunch * 0.05 * sin(x*13.0 + t*9.0 + n1*4.0);

				float boundary = 0.47
					+ (n1-0.5) * (0.30 + uAudio*0.22)
					+ (n2-0.5) * (0.13 + uAudio*0.18)
					+ voiceWave;

				float distToBoundary = uv.y - boundary;

				float softWidth = 0.12 + 0.06*fbm(vec2(x*2.4+10.0, t*0.6)) + uAudio*0.05;
				float mixv = smoothstep(-softWidth, softWidth, distToBoundary);

				vec3 colTop    = vec3(0.36, 0.41, 0.95);
				vec3 colBottom = vec3(1.0, 1.0, 1.0);
				vec3 base = mix(colBottom, colTop, mixv);

				float wispN = fbm(vec2(x*6.0 + t*1.2, uv.y*6.0 - t*0.9));
				float proximity = exp(-pow(distToBoundary / (softWidth*1.7), 2.0));
				float wisp = (wispN-0.5) * proximity * (0.32 + uAudio*0.55 + uAudioPunch*0.4);
				base += wisp;

				float cloudShade = fbm(vec2(x*1.6+30.0, uv.y*1.4 + t*0.2));
				base += (cloudShade-0.5) * 0.05 * mixv;

				float glassLight = smoothstep(0.9,0.0,length(p - vec2(-0.14,0.16)))*0.16;
				base += glassLight;

				base += uAudioPunch * 0.08;
				base += uAudio * 0.02;

				gl_FragColor = vec4(base, edge);
			}
		`;

		function compileShader(type: number, src: string): WebGLShader {
			const shader = gl!.createShader(type)!;
			gl!.shaderSource(shader, src);
			gl!.compileShader(shader);
			if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
				console.error('Shader compilation failed:', gl!.getShaderInfoLog(shader));
			}
			return shader;
		}

		shaderProgram = gl.createProgram()!;
		gl.attachShader(shaderProgram, compileShader(gl.VERTEX_SHADER, vertSrc));
		gl.attachShader(shaderProgram, compileShader(gl.FRAGMENT_SHADER, fragSrc));
		gl.linkProgram(shaderProgram);

		const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

		const aPos = gl.getAttribLocation(shaderProgram, 'aPos');
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

		uTime = gl.getUniformLocation(shaderProgram, 'uTime');
		uResolution = gl.getUniformLocation(shaderProgram, 'uResolution');
		uAudio = gl.getUniformLocation(shaderProgram, 'uAudio');
		uAudioPunch = gl.getUniformLocation(shaderProgram, 'uAudioPunch');

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		resizeCanvas();
	}

	function resizeCanvas() {
		if (!canvasElement || !gl) return;
		const size = 260;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvasElement.width = size * dpr;
		canvasElement.height = size * dpr;
		gl.viewport(0, 0, canvasElement.width, canvasElement.height);
	}

	// WebGL Rendering Loop
	const start = browser ? performance.now() : 0;
	function renderFrame(now: number) {
		if (!gl || !shaderProgram) return;

		const t = (now - start) / 1000;

		// Calculate reactive amplitude values from Analyser nodes
		let rawVolume = 0;
		if (!isMuted) {
			if (micAnalyser) {
				const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
				micAnalyser.getByteTimeDomainData(dataArray);
				let sumSquares = 0;
				for (let i = 0; i < dataArray.length; i++) {
					const v = (dataArray[i] - 128) / 128;
					sumSquares += v * v;
				}
				rawVolume = Math.sqrt(sumSquares / dataArray.length) * 4.5;
			}
		}

		// Also check AI speaker volume to animate orb on reply
		if (aiAnalyser) {
			const dataArray = new Uint8Array(aiAnalyser.frequencyBinCount);
			aiAnalyser.getByteTimeDomainData(dataArray);
			let sumSquares = 0;
			for (let i = 0; i < dataArray.length; i++) {
				const v = (dataArray[i] - 128) / 128;
				sumSquares += v * v;
			}
			const aiVolume = Math.sqrt(sumSquares / dataArray.length) * 4.5;
			rawVolume = Math.max(rawVolume, aiVolume);
		}

		rawVolume = Math.min(1, rawVolume);

		audioLevel += (rawVolume - audioLevel) * 0.12;
		const punchTarget = Math.max(0, rawVolume - audioLevel * 0.6);
		audioPunch += (punchTarget - audioPunch) * 0.35;

		gl.useProgram(shaderProgram);
		gl.uniform1f(uTime, t);
		gl.uniform2f(uResolution, canvasElement!.width, canvasElement!.height);
		gl.uniform1f(uAudio, audioLevel);
		gl.uniform1f(uAudioPunch, audioPunch);

		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		// Dynamic sizing of the wrapper container
		const container = document.getElementById('orbInnerContainer');
		if (container) {
			const scale = 1 + audioLevel * 0.05 + audioPunch * 0.03;
			container.style.transform = `scale(${scale})`;
			container.style.setProperty('--glow', (0.35 + audioLevel * 0.5).toFixed(3));
		}

		animationFrameId = requestAnimationFrame(renderFrame);
	}

	// Capture Video/Screen frames & Send them to the Gemini API
	function startVideoCapturing() {
		if (captureIntervalId) clearInterval(captureIntervalId);

		const captureCanvas = document.createElement('canvas');
		const captureCtx = captureCanvas.getContext('2d');
		captureCanvas.width = 320;
		captureCanvas.height = 240;

		captureIntervalId = setInterval(() => {
			if (!videoStream || !ws || ws.readyState !== WebSocket.OPEN || !videoElement) return;
			if (!captureCtx) return;

			// Draw frame and convert to base64 jpeg
			captureCtx.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height);
			const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.6);
			const base64Data = dataUrl.split(',')[1];

			ws.send(
				JSON.stringify({
					realtimeInput: {
						video: {
							mimeType: 'image/jpeg',
							data: base64Data
						}
					}
				})
			);
		}, 1000);
	}

	function stopVideoCapturing() {
		if (captureIntervalId) {
			clearInterval(captureIntervalId);
			captureIntervalId = null;
		}
	}

	// Start Camera Video Feed
	async function toggleCamera() {
		if (isScreenSharing) {
			stopScreenSharing();
		}

		if (isVideoMode) {
			// Turning off Camera
			isVideoMode = false;
			stopVideoStream();
		} else {
			try {
				videoStream = await navigator.mediaDevices.getUserMedia({
					video: { width: 640, height: 480, facingMode: 'user' }
				});
				isVideoMode = true;
				await tick(); // Wait for {#if} block to render the <video> element
				if (videoElement) {
					videoElement.srcObject = videoStream;
					videoElement.play();
				}
				startVideoCapturing();
			} catch (err) {
				console.error('[LiveConversation] Camera stream failed:', err);
				alert('Camera access denied or unavailable.');
			}
		}
	}

	// Start Screen Sharing Feed
	async function toggleScreenSharing() {
		if (isVideoMode) {
			isVideoMode = false;
			stopVideoStream();
		}

		if (isScreenSharing) {
			stopScreenSharing();
		} else {
			try {
				videoStream = await navigator.mediaDevices.getDisplayMedia({
					video: { width: 1280, height: 720 }
				});
				isScreenSharing = true;

				// Listen for user clicking "Stop Sharing" from browser bar
				videoStream.getVideoTracks()[0].onended = () => {
					stopScreenSharing();
				};

				await tick(); // Wait for {#if} block to render the <video> element
				if (videoElement) {
					videoElement.srcObject = videoStream;
					videoElement.play();
				}
				startVideoCapturing();
			} catch (err) {
				console.error('[LiveConversation] Screen share stream failed:', err);
			}
		}
	}

	function stopVideoStream() {
		stopVideoCapturing();
		if (videoStream) {
			videoStream.getTracks().forEach((track) => track.stop());
			videoStream = null;
		}
		if (videoElement) {
			videoElement.srcObject = null;
		}
	}

	function toggleTorch() {
		if (!videoStream) return;
		const track = videoStream.getVideoTracks()[0];
		if (!track) return;
		const caps = track.getCapabilities();
		if (!caps || !('torch' in caps)) {
			alert('Flash/torch is not supported on this device.');
			return;
		}
		track
			.applyConstraints({ advanced: [{ torch: !isTorchOn } as MediaTrackConstraintSet] })
			.then(() => {
				isTorchOn = !isTorchOn;
			})
			.catch((err: unknown) => {
				console.error('[LiveConversation] Torch toggle failed:', err);
				alert('Failed to toggle flash.');
			});
	}

	function stopScreenSharing() {
		isScreenSharing = false;
		stopVideoStream();
	}

	// WebSocket & Audio Connection Life-cycle
	async function startSession() {
		const apiKey = await getGeminiApiKey();
		if (!apiKey) {
			alert('Gemini API key is not configured. Please configure it in Connection Settings.');
			closeSession();
			return;
		}

		// Initialize Web Audio Context
		audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		aiAnalyser = audioContext.createAnalyser();
		aiAnalyser.fftSize = 512;
		aiAnalyser.connect(audioContext.destination);

		// Fetch model from settings
		const selectedLiveModel = config().liveModel || 'gemini-2.5-flash-native-audio-preview-12-2025';
		const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log('[LiveConversation] WebSocket connection established.');
			// Send setup payload
			ws?.send(
				JSON.stringify({
					setup: {
						model: `models/${selectedLiveModel}`,
						generationConfig: {
							responseModalities: ['AUDIO'],
							speechConfig: {
								voiceConfig: {
									prebuiltVoiceConfig: {
										voiceName: 'Puck' // Premium crisp default voice
									}
								}
							}
						}
					}
				})
			);

			// Start Microphone Recording & Stream
			startMicRecording();
		};

		ws.onmessage = async (event) => {
			try {
				let textData = '';
				if (event.data instanceof Blob) {
					textData = await event.data.text();
				} else if (event.data instanceof ArrayBuffer) {
					textData = new TextDecoder().decode(event.data);
				} else if (typeof event.data === 'string') {
					textData = event.data;
				} else {
					console.warn('[LiveConversation] Unknown event.data type:', typeof event.data);
					return;
				}

				const response = JSON.parse(textData);

				// Process server response chunks
				if (response.serverContent?.modelTurn?.parts) {
					for (const part of response.serverContent.modelTurn.parts) {
						if (part.inlineData && part.inlineData.data) {
							// Raw base64 audio chunk received
							const binaryString = atob(part.inlineData.data);
							const len = binaryString.length;
							const bytes = new Uint8Array(len);
							for (let i = 0; i < len; i++) {
								bytes[i] = binaryString.charCodeAt(i);
							}
							playAudioChunk(bytes.buffer);
						}
						if (part.text) {
							// Subtitle transcript text
							subtitlesText += part.text;
						}
					}
				}

				if (response.serverContent?.turnComplete) {
					// Clear subtitles on next model response turn or keep them briefly
					setTimeout(() => {
						subtitlesText = '';
					}, 3500);
				}
			} catch (err) {
				console.error('[LiveConversation] Message decoding error:', err);
			}
		};

		ws.onerror = (e) => {
			console.error('[LiveConversation] WebSocket encountered an error:', e);
		};

		ws.onclose = (event) => {
			console.log('[LiveConversation] WebSocket connection closed.', event);
			closeSession();
		};
	}

	async function startMicRecording() {
		if (!audioContext) return;

		try {
			micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const micSource = audioContext.createMediaStreamSource(micStream);

			micAnalyser = audioContext.createAnalyser();
			micAnalyser.fftSize = 512;
			micSource.connect(micAnalyser);

			// ScriptProcessorNode resamples buffer to 16kHz & sends base64 chunks
			scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
			micSource.connect(scriptProcessor);
			scriptProcessor.connect(audioContext.destination);

			scriptProcessor.onaudioprocess = (event) => {
				if (isMuted || !ws || ws.readyState !== WebSocket.OPEN) return;

				const resampledPCM = resampleAndConvertTo16BitPCM(
					event.inputBuffer,
					16000,
					audioContext!.sampleRate
				);
				const base64 = base64ArrayBuffer(resampledPCM.buffer);

				ws.send(
					JSON.stringify({
						realtimeInput: {
							audio: {
								mimeType: 'audio/pcm;rate=16000',
								data: base64
							}
						}
					})
				);
			};
		} catch (err) {
			console.error('[LiveConversation] Microphone stream failed:', err);
			alert('Microphone access is required for Live Conversation.');
			closeSession();
		}
	}

	function toggleMute() {
		isMuted = !isMuted;
	}

	function closeSession() {
		stopVideoStream();

		if (scriptProcessor) {
			scriptProcessor.disconnect();
			scriptProcessor = null;
		}
		if (micStream) {
			micStream.getTracks().forEach((track) => track.stop());
			micStream = null;
		}
		if (ws) {
			ws.close();
			ws = null;
		}
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		aiAnalyser = null;
		micAnalyser = null;
		subtitlesText = '';
		isVideoMode = false;
		isScreenSharing = false;

		liveConversationStore.close();
	}

	// Trigger audio session when overlay gets active
	$effect(() => {
		if (isOpen) {
			startSession();
			setTimeout(() => {
				initWebGL();
				if (gl) renderFrame(performance.now());
			}, 100);
		} else {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}
			closeSession();
		}
	});

	onDestroy(() => {
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		closeSession();
	});
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-white dark:bg-black text-black dark:text-white"
		style="padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px);"
	>
		<div class="relative w-full h-full" style="padding-top: env(safe-area-inset-top, 0px);">
			<div
				class={cn(
					'absolute flex items-center justify-center w-[220px] h-[220px] transition-all duration-[600ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] left-1/2 -translate-x-1/2 -translate-y-1/2',
					isVideoMode || isScreenSharing
						? 'top-[55px] scale-[0.35] z-50'
						: 'top-[40%] scale-100 z-40'
				)}
				id="orbWrapperContainer"
			>
				<div
					class="relative w-full h-full transition-transform duration-100 ease-out orb-glow"
					id="orbInnerContainer"
				>
					<canvas bind:this={canvasElement} class="rounded-full shadow-2xl block w-full h-full"
					></canvas>
					<div
						class="absolute top-[6%] left-[12%] w-[55%] h-[35%] rounded-full bg-gradient-to-br from-white/40 to-transparent blur-[6px] pointer-events-none z-20"
					></div>
				</div>
			</div>

			<!-- Video/Screen Feed Display Container (Only render when active to avoid text leakage behind the orb) -->
			{#if isVideoMode || isScreenSharing}
				<div
					class="absolute top-[110px] bottom-5 left-5 right-5 rounded-[32px] overflow-hidden bg-[#111] pointer-events-auto z-10 transition-all duration-500"
				>
					<video
						bind:this={videoElement}
						class="w-full h-full object-cover filter brightness-[0.85]"
						autoplay
						playsinline
						muted
					></video>

					{#if isVideoMode}
						<div
							class="absolute bottom-5 left-5 right-5 flex justify-between items-end pointer-events-auto z-30"
						>
							<button
								class="w-10 h-10 rounded-full bg-black/40 text-white/80 flex items-center justify-center backdrop-blur-md transition-all active:scale-90 border-none"
								onclick={toggleTorch}
							>
								<Zap class="h-[18px] w-[18px]" />
							</button>
							<button
								class="w-10 h-10 rounded-full bg-black/40 text-white/80 flex items-center justify-center backdrop-blur-md transition-all active:scale-90 border-none"
								onclick={async () => {
									const currentFacing = videoStream?.getVideoTracks()[0].getSettings().facingMode;
									const newFacing = currentFacing === 'user' ? 'environment' : 'user';
									stopVideoStream();
									try {
										videoStream = await navigator.mediaDevices.getUserMedia({
											video: { width: 640, height: 480, facingMode: newFacing }
										});
										isVideoMode = true;
										await tick();
										if (videoElement) {
											videoElement.srcObject = videoStream;
											videoElement.play();
										}
										startVideoCapturing();
									} catch (err) {
										console.error(err);
									}
								}}
							>
								<SwitchCamera class="h-[18px] w-[18px]" />
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Action bar controls footer -->
		<div class="flex items-center justify-center gap-6 px-6 py-8 z-50">
			<!-- Camera Feed Button -->
			<button
				class={cn(
					'w-[58px] h-[58px] rounded-full border-none flex items-center justify-center text-lg transition-all duration-200 active:scale-90 shadow-md',
					isVideoMode
						? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
						: 'bg-neutral-100 hover:bg-neutral-200 text-black dark:bg-white/15 dark:hover:bg-white/20 dark:text-white'
				)}
				onclick={toggleCamera}
				title={isVideoMode ? 'Turn off camera' : 'Turn on camera'}
			>
				{#if isVideoMode}
					<VideoOff class="h-5 w-5" />
				{:else}
					<Video class="h-5 w-5" />
				{/if}
			</button>

			<!-- Microphone Mute Button -->
			<button
				class={cn(
					'w-[58px] h-[58px] rounded-full border-none flex items-center justify-center text-lg transition-all duration-200 active:scale-90 shadow-md',
					isMuted
						? 'bg-red-500 hover:bg-red-600 text-white'
						: 'bg-neutral-900 text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100'
				)}
				onclick={toggleMute}
				title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
			>
				{#if isMuted}
					<MicOff class="h-5 w-5" />
				{:else}
					<Mic class="h-5 w-5" />
				{/if}
			</button>

			<!-- Screen Share Button -->
			<button
				class={cn(
					'w-[58px] h-[58px] rounded-full border-none flex items-center justify-center text-lg transition-all duration-200 active:scale-90 shadow-md',
					isScreenSharing
						? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
						: 'bg-neutral-100 hover:bg-neutral-200 text-black dark:bg-white/15 dark:hover:bg-white/20 dark:text-white'
				)}
				onclick={toggleScreenSharing}
				title={isScreenSharing ? 'Stop sharing screen' : 'Share Screen'}
			>
				<MonitorUp class="h-5 w-5" />
			</button>

			<!-- End Session Button -->
			<button
				class="w-[58px] h-[58px] rounded-full border-none flex items-center justify-center text-lg transition-all duration-200 active:scale-90 shadow-md bg-red-600 hover:bg-red-700 text-white"
				onclick={closeSession}
				title="End Conversation"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	</div>
{/if}

<style>
	/* Custom premium glowing elements for WebGL sphere container */
	.orb-glow::before {
		content: '';
		position: absolute;
		inset: -30px;
		border-radius: 50%;
		background: radial-gradient(
			circle at 50% 45%,
			rgba(99, 102, 241, var(--glow, 0.35)),
			rgba(99, 102, 241, 0) 70%
		);
		filter: blur(20px);
		z-index: 0;
		transition: opacity 0.1s linear;
		pointer-events: none;
	}
</style>
