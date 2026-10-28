<script lang="ts">
	// The composer for a selection, beside the selection. Nothing is written until the first message. Addressed to the
	// agent, it says so with a pill in front of the words, which Backspace in an empty box takes away, and offers
	// Refine's quick actions as ready-made asks
	import { ChevronDown, Sparkles } from '@lucide/svelte';
	import { tip } from '$lib/components/tooltip.svelte';
	import { showContextMenu } from '$lib/menus/contextMenu.svelte';
	import { oneLine } from '$lib/comments/quoteLabel';
	import { AGENT_MENTION, addressed as toAgent, mentionsAgent } from '$lib/comments/agentMention';
	import { REFINE_ACTIONS, type RefineAction } from '$lib/ai/refineActions';
	import { sized } from './sized';
	import { m } from '$lib/paraglide/messages';

	let {
		quote,
		top,
		addressed = false,
		agentReady = false,
		onSubmit,
		onCancel,
		onSize
	}: {
		quote: string;
		top: number;
		/** opened addressed to the agent, from Ask agent */
		addressed?: boolean;
		/** the agent can be asked here */
		agentReady?: boolean;
		/** `keyed`: sent with Enter, so the reader's hands are on the keyboard and go back to the text. `action`: a quick
		 *  action picked, whose own words ask the agent */
		onSubmit: (body: string, keyed: boolean, action?: RefineAction) => void;
		onCancel: () => void;
		onSize: (height: number) => void;
	} = $props();

	const QUICK = ['rephrase', 'shorten', 'grammar'];
	const quick = REFINE_ACTIONS.filter((a) => QUICK.includes(a.id));
	const rest = REFINE_ACTIONS.filter((a) => !QUICK.includes(a.id));

	let draft = $state('');
	let box = $state<HTMLTextAreaElement | null>(null);
	// the address as opened; the reader can take it away or put it back
	// svelte-ignore state_referenced_locally
	let agent = $state(addressed);
	const asking = $derived(agentReady && (agent || mentionsAgent(draft)));

	$effect(() => {
		box?.focus({ preventScroll: true });
	});

	// going back to the text without writing anything takes the composer with it: the passage stays
	// marked while this card is open, and a card nobody is writing in leaves a mark nobody asked for.
	// A started note is never thrown away, so the card stays once there is anything in it
	$effect(() => {
		function onFocusIn(e: FocusEvent) {
			const into = e.target as HTMLElement | null;
			if (!into?.closest?.('.ProseMirror, .cm-editor')) return;
			if (draft.trim()) return;
			onCancel();
		}
		document.addEventListener('focusin', onFocusIn);
		return () => document.removeEventListener('focusin', onFocusIn);
	});

	function submit(keyed: boolean) {
		const body = draft.trim();
		if (!body) return;
		draft = '';
		onSubmit(agent && agentReady ? toAgent(body) : body, keyed);
	}

	function run(action: RefineAction) {
		draft = '';
		onSubmit(`${AGENT_MENTION} ${action.label()}`, false, action);
	}

	function more(button: HTMLElement): void {
		const at = button.getBoundingClientRect();
		void showContextMenu(
			rest.map((a) => ({ label: a.label(), icon: a.icon, onclick: () => run(a) })),
			{ x: at.left, y: at.bottom + 4 }
		);
	}
</script>

<div
	class="comment-card comment-card-pending bg-surface-50-950 border-surface-200-800 rounded-container border text-xs"
	style="top: {top}px"
	use:sized={onSize}
>
	<span class="text-muted block truncate font-mono" use:tip={quote}>{oneLine(quote)}</span>
	<div class="textarea rounded-container mt-1.5 flex w-full items-start gap-1 py-1 text-xs">
		{#if agent && agentReady}
			<span class="agent-mention mt-px shrink-0">{AGENT_MENTION}</span>
		{/if}
		<textarea
			bind:this={box}
			class="min-h-8 min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-xs outline-none focus:ring-0"
			rows="2"
			placeholder={agent && agentReady ? m.agent_placeholder() : m.comments_add()}
			bind:value={draft}
			onkeydown={(e) => {
				if (e.isComposing) return;
				if (e.key === 'Escape') {
					draft = '';
					onCancel();
				} else if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					submit(true);
				} else if (e.key === 'Backspace' && agent && !draft) {
					e.preventDefault();
					agent = false;
				}
			}}></textarea>
	</div>
	{#if agent && agentReady && !draft.trim()}
		<div class="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
			<span class="text-muted">{m.agent_try()}</span>
			{#each quick as action (action.id)}
				<button class="btn btn-xs hover:preset-tonal px-1.5" onclick={() => run(action)}>{action.label()}</button>
			{/each}
			<button class="btn btn-xs hover:preset-tonal gap-0.5 px-1.5" onclick={(e) => more(e.currentTarget)}>
				{m.ai_refine_more()}<ChevronDown class="size-3" />
			</button>
		</div>
	{/if}
	<div class="mt-1.5 flex items-center gap-1">
		<button class="btn btn-xs preset-filled-primary-500" disabled={!draft.trim()} onclick={() => submit(false)}>
			{asking ? m.agent_send() : m.comments_add()}
		</button>
		<button
			class="btn btn-xs hover:preset-tonal"
			onclick={() => {
				draft = '';
				onCancel();
			}}
		>
			{m.comments_cancel()}
		</button>
		{#if agentReady && !agent}
			<button
				class="btn-icon btn-icon-xs hover:preset-tonal text-muted ml-auto"
				use:tip={m.agent_ask()}
				aria-label={m.agent_ask()}
				onclick={() => {
					agent = true;
					box?.focus();
				}}
			>
				<Sparkles class="size-3.5" />
			</button>
		{/if}
	</div>
</div>
