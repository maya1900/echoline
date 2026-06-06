# 鉴权与数据库

EchoLine 现在使用完全自有部署机制，不再依赖 Supabase。

## 组成

- Auth.js：管理邮箱密码登录、Linux.do OAuth 和 session。
- Drizzle ORM：管理应用查询和 schema migration。
- PostgreSQL：保存用户、剧集、字幕、学习进度、生词、跟读尝试和站点设置。
- 本地媒体目录：保存视频和录音，路径以 `local/...` 写入数据库。

## Linux.do OAuth

Linux.do Provider 配置：

```text
Authorization endpoint: https://connect.linux.do/oauth2/authorize
Token endpoint: https://connect.linux.do/oauth2/token
Userinfo endpoint: https://connect.linux.do/api/user
Scopes: openid profile email
```

环境变量：

```bash
LINUXDO_CLIENT_ID=...
LINUXDO_CLIENT_SECRET=...
NEXTAUTH_URL=http://localhost:3789
NEXTAUTH_SECRET=replace-with-a-long-random-secret
```

回调地址：

```text
http://localhost:3789/api/auth/callback/linuxdo
https://<YOUR_DOMAIN>/api/auth/callback/linuxdo
```

身份绑定使用 Auth.js `accounts.provider + accounts.provider_account_id`，不要只依赖邮箱。

## 邮箱密码

邮箱密码账号保存在 `users.password_hash`，密码使用 `bcryptjs` 哈希。

- `POST /api/auth/register`：注册本地账号。
- `CredentialsProvider`：处理邮箱密码登录。
- 数据库首位注册用户自动成为 `admin`。

## 权限模型

数据库不暴露公网，浏览器不能直连数据库。所有请求都走 Next.js route handlers。

服务端统一使用：

- `requireUserRequest()`：要求登录。
- `requireAdminRequest()`：要求 `profiles.role = 'admin'`。
- 用户私有数据查询必须带 `userId = currentUser.id`。

V1 不使用 RLS。权限边界由应用层 route handlers 负责。

## 迁移

schema 定义在：

```text
lib/db/schema.ts
```

迁移文件在：

```text
drizzle/
```

常用命令：

```bash
npm run db:generate
npm run db:migrate
npm run db:push
```

生产环境优先使用 `db:migrate`，不要直接 `db:push`。
