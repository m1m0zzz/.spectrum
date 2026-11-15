<script lang="ts">
  // 曲の選択。選んだ曲は音声の状態（AudioState）に読み込む。再生・解析・波形はそちらが受け持つ
  import { _ } from 'svelte-i18n';
  import FileInput from '#lib/components/FileInput.svelte';
  import { getAudioState } from '#lib/state/audio.svelte.ts';
  import { getExportState } from '#lib/state/export.svelte.ts';

  const audio = getAudioState();
  // 動画の作成中は曲を差し替えられないようにする
  const exporter = getExportState();
  // ダイアログを取り消すと選択が空になる。そのときは今の曲のままにする
  const upload = (files: FileList | undefined) => {
    if (files?.[0]) audio.load(files[0]);
  };
</script>

<section>
  <h3>🎵 {$_('upload_audio')}</h3>
  <FileInput
    id="audio-file"
    accept="audio/*"
    ariaLabel="Upload audio"
    disabled={exporter.busy}
    onchange={upload}
  />
</section>
