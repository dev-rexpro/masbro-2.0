import type { PageLoad } from './$types';
import { validateApiKey } from '$lib/utils';
import { DEMO_MODE } from '$lib/constants';

export const load: PageLoad = async ({ fetch }) => {
	if (DEMO_MODE) return;
	await validateApiKey(fetch);
};
