# 北極熊烤肉店 3D

**線上試玩：<https://malilion.github.io/Polar-Bear-BBQ-Game/>**

使用 Blender 背景模式建模，匯出 GLB，由 Three.js 即時呈現的簡單烤肉遊戲。

- 拖曳旋轉、滾輪或雙指縮放；也有縮放與重設視角按鈕。
- 三個烤位可以同時使用，可直接點擊立體烤爐，或操作下方可鍵盤存取的按鈕。
- 肉串 4 秒、鮮魚 5 秒；熟透後 4 秒會烤焦。食物模型隨熟度變色。
- 90 秒內賺到 200 金幣。客人耐心 24 秒，前 12 秒送餐多拿 5 金幣。
- 切到其他分頁會暫停。沒有帳號、後端紀錄或跨次遊戲存檔。

## 執行

```sh
npm install
npm run dev
npm run test:game
npm run build
npm run preview
```

純前端的 Vite 專案：沒有 API 路由、沒有 server actions、沒有資料庫。所有遊戲狀態都在瀏覽器記憶體裡，關掉分頁就重來。

## GitHub Pages

`web/index.html` 是進入點，掛載 `app/page.tsx`。`npm run build` 輸出靜態檔到 `dist/`（未納入 Git）。

建置時的 `base` 預設為 `/Polar-Bear-BBQ-Game/`，可用 `PAGES_BASE` 環境變數覆寫；GLB 路徑跟著 `import.meta.env.BASE_URL` 解析，所以放在任何子路徑都載得到。`npm run dev` 一律走根路徑。

推送到 `main` 時，`.github/workflows/pages.yml` 會自動建置並部署。

## 使用 headless Blender 重新建模

已以 Blender 4.5.0 執行。請將 `BLENDER_BIN` 指向本機 Blender 執行檔。

```sh
BLENDER_BIN=/Applications/Blender.app/Contents/MacOS/Blender
"$BLENDER_BIN" --background --python scripts/build_scene.py -- --render
```

產物：

- `assets/blender/polar-bbq.blend`：可編輯原始場景，含攝影機與燈光。
- `public/models/polar-bbq.glb`：網頁載入的完整幾何場景，沒有外部貼圖依賴。
- `public/models/scene-manifest.json`：Blender 版本、物件及互動節點契約。
- `outputs/polar-bbq-blender.png`：可選的 Blender 攝影機預覽，未納入 Git。

模型由 `scripts/build_scene.py` 的 Blender 幾何建構，不是平面圖貼在 3D 平面上。舊版 `public/polar-bbq.png` 保留為先前作品，但 3D 遊戲不載入它。

## 場景節點

`GrillHit0`～`GrillHit2` 帶有 `slotIndex` 自訂屬性供射線點擊；`Food_meat_0`～`Food_fish_2` 是食材群組；`cookable` 網格隨熟度變色。`Guest_0`～`Guest_2` 依訂單存在與否顯示。`Chef`、`ChefHead` 與 `ChefArmRight` 用於輕量動畫。

Blender 的 Z-up 匯出為 glTF 的 Y-up。遊戲狀態集中在 `lib/game.ts`，模型只呈現同一份狀態。
