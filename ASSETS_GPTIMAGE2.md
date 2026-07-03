# アセット差し替えガイド（gpt-image / gptimage2 用プロンプト集）

このゲームは全スプライトを**コードで手続き生成**しているが、`public/assets/sprites/<id>.png`
に透過PNGを置くと、そのスプライトだけ**AI生成画像で上書き**される（無ければ従来のコード描画に
自動フォールバック）。ゲームは常に動くので、1枚ずつ差し替えて確認できる。

## 使い方（3ステップ）

1. 下記プロンプトで画像を生成（**背景透過PNG**、正方形〜指定比率）。
2. `public/assets/sprites/` にファイル名 **`<id>.png`** で保存（例: `enemy_oni.png`）。
3. `npm run dev` を再読み込み。ブラウザのコンソールに `[hyakki] AI sprite overrides loaded: ...`
   と出れば反映済み。ゲーム内で `window.__hyakki.listAssetSlots()` を実行すると、
   全スロットと「PNGがあるか（✔/·）」の一覧が出る（ファイル名ミスの検出用）。

## 仕様（重要）

- **必ず背景透過**。余白は詰め、被写体を画面いっぱいに。
- 元スプライトの**枠サイズ（下の px）はゲーム内の表示footprint**。当たり判定・アンカーは
  枠基準なので変わらない。AI画像はこの枠に**アスペクト維持で contain**される。高解像度でOK
  （綺麗に縮小される）。目安として**各辺 256〜512px**で作ると縮小が滑らか。
- **1スプライト＝1枚の静止画**でよい（アニメ不要）。敵/ボスの被弾白フラッシュは自動付与される。
- 全体で**統一した画風**にすると馴染む。下の「共通スタイル」を各プロンプト先頭に付けること。

## 共通スタイル（各プロンプトの先頭に付与）

```
Japanese folklore video game sprite, dark moody night-parade aesthetic, hand-painted
semi-realistic with bold readable silhouette, rim-lit with warm lantern-orange and cold
spirit-teal accents against near-black, subtle ink outline, centered single subject,
transparent background, no text, no border, no ground shadow, high detail but reads
clearly at small size.
```

パレット参考: 墨黒 #0b0b12 / 骨白 #f2ead8 / 提灯橙 #e8a33d / 霊気翠 #5fd3c4 /
血朱 #b03a3a / 金 #f5c542 / 狐緑 #7fda89 / 藤紫 #8a6fc9。

---

## ① 自キャラ（陰陽師たち・24×28px 縦長）

| ファイル | プロンプト（共通スタイルの後に続ける） |
|---|---|
| `char_onmyoji.png` | A young onmyoji (Heian exorcist) in a pale off-white robe with violet trim and a black eboshi hat, holding a paper talisman, calm determined face, full body facing viewer. |
| `char_miko.png` | A shrine maiden (miko) in white haori and crimson hakama with a red hair ribbon, holding a purification wand, full body facing viewer. |
| `char_ronin.png` | A wandering ronin swordsman in dark teal kimono with a topknot, one hand on a sheathed katana, weathered stance, full body facing viewer. |
| `char_sohei.png` | A stout warrior monk (sohei) in ochre robes with a cloth hood and prayer beads, sturdy build, full body facing viewer. |
| `char_kitsune.png` | A fox-possessed girl with pale green fox ears and tails peeking out, mischievous smile, light robe, floating foxfire beside her, full body facing viewer. |
| `char_kugutsu.png` | A puppeteer in violet robes and a wide straw hat, thin strings trailing from the fingers to tiny puppets, enigmatic, full body facing viewer. |

## ② 妖怪（雑魚敵）

各16〜30px。**シルエット重視**、目立つ1色アクセント。

| ファイル | px | プロンプト |
|---|---|---|
| `enemy_hitodama.png` | 20×20 | A hitodama: a floating teal soul-flame orb with a wispy tail and two small dark eyes. |
| `enemy_chochin.png` | 22×24 | A chochin-obake: a paper lantern yokai, glowing orange, one big cyclops eye and a long lolling red tongue. |
| `enemy_kasa.png` | 20×26 | A kasa-obake: a one-eyed one-legged umbrella yokai hopping, violet paper canopy, tongue out. |
| `enemy_yosuzume.png` | 16×14 | A yosuzume: a small ghostly night sparrow with pale spread wings and glowing eyes. |
| `enemy_hitotsume.png` | 22×24 | A hitotsume-kozo: a small one-eyed boy monk in a teal robe with a single huge eye. |
| `enemy_gaikotsu.png` | 20×26 | A gaikotsu: a bone-white skeletal yokai, hollow eye sockets, exposed ribs, menacing. |
| `enemy_onibi.png` | 18×18 | An onibi: a fierce ember-orange will-o-wisp flame with a golden core and dark eyes. |
| `enemy_kappa.png` | 24×24 | A kappa: a green river-imp with a water dish on its head, beak, turtle-shell back. |
| `enemy_tsuchigumo.png` | 28×22 | A tsuchigumo: a dark bulbous ground-spider yokai with many legs and ember eyes. |
| `enemy_hannya.png` | 22×26 | A hannya: a vengeful female demon mask, bone-white face, two golden horns, ember eyes, wide fanged grin. |
| `enemy_nurikabe.png` | 30×26 | A nurikabe: a broad grey plaster-wall yokai with small stubby feet and two little eyes, wide and blocky. |
| `enemy_tengu.png` | 24×26 | A tengu: a red-faced long-nosed mountain goblin with black crow wings and white eyes. |
| `enemy_omukade.png` | 30×20 | An omukade: a giant segmented centipede yokai, dark red armored segments, ember head, many legs, horizontal. |
| `enemy_nue.png` | 28×26 | A nue chimera: a monkey-faced tiger-bodied yokai with a snake tail, ochre fur with dark stripes, ember eyes. |
| `enemy_oni.png` | 26×30 | An oni: a red-skinned horned ogre demon with bone-white horns, golden eyes, fangs, a tiger-fur belt. |
| `enemy_yukinko.png` | 16×18 | A yukinko: a tiny round snow-child spirit, white body in a small straw coat, pale cold face. |

## ③ ボス・掃討役

| ファイル | px | プロンプト |
|---|---|---|
| `boss_gashadokuro.png` | 40×44 | A gashadokuro: a colossal bone-white skeleton yokai looming, huge skull with dark hollow sockets, massive ribcage, imposing. |
| `boss_shuten.png` | 40×44 | Shuten-doji: a giant crimson oni king with bone horns, golden glowing eyes, a fierce scowl, holding a sake gourd, regal and terrifying. |
| `boss_yukionna.png` | 36×46 | A yuki-onna: a tall pale snow-woman in a flowing white robe fading to mist, long black hair, icy teal eyes, cold beauty, chilling aura. |
| `boss_akatsuki.png` | 44×44 | The First Light: a blinding radiant sun-disk of pure white-gold light with piercing rays, holy and unstoppable, over-bright core. |

## ④ 力・武器の弾（projectiles）

小さいので**発光する明快な形**を。`_evo`は進化形＝上位版で金/朱の強化色。

| ファイル | px | プロンプト |
|---|---|---|
| `shot_ofuda.png` | 14×14 | A flying ofuda paper talisman, white slip with red sacred script, motion streak. |
| `shot_hyakki_seal.png` | 20×20 | An evolved great sealing-talisman, gold paper with blazing crimson script, radiant. |
| `shot_kunai.png` | 12×12 | A grey steel kunai throwing blade with a red-wrapped ring, motion trail. |
| `shot_kunai_evo.png` | 14×14 | An evolved golden kunai blade glowing with ember energy, sharp motion trail. |
| `shot_juzu.png` | 12×12 | A single glowing violet prayer bead (juzu), soft highlight. |
| `shot_juzu_evo.png` | 14×14 | A single radiant golden prayer bead with a white core, holy glow. |
| `shot_masakari.png` | 18×18 | A spinning battle-axe (masakari) with a dark haft and pale bright blade. |
| `shot_masakari_evo.png` | 22×22 | An evolved demon-cleaving axe wreathed in ember flame, black haft, glowing edge. |
| `shot_tomoe.png` | 16×16 | A spinning teal sacred mirror-ring with three tomoe comma-marks, glowing. |
| `shot_tomoe_evo.png` | 20×20 | An evolved golden sacred-treasure ring spinning with bright tomoe marks, radiant. |
| `shot_kitsunebi.png` | 16×16 | A teal-white foxfire flame orb, ghostly and bright. |
| `shot_kitsunebi_evo.png` | 20×20 | An evolved nine-tails inferno flame orb, ember-gold blaze with a white-hot core. |

## ⑤ エフェクト・モーション（fx）

**半透明**で作ると重なりが綺麗（透過PNGのアルファで表現）。中心から広がる形。

| ファイル | px | プロンプト |
|---|---|---|
| `fx_slash.png` | 64×64 | A crescent sword-slash arc, bone-white with a pale inner streak, motion swipe, semi-transparent, on transparent background. |
| `fx_slash_evo.png` | 72×72 | A wide evolved slash arc, gold with crimson inner edge, powerful swipe, semi-transparent. |
| `fx_kekkai.png` | 128×128 | A circular protective barrier ward, faint teal glowing ring with hanging paper shide charms, translucent fill, top-down, semi-transparent. |
| `fx_kekkai_evo.png` | 128×128 | An evolved barrier: a bright gold double ring with an ember inner circle, translucent, top-down, semi-transparent. |
| `fx_zone.png` | 96×96 | A teal holy-water puddle zone with rising bubbles, translucent, top-down ellipse, semi-transparent. |
| `fx_zone_evo.png` | 96×96 | An evolved violet spirit-swamp zone with a single eye in the mire, translucent, top-down ellipse, semi-transparent. |
| `fx_bolt.png` | 20×56 | A vertical lightning bolt strike, gold-white jagged branch with a bright impact blob at the bottom, on transparent background. |
| `fx_bolt_evo.png` | 26×64 | An evolved thunder-god lightning strike, teal-white, thicker jagged bolt with a bright burst, on transparent background. |

## ⑥ アイテム（護符＝パッシブ・18×18px）

小さなアイコン。**背景の枠は不要**（ゲーム側で枠を描く）ので被写体だけ。

| ファイル | プロンプト |
|---|---|
| `item_rice.png` | A small bowl of sacred white rice (shinsen), a couple of grains, icon. |
| `item_sutra.png` | A folded paper sutra scroll with vertical ink lines, icon. |
| `item_magatama.png` | A teal comma-shaped magatama jewel with a highlight, icon. |
| `item_tea.png` | A steaming cup of herbal medicine tea, icon. |
| `item_lantern.png` | A large round orange paper lantern (chochin), lit, icon. |
| `item_ema.png` | A wooden ema votive plaque (pentagon top) with a small red mark, icon. |
| `item_shimenawa.png` | A twisted sacred straw rope (shimenawa) with paper shide streamers, icon. |
| `item_bunshin.png` | Two overlapping pale ghostly shadow-clones of a ninja, icon. |
| `item_lodestone.png` | A red-and-grey horseshoe lodestone magnet, icon. |
| `item_maneki.png` | A white maneki-neko beckoning cat with a gold collar, icon. |
| `item_kanmuri.png` | A golden imperial crown, icon. |
| `item_noh.png` | A pale Noh theatre mask (ko-omote) with a faint red mouth, icon. |
| `item_juso.png` | A straw-doll curse charm (wara-ningyo) pinned with a nail, ominous, icon. |

## ⑦ 拾い物（pickups）

| ファイル | px | プロンプト |
|---|---|---|
| `pickup_chest.png` | 22×18 | A small ornate treasure chest, orange wood with gold trim and a lock, closed, glinting. |
| `pickup_food.png` | 16×14 | A steamed white bun (manju) with a small red mark, appetizing, icon. |
| `pickup_coin.png` | 12×12 | A gold oval koban coin with an engraved mark, shiny. |
| `pickup_vacuum.png` | 16×16 | A swirling teal spiral vortex icon suggesting suction. |
| `pickup_bomb.png` | 16×16 | A round black bomb with a lit orange spark fuse. |

## ⑧ その他

| ファイル | px | プロンプト |
|---|---|---|
| `gem.png` | 10×10 | A small glowing blue experience gem, faceted diamond shape with a highlight. |
| `poof.png` | 20×20 | A pale grey puff of smoke / spirit dissipation ring, semi-transparent, on transparent background. |

---

## 一括生成のコツ

- gpt-image は「複数被写体を1画像に並べたシート」だと個別に切り出しづらい。**1ファイル1被写体**推奨。
- 同じ「共通スタイル」冒頭を固定し、末尾の被写体文だけ差し替えると画風が揃う。
- 動きのアニメが欲しい場合でも、本ゲームは静止1枚で動く（揺れ等はコード側の演出で付く）。
- 反映後は `window.__hyakki.listAssetSlots()` で ✔ を確認。表示がおかしければ元PNGの透過/余白を見直す。
