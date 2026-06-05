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
- 评分当前会优先用已提交文本或 OpenAI ASR 转写录音，再走 V1 文本评分 fallback；只返回转写、准确度、完整度、漏词、总分和中文短反馈，`fluency` 不写分数。

## 字幕导入

JSON 请求：

```bash
curl -X POST http://localhost:3000/api/admin/import-subtitles \
  -H "Content-Type: application/json" \
  -d '{"episodeId":"00000000-0000-4000-8000-000000000101","sourceFilename":"episode.srt","subtitleText":"1\n00:00:01,000 --> 00:00:03,000\nHello.\n你好。"}'
```

也可以用 `multipart/form-data` 上传 `file`，并同时传 `episodeId`。

## 私有媒体

`episodes.media_url` 支持四种形式：

- `https://...`：直接返回。
- `/mock/...`：本地 mock 原样返回。
- `local/path/to/video.mp4`：从服务器本地 `LOCAL_MEDIA_ROOT` 目录读取，并通过受登录保护的 `/api/media/local/...` 支持 Range 播放。
- `bucket/path/to/video.mp4`：从 Supabase Storage 生成 15 分钟签名 URL。

推荐为剧集视频创建私有 bucket：

```bash
media
```

可用环境变量覆盖：

```bash
MEDIA_BUCKET=media
```

Storage object path 不包含 bucket，例如：

```text
s01/pilot.mp4
```

数据库 `episodes.media_url` 保存完整 `bucket/path`：

```text
media/s01/pilot.mp4
```

后台 `POST /api/admin/media` 上传成功后会返回并填入这个 `bucket/path`，播放时仍由 `GET /api/episodes/:id/media-url` 生成短期签名 URL。

自有服务器 / Docker 部署时推荐先使用 `local/...`：

```bash
LOCAL_MEDIA_ROOT=/data/your-english-coach/media
```

例如数据库里保存：

```text
local/friends/s01e01.mp4
```

实际文件放在：

```text
/data/your-english-coach/media/friends/s01e01.mp4
```

## 录音上传

跟读和接下一句会把浏览器录音提交到 `POST /api/attempts/score` 的 `audio` 字段。服务端默认上传到私有 bucket `recordings`，也可以用 `RECORDINGS_BUCKET` 覆盖。`RECORDINGS_BUCKET` 只用于 `repeat_attempts.audio_url` 的跟读/接下一句录音，不用于 `episodes.media_url` 的剧集视频。

建议在 Supabase Storage 创建私有 bucket：

```bash
recordings
```

服务端优先使用 `SUPABASE_SERVICE_ROLE_KEY` 上传录音；没有 service role 时会尝试使用当前登录用户的 Supabase session，需自行配置对应 Storage policy。

## 录音转写

`POST /api/attempts/score` 上传录音后，会读取当前登录用户在 `/settings` 的 AI 评分配置，并尝试用 ASR Provider 生成 `transcript`。目前支持 OpenAI 和智谱：

```bash
ASR_PROVIDER=openai
OPENAI_API_KEY=sk-...
ASR_MODEL=gpt-4o-mini-transcribe
```

或：

```bash
ASR_PROVIDER=zhipu
ZHIPU_API_KEY=...
ASR_MODEL=glm-asr-2512
```

也可以不写环境变量，直接在设置页填写当前用户自己的 ASR API Key。未配置 API Key 或未拿到真实转写时，接口会返回不可评分结果，不会把目标句当作转写文本计入完成。

设置页提供“录音测试”，会调用 `POST /api/settings/asr-test` 上传一段浏览器录制的人声音频，用来验证当前 Provider、Key 和模型是否能返回真实 `transcript`。

现有 Supabase 项目如果是在 ASR 设置前创建的，需要在 SQL Editor 执行 `supabase/patch-asr-settings.sql`。常见报错是：

```text
Could not find the 'asr_api_key' column of 'profiles' in the schema cache
```

补丁核心内容：

```sql
alter table public.profiles
  add column if not exists subtitle_language text not null default 'both',
  add column if not exists default_playback_rate numeric(3,2) not null default 1.00,
  add column if not exists auto_loop boolean not null default true,
  add column if not exists ai_scoring_enabled boolean not null default true,
  add column if not exists asr_provider text not null default 'openai',
  add column if not exists asr_model text not null default 'gpt-4o-mini-transcribe',
  add column if not exists asr_api_key text;
```

## 查词配置

AI 查词的 Provider、模型和 API Key 以 `/admin` 后台保存到 `site_settings` 的配置为准，不读取 `DICTIONARY_AI_PROVIDER`、`DICTIONARY_AI_MODEL` 或 `DICTIONARY_AI_API_KEY` 环境变量。

本地词典未命中时，只有后台开启“启用 AI 中文释义”且“查词 API Key”已保存，才会调用 AI 兜底。`DICTIONARY_AI_BASE_URL` 只作为开发调试时的底层 endpoint 覆盖，不负责选择查词供应商、模型或密钥。

## Linux.do OAuth/OIDC

项目登录页使用 Supabase Custom OIDC Provider 接入 Linux.do，Provider identifier 约定为：

```text
custom:linuxdo
```

Linux.do 创建 OAuth2/OIDC 应用时填写：

```text
应用名：your-english-coach
应用主页：http://localhost:3000
应用描述：看剧学英语
回调地址：https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
应用图标：可留空，或填写公开可访问的 logo URL
```

如果部署到正式域名，应用主页改为正式站点 URL；回调地址仍使用 Supabase Auth callback。Supabase Auth 会在回调后再跳回本项目 `/auth/callback`。

Linux.do 返回后，在 Supabase Dashboard 的 Authentication Provider 中新增 Custom OIDC Provider：

```text
Name：Linux.do
Identifier：linuxdo
Client ID：Linux.do 返回的 Client ID
Client Secret：Linux.do 返回的 Client Secret
Issuer URL：https://connect.linux.do/
Authorization endpoint：https://connect.linux.do/oauth2/authorize
Token endpoint：https://connect.linux.do/oauth2/token
Userinfo endpoint：https://connect.linux.do/api/user
Scopes：openid, profile, email
```

同时在 Supabase Auth 的 Redirect URLs 里加入：

```text
http://localhost:3000/auth/callback
http://localhost:3000/**
https://<YOUR_DOMAIN>/auth/callback
https://<YOUR_DOMAIN>/**
```

如果 Dashboard 需要 Discovery URL，填写：

```text
https://connect.linux.do/.well-known/openid-configuration
```

项目侧不保存 Client Secret。登录成功后，Supabase 会创建/返回当前用户 session，`/auth/callback` 会调用 `bootstrapUserProfile` 写入 `profiles` 和默认 `study_plans`。当前项目只依赖 Supabase `user.id`、`user.email` 和 `user.user_metadata.display_name`。

## 下一步

- 管理页补媒体文件上传流程。
- 增加端到端冒烟检查。
