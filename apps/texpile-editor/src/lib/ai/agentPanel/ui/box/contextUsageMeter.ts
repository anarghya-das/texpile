import { Shrink } from '@lucide/svelte';
import { m } from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import type { ContextMenuItem } from '$lib/menus/contextMenu.svelte';
import type { AgentCommand, ContextUsage } from '../../agentPanel.types';

const CONTEXT_NEARLY_FULL = 0.8;
const COMPACT_COMMAND = 'compact';

export const COMPACT_CHAT_MESSAGE = `/${COMPACT_COMMAND}`;

export function contextShare(usage: ContextUsage): number {
	return Math.min(1, usage.used / usage.size);
}

export function isContextNearlyFull(usage: ContextUsage): boolean {
	return contextShare(usage) >= CONTEXT_NEARLY_FULL;
}

export function contextUsageLabel(usage: ContextUsage): string {
	const tokens = new Intl.NumberFormat(getLocale(), { notation: 'compact', maximumFractionDigits: 1 });
	return m.agent_panel_context({
		percent: new Intl.NumberFormat(getLocale(), { style: 'percent' }).format(contextShare(usage)),
		used: tokens.format(usage.used),
		size: tokens.format(usage.size)
	});
}

export function contextUsageMenu(
	usage: ContextUsage,
	commands: AgentCommand[],
	working: boolean,
	agent: string,
	onCompact: () => void
): ContextMenuItem[] {
	const offered = commands.some((c) => c.name === COMPACT_COMMAND);
	const tip = !offered
		? m.agent_panel_compact_unavailable({ agent })
		: working
			? m.agent_panel_compact_busy({ agent })
			: m.agent_panel_compact_note();
	return [
		{ label: contextUsageLabel(usage), disabled: true },
		{ separator: true },
		{ label: m.agent_panel_compact_now(), icon: Shrink, onclick: onCompact, disabled: !offered || working, tip }
	];
}
