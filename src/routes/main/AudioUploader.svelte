<script lang="ts">
  // 曲の選択。選んだ曲は音声の状態（AudioState）に読み込む。再生・解析・波形はそちらが受け持つ
  import { _ } from 'svelte-i18n';
  import FileInput from '#lib/components/FileInput.svelte';
  import { getAudioState } from '#lib/state/audio.svelte.ts';
  import { getExportState } from '#lib/state/export.svelte.ts';

  // iOS Safari は audio/* を video/* として扱い、音声ファイルが選べなくなる（WebKit bug 242110）。
  // 拡張子と MIME タイプも並べて選べるようにする。ほかのブラウザには audio/* が効く
  const ACCEPT = [
    'audio/*',
    '.mp3',
    '.m4a',
    '.aac',
    '.wav',
    '.aif',
    '.aiff',
    '.flac',
    '.ogg',
    '.opus',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/wav',
    'audio/x-wav'
  ].join(',');

  const audio = getAudioState();
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
    accept={ACCEPT}
    ariaLabel="Upload audio"
    disabled={exporter.busy}
    onchange={upload}
  />
</section>
