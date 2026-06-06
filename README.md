# 追句 EchoLine

追句 EchoLine 是一个面向中文母语用户的个人自用逐句看剧学英语工作台。V1 重点是跑通学习闭环：登录后继续学习剧集，按字幕逐句粗听、精听、循环、跟读评分，并沉淀学习进度和生词复习。

## 功能范围

- 第一屏直接进入学习工作台，不做营销首页。
- 支持剧集、集数、字幕行、学习进度和生词本流程。
- 支持本地媒体目录播放，数据库保存 `local/...` 路径。
- 支持 Auth.js 邮箱密码登录、Linux.do OAuth、自托管 PostgreSQL 和 Drizzle 迁移。
- 跟读评分只展示转写文本、准确度、完整度、漏词、总分和中文短反馈。

V1 不包含支付、会员、社区、公开排行榜或复杂运营后台。

## 技术栈

<p>
  <img alt="Next.js App Router" src="https://img.shields.io/badge/Next.js_App_Router-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-23272f?style=flat-square&logo=react&logoColor=61dafb" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-0f172a?style=flat-square&logo=tailwindcss&logoColor=38bdf8" />
  <img alt="shadcn/ui" src="https://img.shields.io/badge/shadcn%2Fui-111827?style=flat-square&logo=shadcnui&logoColor=white" />
  <img alt="lucide-react" src="https://img.shields.io/badge/lucide--react-f56565?style=flat-square&logo=lucide&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-1f2937?style=flat-square&logo=postgresql&logoColor=60a5fa" />
  <img alt="Docker Compose" src="https://img.shields.io/badge/Docker_Compose-1d63ed?style=flat-square&logo=docker&logoColor=white" />
</p>

Next.js App Router + TypeScript + Tailwind CSS，配合 shadcn/ui 风格组件、lucide-react 图标、Auth.js、Drizzle ORM、PostgreSQL 和 Docker Compose 自托管部署。

## 本地开发

安装依赖：

```bash
npm install
```

准备环境变量：

```bash
cp .env.example .env.local
```

启动开发服务器：

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

## 常用命令

```bash
npm run typecheck
npm run lint
npm run build
npm run db:migrate
```

## 媒体目录

自托管部署推荐使用本地媒体目录：

```bash
LOCAL_MEDIA_ROOT=/data/echoline/media
```

数据库中的集数媒体路径保存为：

```text
local/s01/example.mp4
```

播放时应用会通过受登录保护的 `/api/media/local/...` 接口读取文件，并支持 Range 拖动播放。

## 文档

- 产品与验收要求：[docs/development.md](docs/development.md)
- 开发计划：[docs/development-plan.md](docs/development-plan.md)
- UI 方向：[docs/ui.md](docs/ui.md)
- 鉴权与数据库：[docs/auth-and-database.md](docs/auth-and-database.md)
- 部署说明：[docs/deployment.md](docs/deployment.md)

## 许可证

本项目使用 Apache License 2.0，详见 [LICENSE](LICENSE)。
