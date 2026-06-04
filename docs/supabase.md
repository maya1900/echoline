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
- Supabase Auth 已接入邮箱登录/注册、callback、logout，并在登录后初始化 `profiles` 与 `study_plans`。
- `study-plan`、`vocab`、`attempts/score` 和管理员接口已尝试写真实表，失败时保留 mock 响应。
- `POST /api/admin/import-subtitles` 已支持 SRT/VTT 解析并写入 `subtitle_lines`。
- `GET /api/episodes/:id/media-url` 已支持 Supabase Storage 私有文件签名 URL。
- `POST /api/attempts/score` 已支持 JSON 文本评分和 `multipart/form-data` 录音上传，录音路径写入 `repeat_attempts.audio_url`。
- 评分当前仍是 V1 文本 fallback：只返回转写、准确度、完整度、漏词、总分和中文短反馈，`fluency` 不写分数；真实 ASR 接入后替换转写来源。

## 字幕导入

JSON 请求：

```bash
curl -X POST http://localhost:3000/api/admin/import-subtitles \
  -H "Content-Type: application/json" \
  -d '{"episodeId":"00000000-0000-4000-8000-000000000101","sourceFilename":"episode.srt","subtitleText":"1\n00:00:01,000 --> 00:00:03,000\nHello.\n你好。"}'
```

也可以用 `multipart/form-data` 上传 `file`，并同时传 `episodeId`。

## 私有媒体

`episodes.media_url` 支持三种形式：

- `https://...`：直接返回。
- `/mock/...`：本地 mock 原样返回。
- `bucket/path/to/video.mp4`：从 Supabase Storage 生成 15 分钟签名 URL。

## 录音上传

跟读和接下一句会把浏览器录音提交到 `POST /api/attempts/score` 的 `audio` 字段。服务端默认上传到私有 bucket `recordings`，也可以用 `RECORDINGS_BUCKET` 覆盖。

建议在 Supabase Storage 创建私有 bucket：

```bash
recordings
```

服务端优先使用 `SUPABASE_SERVICE_ROLE_KEY` 上传录音；没有 service role 时会尝试使用当前登录用户的 Supabase session，需自行配置对应 Storage policy。

## 下一步

- 接入真实 ASR Provider 转写录音。
- 管理页补媒体文件上传流程。
- 增加端到端冒烟检查。
