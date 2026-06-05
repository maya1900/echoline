# 自有服务器 Docker 部署

V1 推荐部署形态：

- Next.js 应用：本仓库 `Dockerfile`，以 standalone 方式运行。
- 数据与鉴权：自托管 Supabase，也就是 Postgres + Auth + PostgREST + RLS。
- 视频资源：服务器本地目录，数据库保存 `local/...` 路径。
- Redis：随应用栈部署，先作为后续缓存/队列能力预留。
- 入口代理：Caddy，自动 HTTPS，并可把 `/supabase/*` 代理到自托管 Supabase Kong。

## 为什么不是 MySQL

当前代码已经使用 Supabase Auth、RLS、Storage client 和 `auth.uid()` 策略。最后部署阶段直接换成 MySQL 会牵动登录、权限、查询、后台管理和媒体签名逻辑。自托管 Supabase/Postgres 能把数据库放回自己的服务器，同时保留现有 API 和 RLS 模型，风险最小。

## 服务器目录

```bash
sudo mkdir -p /opt/echoline
sudo mkdir -p /data/echoline/media
sudo chown -R "$USER":"$USER" /opt/echoline
sudo chown -R 1001:1001 /data/echoline/media
```

`1001:1001` 对应应用容器里的 `nextjs` 用户，保证后台上传视频时可以写入媒体目录。

## 自托管 Supabase

在同一台服务器上部署官方 Supabase Docker stack，并让 Kong 监听在宿主机 `8000` 端口。Supabase 侧关键配置建议：

```bash
API_EXTERNAL_URL=https://echoline.example.com/supabase
SITE_URL=https://echoline.example.com
```

登录回调需要加入：

```text
https://echoline.example.com/auth/callback
https://echoline.example.com/**
```

Supabase 启动后，在 Studio SQL Editor 依次执行：

```text
supabase/schema.sql
supabase/seed.sql
```

如是已有库，再按需执行补丁：

```text
supabase/patch-asr-settings.sql
supabase/patch-echoline-brand.sql
supabase/patch-profile-role-lockdown.sql
```

## 应用环境变量

复制生产样例并填写真实值：

```bash
cp .env.production.example .env.production
```

最小必填项：

```bash
ECHOLINE_DOMAIN=echoline.example.com
ECHOLINE_MEDIA_ROOT=/data/echoline/media
SUPABASE_KONG_URL=http://host.docker.internal:8000

NEXT_PUBLIC_SUPABASE_URL=https://echoline.example.com/supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

MEDIA_STORAGE=local
LOCAL_MEDIA_ROOT=/data/echoline/media
REDIS_URL=redis://redis:6379/0
```

`MEDIA_STORAGE=local` 会让后台视频上传直接写入 `LOCAL_MEDIA_ROOT`，返回并保存 `local/s01/xxx.mp4`。播放时前端仍先请求 `/api/episodes/:id/media-url`，再走受登录保护的 `/api/media/local/...`，支持 Range 拖动播放。

## 启动应用

```bash
docker compose --env-file .env.production -f deploy/compose.yml up -d --build
docker compose --env-file .env.production -f deploy/compose.yml ps
```

查看日志：

```bash
docker compose --env-file .env.production -f deploy/compose.yml logs -f web
docker compose --env-file .env.production -f deploy/compose.yml logs -f caddy
```

更新部署：

```bash
git pull
docker compose --env-file .env.production -f deploy/compose.yml up -d --build
```

## 部署后检查

1. 打开 `https://echoline.example.com`，确认能进入登录页。
2. 登录后进入 `/admin`，上传一个小视频，确认集数表单得到 `local/...`。
3. 确认服务器上出现对应文件：

```bash
find /data/echoline/media -type f | head
```

4. 发布剧集后进入学习页，拖动播放器确认 Range 播放正常。
5. 跑一次字幕导入、学习进度保存和跟读评分，确认 Supabase RLS 与服务端写入正常。
