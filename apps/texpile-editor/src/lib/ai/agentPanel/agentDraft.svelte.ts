// Words handed to the Agent tab from elsewhere, a comment thread too big for a comment: its message box takes them as
// its text, for the reader to send as they are or change first
import { box } from '$lib/runes/box.svelte';

export const agentDraft = box<string | null>(null);
