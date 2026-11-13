<script lang="ts">
	import { _ } from 'svelte-i18n';

	// input と label を結ぶ id。ページ内で一意にする
	export let id: string;
	export let accept: string;
	// input のアクセシブルな名前（読み上げや自動テストで使う）
	export let ariaLabel: string;
	export let files: FileList | undefined = undefined;
	export let disabled = false;

	// ブラウザの input はファイル名を表示しないよう隠し、change イベントから取った名前を横に出す。
	// ダイアログを取り消すと（Chrome では）選択が空になるので、名前も消える
	let fileName = '';
	const onChange = (e: Event & { currentTarget: HTMLInputElement }) => {
		fileName = e.currentTarget.files?.[0]?.name ?? '';
	};
</script>

<span class="file-input">
	<!-- 見た目からは隠すが、キーボードで選べるようフォーカスは受け取る。change は親にも渡す -->
	<input
		{id}
		class="visually-hidden"
		type="file"
		{accept}
		aria-label={ariaLabel}
		{disabled}
		bind:files
		on:change={onChange}
		on:change
	/>
	<label for={id} class="pixel-button">{$_('choose_file')}</label>
	<span class="file-name" class:note={!fileName} title={fileName || undefined}
		>{fileName || $_('no_file_selected')}</span
	>
</span>
