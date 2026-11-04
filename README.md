# 奖金请批准 · H5 原型

提交 OKR 立项书，让朋友当上级审批，用自律换一笔奖金。这是小程序上线前用来在熟人群里验证规则的 H5 版本。

纯静态网页（HTML + 原生 JS，无需构建），放在 GitHub Pages；多人数据放在 Supabase 免费版。

## 一、先在手机上看看（单机演示模式）

不配置数据库也能用：`js/config.js` 两项留空时，数据只存在当前浏览器里。顶部蓝条可以：

- **切换身份**：在同一台手机上扮演申请人和上级
- **时间 +1 天**：快进时间，几分钟走完一个考核周期

演示模式下别人打不开你的链接，多人测试请完成第三步。

## 二、发布到 GitHub Pages

1. 把整个文件夹推到 GitHub 仓库（比如 `bonus-approval`）
2. 仓库 → Settings → Pages → Source 选 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)` → Save
3. 一两分钟后访问 `https://<你的用户名>.github.io/bonus-approval/`

## 三、接上 Supabase（多人模式）

1. 在 [supabase.com](https://supabase.com) 新建项目，区域选 **Singapore** 或 **Tokyo**（国内访问较快）
2. 左侧 SQL Editor → 粘贴 `supabase/schema.sql` 全部内容 → Run
3. 左侧 Project Settings → API，复制 **Project URL** 和 **anon public key**
4. 填进 `js/config.js`：
   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```
5. 提交并推送，GitHub Pages 自动更新

anon key 本来就是给浏览器用的公开密钥，可以放进代码；**不要**把 service_role key 放进来。

## 规则（与 PRD 一致）

| 规则 | 说明 |
| --- | --- |
| 立项 | 任意一位上级同意即开始；48 小时无人审批默认通过；上级可加码，申请人接受后开始 |
| 考核开始 | 原型阶段为审批通过**当天**开始（PRD 为次日，方便快速测试） |
| 日报 | 每天最多 1 次；24 小时无人审批默认通过；多位上级按多数票，平票通过 |
| 重交 | 当天被驳回可重交 1 次，再被驳回记为未完成 |
| 完成率 | 不封顶；每周模式多打的卡计入，但有一周断档则超额不计；每天模式全勤零驳回视同 120% |
| 评级 | ≥120% 卓越·破格晋升 / ≥100% 超出预期 / ≥80% 符合预期（以上发奖金）/ ≥50% 需改进 / 其余或主动放弃为毕业 |

自动放行在每次打开页面时计算，不需要定时任务。

## 原型阶段的已知限制

- 没有微信登录，身份是浏览器里保存的名字，换手机或清缓存会变成新身份
- 数据库对匿名用户开放读写（不能删除），只适合熟人测试，正式上线前要改成鉴权策略
- 没有内容审核和逾期提醒
- 在微信里分享是普通链接，没有卡片封面

## 目录

```
index.html          入口
css/style.css       公文纸样式
js/logic.js         业务规则（纯函数，小程序可直接复用）
js/store.js         数据层：单机演示 / Supabase
js/card.js          结案通知书图片
js/app.js           页面与路由
js/config.js        Supabase 配置
supabase/schema.sql 建表脚本
tests/              规则测试：node tests/logic.test.mjs
```
