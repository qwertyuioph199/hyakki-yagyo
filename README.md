# 百鬼夜行 HYAKKI YAGYO

陰陽師となり、百鬼夜行の夜を夜明け(30分)まで生き延びるサバイバーアクション。
Vampire Survivors の隠れ仕様を完全リバースエンジニアリングした機能クローン(テーマ・素材・名称は100%オリジナル)。

- **ランタイム依存ゼロ** — Vite + TypeScript strict + Canvas2D のみ
- **決定論的シミュレーション** — 固定60Hzタイムステップ、同シード+同入力=同結果
- **RE文書** — [MECHANICS.md](MECHANICS.md):原作の仕組み→本実装の対応表(全式ユニットテスト済み)
- **事業計画** — [BUSINESS.md](BUSINESS.md)

## 開発

```bash
npm install
npm run dev      # http://localhost:5199 (ランディング) / /play/ (ゲーム)
npm test         # ユニット+統合テスト
npm run build    # 型チェック+本番ビルド
npm run bot      # ヘッドレスボット・バランス掃引
```

デバッグ:`/play/#perf` = 性能ストレスシーン、`/play/#sprites` = アトラスレビュー。

## 性能(実測値は P7 で記録)

目標:敵500体+弾200+ジェム300で p95 ≤ 16.7ms(60fps)。
