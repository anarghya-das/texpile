// the ring beside Send: how much of the agent's context the chat fills, and what its hint says
import { m } from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import type { ContextUsage } from '../../agentPanel.types';

/** from here on the agent is close to compacting the chat, so the ring warns */
const NEARLY_FULL = 0.8;

/** from 0 to 1: an agent can count a little past its window */
export function contextShare(usage: ContextUsage): number {
	return Math.min(1, usage.used / usage.size);
}

export function isContextNearlyFull(usage: ContextUsage): boolean {
	return contextShare(usage) >= NEARLY_FULL;
}

export function contextUsageLabel(usage: ContextUsage): string {
	const tokens = new Intl.NumberFormat(getLocale(), { notation: 'compact', maximumFractionDigits: 1 });
	return m.agent_panel_context({
		percent: new Intl.NumberFormat(getLocale(), { style: 'percent' }).format(contextShare(usage)),
		used: tokens.format(usage.used),
		size: tokens.format(usage.size)
	});
}
