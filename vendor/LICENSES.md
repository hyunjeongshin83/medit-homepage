# 사이트 안에서 직접 제공하는 외부 구성요소 (vendor/)

방문자의 IP 주소 등이 외부 서버(Google Fonts, unpkg, jsDelivr)로 전달되지 않도록 아래 구성요소를 이 사이트 안에서 직접 제공합니다.

| 구성요소 | 버전 | 라이선스 | 원 출처 |
|---|---|---|---|
| Noto Sans KR (가변 글꼴, `@fontsource-variable/noto-sans-kr` 5.3.1 패키지의 woff2) | — | SIL Open Font License 1.1 | Google / Adobe — https://fonts.google.com/noto/specimen/Noto+Sans+KR |
| IBM Plex Mono 400·500·600 (`@fontsource/ibm-plex-mono` 패키지의 woff2, latin·latin-ext) | — | SIL Open Font License 1.1 | IBM — https://github.com/IBM/plex |
| Tone.js | 14.8.49 | MIT | https://github.com/Tonejs/Tone.js |
| Salamander Grand Piano V2 (Yamaha C5) — 음원 4개(C4·D#4·F#4·A4, mp3). 원본 Tone.js 오디오 저장소(github.com/Tonejs/audio)의 사본 | V2 | Creative Commons Attribution 3.0 (CC BY 3.0) — 저작자: Alexander Holm. 변경 없음 | http://creativecommons.org/licenses/by/3.0/ · `vendor/audio/salamander/README-SalamanderGrandPiano.txt` |
| node-qrcode (브라우저용 번들, 이 저장소에서 `lib/browser.js`를 esbuild로 묶음) | 1.5.3 | MIT | https://github.com/soldair/node-qrcode |

음원은 원본 파일을 그대로 두었고(편집 없음), 이용 조건은 CC BY 3.0(저작자 표시)입니다.
각 라이선스 전문은 `vendor/fonts/LICENSE-*.txt`, `vendor/tone/LICENSE.md`, `vendor/qrcode/LICENSE` 에 있습니다.
