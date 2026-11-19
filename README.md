# .Spectrum

dot spectrum is a pixel-art-like spectrum analyzer. w/ Web Audio API.

![preview](./preview.gif)

## 📚 Tech Stack

- Canvas API
- Web Audio API
- WebCodecs / [Mediabunny](https://github.com/Vanilagy/mediabunny)
- PWA

## ❤️ Acknowledgments

マルモニカ - 患者長ひっく (https://twitter.com/hicchicc) 様

https://00ff.booth.pm/items/4927023

## Third-party licenses

Video export uses [Mediabunny](https://github.com/Vanilagy/mediabunny) (`mediabunny`), licensed under [MPL-2.0](https://www.mozilla.org/MPL/2.0/). Its source is at the tag of the bundled version in [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny/tags).

When the browser cannot encode AAC, the site loads [`@mediabunny/aac-encoder`](https://github.com/Vanilagy/mediabunny/tree/main/packages/aac-encoder) (MPL-2.0). It contains a WebAssembly build of [FFmpeg](https://ffmpeg.org/)'s AAC encoder, which is licensed under [LGPL-2.1-or-later](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html) (built without `--enable-gpl`). The package's README describes how the WebAssembly build is made, and the FFmpeg license files are in its `licenses/ffmpeg` directory. The bundled versions are in `package-lock.json` and in the links in the page footer.
