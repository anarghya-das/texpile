import { it, expect } from 'vitest';
import { agentReplyPrompt, agentTabDraft, parseAgentAnswer, type AgentReplyRequest } from '$lib/ai/agentReplyPrompt';

const base: AgentReplyRequest = {
	agent: 'Claude',
	path: 'chapters/results.tex',
	turns: [
		{ by: 'Mei', body: '@agent is this claim supported?', mine: false },
		{ by: 'Claude', body: 'Only by the first table.', mine: true },
		{ by: 'Mei', body: '@agent then tone it down', mine: false }
	],
	passage: 'Our method is always faster.',
	before: 'We ran every benchmark.\n',
	after: '\nSee Table 2.',
	readsFolder: true,
	kind: 'any'
};

it('gives an agent that reads the folder the file it is in, and one that does not only its format', () => {
	const folder = agentReplyPrompt(base);
	expect(folder.system).toContain('The project the file belongs to is your working directory.');
	expect(folder.system).toContain('Never change a file.');
	expect(folder.request).toContain('The file: chapters/results.tex');
	const alone = agentReplyPrompt({ ...base, readsFolder: false });
	expect(alone.system).toContain('a LaTeX file (.tex)');
	expect(alone.system + alone.request).not.toMatch(/chapters|results/);
	expect(alone.system).toContain('Never add a citation, a number or a claim the passage does not already have.');
});

it('sends the whole thread oldest first, its own messages marked, and lets the agent choose between a reply and an edit', () => {
	const { system, request } = agentReplyPrompt(base);
	expect(request).toContain('Mei: @agent is this claim supported?\nClaude (you): Only by the first table.\nMei: @agent then tone it down');
	expect(request.indexOf('The passage:\n<<<\nOur method is always faster.\n>>>')).toBeGreaterThan(request.indexOf('Text before'));
	expect(system).toContain('A question, or a request for your thoughts, gets an answer and no edit.');
	expect(system).toContain('<edit>the new passage</edit>');
});

it('asks only for words in a suggestion thread, where the change is already made, and shows what it took out', () => {
	const { system, request } = agentReplyPrompt({ ...base, kind: 'reply', restore: 'Our method is faster.' });
	expect(system).toContain('never give an edit');
	expect(system).not.toContain('<edit>');
	expect(request).toContain('The words the suggested change took out, which the passage replaced:\n<<<\nOur method is faster.\n>>>');
});

it('puts a quick action first, and asks for the edit', () => {
	const { system, request } = agentReplyPrompt({
		...base,
		kind: 'edit',
		task: 'Make the passage shorter without losing anything that matters.'
	});
	expect(request.startsWith('Make the passage shorter')).toBe(true);
	expect(system).toContain('give the edit');
});

it('reads the reply and the edit from their tags, an empty edit as a deletion, and an untagged answer as all reply', () => {
	expect(parseAgentAnswer('<reply>Toned it down.</reply>\n<edit>Our method is often faster.</edit>')).toEqual({
		reply: 'Toned it down.',
		edit: 'Our method is often faster.',
		handoff: false
	});
	expect(parseAgentAnswer('<reply>It is supported by Table 1.</reply>')).toEqual({
		reply: 'It is supported by Table 1.',
		edit: null,
		handoff: false
	});
	expect(parseAgentAnswer('<reply>Removed it.</reply><edit></edit>')).toEqual({ reply: 'Removed it.', edit: '', handoff: false });
	expect(parseAgentAnswer('Our method is often faster.')).toEqual({ reply: 'Our method is often faster.', edit: null, handoff: false });
});

it('holds the reply to a short card, and sends what needs more room on to the Agent tab, with no edit', () => {
	const { system } = agentReplyPrompt(base);
	expect(system).toContain('one or two short sentences, 40 words at most');
	expect(system).toContain('ask one short question instead');
	expect(system).toContain('add <handoff/> after the reply');
	expect(agentReplyPrompt({ ...base, kind: 'edit' }).system).not.toContain('<handoff/>');
	expect(parseAgentAnswer('<reply>That rewrites the whole section.</reply><handoff/><edit>All new.</edit>')).toEqual({
		reply: 'That rewrites the whole section.',
		edit: null,
		handoff: true
	});
	expect(parseAgentAnswer('Needs a longer conversation. <handoff />')).toEqual({
		reply: 'Needs a longer conversation.',
		edit: null,
		handoff: true
	});
});

it('starts the Agent tab with where the passage is, its words, and what was asked', () => {
	expect(
		agentTabDraft({ path: 'sections/intro.tex', line: 5, quote: 'it is always better ', asks: ['rewrite the section around this'] })
	).toBe('About my comment on sections/intro.tex, line 5:\n"it is always better"\n\nrewrite the section around this');
	expect(agentTabDraft({ path: 'refs.bib', line: null, quote: 'x'.repeat(400), asks: [] })).toContain(`"${'x'.repeat(300)}…"`);
});
