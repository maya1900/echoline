"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Captions, Gauge, Mic, Settings2, Square } from "lucide-react";
import { convertAudioBlobToWavFile } from "@/lib/audio/wav";
import type { UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const asrProviderOptions = ["openai", "zhipu"];
const asrProviderLabels: Record<string, string> = {
  openai: "OpenAI",
  zhipu: "智谱"
};
const asrDefaultModels: Record<string, string> = {
  openai: "gpt-4o-mini-transcribe",
  zhipu: "glm-asr-2512"
};
const asrKeyLabels: Record<string, string> = {
  openai: "OpenAI API Key",
  zhipu: "智谱 API Key"
};
const asrKeyPlaceholders: Record<string, string> = {
  openai: "填写 OPENAI_API_KEY",
  zhipu: "填写 ZHIPU_API_KEY 或 BIGMODEL_API_KEY"
};

export function SettingsWorkbench({ initialSettings }: { initialSettings: UserSettings }) {
  const asrTestRecorderRef = useRef<MediaRecorder | null>(null);
  const asrTestChunksRef = useRef<Blob[]>([]);
  const asrTestStreamRef = useRef<MediaStream | null>(null);
  const asrTestTimerRef = useRef<number | null>(null);
  const [settings, setSettings] = useState(initialSettings);
  const [asrApiKeyInput, setAsrApiKeyInput] = useState("");
  const [message, setMessage] = useState("");
  const [asrTestMessage, setAsrTestMessage] = useState("");
  const [asrTestTranscript, setAsrTestTranscript] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingAsr, setIsTestingAsr] = useState(false);
  const [isRecordingAsrTest, setIsRecordingAsrTest] = useState(false);
  const [notify, setNotify] = useState(false);
  const asrProviderLabel = asrProviderLabels[settings.asrProvider] ?? settings.asrProvider;
  const asrKeyLabel = asrKeyLabels[settings.asrProvider] ?? "ASR API Key";
  const asrKeyPlaceholder = asrKeyPlaceholders[settings.asrProvider] ?? "填写 ASR API Key";

  function updateAsrProvider(value: string) {
    setSettings((current) => {
      const nextProvider = value.trim() || "openai";
      const currentDefaultModel = asrDefaultModels[current.asrProvider];
      const nextDefaultModel = asrDefaultModels[nextProvider] ?? current.asrModel;
      const shouldReplaceModel = !current.asrModel.trim() || current.asrModel === currentDefaultModel;

      return {
        ...current,
        asrProvider: nextProvider,
        asrModel: shouldReplaceModel ? nextDefaultModel : current.asrModel
      };
    });
    setAsrTestMessage("");
    setAsrTestTranscript("");
  }

  useEffect(() => {
    return () => {
      clearAsrTestTimer();
      asrTestRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      asrTestRecorderRef.current = null;
      asrTestStreamRef.current?.getTracks().forEach((track) => track.stop());
      asrTestStreamRef.current = null;
    };
  }, []);

  async function saveSettings() {
    setIsSaving(true);
    setMessage("保存中");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        asrApiKey: asrApiKeyInput
      })
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: UserSettings; error?: string } | null) : null;

    if (response?.ok && payload?.data) {
      setSettings(payload.data);
      setAsrApiKeyInput("");
      setMessage("已保存");
    } else {
      setMessage(payload?.error ?? "保存失败");
    }

    setIsSaving(false);
  }

  function clearAsrTestTimer() {
    if (asrTestTimerRef.current) {
      window.clearTimeout(asrTestTimerRef.current);
      asrTestTimerRef.current = null;
    }
  }

  function getAsrTestMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/wav"];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
  }

  function stopAsrTestTracks() {
    asrTestStreamRef.current?.getTracks().forEach((track) => track.stop());
    asrTestStreamRef.current = null;
  }

  async function startAsrTestRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAsrTestMessage("当前浏览器不支持录音测试");
      return;
    }

    setAsrTestMessage("录音中，请说一句 hello 或读当前字幕");
    setAsrTestTranscript("");
    setIsRecordingAsrTest(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getAsrTestMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      asrTestChunksRef.current = [];
      asrTestStreamRef.current = stream;
      asrTestRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          asrTestChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        clearAsrTestTimer();
        stopAsrTestTracks();
        setIsRecordingAsrTest(false);
        setAsrTestMessage("录音失败，请重新试一次");
      };
      recorder.onstop = () => {
        clearAsrTestTimer();
        const audioBlob = new Blob(asrTestChunksRef.current, { type: recorder.mimeType || "audio/webm" });

        stopAsrTestTracks();
        asrTestRecorderRef.current = null;
        setIsRecordingAsrTest(false);

        if (audioBlob.size === 0) {
          setAsrTestMessage("没有录到声音，请重新试一次");
          return;
        }

        void testAsrSettings(audioBlob);
      };

      recorder.start();
      asrTestTimerRef.current = window.setTimeout(() => {
        stopAsrTestRecording();
      }, 4200);
    } catch {
      clearAsrTestTimer();
      stopAsrTestTracks();
      setIsRecordingAsrTest(false);
      setAsrTestMessage("无法使用麦克风，请检查浏览器权限");
    }
  }

  function stopAsrTestRecording() {
    const recorder = asrTestRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      clearAsrTestTimer();
      setAsrTestMessage("上传测试转写中");
      recorder.stop();
      return;
    }

    setIsRecordingAsrTest(false);
  }

  async function testAsrSettings(audioBlob: Blob) {
    setIsTestingAsr(true);
    setAsrTestMessage("正在转换录音格式");
    setAsrTestTranscript("");
    let audioFile: File;

    try {
      audioFile = await convertAudioBlobToWavFile(audioBlob, `asr-test-${Date.now()}.wav`);
    } catch (error) {
      setAsrTestMessage(error instanceof Error ? error.message : "录音格式转换失败，请换浏览器重试");
      setIsTestingAsr(false);
      return;
    }

    const formData = new FormData();

    setAsrTestMessage("正在测试真实转写");
    formData.append("asrProvider", settings.asrProvider);
    formData.append("asrModel", settings.asrModel);
    formData.append("asrApiKey", asrApiKeyInput);
    formData.append("audio", audioFile, audioFile.name);

    const response = await fetch("/api/settings/asr-test", {
      method: "POST",
      body: formData
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: { message?: string; provider?: string; transcript?: string }; error?: string } | null) : null;

    if (response?.ok) {
      const saveHint = asrApiKeyInput.trim() ? "连接成功。请点击“保存设置”，保存后才会用于跟读评分。" : "连接成功，当前使用的是已保存或环境变量里的 Key。";

      setAsrTestTranscript(payload?.data?.transcript ?? "");
      setAsrTestMessage(payload?.data?.message ? `${payload.data.message}。${saveHint}` : `${asrProviderLabel} 测试转写成功。${saveHint}`);
    } else {
      setAsrTestMessage(payload?.error ?? "ASR 测试失败");
    }

    setIsTestingAsr(false);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SettingGroup icon={Captions} title="字幕">
        <SettingToggle
          label="英文优先显示"
          active={settings.subtitleLanguage !== "chinese"}
          onClick={() => setSettings((current) => ({ ...current, subtitleLanguage: current.subtitleLanguage === "chinese" ? "both" : "chinese" }))}
        />
        <SettingToggle label="逐句结束自动暂停" active={settings.autoLoop} onClick={() => setSettings((current) => ({ ...current, autoLoop: !current.autoLoop }))} />
      </SettingGroup>

      <SettingGroup icon={Gauge} title="播放">
        <label className="block rounded-md border border-[color:var(--line)] p-4">
          <span className="mb-3 block text-sm font-semibold">默认速度 {settings.defaultPlaybackRate.toFixed(2)}x</span>
          <input
            type="range"
            min="0.5"
            max="1.25"
            step="0.05"
            value={settings.defaultPlaybackRate}
            onChange={(event) => setSettings((current) => ({ ...current, defaultPlaybackRate: Number(event.target.value) }))}
            className="w-full accent-[color:var(--green)]"
          />
        </label>
        <label className="block rounded-md border border-[color:var(--line)] p-4">
          <span className="mb-3 block text-sm font-semibold">单句循环 3 次</span>
          <input type="range" min="1" max="8" step="1" defaultValue="3" className="w-full accent-[color:var(--amber)]" />
        </label>
      </SettingGroup>

      <SettingGroup icon={Settings2} title="AI 评分">
        <SettingToggle label="启用跟读评分" active={settings.aiScoringEnabled} onClick={() => setSettings((current) => ({ ...current, aiScoringEnabled: !current.aiScoringEnabled }))} />
        <div className="rounded-md border border-[color:var(--line)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{settings.asrApiKeyConfigured ? "转写服务已接入" : "转写服务未接入"}</span>
            <span className="rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">
              {asrProviderLabel}
            </span>
          </div>
          <div className="grid gap-3">
            <ProviderField value={settings.asrProvider} options={asrProviderOptions} labels={asrProviderLabels} onChange={updateAsrProvider} />
            <TextField label="转写模型" value={settings.asrModel} onChange={(value) => setSettings((current) => ({ ...current, asrModel: value }))} />
            <SecretField label={asrKeyLabel} value={asrApiKeyInput} configured={settings.asrApiKeyConfigured} placeholder={asrKeyPlaceholder} onChange={setAsrApiKeyInput} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[color:var(--muted)]">录一小段真实人声，验证供应商是否能返回转写文本。</p>
              <button
                type="button"
                onClick={() => {
                  if (isRecordingAsrTest) {
                    stopAsrTestRecording();
                    return;
                  }

                  void startAsrTestRecording();
                }}
                disabled={isTestingAsr}
                className={cn(
                  "flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] px-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-60",
                  isRecordingAsrTest && "border-[color:var(--red)] text-[color:var(--red)]"
                )}
              >
                {isRecordingAsrTest ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                {isTestingAsr ? "测试中" : isRecordingAsrTest ? "停止并测试" : "录音测试"}
              </button>
            </div>
            {asrTestMessage ? <p className="rounded-md border border-[color:var(--line)] bg-white/60 px-3 py-2 text-sm font-semibold text-[color:var(--muted)]">{asrTestMessage}</p> : null}
            {asrTestTranscript ? (
              <div className="rounded-md border border-[color:var(--line)] bg-white/70 px-3 py-2">
                <p className="text-xs font-semibold text-[color:var(--muted)]">测试转写</p>
                <p className="mt-1 text-sm leading-6">{asrTestTranscript}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-md border border-[color:var(--line)] p-4 text-sm leading-6 text-[color:var(--muted)]">只展示转写、准确度、完整度、漏词、总分和中文短反馈。</div>
        <button onClick={saveSettings} disabled={isSaving} className="ink-action h-11 rounded-md px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-70">
          {isSaving ? "保存中" : "保存设置"}
        </button>
        {message ? <p className="text-sm font-semibold text-[color:var(--muted)]">{message}</p> : null}
      </SettingGroup>

      <SettingGroup icon={Bell} title="提醒">
        <SettingToggle label="每日复习提醒" active={notify} onClick={() => setNotify((value) => !value)} />
        <div className="rounded-md border border-[color:var(--line)] p-4 text-sm leading-6 text-[color:var(--muted)]">后续接入账户与通知渠道后启用。</div>
      </SettingGroup>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
    </label>
  );
}

function ProviderField({ value, options, labels, onChange }: { value: string; options: string[]; labels: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <div className="grid min-w-0 gap-2 text-sm font-semibold">
      <span>ASR Provider</span>
      <div className="grid grid-cols-2 gap-2 rounded-md border border-[color:var(--line)] bg-white/50 p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "h-10 rounded px-3 text-sm font-semibold transition",
              value === option ? "ink-action" : "text-[color:var(--muted)] hover:bg-white"
            )}
          >
            {labels[option] ?? option}
          </button>
        ))}
      </div>
    </div>
  );
}

function SecretField({
  label,
  value,
  configured,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  configured: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      <span className="flex flex-wrap items-center gap-2">
        {label}
        <span className="rounded border border-[color:var(--line)] px-2 py-0.5 text-xs font-semibold text-[color:var(--muted)]">
          {configured ? "已配置" : "未配置"}
        </span>
      </span>
      <input
        type="password"
        value={value}
        placeholder={configured ? "填写新 key 后保存会覆盖当前配置" : placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]"
      />
    </label>
  );
}

function SettingGroup({ icon: Icon, title, children }: { icon: typeof Captions; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-[color:var(--amber)]" aria-hidden="true" />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function SettingToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-14 items-center justify-between gap-3 rounded-md border border-[color:var(--line)] p-3 text-left text-sm">
      <span className="font-semibold">{label}</span>
      <span className={cn("relative h-7 w-12 rounded-full border border-[color:var(--line)] transition", active ? "bg-[color:var(--green)]" : "bg-white")}>
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition", active ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}
