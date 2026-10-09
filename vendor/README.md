# vendor/

同梱している外部ライブラリーの出所と検証用の値である。CDNから読み込まず自己ホストにしているため、配信元が差し替えられても台帳データに影響しない。オフラインでも動く。

## qrcode.min.js

| 項目 | 値 |
|---|---|
| ライブラリー | QRCode.js（davidshimjs/qrcodejs） |
| バージョン | 1.0.0 |
| 取得元 | <https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js> |
| 取得日 | 2026-10-09 |
| サイズ | 19,927バイト |
| SHA-256 | `c541ef06327885a8415bca8df6071e14189b4855336def4f36db54bde8484f36` |
| SRI（cdnjs公開値と一致） | `sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA==` |
| ライセンス | MIT（Copyright (c) 2012 davidshimjs） |
| リポジトリー | <https://github.com/davidshimjs/qrcodejs> |

- ファイルは一切改変していない。`sha256sum vendor/qrcode.min.js` で上の値と照合できる
- `eval` と `new Function` は含まれない（取得時に確認）
- canvasに対応しないブラウザー向けの代替描画は `style` 属性つきのHTMLを組み立てる。本ツールのCSPは `style-src 'self'` なので、その経路ではQRの色が当たらない。canvasに対応する現行のブラウザーでは使われない
- ライセンス全文は [LICENSE-qrcodejs.txt](LICENSE-qrcodejs.txt) にある
