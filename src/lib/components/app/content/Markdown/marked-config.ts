import { Marked } from 'marked';

export function createMarkedInstance() {
	const marked = new Marked();

	marked.use({
		extensions: [
			{
				name: 'blockKatex',
				level: 'block',
				start(src) {
					return src.indexOf('$$');
				},
				tokenizer(src) {
					const match = src.match(/^\$\$([\s\S]+?)\$\$/);
					if (match) {
						return {
							type: 'blockKatex',
							raw: match[0],
							text: match[1].trim(),
							displayMode: true
						};
					}
					return undefined;
				}
			},
			{
				name: 'inlineKatex',
				level: 'inline',
				start(src) {
					return src.indexOf('$');
				},
				tokenizer(src) {
					const match = src.match(/^\$([^$\n]+?)\$/);
					if (match) {
						return {
							type: 'inlineKatex',
							raw: match[0],
							text: match[1].trim(),
							displayMode: false
						};
					}
					return undefined;
				}
			},
			{
				name: 'citation',
				level: 'inline',
				start(src) {
					return src.indexOf('[');
				},
				tokenizer(src) {
					const match = src.match(/^\[(\d+(?:,\s*\d+)*)\](?!\()/);
					if (match) {
						const ids = match[1]
							.split(',')
							.map((s) => parseInt(s.trim()))
							.filter((n) => !isNaN(n));
						return {
							type: 'citation',
							raw: match[0],
							ids: ids
						};
					}
					return undefined;
				}
			},
			{
				name: 'colonFence',
				level: 'block',
				start(src) {
					return src.indexOf(':::');
				},
				tokenizer(src) {
					const match = src.match(/^:::\s*([a-zA-Z0-9_-]+)\n([\s\S]*?)\n:::/);
					if (match) {
						return {
							type: 'colonFence',
							raw: match[0],
							fenceType: match[1],
							text: match[2],
							tokens: this.lexer.blockTokens(match[2])
						};
					}
					return undefined;
				}
			},
			{
				name: 'details',
				level: 'block',
				start(src) {
					return src.indexOf('<details');
				},
				tokenizer(src) {
					const match = src.match(
						/^<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/i
					);
					if (match) {
						return {
							type: 'details',
							raw: match[0],
							summary: match[1].trim(),
							text: match[2].trim(),
							attributes: { type: 'reasoning' }
						};
					}
					return undefined;
				}
			}
		]
	});

	return marked;
}

export const customMarked = createMarkedInstance();
