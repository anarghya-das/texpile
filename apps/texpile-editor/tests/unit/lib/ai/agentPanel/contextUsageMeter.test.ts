import { it, expect } from 'vitest';
import { contextShare, contextUsageLabel, isContextNearlyFull } from '$lib/ai/agentPanel/ui/box/contextUsageMeter';

it('says how much of the context the chat fills, in tokens rounded the way the reader reads them', () => {
	expect(contextUsageLabel({ used: 48_200, size: 1_000_000 })).toBe('5% of context used (48.2K of 1M tokens)');
	expect(contextUsageLabel({ used: 150_000, size: 200_000 })).toBe('75% of context used (150K of 200K tokens)');
});

it('fills the ring no further than full when the agent counts past its window', () => {
	expect(contextShare({ used: 210_000, size: 200_000 })).toBe(1);
	expect(contextUsageLabel({ used: 210_000, size: 200_000 })).toBe('100% of context used (210K of 200K tokens)');
});

it('warns from four fifths of the window on', () => {
	expect(isContextNearlyFull({ used: 159_999, size: 200_000 })).toBe(false);
	expect(isContextNearlyFull({ used: 160_000, size: 200_000 })).toBe(true);
});
