<script lang="ts">
	import { decode } from 'html-entities';
	import { saveAs } from 'file-saver';
	import { marked, type Token } from 'marked';
	import { copyToClipboard } from '$lib/utils';
	import { toast } from 'svelte-sonner';
	import { Copy, Download, Check } from '@lucide/svelte';

	import CodeBlock from './CodeBlock.svelte';
	import MarkdownInlineTokens from './MarkdownInlineTokens.svelte';
	import KatexRenderer from './KatexRenderer.svelte';
	import AlertRenderer, { alertComponent } from './AlertRenderer.svelte';
	import ConsecutiveDetailsGroup from './ConsecutiveDetailsGroup.svelte';
	import HtmlToken from './HTMLToken.svelte';
	import ColonFenceBlock from './ColonFenceBlock.svelte';
	import MarkdownTokens from './MarkdownTokens.svelte';

	interface Props {
		id: string;
		tokens: Token[];
		top?: boolean;
		attributes?: any;
		sourceIds?: string[];
		done?: boolean;
		save?: boolean;
		preview?: boolean;
		paragraphTag?: string;
		editCodeBlock?: boolean;
		topPadding?: boolean;
		allowEmbeds?: boolean;
		onSave?: (value: { raw: string; oldContent: string; newContent: string }) => void;
		onUpdate?: () => void;
		onPreview?: () => void;
		onTaskClick?: (data: any) => void;
		onSourceClick?: (id: string) => void;
	}

	let {
		id,
		tokens = [],
		top = true,
		attributes = {},
		sourceIds = [],
		done = true,
		save = false,
		preview = false,
		paragraphTag = 'p',
		editCodeBlock = true,
		topPadding = false,
		allowEmbeds = true,
		onSave = () => {},
		onUpdate = () => {},
		onPreview = () => {},
		onTaskClick = () => {},
		onSourceClick = () => {}
	}: Props = $props();

	const headerComponent = (depth: number) => {
		return 'h' + depth;
	};

	const GROUPABLE_DETAIL_TYPES = new Set(['tool_calls', 'reasoning', 'code_interpreter']);

	const isGroupableDetailToken = (token: Token & { attributes?: { type?: string } }) => {
		return token?.type === 'details' && GROUPABLE_DETAIL_TYPES.has(token?.attributes?.type ?? '');
	};

	const getDisplayTokens = (tokenList: Token[] = []) => {
		const displayTokens: any[] = [];
		let detailGroup: any[] = [];

		const flushDetailGroup = () => {
			if (detailGroup.length > 1) {
				displayTokens.push({
					type: 'detail_group',
					items: [...detailGroup]
				});
			} else if (detailGroup.length === 1) {
				displayTokens.push(detailGroup[0]);
			}

			detailGroup = [];
		};

		for (const token of tokenList) {
			if (isGroupableDetailToken(token)) {
				detailGroup.push(token);
			} else {
				flushDetailGroup();
				displayTokens.push(token);
			}
		}

		flushDetailGroup();

		return displayTokens;
	};

	const getDetailTextContent = (token: any) => {
		return decode(token?.text || '')
			.replace(/<summary>.*?<\/summary>/gi, '')
			.trim();
	};

	const displayTokens = $derived(getDisplayTokens(tokens));

	const unescapeHtml = (str: string) =>
		str
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'");

	const exportTableToCSVHandler = (token: any, tokenIdx = 0) => {
		const header = token.header.map(
			(headerCell: any) => `"${decode(headerCell.text).replace(/"/g, '""')}"`
		);

		const rows = token.rows.map((row: any[]) =>
			row.map((cell) => {
				const cellContent = cell.tokens.map((t: any) => t.text).join('');
				return `"${decode(cellContent).replace(/"/g, '""')}"`;
			})
		);

		const csvData = [header, ...rows];
		const csvContent = csvData.map((row) => row.join(',')).join('\n');

		const bom = '\uFEFF'; // BOM for UTF-8
		const blob = new Blob([bom + csvContent], {
			type: 'text/csv;charset=UTF-8'
		});

		saveAs(blob, `table-${id}-${tokenIdx}.csv`);
		toast.success('Table exported to CSV');
	};

	let copiedTableIdx = $state<number | null>(null);

	const copyTableRaw = async (token: any, idx: number) => {
		copiedTableIdx = idx;
		await copyToClipboard(token.raw.trim());
		toast.success('Table copied to clipboard');
		setTimeout(() => {
			copiedTableIdx = null;
		}, 1000);
	};
</script>

{#each displayTokens as token, tokenIdx (tokenIdx)}
	{#if token.type === 'hr'}
		<hr class="border-border/30 my-4" />
	{:else if token.type === 'heading'}
		<svelte:element this={headerComponent(token.depth)} dir="auto">
			<MarkdownInlineTokens
				id={`${id}-${tokenIdx}-h`}
				tokens={token.tokens}
				{done}
				{sourceIds}
				{onSourceClick}
			/>
		</svelte:element>
	{:else if token.type === 'code'}
		{#if token.raw.includes('```')}
			<CodeBlock
				id={`${id}-${tokenIdx}`}
				lang={token?.lang ?? ''}
				code={token?.text ?? ''}
				edit={editCodeBlock}
			/>
		{:else}
			{token.text}
		{/if}
	{:else if token.type === 'table'}
		<div
			class="relative w-full group mb-2 border border-border rounded-xl p-2 bg-muted/5 shadow-xs"
		>
			<div class="scrollbar-hidden relative overflow-x-auto max-w-full">
				<table class="w-full text-sm text-start text-muted-foreground max-w-full" dir="auto">
					<thead class="text-xs text-foreground uppercase bg-muted/10 border-b border-border/30">
						<tr>
							{#each token.header as header, headerIdx}
								<th
									scope="col"
									class="px-2.5 py-2 cursor-pointer"
									style={token.align[headerIdx] ? `text-align: ${token.align[headerIdx]}` : ''}
								>
									<div class="gap-1.5 text-start">
										<div class="shrink-0 break-normal">
											<MarkdownInlineTokens
												id={`${id}-${tokenIdx}-header-${headerIdx}`}
												tokens={header.tokens}
												{done}
												{sourceIds}
												{onSourceClick}
											/>
										</div>
									</div>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each token.rows as row, rowIdx}
							<tr class="border-b border-border/20 text-xs hover:bg-muted/10 transition-colors">
								{#each row ?? [] as cell, cellIdx}
									<td
										class="px-3 py-2 text-foreground"
										style={token.align[cellIdx] ? `text-align: ${token.align[cellIdx]}` : ''}
									>
										<div class="break-normal">
											<MarkdownInlineTokens
												id={`${id}-${tokenIdx}-row-${rowIdx}-${cellIdx}`}
												tokens={cell.tokens}
												{done}
												{sourceIds}
												{onSourceClick}
											/>
										</div>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="absolute top-2 right-2 z-20 invisible group-hover:visible flex gap-1">
				<button
					class="p-1 rounded-md bg-background border border-border/20 shadow-xs hover:bg-accent transition"
					onclick={(e) => {
						e.stopPropagation();
						copyTableRaw(token, tokenIdx);
					}}
					title="Copy Table"
				>
					{#if copiedTableIdx === tokenIdx}
						<Check class="size-3.5 text-green-500" />
					{:else}
						<Copy class="size-3.5" />
					{/if}
				</button>

				<button
					class="p-1 rounded-md bg-background border border-border/20 shadow-xs hover:bg-accent transition"
					onclick={(e) => {
						e.stopPropagation();
						exportTableToCSVHandler(token, tokenIdx);
					}}
					title="Export to CSV"
				>
					<Download class="size-3.5" />
				</button>
			</div>
		</div>
	{:else if token.type === 'blockquote'}
		{@const alert = alertComponent(token)}
		{#if alert}
			<AlertRenderer {token} {alert} />
		{:else}
			<blockquote dir="auto">
				<MarkdownTokens
					id={`${id}-${tokenIdx}`}
					tokens={token.tokens}
					{done}
					{editCodeBlock}
					{onTaskClick}
					{sourceIds}
					{onSourceClick}
				/>
			</blockquote>
		{/if}
	{:else if token.type === 'list'}
		{#if token.ordered}
			<ol start={token.start || 1} dir="auto">
				{#each token.items as item, itemIdx}
					<li class="text-start">
						{#if item?.task}
							<input
								class="translate-y-[1px] -translate-x-1 flex-shrink-0"
								type="checkbox"
								checked={item.checked}
								onchange={(e) => {
									onTaskClick({
										id: id,
										token: token,
										tokenIdx: tokenIdx,
										item: item,
										itemIdx: itemIdx,
										checked: (e.target as HTMLInputElement).checked
									});
								}}
							/>
						{/if}

						<MarkdownTokens
							id={`${id}-${tokenIdx}-${itemIdx}`}
							tokens={item.tokens}
							top={token.loose}
							{done}
							{editCodeBlock}
							{onTaskClick}
							{sourceIds}
							{onSourceClick}
						/>
					</li>
				{/each}
			</ol>
		{:else}
			<ul dir="auto">
				{#each token.items as item, itemIdx}
					<li class="text-start {item?.task ? 'flex -translate-x-6.5 gap-3' : ''}">
						{#if item?.task}
							<input
								class="flex-shrink-0"
								type="checkbox"
								checked={item.checked}
								onchange={(e) => {
									onTaskClick({
										id: id,
										token: token,
										tokenIdx: tokenIdx,
										item: item,
										itemIdx: itemIdx,
										checked: (e.target as HTMLInputElement).checked
									});
								}}
							/>

							<div>
								<MarkdownTokens
									id={`${id}-${tokenIdx}-${itemIdx}`}
									tokens={item.tokens}
									top={token.loose}
									{done}
									{editCodeBlock}
									{onTaskClick}
									{sourceIds}
									{onSourceClick}
								/>
							</div>
						{:else}
							<MarkdownTokens
								id={`${id}-${tokenIdx}-${itemIdx}`}
								tokens={item.tokens}
								top={token.loose}
								{done}
								{editCodeBlock}
								{onTaskClick}
								{sourceIds}
								{onSourceClick}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else if token.type === 'detail_group'}
		<ConsecutiveDetailsGroup
			id={`${id}-${tokenIdx}-detail-group`}
			tokens={token.items}
			messageDone={done}
			{allowEmbeds}
		>
			{#snippet content()}
				<div class="space-y-1">
					{#each token.items as detailToken, detailIdx}
						{@const textContent = getDetailTextContent(detailToken)}
						{#if textContent.length > 0}
							<details class="w-full border border-border rounded-lg p-2 bg-muted/20">
								<summary
									class="cursor-pointer font-medium text-sm text-muted-foreground select-none"
								>
									{detailToken.summary}
								</summary>
								<div class="mt-2 pl-4 border-l border-border">
									<MarkdownTokens
										id={`${id}-${tokenIdx}-${detailIdx}-d`}
										tokens={marked.lexer(decode(detailToken.text))}
										attributes={detailToken?.attributes}
										{done}
										{editCodeBlock}
										{onTaskClick}
										{sourceIds}
										{onSourceClick}
									/>
								</div>
							</details>
						{:else}
							<details class="w-full border border-border rounded-lg p-2 bg-muted/20" open={false}>
								<summary class="font-medium text-sm text-muted-foreground select-none opacity-50">
									{detailToken.summary}
								</summary>
							</details>
						{/if}
					{/each}
				</div>
			{/snippet}
		</ConsecutiveDetailsGroup>
	{:else if token.type === 'details'}
		{@const textContent = getDetailTextContent(token)}
		{#if textContent.length > 0}
			<details class="w-full border border-border rounded-lg p-2 my-2 bg-muted/20">
				<summary class="cursor-pointer font-medium text-sm text-muted-foreground select-none">
					{token.summary}
				</summary>
				<div class="mt-2 pl-4 border-l border-border">
					<MarkdownTokens
						id={`${id}-${tokenIdx}-d`}
						tokens={marked.lexer(decode(token.text))}
						attributes={token?.attributes}
						{done}
						{editCodeBlock}
						{onTaskClick}
						{sourceIds}
						{onSourceClick}
					/>
				</div>
			</details>
		{:else}
			<details class="w-full border border-border rounded-lg p-2 my-2 bg-muted/20" open={false}>
				<summary class="font-medium text-sm text-muted-foreground select-none opacity-50">
					{token.summary}
				</summary>
			</details>
		{/if}
	{:else if token.type === 'html'}
		<HtmlToken {id} {token} />
	{:else if token.type === 'iframe'}
		<iframe
			src="/api/v1/files/{token.fileId}/content"
			title={token.fileId}
			style="width: 100%; border: 0;"
			onload={(e) => {
				try {
					const el = e.currentTarget as HTMLIFrameElement;
					el.style.height = (el.contentWindow?.document.body.scrollHeight ?? 300) + 20 + 'px';
				} catch {}
			}}
		></iframe>
	{:else if token.type === 'paragraph'}
		{#if paragraphTag == 'span'}
			<span dir="auto">
				<MarkdownInlineTokens
					id={`${id}-${tokenIdx}-p`}
					tokens={token.tokens ?? []}
					{done}
					{sourceIds}
					{onSourceClick}
				/>
			</span>
		{:else}
			<p dir="auto">
				<MarkdownInlineTokens
					id={`${id}-${tokenIdx}-p`}
					tokens={token.tokens ?? []}
					{done}
					{sourceIds}
					{onSourceClick}
				/>
			</p>
		{/if}
	{:else if token.type === 'text'}
		{#if top}
			<p dir="auto">
				{#if token.tokens}
					<MarkdownInlineTokens
						id={`${id}-${tokenIdx}-t`}
						tokens={token.tokens}
						{done}
						{sourceIds}
						{onSourceClick}
					/>
				{:else}
					{unescapeHtml(token.text)}
				{/if}
			</p>
		{:else if token.tokens}
			<MarkdownInlineTokens
				id={`${id}-${tokenIdx}-p`}
				tokens={token.tokens ?? []}
				{done}
				{sourceIds}
				{onSourceClick}
			/>
		{:else}
			{unescapeHtml(token.text)}
		{/if}
	{:else if token.type === 'inlineKatex'}
		{#if token.text}
			<KatexRenderer content={token.text} displayMode={(token as any)?.displayMode ?? false} />
		{/if}
	{:else if token.type === 'blockKatex'}
		{#if token.text}
			<KatexRenderer content={token.text} displayMode={(token as any)?.displayMode ?? false} />
		{/if}
	{:else if token.type === 'colonFence'}
		<ColonFenceBlock
			id={`${id}-${tokenIdx}`}
			{token}
			{tokenIdx}
			{done}
			{editCodeBlock}
			{sourceIds}
			{onTaskClick}
			{onSourceClick}
		/>
	{:else if token.type === 'space'}
		<div class="my-2"></div>
	{:else}
		{console.log('Unknown token', token)}
	{/if}
{/each}
