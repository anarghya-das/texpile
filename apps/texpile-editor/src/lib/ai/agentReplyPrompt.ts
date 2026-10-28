// What a comment addressed to the agent asks it, and how its answer splits into a reply and, when it was asked for
// one, the new text of the passage the thread is on
import { fileFormat } from './refinePrompt';

/** one message of the thread; `mine` for those the agent wrote */
export type ThreadTurn = { by: string; body: string; mine: boolean };

/** `reply`: answer only, as in a suggestion's thread, where the change is already made. `edit`: a quick action, which
 *  always changes the passage. `any`: the agent decides from the words */
export type AnswerKind = 'any' | 'reply' | 'edit';

export type AgentReplyRequest = {
	/** the agent's name, as it signs its replies */
	agent: string;
	/** workspace-relative; only its extension is told to an agent that does not read the folder */
	path: string;
	/** the thread so far, the last message being the one to answer */
	turns: ThreadTurn[];
	passage: string;
	before: string;
	after: string;
	/** the agent runs in the project's folder and can read it */
	readsFolder: boolean;
	kind: AnswerKind;
	/** in a suggestion's thread: the words the suggestion took out, which `passage` replaced */
	restore?: string;
	/** a quick action's task, in the agent's words, in place of the last message */
	task?: string;
};

export function agentReplyPrompt(r: AgentReplyRequest): { system: string; request: string } {
	const format = fileFormat(r.path);
	const file = format.extension ? `a ${format.name} file (.${format.extension})` : `a ${format.name} file`;
	const system = [
		`You are ${r.agent}, answering a comment thread on a passage of ${file}.` +
			(r.readsFolder ? ' The project the file belongs to is your working directory.' : ''),
		'The request gives the thread, then the passage it is pinned to with the text around it. Answer the last message.',
		...(r.readsFolder
			? ['Read other files in the project when the thread needs them: the bibliography, the macros, other sections. Never change a file.']
			: []),
		...(r.kind === 'reply'
			? ['The change this thread is about is already in the file, so answer in words only: never give an edit.']
			: r.kind === 'edit'
				? ['The last message asks for a change to the passage: give the edit.']
				: [
						'A question, or a request for your thoughts, gets an answer and no edit. A change, even one asked as a question, gets the edit.'
					]),
		'Reply in this form, with nothing outside the tags:',
		'<reply>your answer</reply>',
		...(r.kind === 'reply' ? [] : ['<edit>the new passage</edit>', 'Leave <edit> out entirely when you do not change the passage.']),
		'The reply is read in a narrow card beside the page. Keep it to one or two short sentences, 40 words at most, in plain text without Markdown.',
		'Answer directly: no greeting, no restating the question, no caveats the author did not ask about.',
		'When you need something from the author first, ask one short question instead.',
		...(r.kind === 'reply'
			? []
			: ['With an edit, the reply names the change in a few words, such as "Softened the claim."; the suggestion shows the rest.']),
		...(r.kind === 'edit'
			? []
			: [
					'Some asks need more room than a comment: a long explanation, an open-ended discussion, or changes beyond this passage, to other paragraphs or files.',
					'Do not attempt those here. Give no edit, say in one sentence what it needs, and add <handoff/> after the reply: the author continues in a longer conversation with the full project.'
				]),
		...(r.kind === 'reply'
			? []
			: [
					`The edit replaces the whole passage: write all of it in ${format.name}, without quotation marks or a code fence. An empty edit deletes the passage.`,
					'Keep every command, formula, citation, cross-reference and label exactly as written unless the task needs otherwise.',
					r.readsFolder
						? 'Add a citation only with a key the bibliography has, and never a number or a claim nothing in the project supports.'
						: 'Never add a citation, a number or a claim the passage does not already have.',
					"Keep the author's voice and the spelling conventions the document uses.",
					`A list is ${format.list}.`
				])
	].join('\n');
	const turns = r.turns.map((t) => `${t.mine ? `${t.by} (you)` : t.by}: ${t.body}`);
	const request = [
		...(r.task ? [r.task, ''] : []),
		'The thread, oldest first:',
		'<<<',
		...turns,
		'>>>',
		'',
		...(r.readsFolder ? [`The file: ${r.path}`, ''] : []),
		'Text before the passage, for context only:',
		'<<<',
		r.before,
		'>>>',
		'',
		'The passage:',
		'<<<',
		r.passage,
		'>>>',
		'',
		...(r.restore !== undefined
			? ['The words the suggested change took out, which the passage replaced:', '<<<', r.restore, '>>>', '']
			: []),
		'Text after the passage, for context only:',
		'<<<',
		r.after,
		'>>>'
	].join('\n');
	return { system, request };
}

/** the reply, the edit when there is one, and whether the agent handed the thread on as too big for a comment, which
 *  takes no edit. An answer without the tags is all reply: words taken for a passage would replace the reader's text
 *  with an explanation of it */
export function parseAgentAnswer(answer: string): { reply: string; edit: string | null; handoff: boolean } {
	const reply = /<reply>([\s\S]*?)<\/reply>/i.exec(answer)?.[1];
	const edit = /<edit>([\s\S]*?)<\/edit>/i.exec(answer)?.[1];
	const handoff = /<handoff\s*\/?>/i.test(answer);
	if (reply === undefined && edit === undefined) return { reply: answer.replace(/<handoff\s*\/?>/gi, '').trim(), edit: null, handoff };
	return { reply: (reply ?? '').trim(), edit: handoff ? null : (edit ?? null), handoff };
}

/** what a thread handed on starts the Agent tab with: where the passage is, its words, and what the author asked, for
 *  them to send as it is or change first */
export function agentTabDraft(o: { path: string; line: number | null; quote: string; asks: string[] }): string {
	const at = o.line ? `${o.path}, line ${o.line}` : o.path;
	const quote = o.quote.length > 300 ? `${o.quote.slice(0, 300).trimEnd()}…` : o.quote;
	return [`About my comment on ${at}:`, `"${quote.trim()}"`, '', ...o.asks].join('\n');
}
