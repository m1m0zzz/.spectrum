<script lang="ts">
	import { _ } from 'svelte-i18n';
	// 数値の入力欄に、ドット絵風の ▲▼ を付ける。ブラウザの増減ボタンは見た目を変えられないため CSS で隠している。
	// 中に置いた <input type="number"> をそのまま使い、▲▼ では stepUp / stepDown のあとに input・change を送る。
	// こうすると、親の bind:value や on:change（範囲に収める処理など）がキー入力のときと同じように動く
	let root: HTMLElement;

	const step = (dir: 1 | -1) => {
		const input = root.querySelector('input');
		if (!input || input.disabled) return;
		if (dir == 1) input.stepUp();
		else input.stepDown();
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
	};
</script>

<span class="pixel-number" bind:this={root}>
	<slot />
	<!-- キーボードでは入力欄の ↑↓ で増減できるので、▲▼ はマウス・タッチ用にし、フォーカスや読み上げの対象から外す -->
	<span class="pixel-number-steps" aria-hidden="true">
		<button
			type="button"
			class="pixel-number-step up"
			aria-label={$_('number_increment')}
			tabindex="-1"
			on:click={() => step(1)}
		></button>
		<button
			type="button"
			class="pixel-number-step down"
			aria-label={$_('number_decrement')}
			tabindex="-1"
			on:click={() => step(-1)}
		></button>
	</span>
</span>
