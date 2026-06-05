# Agent 规范

## 项目定位

`追句 EchoLine` 是一个面向中文母语用户的个人自用“逐句看剧学英语”工作台。V1 优先交付完整学习闭环，不包含支付、会员、社区、公开排行榜或复杂运营后台。

## 信息源优先级

- 产品与验收要求：`docs/development.md`
- 开发计划：`docs/development-plan.md`
- UI 方向与组件规则：`docs/ui.md`
- 数据模型与 RLS 基线：`supabase/schema.sql`

## 工作规则

- 遵循 Next.js App Router、TypeScript、Tailwind CSS、shadcn/ui 风格组件和 lucide 图标方向。
- 第一屏必须是学习工作台，不做营销首页。
- 后端未接入前，用类型化 mock 数据跑通真实流程。
- V1 不展示发音分或流利度分。可展示的评分只有转写文本、准确度、完整度、漏词、总分和中文短反馈。
- 媒体内容按个人私有学习资料处理，不增加公开分发流程。
- UI 文案保持简洁、操作导向，避免大段功能说明。
- 桌面端和移动端都要适合反复学习：字幕清晰、控件易点、工具栏稳定、文本不重叠。

## 开发习惯

- 优先小而聚焦的改动，不做无关重构。
- Supabase 集成完成前，使用类型化 mock 数据和本地 route handlers。
- API route 契约尽量贴近 `docs/development.md`。
- 只在行为不够直观的位置添加少量注释。
- 完成 UI 改动前，尽量运行 lint/build，并在可行时用浏览器做桌面和移动端冒烟检查。
