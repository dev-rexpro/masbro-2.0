import { browser } from '$app/environment';

class ToolsConfigStore {
	structuredOutputsEnabled = $state(false);
	structuredOutputsSchema = $state('');
	codeExecutionEnabled = $state(false);
	functionCallingEnabled = $state(false);
	functionCallingSchema = $state('');
	googleSearchGroundingEnabled = $state(true);
	googleMapsGroundingEnabled = $state(false);
	urlContextEnabled = $state(false);

	constructor() {
		if (browser) {
			try {
				const saved = localStorage.getItem('tools_config');
				if (saved) {
					const parsed = JSON.parse(saved);
					if (typeof parsed === 'object' && parsed !== null) {
						this.structuredOutputsEnabled = !!parsed.structuredOutputsEnabled;
						this.structuredOutputsSchema = parsed.structuredOutputsSchema || '';
						this.codeExecutionEnabled = !!parsed.codeExecutionEnabled;
						this.functionCallingEnabled = !!parsed.functionCallingEnabled;
						this.functionCallingSchema = parsed.functionCallingSchema || '';
						this.googleSearchGroundingEnabled = parsed.googleSearchGroundingEnabled !== false;
						this.googleMapsGroundingEnabled = !!parsed.googleMapsGroundingEnabled;
						this.urlContextEnabled = !!parsed.urlContextEnabled;
					}
				}
			} catch (e) {
				console.error('[ToolsConfigStore] Failed to load config:', e);
			}
		}
	}

	save() {
		if (!browser) return;
		try {
			localStorage.setItem(
				'tools_config',
				JSON.stringify({
					structuredOutputsEnabled: this.structuredOutputsEnabled,
					structuredOutputsSchema: this.structuredOutputsSchema,
					codeExecutionEnabled: this.codeExecutionEnabled,
					functionCallingEnabled: this.functionCallingEnabled,
					functionCallingSchema: this.functionCallingSchema,
					googleSearchGroundingEnabled: this.googleSearchGroundingEnabled,
					googleMapsGroundingEnabled: this.googleMapsGroundingEnabled,
					urlContextEnabled: this.urlContextEnabled
				})
			);
		} catch (e) {
			console.error('[ToolsConfigStore] Failed to save config:', e);
		}
	}

	toggleStructuredOutputs() {
		this.structuredOutputsEnabled = !this.structuredOutputsEnabled;
		this.save();
	}

	setStructuredOutputsSchema(val: string) {
		this.structuredOutputsSchema = val;
		this.save();
	}

	toggleCodeExecution() {
		this.codeExecutionEnabled = !this.codeExecutionEnabled;
		this.save();
	}

	toggleFunctionCalling() {
		this.functionCallingEnabled = !this.functionCallingEnabled;
		this.save();
	}

	setFunctionCallingSchema(val: string) {
		this.functionCallingSchema = val;
		this.save();
	}

	toggleGoogleSearchGrounding() {
		this.googleSearchGroundingEnabled = !this.googleSearchGroundingEnabled;
		this.save();
	}

	toggleGoogleMapsGrounding() {
		this.googleMapsGroundingEnabled = !this.googleMapsGroundingEnabled;
		this.save();
	}

	toggleUrlContext() {
		this.urlContextEnabled = !this.urlContextEnabled;
		this.save();
	}
}

export const toolsConfigStore = new ToolsConfigStore();
