<script lang="ts">
  import styles from './FileInput.module.css';
  import { _ } from 'svelte-i18n';

  type Props = {
    // input と label を結ぶ id。ページ内で一意にする
    id: string;
    accept: string;
    // input のアクセシブルな名前（読み上げや自動テストで使う）
    ariaLabel: string;
    files?: FileList;
    disabled?: boolean;
    // ファイルを選んだとき（files を更新したあと）に呼ぶ。false（を返す Promise）を返すと、表示する名前を前のファイルに戻す
    onchange?: (files: FileList | undefined) => void | boolean | Promise<void | boolean>;
  };
  let { id, accept, ariaLabel, files = $bindable(), disabled = false, onchange }: Props = $props();

  // ブラウザの input はファイル名を表示しないよう隠し、change イベントから取った名前を横に出す。
  // ダイアログを取り消すと（Chrome では）選択が空になるので、名前も消える
  let fileName = $state('');
  let changing = 0;
  const onChange = async (e: Event & { currentTarget: HTMLInputElement }) => {
    const id = ++changing;
    const previous = fileName;
    fileName = e.currentTarget.files?.[0]?.name ?? '';
    const accepted = await onchange?.(e.currentTarget.files ?? undefined);
    // 親が読み込めなかったときは、使われているファイルの名前に戻す。その間に選び直していたら戻さない
    if (accepted === false && id == changing) fileName = previous;
  };
</script>

<span class={styles.root}>
  <!-- 見た目からは隠すが、キーボードで選べるようフォーカスは受け取る。選んだファイルは onchange で親にも渡す -->
  <input
    {id}
    class="visually-hidden"
    type="file"
    {accept}
    aria-label={ariaLabel}
    {disabled}
    bind:files
    onchange={onChange}
  />
  <label for={id} class={['pixel-button', styles.button]}>{$_('choose_file')}</label>
  <span class={[styles.name, !fileName && 'note']} title={fileName || undefined}
    >{fileName || $_('no_file_selected')}</span
  >
</span>
