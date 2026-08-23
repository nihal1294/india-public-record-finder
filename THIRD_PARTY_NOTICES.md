# Third-party notices

## Noto Sans Kannada

`apps/web/public/fonts/noto-sans-kannada/NotoSansKannada-Regular.ttf` is the current
static Noto Sans Kannada regular face from the [official Google Fonts static
source](https://fonts.gstatic.com/s/notosanskannada/v32/8vIs7xs32H97qzQKnzfeXycxXZyUmySvZWItmf1fe6TVmgop9ndpS-BqHEyGrDvNzSI.ttf).
It is licensed under SIL Open Font License 1.1; the complete licence text from
the [official Google Fonts source](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskannada/OFL.txt)
is retained at `apps/web/public/fonts/noto-sans-kannada/OFL.txt`. The verified SHA-256
of the 143576-byte bundled regular font is
`4b8dd08fc05afa13cc8daa8ac2187f35711be026286db8608e87c86f715e273d`.

## PaddleOCR recognizers

The offline OCR worker uses `PaddlePaddle/ka_PP-OCRv3_mobile_rec` at
`fd08732bad5fb532cf883cb42a75ed139a72ab18` and
`PaddlePaddle/en_PP-OCRv4_mobile_rec` at
`f97b62fdc0eb71c689393a19a4b21baa1795c9ab`. Both model repositories declare
the Apache-2.0 licence. Exact file digests and expected cache directories are
in `models/manifest.json`; model weights are operator-fetched and are not
stored in this repository.

## Multilingual retrieval model

The service uses `intfloat/multilingual-e5-small` at revision
`614241f622f53c4eeff9890bdc4f31cfecc418b3`, licensed under MIT. Its exact
required files and SHA-256 values are declared in `models/manifest.json`.
Model weights are verified during packaging and are not stored in this
repository.
