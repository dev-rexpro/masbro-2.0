import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const outDir = process.env.LLAMA_UI_OUT_DIR ?? './dist';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess(), mdsvex()],

	kit: {
		paths: {
			relative: true
		},
		adapter: adapter(),
		output: {
			bundleStrategy: 'single'
		},
		alias: {
			$styles: 'src/styles'
		}
	},

	extensions: ['.svelte', '.svx']
};

export default config;
