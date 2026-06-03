# Supabase 接入说明

## 本地配置

1. 在 Supabase SQL Editor 依次执行：
   - `supabase/schema.sql`
   - `supabase/seed.sql`
2. 复制 `.env.example` 为 `.env.local`，填入项目的 anon 配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 当前接入状态

- 已新增 App Router 可用的 Supabase server client。
- 页面与 GET API 会优先读取 Supabase；未配置环境变量或查询失败时回退到类型化 mock 数据。
- `study-plan`、`vocab`、`attempts/score` 和管理员接口已尝试写真实表，失败时保留 mock 响应。
- 评分仍是 V1 mock：只返回转写、准确度、完整度、漏词、总分和中文短反馈，`fluency` 不写分数。

## 下一步

- 接入 Supabase Auth 登录注册。
- 登录后用真实用户初始化 `profiles`、`study_plans` 和个人 `vocab_items`。
- 用私有 Storage bucket 的签名 URL 替换 `episodes.media_url`。
