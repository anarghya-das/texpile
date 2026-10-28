<script lang="ts">
	// How full the chat's context is: a ring beside Send that fills as the chat grows, and turns to a warning once
	// the agent is close to dropping or summing up the oldest of it. The counts are in its hint
	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import { tip } from '$lib/components/tooltip.svelte';
	import { contextShare, contextUsageLabel, isContextNearlyFull } from './contextUsageMeter';
	import type { ContextUsage } from '../../agentPanel.types';

	type Props = { usage: ContextUsage };
	const props: Props = $props();
	const label = $derived(contextUsageLabel(props.usage));
</script>

<Progress value={contextShare(props.usage) * 100}>
	{#snippet element(attrs)}
		<div
			{...attrs}
			class="flex size-6 shrink-0 items-center justify-center {isContextNearlyFull(props.usage) ? 'text-warning-ink' : 'text-muted'}"
			use:tip={label}
		>
			<Progress.Circle class="[--size:calc(var(--spacing)*3.5)] [--thickness:calc(var(--spacing)*0.5)]" aria-label={label}>
				<Progress.CircleTrack />
				<Progress.CircleRange class="stroke-current" />
			</Progress.Circle>
		</div>
	{/snippet}
</Progress>
