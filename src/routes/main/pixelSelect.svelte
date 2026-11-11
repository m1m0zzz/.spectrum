<script lang="ts" context="module">
	export type SelectOption<T extends string | number = string | number> = {
		value: T;
		label: string;
		disabled?: boolean;
	};

	// popover に対応しているか（Chrome 114+ / Safari 17+ / Firefox 125+）。
	// 対応していないブラウザでは、リストを position: fixed で出す
	const supportsPopover =
		typeof HTMLElement != 'undefined' && 'showPopover' in HTMLElement.prototype;
</script>

<script lang="ts" generics="T extends string | number">
	// ドット絵風の選択欄。<select> の代わりに、WAI-ARIA の select-only combobox パターンで作る
	// （https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/）。
	// フォーカスは常にボタン（combobox）に置き、リスト内の位置は aria-activedescendant で示す
	import { createEventDispatcher, onDestroy, tick } from 'svelte';

	// リストと選択肢の id のもと。ページ内で一意にする
	export let id: string;
	// 名前の付け方。見出しのテキストの要素の id（labelledby）か、名前そのもの（ariaLabel）
	export let labelledby: string | undefined = undefined;
	export let ariaLabel: string | undefined = undefined;
	export let options: SelectOption<T>[];
	export let value: T;
	export let disabled = false;

	const dispatch = createEventDispatcher<{ change: { value: T } }>();

	let root: HTMLElement;
	let button: HTMLButtonElement;
	let list: HTMLElement;
	let open = false;
	// リスト内でいま指している選択肢（キーボードやマウスで動く）
	let active = -1;
	// ボタンの下に出すか上に出すか、と位置
	let position = { top: 0, left: 0, minWidth: 0, maxHeight: 0 };

	$: selectedIndex = options.findIndex((o) => o.value === value);
	$: selectedLabel = options[selectedIndex]?.label ?? '';
	const optionId = (i: number) => `${id}-option-${i}`;

	const enabledIndexes = () => options.flatMap((o, i) => (o.disabled ? [] : [i]));

	// 選べる選択肢のうち、i から dir の向きに n 個進んだもの（端で止まる）
	const step = (from: number, dir: 1 | -1, n = 1) => {
		const enabled = enabledIndexes();
		if (enabled.length == 0) return -1;
		let pos = enabled.indexOf(from);
		if (pos == -1) pos = dir == 1 ? -1 : enabled.length;
		return enabled[Math.min(Math.max(pos + dir * n, 0), enabled.length - 1)];
	};

	const place = () => {
		if (!button || !list) return;
		const rect = button.getBoundingClientRect();
		const gap = 4;
		const below = window.innerHeight - rect.bottom - gap * 2;
		const above = rect.top - gap * 2;
		// 下に入りきらず、上の方が広いときは上に出す
		// scrollHeight は枠を含まないので足す（max-height は枠を含む border-box で効く）
		const listHeight = list.scrollHeight + (list.offsetHeight - list.clientHeight);
		const up = listHeight > below && above > below;
		const maxHeight = Math.max(Math.min(up ? above : below, 320), 80);
		const height = Math.min(listHeight, maxHeight);
		position = {
			top: up ? rect.top - gap - height : rect.bottom + gap,
			left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, list.offsetWidth) - gap),
			minWidth: rect.width,
			maxHeight
		};
	};

	const scrollActiveIntoView = async () => {
		await tick();
		list?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
	};

	const show = async (start = selectedIndex) => {
		if (disabled || open) return;
		open = true;
		active = start >= 0 && !options[start]?.disabled ? start : step(-1, 1);
		await tick();
		if (supportsPopover) {
			// サーバーで作る HTML（popover に対応しているか分からない）と食い違わないよう、ここで付ける
			list.popover = 'manual';
			list.showPopover();
		}
		place();
		await tick();
		place();
		scrollActiveIntoView();
		document.addEventListener('pointerdown', onOutsidePointerDown, true);
		window.addEventListener('scroll', place, true);
		window.addEventListener('resize', hide);
	};

	const hide = () => {
		if (!open) return;
		open = false;
		if (supportsPopover && list?.matches(':popover-open')) list.hidePopover();
		document.removeEventListener('pointerdown', onOutsidePointerDown, true);
		window.removeEventListener('scroll', place, true);
		window.removeEventListener('resize', hide);
	};

	const choose = (i: number) => {
		const option = options[i];
		if (!option || option.disabled) return;
		if (option.value !== value) {
			value = option.value;
			dispatch('change', { value });
		}
	};

	const onOutsidePointerDown = (e: PointerEvent) => {
		if (!root.contains(e.target as Node)) hide();
	};

	// 頭文字で選択肢に飛ぶ。続けて打った文字はつなげて探す
	let typed = '';
	let typedTimer: ReturnType<typeof setTimeout> | undefined;
	const typeahead = (char: string) => {
		clearTimeout(typedTimer);
		typedTimer = setTimeout(() => (typed = ''), 500);
		typed += char.toLowerCase();
		const from = open ? active : selectedIndex;
		const order = options.map((_, k) => (from + 1 + k) % options.length);
		// 同じ文字を繰り返したときは、その文字で始まる次の選択肢へ
		const query = [...typed].every((c) => c == typed[0]) ? typed[0] : typed;
		const found = order.find(
			(i) => !options[i].disabled && options[i].label.toLowerCase().startsWith(query)
		);
		return found;
	};

	const onKeydown = (e: KeyboardEvent) => {
		const last = enabledIndexes().at(-1) ?? -1;
		const first = enabledIndexes()[0] ?? -1;

		if (!open) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
				e.preventDefault();
				show();
			} else if (e.key == 'Home' || e.key == 'End') {
				e.preventDefault();
				show(e.key == 'Home' ? first : last);
			} else if (e.key.length == 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
				const found = typeahead(e.key);
				if (found != undefined) show(found);
			}
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				if (e.altKey) break;
				active = step(active, 1);
				break;
			case 'ArrowUp':
				if (e.altKey) {
					choose(active);
					hide();
					break;
				}
				active = step(active, -1);
				break;
			case 'PageDown':
				active = step(active, 1, 10);
				break;
			case 'PageUp':
				active = step(active, -1, 10);
				break;
			case 'Home':
				active = first;
				break;
			case 'End':
				active = last;
				break;
			case 'Enter':
			case ' ':
				choose(active);
				hide();
				break;
			case 'Escape':
				hide();
				break;
			case 'Tab':
				// 指している選択肢に決めて閉じ、フォーカスは次の要素へ移す（preventDefault しない）
				choose(active);
				hide();
				return;
			default:
				if (e.key.length == 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
					const found = typeahead(e.key);
					if (found != undefined) active = found;
					break;
				}
				return;
		}
		e.preventDefault();
		scrollActiveIntoView();
	};

	// 書き出し中などで使えなくなったら閉じる
	$: if (disabled) hide();

	onDestroy(() => {
		hide();
		clearTimeout(typedTimer);
	});
</script>

<span class="pixel-select" bind:this={root}>
	<button
		type="button"
		class="pixel-select-button"
		role="combobox"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls="{id}-list"
		aria-labelledby={labelledby}
		aria-label={ariaLabel}
		aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
		{disabled}
		bind:this={button}
		on:click={() => (open ? hide() : show())}
		on:keydown={onKeydown}
		on:blur={hide}
	>
		<!-- いちばん長い選択肢に幅を合わせ、値を変えてもボタンの幅が変わらないようにする -->
		<span class="pixel-select-value">
			<span>{selectedLabel}</span>
			{#each options as option (option.value)}
				<span class="pixel-select-sizer" aria-hidden="true">{option.label}</span>
			{/each}
		</span>
		<span class="pixel-select-arrow" aria-hidden="true"></span>
	</button>
	<!-- リストは <p> の中にも置くため、<ul>/<li> ではなく span に役割を付ける（<p> の中に <ul> は置けず、
	     ブラウザが <p> を途中で閉じて、サーバーで作った HTML とブラウザでの描画が食い違う）。
	     マウスで押してもボタンからフォーカスが外れないよう、pointerdown の既定の動作を止める -->
	<span
		id="{id}-list"
		class="pixel-select-list"
		class:open
		role="listbox"
		aria-labelledby={labelledby}
		aria-label={ariaLabel}
		tabindex="-1"
		bind:this={list}
		style:top="{position.top}px"
		style:left="{position.left}px"
		style:min-width="{position.minWidth}px"
		style:max-height="{position.maxHeight}px"
		on:pointerdown|preventDefault
	>
		{#each options as option, i (option.value)}
			<!-- キーボード操作はフォーカスを持つボタン（combobox）が受け持ち、aria-activedescendant で選択肢を指す
			     （select-only combobox パターン）。選択肢そのものにはキー操作を付けない -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<span
				id={optionId(i)}
				class="pixel-select-option"
				class:active={i == active}
				role="option"
				tabindex="-1"
				aria-selected={i == selectedIndex}
				aria-disabled={option.disabled ? 'true' : undefined}
				on:pointermove={() => {
					if (!option.disabled) active = i;
				}}
				on:click={() => {
					if (option.disabled) return;
					choose(i);
					hide();
					button.focus();
				}}
			>
				{option.label}
			</span>
		{/each}
	</span>
</span>
