// "@agent" in a comment: the reader asking the agent picked in Preferences, whichever one that is. The log keeps it
// as plain text, so a thread reads the same in an editor or a diff as it does in the panel

export const AGENT_MENTION = '@agent';

// a word of its own, so neither an address nor "@agents" reads as one
const MENTION = /(?<![\w@.])@agent(?![\w-])/gi;

export function mentionsAgent(body: string): boolean {
	MENTION.lastIndex = 0;
	return MENTION.test(body);
}

/** `body` sent to the agent: the mention in front, unless the reader already wrote it somewhere */
export function addressed(body: string): string {
	return mentionsAgent(body) ? body : `${AGENT_MENTION} ${body}`;
}

/** what the reader asked, without the mention that sent it */
export function withoutMention(body: string): string {
	return body
		.replace(MENTION, '')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

/** a message's text in runs, each mention its own, for drawing the mentions as pills */
export function mentionRuns(body: string): { text: string; mention: boolean }[] {
	const out: { text: string; mention: boolean }[] = [];
	let at = 0;
	for (const hit of body.matchAll(MENTION)) {
		if (hit.index > at) out.push({ text: body.slice(at, hit.index), mention: false });
		out.push({ text: hit[0], mention: true });
		at = hit.index + hit[0].length;
	}
	if (at < body.length) out.push({ text: body.slice(at), mention: false });
	return out;
}

// A reply that hands the thread on to the Agent tab, for what is too long for a comment, ends in this line. The card
// draws it as the button that carries the thread there; in the log it reads as what it means
export const AGENT_TAB_MARK = '→ Agent tab';

export function withHandoff(body: string): string {
	return body ? `${body}\n\n${AGENT_TAB_MARK}` : AGENT_TAB_MARK;
}

/** a message's words, and whether it ends handing the thread on */
export function handoffOf(body: string): { text: string; handoff: boolean } {
	const at = body.lastIndexOf(AGENT_TAB_MARK);
	if (at < 0 || body.slice(at + AGENT_TAB_MARK.length).trim()) return { text: body, handoff: false };
	return { text: body.slice(0, at).trimEnd(), handoff: true };
}
