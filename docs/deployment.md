# 自有服务器 Docker 部署

V1 推荐部署形态：

- Next.js 应用：本仓库 `Dockerfile`，以 standalone 方式运行。
- 数据库：同栈 PostgreSQL 16，数据库不暴露公网。
- 鉴权：Auth.js，支持邮箱密码和 Linux.do OAuth。
- ORM 与迁移：Drizzle ORM + `drizzle-kit` migrations。
- 视频与录音：服务器本地私有目录，数据库保存 `local/...` 路径。
- Redis：随应用栈部署，先作为后续缓存/队列能力预留。
- 入口代理：Nginx，默认通过 `WEB_PORT=3789` 反代 Next.js 应用。

## 服务器目录

```bash
sudo mkdir -p /opt/echoline
sudo mkdir -p /data/echoline/media
sudo chown -R "$USER":"$USER" /opt/echoline
sudo chown -R 1001:1001 /data/echoline/media
```

`1001:1001` 对应应用容器里的 `nextjs` 用户，保证后台上传视频和保存录音时可以写入媒体目录。

## 应用环境变量

复制生产样例并填写真实值：

```bash
cp .env.production.example .env.production
```

最小必填项：

```bash
NGINX_SERVER_NAME=echoline.example.com
ECHOLINE_MEDIA_ROOT=/data/echoline/media
WEB_PORT=3789

POSTGRES_DB=echoline
POSTGRES_USER=echoline
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgres://echoline:change-me@postgres:5432/echoline

NEXTAUTH_URL=http://echoline.example.com:3789
NEXTAUTH_SECRET=change-to-a-long-random-secret

LINUXDO_CLIENT_ID=...
LINUXDO_CLIENT_SECRET=...

LOCAL_MEDIA_ROOT=/data/echoline/media
REDIS_URL=redis://redis:6379/0
```

Linux.do OAuth 应用回调地址：

```text
http://echoline.example.com:3789/api/auth/callback/linuxdo
```

本地开发回调地址：

```text
http://localhost:3789/api/auth/callback/linuxdo
```

## 数据库迁移

首次部署或 schema 更新后，在服务器仓库目录执行：

```bash
npm ci
DATABASE_URL=postgres://echoline:change-me@localhost:5432/echoline npm run db:migrate
```

如果只通过 Compose 内网访问数据库，可以临时进入同网络执行迁移，或在本机把 `DATABASE_URL` 指向可访问的 Postgres 地址。

## 启动应用

```bash
docker compose --env-file .env.production -f deploy/compose.yml up -d --build
docker compose --env-file .env.production -f deploy/compose.yml ps
```

查看日志：

```bash
docker compose --env-file .env.production -f deploy/compose.yml logs -f web
docker compose --env-file .env.production -f deploy/compose.yml logs -f postgres
docker compose --env-file .env.production -f deploy/compose.yml logs -f nginx
```

更新部署：

```bash
git pull
npm ci
DATABASE_URL=postgres://echoline:change-me@localhost:5432/echoline npm run db:migrate
docker compose --env-file .env.production -f deploy/compose.yml up -d --build
```

## 部署后检查

1. 打开 `http://echoline.example.com:3789`，确认能进入登录页。
2. 用 Linux.do 登录，确认返回工作台。
3. 首位邮箱注册用户会自动成为 admin；也可以在数据库里手动把 `profiles.role` 改为 `admin`。
4. 进入 `/admin`，上传一个小视频，确认集数表单得到 `local/...`。
5. 确认服务器上出现对应文件：

```bash
find /data/echoline/media -type f | head
```

6. 发布剧集后进入学习页，拖动播放器确认 Range 播放正常。
7. 跑一次字幕导入、学习进度保存和跟读评分，确认服务端鉴权与数据库写入正常。
