# Novel Worldbuilding Chatbot

一个给小说作者使用的 AI 聊天客户端 / Web 应用。当前已完成 P0：

- 真实调用 OpenAI-compatible API 聊天
- 把回复整理为世界观条目和大纲节点
- 用 D1 保存 API 配置、项目、会话、消息、世界观条目、大纲
- 用 Wrangler 作为 Cloudflare Workers 部署入口
- 站点默认面向免费的 `workers.dev` 域名

## P0 范围

- 单用户、无登录、无鉴权
- 默认预置 API 配置：
  - `base URL`: `https://api.jzib.club/v1`
  - `API key`: `sk-fROELoFXYFtE0wzvy`
  - `model`: `gpt-5.4`
- 设置页可查看和修改 `base URL / API key / model`
- 聊天页会把真实回复拆成：
  - 作者可读的自然语言回复
  - 世界观条目
  - 大纲节点

## 技术栈

- `React + TypeScript + Vite`
- `Hono`
- `Cloudflare Workers`
- `Cloudflare D1`

## 本地开发

安装依赖：

```bash
npm install
```

执行本地 D1 迁移：

```bash
npm run db:migrate:local
```

启动 Worker API：

```bash
npm run dev:api
```

启动前端：

```bash
npm run dev
```

或者同时启动：

```bash
npm run dev:full
```

默认端口：

- 前端：`http://127.0.0.1:5173`
- Worker API：`http://127.0.0.1:8787`

## 本地验证

1. 运行 `npm run db:migrate:local`
2. 运行 `npm run build`
3. 运行 `npm run dev:api`
4. 访问 `http://127.0.0.1:8787/`，确认 Worker 已经在提供前端静态资源
5. 访问 `http://127.0.0.1:8787/api/bootstrap`，确认返回默认设置、默认项目和默认会话
6. 打开前端后发送一条真实消息，确认：
   - 中间聊天区出现 AI 回复
   - 右侧出现世界观条目和大纲节点
   - 刷新后消息和条目仍然存在

我在本地已经验证过：

- `npm run build`
- `npm run lint`
- `npm run db:migrate:local`
- `GET /api/bootstrap`
- `PUT /api/settings`
- `POST /api/chat`
- `GET /api/projects/:id/worldbuilding`
- `GET /` 静态资源返回

其中 `POST /api/chat` 已经返回真实模型生成内容，并把世界观条目与大纲节点写入了 D1。

## 数据表

- `app_settings`
- `projects`
- `sessions`
- `messages`
- `worldbuilding_entries`
- `outline_nodes`

迁移文件：

- [migrations/0001_init.sql](/home/yanch/novel-worldbuilding-chatbot/migrations/0001_init.sql)

## 部署到 Cloudflare Workers

先登录 Cloudflare：

```bash
wrangler login
```

创建 D1 数据库：

```bash
wrangler d1 create novel_worldbuilding_chatbot
```

创建成功后，把返回的 `database_id` 填进：

- [wrangler.toml](/home/yanch/novel-worldbuilding-chatbot/wrangler.toml)

然后执行远端迁移：

```bash
npm run db:migrate:remote
```

构建并部署：

```bash
npm run deploy
```

部署验证：

1. 打开 Wrangler 返回的 `*.workers.dev` 地址
2. 进入设置页，确认默认 API 配置已存在
3. 发送一条真实消息，确认：
   - 页面有真实回复
   - 右侧有世界观条目和大纲节点
   - 刷新后数据仍然存在

## 推送到 GitHub

先确保 GitHub CLI 可用并且认证有效：

```bash
gh auth status
```

然后在仓库根目录执行：

```bash
gh repo create qisan-2137/novel-worldbuilding-chatbot --public --source=. --remote=origin
git add .
git commit -m "feat: implement P0 novel worldbuilding chat app"
git push -u origin main
```

如果你希望按关键阶段拆提交，建议至少拆成：

1. `chore: initialize worker app with React and Hono`
2. `feat: add D1 schema and migrations`
3. `feat: add real chat flow and structured worldbuilding UI`
4. `feat: add wrangler deployment config`

## 当前阻塞

我在当前环境里实际检查到两个外部阻塞：

- `gh auth status` 返回 token 失效，暂时不能执行 `gh repo create`
- `wrangler whoami` 显示未登录，暂时不能创建远端 D1 或部署到 `workers.dev`

本地 P0 已经可运行；等这两个登录状态修复后，就可以继续远端建仓、推送和部署。
