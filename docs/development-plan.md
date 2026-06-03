# 开发计划

## 目标

交付一个 V1 学习工作台原型：先用类型化 mock 数据跑通完整学习闭环，再为 Supabase Auth、Postgres、Storage 和 AI 评分留下清晰接入点。

## 阶段一：可运行产品骨架

- 初始化 Next.js App Router、TypeScript、Tailwind CSS、lucide 图标和共享 UI 基础层。
- 创建接近登录后状态的应用框架。
- 准备剧集、集数、字幕、进度、生词和跟读尝试的 mock 数据。
- 增加与开发文档一致的 route handlers。

## 阶段二：核心页面

- `/`：学习工作台，包含继续学习、今日计划、最近剧集和学习统计。
- `/series`：剧集列表，支持搜索和筛选。
- `/learn/[episodeId]`：学习页，包含粗听、精听、逐句循环、跟读和接下一句模式。
- `/progress`：长期学习进度。
- `/vocab`：查词、生词和复习工作台。
- `/plan`：每日学习计划设置。
- `/settings`：账户、字幕、播放和 AI 评分设置。
- `/admin`：个人管理员导入和内容维护界面。
- `/login`：邮箱登录/注册入口，并预留 OAuth。

## 阶段三：学习交互

- 句子上一句/下一句、字幕显示切换、播放速度、循环次数和模式 tabs。
- 跟读与接下一句的录音状态 mock 流程。
- mock 评分结果：转写文本、准确度、完整度、漏词、总分和中文反馈。
- 字幕单词可点击查义，并支持收藏到生词本。

## 阶段四：后续后端集成

- 用 Supabase 查询替换 mock 数据，并依赖 RLS 保护用户数据。
- 从 Supabase 私有 Storage bucket 生成短期签名媒体 URL。
- 接入 Supabase Auth 和 profile 角色判断。
- 实现服务端字幕导入解析。
- 增加 AI Provider 适配器，用于转写和文本级匹配反馈。

## 当前开发范围

本轮完成阶段一到阶段三，交付一个可运行的前端原型和 mock API。Supabase 与真实 AI Provider 集成暂时保留为下一轮。

## 验证方式

- `npm run lint`
- `npm run build`
- 浏览器桌面和移动端冒烟检查
