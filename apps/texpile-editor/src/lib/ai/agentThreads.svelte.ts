// Comments addressed to the agent. Each "@agent" message is one run of the agent picked in Preferences, in the
// project's folder where that agent can read it, and with the passage and the text around it where it cannot. Its
// answer comes back into the same thread as a reply, and when it was asked for a change, as a suggestion of its own on
// the same words. Threads run side by side, a few at a time. The agent writes nothing itself: Texpile posts what it
// said, and makes its change through the checks Refine's go through
import { SvelteMap } from 'svelte/reactivity';
import { box } from '$lib/runes/box.svelte';
import { toaster } from '$lib/modals/toaster-svelte';
import { m } from '$lib/paraglide/messages';
import { buildAnchor, dialectOfPath, resolveAnchor, type CommentAnchor } from '$lib/comments/anchor';
import { resolveExactly } from '$lib/comments/anchorSearch';
import { mentionsAgent, withHandoff, withoutMention } from '$lib/comments/agentMention';
import { lineOf } from '$lib/comments/anchorLocate';
import { isSuggestion } from '$lib/comments/suggest';
import type { CommentThread } from '$lib/comments/log';
import type { CommentsController } from '$lib/workspace/commentsController.svelte';
import { projectIntelStore } from '$lib/stores/projectIntel';
import { agentEditProblem, knownCiteKeys } from './agentEditGuard';
import { agentReplyPrompt, agentTabDraft, parseAgentAnswer, type AnswerKind } from './agentReplyPrompt';
import { panelTabOff } from './agentPanel/agentOffer.svelte';
import { contextAround, refinedText } from './refinePrompt';
import type { RefineAction } from './refineActions';
import { refineAgentsOffered } from './refineAgents.svelte';
import { agentBridge, agentName, readsFolder, type RefineAgent } from './selectionRefiner';

/** runs at once; the rest wait their turn */
const MOST_AT_ONCE = 3;
/** the text around the passage an agent sees without an action that says otherwise, as Refine's NEAR */
const NEAR: [number, number] = [1500, 600];

export type AgentThreadsDeps = {
	ctl: CommentsController;
	/** the open file's text, live */
	activeText(): string;
	/** each thread on the open file where the editor has it now, which the log's anchors only catch up with on save */
	liveAnchors(text: string): Map<string, CommentAnchor> | null;
	/** false wherever no suggestion can be recorded: a guest, a single file, a hosted session */
	canSuggest(): boolean;
	/** the selection as a span of the open file's text, or null when it cannot be mapped to one */
	selection(): { from: number; to: number } | null;
	/** a name to sign the question with, asked for when there is none; false when the reader gave none */
	named(): Promise<boolean>;
	/** marks the selected text in the visual editor while the composer has the focus */
	pinSelection(): void;
	/** the Agent tab, its message box holding `draft` */
	openAgentTab(draft: string): void;
};

/** where a thread's passage stands, as the agent is shown it; `anchor` only when it stands in the open file */
type Passage = { passage: string; before: string; after: string; anchor: CommentAnchor | null };

/** a suggestion made in answer to a thread, and the words that thread was on before it */
type Answered = { thread: string; file: string; before: CommentAnchor };

export class AgentThreads {
	/** thread id -> its run; `waiting` while others take the slots */
	readonly runs = new SvelteMap<string, { agent: string; waiting: boolean }>();
	/** thread id -> why its last run failed */
	readonly failed = new SvelteMap<string, string>();

	private queue: { thread: string; action?: RefineAction }[] = [];
	private runIds = new Map<string, string>();
	/** one change lands at a time: each is compared against the file as the one before it left it */
	private landing: Promise<unknown> = Promise.resolve();
	private answered = new Map<string, Answered>();

	constructor(private deps: AgentThreadsDeps) {}

	/** the agent Preferences picked, which every thread asks */
	get agent(): RefineAgent | undefined {
		return refineAgentsOffered()[0];
	}

	/** the name the agent signs with */
	get name(): string | null {
		const agent = this.agent;
		return agent ? agentName(agent) : null;
	}

	get available(): boolean {
		return !!this.agent && !!agentBridge() && this.deps.canSuggest();
	}

	/** the agent has a part in `t`: asked in it, or wrote in it, as a suggestion of its own */
	takesPart(t: CommentThread): boolean {
		const name = this.name;
		return t.messages.some((msg) => mentionsAgent(msg.body) || msg.by === name);
	}

	/** the composer on the selection, addressed to the agent */
	async compose(): Promise<void> {
		const span = this.deps.selection();
		if (!span) return void toaster.info({ title: m.agent_no_span(), duration: 5000 });
		if (!(await this.deps.named())) return;
		this.deps.ctl.beginAdd(span.from, span.to, true);
		this.deps.pinSelection();
	}

	/** answer `thread`'s last message; `action`, a quick action, asks for that change */
	ask(thread: string, action?: RefineAction): void {
		const agent = this.agent;
		if (!agent || this.runs.has(thread) || !this.available) return;
		this.failed.delete(thread);
		this.runs.set(thread, { agent: agentName(agent), waiting: true });
		this.queue.push({ thread, action });
		this.next();
	}

	cancel(thread: string): void {
		const queued = this.queue.findIndex((q) => q.thread === thread);
		if (queued >= 0) {
			this.queue.splice(queued, 1);
			this.runs.delete(thread);
			return;
		}
		const id = this.runIds.get(thread);
		if (id) agentBridge()?.cancel(id);
	}

	/** every run ends with the workspace that asked for it */
	stop(): void {
		this.queue = [];
		for (const id of this.runIds.values()) agentBridge()?.cancel(id);
		this.runs.clear();
	}

	/** the Agent tab is there to hand a thread on to */
	get canHandOff(): boolean {
		return !panelTabOff();
	}

	/** carry `t` on to the Agent tab: where its passage is, its words, and what the author asked in it */
	handOff(t: CommentThread): void {
		const name = this.name;
		const asks = t.messages.filter((msg) => msg.by !== name && mentionsAgent(msg.body)).map((msg) => withoutMention(msg.body));
		let line: number | null = null;
		if (t.file === this.deps.ctl.activeFile) {
			const text = this.deps.activeText();
			const hit = resolveAnchor(text, t.anchor);
			if (hit) line = lineOf(text, hit.from);
		}
		this.deps.openAgentTab(
			agentTabDraft({
				path: t.file,
				line,
				quote: t.anchor.quote,
				asks: asks.length ? asks : [withoutMention(t.messages.at(-1)?.body ?? '')]
			})
		);
	}

	/** its last message asks the agent, and nothing is answering it: a run cut short by a quit, or by another window */
	unanswered(t: CommentThread): boolean {
		const last = t.messages.at(-1);
		return !!last && mentionsAgent(last.body) && !this.runs.has(t.id) && !this.failed.has(t.id);
	}

	/**
	 * A suggestion made in answer to a thread took the thread's words with it, so the thread was pinned onto the new ones;
	 * rejecting it brings the old words back, and the thread goes back onto them. Kept for as long as the window is open:
	 * a reject after a restart leaves the thread detached, as it would after any edit of its words
	 */
	follow(threads: CommentThread[]): void {
		for (const [id, a] of this.answered) {
			const s = threads.find((t) => t.id === id);
			if (s && !s.resolved) continue;
			this.answered.delete(id);
			const t = threads.find((x) => x.id === a.thread);
			if (s?.decision === 'rejected' && t && !isSuggestion(t)) void this.deps.ctl.moveAnchor(t, a.before, a.file);
		}
	}

	private next(): void {
		const running = [...this.runs.values()].filter((r) => !r.waiting).length;
		for (let free = MOST_AT_ONCE - running; free > 0 && this.queue.length; free--) {
			const q = this.queue.shift()!;
			const run = this.runs.get(q.thread);
			if (!run) continue;
			this.runs.set(q.thread, { ...run, waiting: false });
			void this.run(q.thread, q.action);
		}
	}

	private async run(id: string, action?: RefineAction): Promise<void> {
		const bridge = agentBridge();
		const agent = this.agent;
		const thread = this.deps.ctl.threads.find((t) => t.id === id);
		try {
			if (!bridge || !agent || !thread) return;
			const by = agentName(agent);
			const at = this.passageOf(thread, action?.context ?? NEAR);
			const kind: AnswerKind = isSuggestion(thread) ? 'reply' : action ? 'edit' : 'any';
			const { system, request } = agentReplyPrompt({
				agent: by,
				path: thread.file,
				turns: thread.messages.map((msg) => ({ by: msg.by, body: msg.body, mine: msg.by === by })),
				...at,
				readsFolder: readsFolder(agent),
				kind,
				restore: thread.restore,
				task: action?.ask
			});
			const runId = crypto.randomUUID();
			this.runIds.set(id, runId);
			const answer = await bridge.run(runId, request, system, agent, readsFolder(agent));
			if (!answer.ok) {
				if (!answer.cancelled) this.failed.set(id, answer.error);
				return;
			}
			const { reply, edit, handoff } = parseAgentAnswer(answer.text);
			// a quick action is a change to the passage, never more than a comment can hold
			const onward = handoff && kind !== 'edit';
			const made = !onward && kind !== 'reply' && edit !== null ? await this.land(thread, at, edit, by, action) : null;
			// gone while it ran: a reply has nothing left to go under
			const now = this.deps.ctl.threads.find((t) => t.id === id);
			if (!now) return;
			const said = [reply || (made === true ? m.agent_changed() : ''), typeof made === 'string' ? made : ''].filter(Boolean).join('\n\n');
			const body = onward ? withHandoff(said) : said;
			if (body) await this.deps.ctl.reply(now, body, by);
		} catch (e) {
			this.failed.set(id, e instanceof Error ? e.message : String(e));
		} finally {
			this.runIds.delete(id);
			this.runs.delete(id);
			this.next();
		}
	}

	/** the passage as it stands now: where the editor has it on the open file, else the words the log remembers */
	private passageOf(thread: CommentThread, context: [number, number]): Passage {
		const ctl = this.deps.ctl;
		if (thread.file === ctl.activeFile) {
			const text = this.deps.activeText();
			const live = this.deps.liveAnchors(text)?.get(thread.id);
			const hit =
				live && text.slice(live.start, live.end) === live.quote ? { from: live.start, to: live.end } : resolveAnchor(text, thread.anchor);
			if (hit && hit.to > hit.from) {
				const around = contextAround(text, hit.from, hit.to, context);
				return { passage: text.slice(hit.from, hit.to), ...around, anchor: buildAnchor(text, hit.from, hit.to) };
			}
		}
		const a = thread.anchor;
		return { passage: a.quote, before: a.prefix, after: a.suffix, anchor: null };
	}

	/** the edit as a suggestion by the agent: true once made, the reason with the words it proposed when not, null for
	 *  an edit that changes nothing */
	private land(thread: CommentThread, at: Passage, edit: string, by: string, action?: RefineAction): Promise<true | string | null> {
		const landed = this.landing.then(() => this.suggest(thread, at, edit, by, action));
		this.landing = landed.catch(() => undefined);
		return landed;
	}

	private async suggest(
		thread: CommentThread,
		at: Passage,
		edit: string,
		by: string,
		action?: RefineAction
	): Promise<true | string | null> {
		const ctl = this.deps.ctl;
		const replacement = refinedText(edit, at.passage);
		if (replacement === at.passage) return null;
		// what it would have changed stays in the thread, for the reader to take or to ask for again
		function proposed(why: string): string {
			return `${m.agent_not_made({ why })}\n\n${replacement.trim()}`;
		}
		if (!at.anchor || ctl.activeFile !== thread.file) return proposed(m.agent_why_closed({ file: thread.file }));
		const now = this.deps.activeText();
		// the reader may have typed on while the agent worked; its answer only fits the words it was given
		const place = resolveExactly(now, at.anchor);
		if (!place) return proposed(m.agent_why_moved({ agent: by }));
		const problem = agentEditProblem(
			dialectOfPath(thread.file),
			at.passage,
			replacement,
			knownCiteKeys(
				now,
				projectIntelStore.current.bibEntries.map((e) => e.key)
			)
		);
		if (problem)
			return proposed(
				'invented' in problem
					? m.ai_refine_invented({ keys: problem.invented.join(', ') })
					: m.ai_refine_lost_label({ labels: problem.lost.join(', ') })
			);
		const asked = action?.label() ?? withoutMention(thread.messages.at(-1)?.body ?? '');
		const made = await ctl.suggestions.suggestAs(by, { from: place.from, to: place.to, insert: replacement }, asked);
		if (!made) return proposed(m.agent_why_not_made());
		// the thread's words are the suggestion's now, so the thread goes with them, as reanchor_comment does for an agent
		// editing over MCP; a reject puts it back (follow)
		const s = ctl.threads.find((t) => t.id === made);
		const t = ctl.threads.find((x) => x.id === thread.id);
		if (s && t && !isSuggestion(t)) {
			await ctl.moveAnchor(t, s.anchor, thread.file, by);
			this.answered.set(made, { thread: t.id, file: thread.file, before: at.anchor });
		}
		return true;
	}
}

/** the open workspace's agent threads, for the selection toolbar and the comment cards; null while no folder is open */
export const agentThreads = box<AgentThreads | null>(null);
