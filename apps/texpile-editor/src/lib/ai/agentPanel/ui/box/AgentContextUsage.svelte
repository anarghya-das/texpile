<script lang="ts">
	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import { showContextMenu } from '$lib/menus/contextMenu.svelte';
	import { tip } from '$lib/components/tooltip.svelte';
	import { contextShare, contextUsageLabel, contextUsageMenu, isContextNearlyFull } from './contextUsageMeter';
	import type { AgentCommand, ContextUsage } from '../../agentPanel.types';

	type Props = { usage: ContextUsage; commands: AgentCommand[]; working: boolean; agent: string; onCompact: () => void };
	const props: Props = $props();
	const label = $derived(contextUsageLabel(props.usage));
	const colour = $derived(isContextNearlyFull(props.usage) ? 'text-warning-ink' : 'text-muted');

	function openMenu(button: HTMLElement): void {
		const at = button.getBoundingClientRect();
		void showContextMenu(
			contextUsageMenu(props.usage, props.commands, props.working, props.agent, props.onCompact),
			{ x: at.left, y: at.top - 4 },
			{ above: true }
		);
	}
</script>

<button
	class="{colour} hover:bg-surface-200-800 rounded-base flex size-6 shrink-0 items-center justify-center transition-colors"
	aria-label={label}
	use:tip={label}
	onclick={(e) => openMenu(e.currentTarget)}
>
	<Progress value={contextShare(props.usage) * 100}>
		<Progress.Circle class="[--size:calc(var(--spacing)*3.5)] [--thickness:calc(var(--spacing)*0.5)]">
			<Progress.CircleTrack />
			<Progress.CircleRange class="stroke-current" />
		</Progress.Circle>
	</Progress>
</button>
