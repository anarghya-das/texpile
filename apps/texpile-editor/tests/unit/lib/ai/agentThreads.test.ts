// The runner between a thread and the agent: the comments controller and the agent are stood in for
import { it, expect, beforeEach } from 'vitest';
import { AgentThreads } from '$lib/ai/agentThreads.svelte';
import { REFINE_ACTIONS } from '$lib/ai/refineActions';
import { buildAnchor, type CommentAnchor } from '$lib/comments/anchor';
import type { CommentThread } from '$lib/comments/log';
import type { CommentsController } from '$lib/workspace/commentsController.svelte';
import type { SourceEdit } from '$lib/workspace/suggestions/suggestionsController';

const PAPER = '\\section{Results}\nOur method is always faster than every baseline.\nSee Table 2.\n';
const PASSAGE = 'Our method is always faster than every baseline.';

type Run = {
	prompt: string;
	system: string;
	agent: string;
	folder: boolean;
	answer: (text: string) => void;
	fail: (error: string) => void;
};

let runs: Run[] = [];

beforeEach(async () => {
	runs = [];
	const { updateSettings } = await import('$lib/settings');
	updateSettings({ refineAgents: ['claude'], aiOff: false });
	(globalThis as { texpileAgent?: unknown }).texpileAgent = {
		run: (_id: string, prompt: string, system: string, agent: string, folder = false) =>
			new Promise((resolve) =>
				runs.push({
					prompt,
					system,
					agent,
					folder,
					answer: (text) => resolve({ ok: true, text }),
					fail: (error) => resolve({ ok: false, error })
				})
			),
		cancel: () => {}
	};
});

/** a workspace with `main.tex` open, holding one thread on PASSAGE whose last message is `ask` */
function workspace(ask = '@agent is this claim supported?') {
	let text = PAPER;
	const from = PAPER.indexOf(PASSAGE);
	const threads: CommentThread[] = [];
	const thread: CommentThread = {
		id: 't1',
		file: 'main.tex',
		anchor: buildAnchor(PAPER, from, from + PASSAGE.length),
		resolved: false,
		messages: [{ id: 't1', at: '', by: 'Mei', body: ask }]
	};
	threads.push(thread);
	const suggested: { by: string; edit: SourceEdit; note: string }[] = [];
	const drafts: string[] = [];
	const moved: { thread: string; quote: string }[] = [];
	const ctl = {
		threads,
		activeFile: 'main.tex',
		async reply(t: CommentThread, body: string, by?: string) {
			t.messages.push({ id: crypto.randomUUID(), at: '', by: by ?? 'Mei', body });
			return 'r';
		},
		async moveAnchor(t: CommentThread, anchor: CommentAnchor) {
			moved.push({ thread: t.id, quote: anchor.quote });
			t.anchor = anchor;
		},
		suggestions: {
			async suggestAs(by: string, edit: SourceEdit, note: string) {
				suggested.push({ by, edit, note });
				const restore = text.slice(edit.from, edit.to);
				text = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
				const anchor = buildAnchor(text, edit.from, edit.from + edit.insert.length);
				threads.push({ id: 's1', file: 'main.tex', anchor, resolved: false, restore, messages: [{ id: 's1', at: '', by, body: note }] });
				return 's1';
			}
		}
	};
	const agents = new AgentThreads({
		ctl: ctl as unknown as CommentsController,
		activeText: () => text,
		liveAnchors: () => null,
		canSuggest: () => true,
		selection: () => null,
		named: async () => true,
		pinSelection: () => {},
		openAgentTab: (draft) => drafts.push(draft)
	});
	return {
		agents,
		thread,
		threads,
		suggested,
		moved,
		drafts,
		type: (next: string) => (text = next),
		text: () => text
	};
}

it('answers a question in the thread, signed by the agent, from the project folder, and changes nothing', async () => {
	const w = workspace();
	w.agents.ask('t1');
	expect(w.agents.runs.get('t1')).toEqual({ agent: 'Claude', waiting: false });
	await expect.poll(() => runs.length).toBe(1);
	expect(runs[0]).toMatchObject({ agent: 'claude', folder: true });
	expect(runs[0].prompt).toContain(`The passage:\n<<<\n${PASSAGE}\n>>>`);
	runs[0].answer('<reply>Only by Table 1; Table 2 shows one slower case.</reply>');
	await expect.poll(() => w.thread.messages.length).toBe(2);
	expect(w.thread.messages[1]).toMatchObject({ by: 'Claude', body: 'Only by Table 1; Table 2 shows one slower case.' });
	expect(w.suggested).toEqual([]);
	expect(w.agents.runs.has('t1')).toBe(false);
});

it('makes a change asked for as its own suggestion, takes the thread onto the new words, and back when it is rejected', async () => {
	const w = workspace('@agent tone it down');
	w.agents.ask('t1');
	await expect.poll(() => runs.length).toBe(1);
	runs[0].answer('<reply>Softened "always".</reply><edit>Our method is often faster than the baselines.</edit>');
	await expect.poll(() => w.thread.messages.length).toBe(2);
	const from = PAPER.indexOf(PASSAGE);
	expect(w.suggested).toEqual([
		{
			by: 'Claude',
			edit: { from, to: from + PASSAGE.length, insert: 'Our method is often faster than the baselines.' },
			note: 'tone it down'
		}
	]);
	expect(w.moved).toEqual([{ thread: 't1', quote: 'Our method is often faster than the baselines.' }]);
	expect(w.thread.messages[1].body).toBe('Softened "always".');

	const s = w.threads.find((t) => t.id === 's1')!;
	Object.assign(s, { resolved: true, decision: 'rejected' });
	w.agents.follow(w.threads);
	await expect.poll(() => w.moved.length).toBe(2);
	expect(w.moved[1]).toEqual({ thread: 't1', quote: PASSAGE });
});

it('keeps a change whose passage was retyped while the agent worked in the thread, as words, rather than in the file', async () => {
	const w = workspace('@agent tone it down');
	w.agents.ask('t1');
	await expect.poll(() => runs.length).toBe(1);
	w.type(PAPER.replace('always', 'nearly always'));
	runs[0].answer('<reply>Softened it.</reply><edit>Our method is often faster.</edit>');
	await expect.poll(() => w.thread.messages.length).toBe(2);
	expect(w.suggested).toEqual([]);
	expect(w.thread.messages[1].body).toBe(
		'Softened it.\n\nNot suggested in the file. The passage changed while Claude was working. The proposed text:\n\nOur method is often faster.'
	);
});

it('asks for the change a quick action names, and notes the suggestion with its label', async () => {
	const w = workspace('@agent Shorten');
	w.agents.ask(
		't1',
		REFINE_ACTIONS.find((a) => a.id === 'shorten')
	);
	await expect.poll(() => runs.length).toBe(1);
	expect(runs[0].prompt.startsWith('Make the passage shorter')).toBe(true);
	runs[0].answer('<reply>Cut the second clause.</reply><edit>Our method is faster.</edit>');
	await expect.poll(() => w.suggested.length).toBe(1);
	expect(w.suggested[0].note).toBe('Shorten');
});

it('runs three threads at once and starts the next as one finishes; a failure stays on its thread to ask again', async () => {
	const w = workspace();
	for (const id of ['t2', 't3', 't4']) w.threads.push({ ...w.thread, id, messages: [...w.thread.messages] });
	for (const id of ['t1', 't2', 't3', 't4']) w.agents.ask(id);
	await expect.poll(() => runs.length).toBe(3);
	expect(w.agents.runs.get('t4')?.waiting).toBe(true);
	runs[1].fail('claude was not found on PATH');
	await expect.poll(() => runs.length).toBe(4);
	expect(w.agents.failed.get('t2')).toBe('claude was not found on PATH');
	const t2 = w.threads.find((t) => t.id === 't2')!;
	expect(w.agents.unanswered(t2)).toBe(false);
	w.agents.failed.delete('t2');
	expect(w.agents.unanswered(t2)).toBe(true);
});

it('hands what is too big for a comment on to the Agent tab, changing nothing, and starts it with the thread', async () => {
	const w = workspace('@agent rewrite this whole section around the pilot results');
	w.agents.ask('t1');
	await expect.poll(() => runs.length).toBe(1);
	runs[0].answer('<reply>That reworks the whole section.</reply><handoff/><edit>Something else.</edit>');
	await expect.poll(() => w.thread.messages.length).toBe(2);
	expect(w.suggested).toEqual([]);
	expect(w.thread.messages[1].body).toBe('That reworks the whole section.\n\n→ Agent tab');
	w.agents.handOff(w.thread);
	expect(w.drafts).toEqual([`About my comment on main.tex, line 2:\n"${PASSAGE}"\n\nrewrite this whole section around the pilot results`]);
});
