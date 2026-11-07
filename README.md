# .Spectrum

dot spectrum is a pixel-art-like spectrum analyzer. w/ Web Audio API.

![preview](./preview.gif)

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Third-party licenses

Video conversion uses [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm). `@ffmpeg/ffmpeg` and `@ffmpeg/util` are MIT. The FFmpeg core (`@ffmpeg/core` / `@ffmpeg/core-mt`), which is bundled into the build and served with this site, is licensed under [GPL-2.0-or-later](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html) because it includes FFmpeg and libraries such as x264. Its source (build scripts pinning the upstream versions) is at the tag of the bundled version in [ffmpegwasm/ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm/tags). The version is in `package-lock.json` and in the link in the page footer.

## TODO

- ドット化サイズを 1/n と、ピクセルサイズの両方で指定可能にする
- style
  - audio
  - file Input

## 📚 Tech Stack

- Canvas API
- Web Audio API
- PWA

## ❤️ Acknowledgments

マルモニカ - 患者長ひっく (https://twitter.com/hicchicc) 様

https://00ff.booth.pm/items/4927023
