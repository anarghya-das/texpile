<script lang="ts">
	import { ChevronDown, ChevronRight, LoaderCircle, X } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages';
	import type { CompactionItem } from '../../agentPanel.types';

	type Props = { compaction: CompactionItem };
	const props: Props = $props();
	let open = $state(false);

	const status = $derived(props.compaction.status);
	const label = $derived(
		status === 'in_progress'
			? m.agent_panel_compacting()
			: status === 'completed'
				? m.agent_panel_compacted()
				: status === 'failed'
					? m.agent_panel_compaction_failed()
					: m.agent_panel_compaction_stopped()
	);
	const summary = $derived(status === 'completed' ? props.compaction.summary.trim() : '');
</script>

<div class="text-xs {status === 'failed' ? 'text-error-ink' : 'text-muted'}">
	<div class="flex items-center gap-2">
		<span class="border-surface-200-800 flex-1 border-t"></span>
		{#if summary}
			<button
				class="hover:preset-tonal rounded-base flex items-center gap-1 px-1 py-0.5"
				aria-expanded={open}
				onclick={() => (open = !open)}
			>
				{#if open}<ChevronDown class="size-3.5" />{:else}<ChevronRight class="size-3.5" />{/if}
				<span class="cap-center">{label}</span>
			</button>
		{:else}
			<span class="flex items-center gap-1 px-1 py-0.5">
				{#if status === 'in_progress'}
					<LoaderCircle class="size-3.5 animate-spin" />
				{:else if status === 'failed'}
					<X class="size-3.5" />
				{/if}
				<span class="cap-center">{label}</span>
			</span>
		{/if}
		<span class="border-surface-200-800 flex-1 border-t"></span>
	</div>
	{#if status === 'failed' && props.compaction.error}
		<p class="mt-1 text-center break-words whitespace-pre-wrap">{props.compaction.error}</p>
	{/if}
	{#if open && summary}<p class="mt-1 break-words whitespace-pre-wrap">{summary}</p>{/if}
</div>
