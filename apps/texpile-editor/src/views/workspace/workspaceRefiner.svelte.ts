// Refine wiring: the reader's selection as a span of the open file, and the suggestion path it lands through. The
// comments addressed to the agent share both, and the same rule for where an agent may suggest
import { untrack } from 'svelte';
import { SelectionRefiner, refiner } from '$lib/ai/selectionRefiner';
import { AgentThreads, agentThreads } from '$lib/ai/agentThreads.svelte';
import { lookUpRefineAgents } from '$lib/ai/refineAgents.svelte';
import { agentDraft } from '$lib/ai/agentPanel/agentDraft.svelte';
import { collabHost } from '$lib/collab/hostStore.svelte';
import { fileMode } from '$lib/workspace/fileMode.svelte';
import { workspaceRoot } from '$lib/workspace/workspaceStore';
import { hasVisualMode } from '$lib/workspace/documentBuffer.svelte';
import { editorViewStore } from '$lib/stores/editorStore';
import { setPmCommentPending } from '$lib/editor/visual/extensions/pmComments';
import { ensureName } from '$lib/identity/ownName.svelte';
import { selectedSpan, type SpanDeps } from './selectedSpan';

type RefinerWiring = SpanDeps & {
	guest: () => boolean;
	/** the dock open on its Agent tab */
	showAgentTab: () => void;
};

export function wireRefiner(d: RefinerWiring): void {
	const ctl = d.comments.ctl;
	// until any are ticked in Preferences, Refine offers the agents installed
	lookUpRefineAgents();
	// the same windows WorkspaceComments lets suggest
	function canSuggest(): boolean {
		return !d.guest() && !collabHost.active && !fileMode.current && ctl.store.writable;
	}
	const r = new SelectionRefiner({
		selection: () => selectedSpan(d),
		activeText: () => d.comments.activeText(),
		path: () => d.doc.path,
		canSuggest,
		suggestAs: (by, edit, note) => ctl.suggestions.suggestAs(by, edit, note),
		reveal: (id) => {
			const thread = ctl.threads.find((t) => t.id === id);
			if (thread) ctl.open(thread);
		}
	});
	const threads = new AgentThreads({
		ctl,
		activeText: () => d.comments.activeText(),
		liveAnchors: (text) => d.comments.liveAnchors(text),
		canSuggest,
		selection: () => selectedSpan(d),
		named: () => ensureName(workspaceRoot.current),
		// as the selection toolbar's Comment does: the composer takes the focus, and the visual editor stops drawing the
		// selection with it
		pinSelection: () => {
			if (d.modes.mode !== 'visual' || !hasVisualMode(d.kind())) return;
			const view = editorViewStore.current;
			const sel = view?.state.selection;
			if (view && sel && !sel.empty) setPmCommentPending(view, { from: sel.from, to: sel.to });
		},
		openAgentTab: (draft) => {
			agentDraft.current = draft;
			d.showAgentTab();
		}
	});
	$effect(() => {
		refiner.current = r;
		agentThreads.current = threads;
		return () => {
			if (refiner.current === r) refiner.current = null;
			if (agentThreads.current === threads) agentThreads.current = null;
			threads.stop();
		};
	});
	$effect(() => {
		const all = ctl.threads;
		untrack(() => threads.follow(all));
	});
}
