import { PropsService } from '$lib/services/props.service';
import { ServerRole } from '$lib/enums';
import { getProviderConfig } from '$lib/utils/api-headers';

/**
 * serverStore - Server connection state, configuration, and role detection
 *
 * This store manages the server connection state and properties fetched from `/props`.
 * It provides reactive state for server configuration and role detection.
 *
 * **Architecture & Relationships:**
 * - **PropsService**: Stateless service for fetching `/props` data
 * - **serverStore** (this class): Reactive store for server state
 * - **modelsStore**: Independent store for model management (uses PropsService directly)
 *
 * **Key Features:**
 * - **Server State**: Connection status, loading, error handling
 * - **Role Detection**: MODEL (single model) vs ROUTER (multi-model)
 * - **Default Params**: Server-wide generation defaults
 */
class ServerStore {
	/**
	 *
	 *
	 * State
	 *
	 *
	 */

	props = $state<ApiLlamaCppServerProps | null>(null);
	loading = $state(false);
	error = $state<string | null>(null);
	role = $state<ServerRole | null>(ServerRole.MODEL);
	private fetchPromise: Promise<void> | null = null;

	/**
	 *
	 *
	 * Getters
	 *
	 *
	 */

	get defaultParams(): ApiLlamaCppServerProps['default_generation_settings']['params'] | null {
		return this.props?.default_generation_settings?.params || null;
	}

	get contextSize(): number | null {
		return this.props?.default_generation_settings?.n_ctx || null;
	}

	get uiSettings(): Record<string, string | number | boolean> | undefined {
		return undefined;
	}

	get isRouterMode(): boolean {
		return this.role === ServerRole.ROUTER;
	}

	get isModelMode(): boolean {
		return this.role === ServerRole.MODEL;
	}

	/**
	 *
	 *
	 * Data Handling
	 *
	 *
	 */

	async fetch(): Promise<void> {
		const providerConfig = getProviderConfig();
		if (providerConfig && providerConfig.providerName !== 'llamacpp') {
			this.props = null;
			this.error = null;
			this.role = ServerRole.MODEL;
			return;
		}

		if (this.fetchPromise) return this.fetchPromise;

		this.loading = true;
		this.error = null;

		this.fetchPromise = (async () => {
			try {
				const props = await PropsService.fetch();
				this.props = props;
				this.detectRole(props);
			} catch (err) {
				this.error = err instanceof Error ? err.message : String(err);
				this.props = null;
				throw err;
			} finally {
				this.loading = false;
				this.fetchPromise = null;
			}
		})();

		return this.fetchPromise;
	}

	clear(): void {
		this.props = null;
		this.error = null;
		this.loading = false;
		this.role = ServerRole.MODEL;
		this.fetchPromise = null;
	}

	async fetchQuiet(): Promise<void> {
		const providerConfig = getProviderConfig();
		if (providerConfig && providerConfig.providerName !== 'llamacpp') {
			this.props = null;
			this.error = null;
			this.role = ServerRole.MODEL;
			return;
		}

		try {
			const props = await PropsService.fetch();
			this.props = props;
			this.detectRole(props);
		} catch (err) {
			console.warn('Quiet props fetch failed:', err);
		}
	}

	/**
	 *
	 *
	 * Utilities
	 *
	 *
	 */

	private detectRole(props: ApiLlamaCppServerProps): void {
		this.role = props.role || ServerRole.MODEL;
	}
}

export const serverStore = new ServerStore();

export const serverProps = () => serverStore.props;
export const serverLoading = () => serverStore.loading;
export const serverError = () => serverStore.error;
export const serverRole = () => serverStore.role;
export const defaultParams = () => serverStore.defaultParams;
export const contextSize = () => serverStore.contextSize;
export const isRouterMode = () => serverStore.isRouterMode;
export const isModelMode = () => serverStore.isModelMode;
