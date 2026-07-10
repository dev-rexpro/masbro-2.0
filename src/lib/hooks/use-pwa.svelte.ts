import { browser } from '$app/environment';
import { versionStore } from '$lib/stores/version.svelte';
import { BUILD_VERSION_LOCALSTORAGE_KEY } from '$lib/constants/storage';

export function usePwa() {
	let needRefreshByStorage = $state(false);

	$effect(() => {
		if (!browser) return;
		if (navigator.serviceWorker?.controller) return;

		const currentVersion = versionStore.value;
		if (!currentVersion) return;

		try {
			const storedVersion = localStorage.getItem(BUILD_VERSION_LOCALSTORAGE_KEY);
			needRefreshByStorage = !!storedVersion && storedVersion !== currentVersion;
			localStorage.setItem(BUILD_VERSION_LOCALSTORAGE_KEY, currentVersion);
		} catch {
			needRefreshByStorage = false;
		}
	});

	return {
		get needRefresh() {
			return false;
		},
		updateServiceWorker: () => {},
		get needRefreshByStorage() {
			return needRefreshByStorage;
		}
	};
}
