"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

const speechStartEvent = "echoline:speech-start";
const pronunciationAudioCache = new Map<string, string | null>();

export function SpeakWordButton({
  word,
  className,
  size = "md"
}: {
  word: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTokenRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const spokenWord = word.trim();
  const label = isUnsupported ? "当前浏览器不支持单词发音" : isLoading ? `正在加载 ${spokenWord} 的发音` : `播放 ${spokenWord} 的发音`;

  useEffect(() => {
    function stopAudio() {
      const audio = audioRef.current;

      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audioRef.current = null;
      }
    }

    function handleSpeechStart(event: Event) {
      const detail = (event as CustomEvent<{ id?: string }>).detail;

      if (detail?.id !== id) {
        playTokenRef.current += 1;
        stopAudio();
        setIsSpeaking(false);
        setIsLoading(false);
      }
    }

    window.addEventListener(speechStartEvent, handleSpeechStart);
    return () => {
      window.removeEventListener(speechStartEvent, handleSpeechStart);
      stopAudio();
    };
  }, [id]);

  async function playPronunciation() {
    if (typeof window === "undefined" || !spokenWord) {
      return;
    }

    const playToken = playTokenRef.current + 1;
    playTokenRef.current = playToken;

    window.dispatchEvent(new CustomEvent(speechStartEvent, { detail: { id } }));
    stopCurrentAudio();
    window.speechSynthesis?.cancel();

    setIsUnsupported(false);
    setIsSpeaking(true);
    setIsLoading(true);

    const audioUrl = await getPronunciationAudioUrl(spokenWord);

    if (playTokenRef.current !== playToken) {
      return;
    }

    setIsLoading(false);

    if (audioUrl) {
      const audio = new Audio(audioUrl);

      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setIsSpeaking(false);
        }
      };
      audio.onerror = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          speakWithBrowserVoice();
        }
      };

      try {
        await audio.play();
        return;
      } catch {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
      }
    }

    speakWithBrowserVoice();
  }

  function stopCurrentAudio() {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }
  }

  function speakWithBrowserVoice() {
    if (typeof window === "undefined" || !spokenWord || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setIsUnsupported(true);
      setIsSpeaking(false);
      return;
    }

    const utterance = new window.SpeechSynthesisUtterance(spokenWord);
    const voice = pickEnglishVoice(window.speechSynthesis.getVoices());

    if (voice) {
      utterance.voice = voice;
    }

    utterance.lang = voice?.lang ?? "en-US";
    utterance.rate = 0.86;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsUnsupported(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={() => void playPronunciation()}
      disabled={!spokenWord || isUnsupported}
      title={label}
      aria-label={label}
      aria-busy={isLoading}
      className={cn(
        "grid shrink-0 place-items-center rounded-md border border-[color:var(--line)] bg-white/65 text-[color:var(--ink)] transition hover:border-[color:var(--ink)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45",
        isSpeaking && "border-[color:var(--green)] bg-[rgba(55,122,87,0.1)] text-[color:var(--green)]",
        isLoading && "cursor-wait animate-pulse",
        size === "sm" ? "h-9 w-9" : "h-10 w-10",
        className
      )}
    >
      <Volume2 className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5")} aria-hidden="true" />
    </button>
  );
}

async function getPronunciationAudioUrl(word: string) {
  const key = word.toLowerCase();

  if (pronunciationAudioCache.has(key)) {
    return pronunciationAudioCache.get(key) ?? null;
  }

  const params = new URLSearchParams({ word });
  const response = await fetch(`/api/pronunciation?${params.toString()}`).catch(() => null);
  const payload = response ? ((await response.json().catch(() => null)) as { data?: { audioUrl?: string | null } } | null) : null;
  const audioUrl = payload?.data?.audioUrl ?? null;

  pronunciationAudioCache.set(key, audioUrl);
  return audioUrl;
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang === "en-US" && voice.default) ??
    voices.find((voice) => voice.lang === "en-US") ??
    voices.find((voice) => voice.lang.startsWith("en-") && voice.default) ??
    voices.find((voice) => voice.lang.startsWith("en-"))
  );
}
