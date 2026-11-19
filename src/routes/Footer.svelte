<script lang="ts">
  import styles from './Footer.module.css';
</script>

<footer class={styles.footer}>
  <div>
    <div>
      <a href="https://m1m0zzz.github.io/" target="_blank" rel="noopener noreferrer">Home Page</a>
      <a href="https://twitter.com/m1m0zzz" target="_blank" rel="noopener noreferrer">Twitter</a>
      <a href="https://soundcloud.com/mimozzz" target="_blank" rel="noopener noreferrer"
        >SoundCloud</a
      >
    </div>
    <hr />
    <p>
      Video export uses
      <a
        href="https://github.com/Vanilagy/mediabunny/tree/v{__MEDIABUNNY_VERSION__}"
        target="_blank"
        rel="noopener noreferrer">Mediabunny v{__MEDIABUNNY_VERSION__}</a
      >
      (<a href="https://www.mozilla.org/MPL/2.0/" target="_blank" rel="noopener noreferrer"
        >MPL-2.0</a
      >). When the browser cannot encode AAC, its AAC encoder extension uses FFmpeg's AAC encoder,
      licensed under
      <a
        href="https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html"
        target="_blank"
        rel="noopener noreferrer">LGPL-2.1-or-later</a
      >; source and build instructions:
      <a
        href="https://github.com/Vanilagy/mediabunny/tree/v{__MEDIABUNNY_VERSION__}/packages/aac-encoder"
        target="_blank"
        rel="noopener noreferrer">@mediabunny/aac-encoder</a
      >.
    </p>
    <p>&copy; 2023 mimoz</p>
  </div>
</footer>
