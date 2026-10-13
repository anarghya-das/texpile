<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart';
	import Star from '@lucide/svelte/icons/star';
</script>

<div class="border-surface-200-800 mt-6 border-t pt-4 text-sm">
	<p class="text-surface-900 mb-2 font-semibold">{'Like Texpile?'}</p>
	<a
		href="https://github.com/texpile/texpile"
		target="_blank"
		rel="noopener noreferrer"
		class="text-muted hover:text-surface-900 flex items-center gap-2 py-1 transition-colors"
	>
		<Star class="text-warning-500 h-4 w-4 fill-current" />{'Star it on GitHub'}
	</a>
	<a
		href="https://github.com/sponsors/louisqli"
		target="_blank"
		rel="noopener noreferrer"
		class="text-muted hover:text-surface-900 flex items-center gap-2 py-1 transition-colors"
	>
		<Heart class="text-error-500 h-4 w-4 fill-current" />{'Donate'}
	</a>
</div>
