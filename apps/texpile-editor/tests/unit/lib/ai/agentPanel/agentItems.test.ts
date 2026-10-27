import { it, expect } from 'vitest';
import { applyUpdate, chatBlocks, contextUsage, toolTitle } from '$lib/ai/agentPanel/agentItems';
import type { ChatItem, SessionUpdate } from '$lib/ai/agentPanel/agentPanel.types';

function run(updates: SessionUpdate[]): ChatItem[] {
	return updates.reduce<ChatItem[]>((items, u) => applyUpdate(items, u), []);
}

it("merges a tool call's later updates into the one step, keeping what each did not say", () => {
	const items = run([
		{ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Edit main.tex', kind: 'edit', status: 'pending' },
		{ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'in_progress', locations: [{ path: '/p/main.tex' }] },
		{ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' }
	]);
	expect(items).toEqual([
		{ kind: 'tool', id: 't1', title: 'Edit main.tex', toolKind: 'edit', status: 'completed', paths: ['/p/main.tex'] }
	]);
});

it('starts a new message after a step, and groups steps with nothing between them', () => {
	const chunk = (text: string): SessionUpdate => ({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });
	const items = run([
		chunk('Reading '),
		chunk('it.'),
		{ sessionUpdate: 'tool_call', toolCallId: 'a', title: 'Read main.tex', kind: 'read', status: 'completed' },
		{ sessionUpdate: 'tool_call', toolCallId: 'b', title: 'Search', kind: 'search', status: 'completed' },
		chunk('Done.')
	]);
	expect(
		chatBlocks(items).map((b) => (b.kind === 'steps' ? b.tools.map((t) => t.id).join('+') : b.kind === 'agent' ? b.text : b.kind))
	).toEqual(['Reading it.', 'a+b', 'Done.']);
});

it("names a tool from Texpile's own MCP server in words, and leaves the agent's own tools as they are", () => {
	expect(toolTitle('mcp__texpile__get_editor_state')).toBe('Texpile: get editor state');
	expect(toolTitle('Edit main.tex')).toBe('Edit main.tex');
});

it('reads the context a usage_update reports, and nothing from one with no window to measure against', () => {
	expect(contextUsage({ sessionUpdate: 'usage_update', used: 52_000, size: 200_000, cost: { amount: 0.4, currency: 'USD' } })).toEqual({
		used: 52_000,
		size: 200_000
	});
	expect(contextUsage({ sessionUpdate: 'usage_update', used: 52_000, size: 0 })).toBeNull();
	expect(contextUsage({ sessionUpdate: 'usage_update', used: '52000', size: 200_000 })).toBeNull();
});

it('places a compaction at its first update, streams its summary in, and patches it with the later ones', () => {
	const summary = (text: string) => [{ type: 'text', text }];
	const items = run([
		{ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Reading.' } },
		{ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'in_progress' },
		{ sessionUpdate: 'compaction_summary_chunk', compactionId: 'c1', content: { type: 'text', text: 'Asked to ' } },
		{ sessionUpdate: 'compaction_summary_chunk', compactionId: 'c1', content: { type: 'text', text: 'fix the intro.' } },
		// one with no summary leaves the summary standing
		{ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'completed' },
		{ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Done.' } },
		{ sessionUpdate: 'compaction_update', compactionId: 'c2', status: 'completed', summary: summary('Old.') },
		// an empty summary clears it
		{ sessionUpdate: 'compaction_update', compactionId: 'c2', status: 'completed', summary: [] }
	]);
	expect(items.map((i) => (i.kind === 'compaction' ? `${i.compactionId}:${i.status}:${i.summary}` : i.kind))).toEqual([
		'agent',
		'c1:completed:Asked to fix the intro.',
		'agent',
		'c2:completed:'
	]);
});

it("keeps a failed compaction's reason, and drops a summary chunk for a compaction it never saw start", () => {
	const items = run([
		{ sessionUpdate: 'compaction_summary_chunk', compactionId: 'gone', content: { type: 'text', text: 'lost' } },
		{ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'in_progress' },
		{ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'failed', error: 'Prompt is too long' }
	]);
	expect(items).toEqual([
		{ kind: 'compaction', id: expect.any(String), compactionId: 'c1', status: 'failed', summary: '', error: 'Prompt is too long' }
	]);
});
