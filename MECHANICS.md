# MECHANICS.md — リバースエンジニアリング文書

本書は Vampire Survivors(poncle, 2022)の隠れ仕様を、コミュニティwiki・データマイン報告から再構築し、
本作『百鬼夜行』へ移植した対応表である。**各節の式・定数はユニットテストが実行する仕様**であり、
テストファイル名を併記する。仕組み・数式はアイデア(著作権の保護対象外)であり、
名称・文言・絵柄・音声は一切複製していない。

確度表記: ✅=複数ソースで一致 / 🟡=単一ソースまたは記憶ベース(数値は要再検証だが構造は確実)

---

## §1 経験値カーブ — `src/data/xp.ts` / `test/data/xp.test.ts`

| 原作 | 本作 | 確度 |
|---|---|---|
| L1→2 = 5 XP | 同一 | ✅ |
| 〜L20 まで毎レベル +10 | 同一 | ✅ |
| L20→21 に一時ボーナス +600 | 同一 | 🟡 |
| 〜L40 まで毎レベル +13 | 同一 | ✅ |
| L40→41 に一時ボーナス +2400 | 同一 | 🟡 |
| L41〜 毎レベル +16 | 同一 | ✅ |
| Growth はXP取得の乗数 | `gainXp: xp += value × growth` | ✅ |

ジェム: 敵撃破で経験値ジェムをドロップ。プール上限(300)超過時は既存ジェムへ価値を統合
(原作の「画面外ジェムが赤ジェムに集約される」仕組みの機能的等価。簡略化: 位置は先頭ジェム)。
`src/game/sim/projectileSystem.ts:spawnGem`

## §2 ウェーブ/出現システム — `src/data/waves.ts` `src/game/sim/spawnSystem.ts`

| 原作 | 本作 | 確度 |
|---|---|---|
| 分単位のウェーブ定義(最低生存数・出現間隔・敵プール) | `WaveDef {minAlive, interval, pool}` 30行テーブル | ✅(構造) |
| 生存数が下限を割ると画面外リングに補充出現 | 不足分の1/4をバッチ補充、リング半径620px | ✅(構造)🟡(数値) |
| 遠距離の敵はデスポーンせずリングへ再配置(蝙蝠の壁が途切れない仕組み) | 800px超で再配置。ボスは除外 | ✅ |
| 分境界の群れイベント(蝙蝠の壁 等) | `swarm {enemy, count, formation}` ring/wall | ✅(構造) |
| ミニボス(分定義、宝箱ドロップ) | `boss` フィールド + boss敵は宝箱ドロップ | ✅ |
| 30:00 に死神(即死級掃討役)出現 | 「夜明けの光」P5で実装 | ✅ |
| Curse が実効出現数を乗算 | `target = minAlive × curse` | ✅ |

## §3 ステータスモデル — `src/game/sim/statSystem.ts` / `test/sim/statSystem.test.ts`

16ステータス: Might/Armor/MaxHP/Recovery/Cooldown/Area/Speed/Duration/Amount/MoveSpeed/
Magnet/Luck/Growth/Greed/Curse/Revival(+Reroll/Skip/Banish チャージ)。

| 規則(原作) | 本作 | 確度 |
|---|---|---|
| キャラ補正+パッシブ+PowerUpは**加算**で積む(乗算ではない) | `aggregateStats` | ✅ |
| 乗数系は基準1.0、Armor/Amount/Recovery等はフラット加算 | 同一 | ✅ |
| MaxHPはキャラ基礎値に%加算 | `hpBase × (1+Σ%)` | ✅ |
| Cooldown低減には下限(本作: 乗数floor 0.1) | `COOLDOWN_FLOOR=0.1` | 🟡 |
| 武器毎クールダウンにも下限(base×0.2) | `weaponSystem` | 🟡 |
| MaxHP増加時は増分ぶん回復 | `recomputeStats` | 🟡 |

## §4 武器システム — `src/data/weapons.ts` `src/game/sim/weaponSystem.ts`

| 原作 | 本作 | 確度 |
|---|---|---|
| 発射数 = 武器amount + レベル差分 + Amountステータス | `count = def.amount + lv.amount + stats.amount` | ✅ |
| ダメージ = (基礎+レベル差分) × Might | 同一 | ✅ |
| Magic Wand: 最近接敵へ自動照準 | `aimedProjectile` = 最近接敵狙い(不在時は移動方向) | ✅ |
| 貫通: 弾ごとに撃破数上限、同一弾は同一敵に1回のみ | pierce + uid リング(hit0..3) | ✅ |
| レベルアップはwiki表と同形式の「レベル毎デルタ」 | `levels: WeaponLevelDelta[]` | ✅(構造) |
| 8挙動アーキタイプに全武器を写像 | aimed/orbit/aura/arcLob/boomerang/randomStrike/zone/familiar(P4で残7実装) | — |

対応表(P4で全10種完成): Whip→御札(実装は自動照準型として)、Magic Wand→(P4)、…

## §5 パッシブ — `src/data/passives.ts`

原作→本作: Spinach→神饌の米(Might+10%)/ Empty Tome→写経(CD-8%)/ Hollow Heart→勾玉(HP+20%)/
Pummarola→薬湯(回復+0.2)/ Candelabrador→大提灯(範囲+10%)/ Bracer→絵馬(弾速+10%)/
Spellbinder→注連縄(時間+10%)/ Duplicator→分身の術(+1発)/ Attractorb→磁鉄鉱(磁力+50%)/
Clover→招き猫(運+10%)/ Crown→冠(成長+8%)/ Stone Mask→能面(金+10%)/ Skull O'Maniac→呪詛(呪い+10%)。
レベル効果は全て線形加算(✅)。数値は原作準拠(🟡 W-Aで最終照合)。

## §6 レベルアップドラフト — `src/game/sim/levelUpSystem.ts` / `test/sim/levelUpSystem.test.ts`

| 原作 | 本作 | 確度 |
|---|---|---|
| 候補: 未満レベルの所持品 + 空きスロットがある場合のみ新規(武器6/パッシブ6) | `collectCandidates` | ✅ |
| レア度加重・重複なし抽選 | `rng.weighted` + 除去抽選 | ✅ |
| 基本3択、Luckで4枠目(上限あり) | `P(4枠)=min(luck−1, 0.3)` | 🟡(上限値) |
| 候補枯渇時は金/回復にフォールバック | gold+25 / food+30HP | ✅(構造) |
| リロール=再抽選 / スキップ=そのレベル放棄 / バニッシュ=以後の候補から除外(ラン内永続) | 同一。チャージはステータス | ✅ |
| ドラフト中はゲーム停止 | `stepRun` が pendingLevelUps>0 で凍結 | ✅ |

## §7 宝箱 — `src/game/sim/chestSystem.ts` / `test/sim/chestSystem.test.ts`

| 原作 | 本作 | 確度 |
|---|---|---|
| 進化可能(基礎武器最大Lv+対応パッシブ所持+進化未所持+分ゲート)なら宝箱は必ず進化を先頭付与 | `eligibleEvolution` → 先頭item | ✅ |
| 進化はレベルアップからは絶対に出ない | 進化武器 `evolutionOnly` はドラフト除外 | ✅ |
| 力(アイテム)数は経過時間スケール1〜5、Luckで+1機会 | `chestRolls = clamp(1+⌊分/6⌋,1,5)`、Luck>1で+1 | 🟡(本作独自の時間スケール化) |
| 宝箱は**所持品のレベルアップのみ**(新規は出ない) | `upgradable` = owned only | ✅ |
| 適用不能ロールは金へ変換、金も経過時間スケール、Greed乗算 | `(25 + 8·分 + 12·個)·greed` | 🟡(数値) |
| ミニボス+通常敵が確率で宝箱ドロップ | boss死亡→常時 / 雑魚→0.25%·Luck | ✅ |
| **開封演出**: 取得でsim凍結→宝箱発光・破裂・力を段階開示・金加算(クリック/Spaceで再開) | `world.chestReveal` + `src/ui/chest.ts` | (本作独自) |

## §8 メタ進行(PowerUpショップ) — `src/game/meta/shop.ts` / `test/meta/shop.test.ts`

| 原作 | 本作 | 確度 |
|---|---|---|
| 価格 = 基礎 × (次ランク) × (1 + 0.10 × **全体購入済ランク数**) | `nextRankPrice` | 🟡(0.10) |
| ∴「高額品から買う」最適化が発生(原作の有名な仕様) | テストで実証 | ✅ |
| 全ランク返金可能 | P4/W-E(spent追跡) | ✅(構造) |
| PowerUp一覧(19種、ランク/効果/基礎価格) | `data/shop.ts` 護符シリーズ | 🟡(価格表) |

## §9 その他の確定仕様

- **被弾無敵**: 接触ダメージ後 0.4s(24tick)の i-frames — `enemySystem` 🟡(長さ)
- **Revival**: 死亡時に残機があれば HP50% で復活+2s無敵 — ✅
- **ノックバック**: 武器係数×(1−敵耐性)、ボスは完全耐性 — ✅(構造)
- **マグネット**: 基礎半径34px × Magnet。ジェムは一度磁化したら追従(原作同様、範囲外離脱でも戻らない) — ✅
- **拾い物**: 御饌(回復)/金貨/磁石(全ジェム磁化)/爆弾(画面内一掃) — ✅(構造)
- **決定論**: 全乱数はワールド所有の mulberry32。`test/sim/simPurity.test.ts` が
  `Math.random`/`Date.now`/`performance.now`/DOM を sim/data 層から締め出し、
  `test/sim/determinism.test.ts` が10k tickのリプレイ同一性+ゴールデンハッシュを固定 — (本作独自の品質保証)

## §10 検証装置(本作独自 — REの証明手段)

- **決定論**: 全乱数はワールド所有のmulberry32。`test/sim/simPurity.test.ts` が sim/data 層から
  `Math.random`/`Date.now`/`performance.now`/DOM を機械的に締め出し、`determinism.test.ts` が
  10k tickのリプレイ同一性とゴールデンハッシュを固定
- **統合**: `fullRun.test.ts` — ヘッドレスで30分完走(実時間≈3秒)。夜明けが**正確にtick 108,000**で
  発火すること、プール上限非超過、NaN不在、ボス→宝箱→金のパイプライン成立を毎回証明
- **バランス**: `npm run bot` — 危険場キーティング+貪欲ドラフトのボットで{キャラ×シード×投資}を掃引。
  ゲート: 初期セーブ中央値6〜17分死/投資済みは+2分以上深く到達。実測: 15.3分 → 20.2分
- **性能**: 可視タブ600フレーム実測 CPU p95 2.1ms(全1000+エンティティ画面内)、フレーム落ち0%

## 既知の簡略化(v1.0)

- ジェムマージは「プール満杯時に先頭へ統合」(原作は赤ジェム集約) — 機能等価・視覚簡略
- 武器ごとの細かな挙動差(King Bibleの回転加速など)はアーキタイプ共通実装に丸めた
- ミニボスの速度/HPは自動ボット基準で再調整済み(§10)。原作数値そのままではない
- 床の光源(ろうそく等)は「約40秒ごとにプレイヤー付近へフィールドドロップ湧き
  (金貨5/御饌3/磁石1/爆弾1の重み)」として機能等価に実装(v1.1.1)。
- 通常敵撃破時に単一ロールで確率ドロップ(v1.1.4): 宝箱0.25%·Luck > 御饌(回復=最大HP30%)0.8%·Luck
  > 金貨2%·Luck。敵からの回復/宝箱の供給ループ。宝箱は上記§7の時間スケール報酬+開封演出付き
