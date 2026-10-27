<script lang="ts">
	// How full the chat's context is: a ring beside Send that fills as the chat grows, and turns to a warning once
	// the agent is close to dropping or summing up the oldest of it. The counts are in its hint
	import { tip } from '$lib/components/tooltip.svelte';
	import { contextShare, contextUsageLabel, isContextNearlyFull } from './contextUsageMeter';
	import type { ContextUsage } from '../../agentPanel.types';

	type Props = { usage: ContextUsage };
	const props: Props = $props();
	const share = $derived(contextShare(props.usage));
	const label = $derived(contextUsageLabel(props.usage));
</script>

<span
	class="flex size-6 shrink-0 items-center justify-center {isContextNearlyFull(props.usage) ? 'text-warning-ink' : 'text-muted'}"
	role="meter"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(share * 100)}
	use:tip={label}
>
	<!-- a quarter turn back, so the ring fills clockwise from the top -->
	<svg class="size-3.5 -rotate-90" viewBox="0 0 16 16" aria-hidden="true">
		<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="2" opacity="0.25" />
		<circle
			cx="8"
			cy="8"
			r="6.5"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			pathLength="100"
			stroke-dasharray="{share * 100} 100"
		/>
	</svg>
</span>
