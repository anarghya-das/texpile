import { it, expect } from 'vitest';
import { addressed, handoffOf, mentionRuns, mentionsAgent, withHandoff, withoutMention } from '$lib/comments/agentMention';

it('takes "@agent" as a word of its own, in any case, and not inside an address or a longer word', () => {
	expect(mentionsAgent('@agent shorten this')).toBe(true);
	expect(mentionsAgent('Thoughts, @Agent?')).toBe(true);
	expect(mentionsAgent('(@agent) see above')).toBe(true);
	expect(mentionsAgent('mail me at team@agent.org')).toBe(false);
	expect(mentionsAgent('the @agents are busy')).toBe(false);
	expect(mentionsAgent('the @agent-based model')).toBe(false);
	expect(mentionsAgent('no mention here')).toBe(false);
});

it('puts the mention in front of a question once, wherever the reader already wrote it', () => {
	expect(addressed('make it shorter')).toBe('@agent make it shorter');
	expect(addressed('what does @agent think?')).toBe('what does @agent think?');
	expect(withoutMention('@agent  make it shorter')).toBe('make it shorter');
});

it('splits a message into runs with each mention its own, nothing lost between them', () => {
	const body = '@agent shorten this, then ask @AGENT again';
	const runs = mentionRuns(body);
	expect(runs).toEqual([
		{ text: '@agent', mention: true },
		{ text: ' shorten this, then ask ', mention: false },
		{ text: '@AGENT', mention: true },
		{ text: ' again', mention: false }
	]);
	expect(runs.map((r) => r.text).join('')).toBe(body);
});

it('marks a reply that hands the thread on with a last line of its own, and reads it back off', () => {
	const body = withHandoff('That rewrites the whole section.');
	expect(body).toBe('That rewrites the whole section.\n\n→ Agent tab');
	expect(handoffOf(body)).toEqual({ text: 'That rewrites the whole section.', handoff: true });
	expect(handoffOf('See the → Agent tab later, maybe')).toEqual({ text: 'See the → Agent tab later, maybe', handoff: false });
	expect(handoffOf('Softened the claim.')).toEqual({ text: 'Softened the claim.', handoff: false });
});
