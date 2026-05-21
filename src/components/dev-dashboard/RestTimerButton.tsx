"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Phase = "idle" | "running" | "done";
type AlarmProfile = "iconic" | "pulse" | "chime";
type AlarmVolume = "mid" | "high" | "max";
const DEFAULT_SECONDS = 150;
const STEP_SECONDS = 30;
const MIN_SECONDS = 30;
const MAX_SECONDS = 600;
const DONE_ACK_MS = 6500;
const ALARM_WAV_PEAK = 0.95;
const ALARM_TONE_PEAK_GAIN = 0.75;
const ALARM_PROFILE_OPTIONS: Array<{ value: AlarmProfile; label: string }> = [
  { value: "iconic", label: "Iconic" },
  { value: "pulse", label: "Pulse" },
  { value: "chime", label: "Chime" },
];
const ALARM_VOLUME_OPTIONS: Array<{ value: AlarmVolume; label: string }> = [
  { value: "mid", label: "Mid" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
];

const getAlarmVolumeScalar = (volume: AlarmVolume): number => {
  if (volume === "mid") return 0.65;
  if (volume === "high") return 0.85;
  return 1;
};

const getAlarmToneConfig = (profile: AlarmProfile) => {
  if (profile === "pulse") {
    return {
      oscA: "square" as const,
      oscB: "triangle" as const,
      frequencyPattern: [988, 1174, 1318, 1046, 1396],
      harmonicRatio: 1.5,
      beepOffsets: [0, 0.18, 0.36, 0.54, 0.72],
      beepDuration: 0.2,
    };
  }

  if (profile === "chime") {
    return {
      oscA: "triangle" as const,
      oscB: "sine" as const,
      frequencyPattern: [784, 1174, 1568],
      harmonicRatio: 2,
      beepOffsets: [0, 0.32, 0.72],
      beepDuration: 0.24,
    };
  }

  return {
    oscA: "triangle" as const,
    oscB: "triangle" as const,
    frequencyPattern: [1046, 1318, 1568],
    harmonicRatio: 1.75,
    beepOffsets: [0, 0.24, 0.52],
    beepDuration: 0.22,
  };
};

type PersistedTimerState = {
  phase: Phase;
  configuredSeconds: number;
  endTime: number | null;
  doneAt: number | null;
};

function createAlarmAudioUrl(profile: AlarmProfile, volume: AlarmVolume): string | null {
  if (typeof window === "undefined") return null;

  const sampleRate = 44100;
  const tone = getAlarmToneConfig(profile);
  const volumeScalar = getAlarmVolumeScalar(volume);
  const durationSeconds = tone.beepOffsets[tone.beepOffsets.length - 1] + tone.beepDuration + 0.08;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const byteCount = 44 + sampleCount * 2;
  const buffer = new ArrayBuffer(byteCount);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    let sample = 0;

    for (const [toneIndex, offset] of tone.beepOffsets.entries()) {
      const local = time - offset;
      if (local < 0 || local > tone.beepDuration) continue;

      const phraseEnv = Math.max(0, 1 - local / tone.beepDuration);
      const snapEnv = Math.exp(-5.5 * local);
      const env = phraseEnv * snapEnv;
      const freq = tone.frequencyPattern[toneIndex % tone.frequencyPattern.length];
      const harmonicFreq = freq * tone.harmonicRatio;

      sample +=
        Math.sin(2 * Math.PI * freq * local) * 0.7 * env +
        Math.sin(2 * Math.PI * harmonicFreq * local) * 0.25 * env +
        Math.sign(Math.sin(2 * Math.PI * freq * local)) * 0.08 * env;
    }

    sample *= 1.25 * volumeScalar;
    const clamped = Math.max(-ALARM_WAV_PEAK, Math.min(ALARM_WAV_PEAK, sample));
    view.setInt16(44 + index * 2, clamped * 0x7fff, true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function postToSW(message: object): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage(message);
    })
    .catch(() => {});
}

export function RestTimerButton({ clientId }: { clientId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configuredSeconds, setConfiguredSeconds] = useState(DEFAULT_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showTestAlarm, setShowTestAlarm] = useState(process.env.NODE_ENV !== "production");
  const [alarmProfile, setAlarmProfile] = useState<AlarmProfile>("chime");
  const [alarmVolume, setAlarmVolume] = useState<AlarmVolume>("max");
  const storageKey = `sbdoh:rest-timer:${clientId}`;

  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alarmAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const alarmAudioUrlRef = useRef<string | null>(null);
  const alarmAudioSettingsSignatureRef = useRef<string | null>(null);
  const alarmActiveRef = useRef(false);

  const persistState = (state: PersistedTimerState) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore storage failures
    }
  };

  const clearPersistedState = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures
    }
  };

  // Register SW once on mount
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Allow enabling test alarm in preview/prod builds via URL flag: ?alarmTest=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("alarmTest") === "1") {
      setShowTestAlarm(true);
    }

    const profile = params.get("alarmProfile");
    if (profile === "iconic" || profile === "pulse" || profile === "chime") {
      setAlarmProfile(profile);
    }

    const volume = params.get("alarmVolume");
    if (volume === "mid" || volume === "high" || volume === "max") {
      setAlarmVolume(volume);
    }
  }, []);

  const clearCountdown = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const clearTimeouts = () => {
    if (doneResetTimeoutRef.current !== null) {
      clearTimeout(doneResetTimeoutRef.current);
      doneResetTimeoutRef.current = null;
    }
    if (vibrationStopTimeoutRef.current !== null) {
      clearTimeout(vibrationStopTimeoutRef.current);
      vibrationStopTimeoutRef.current = null;
    }
    if (alarmRetryIntervalRef.current !== null) {
      clearInterval(alarmRetryIntervalRef.current);
      alarmRetryIntervalRef.current = null;
    }
  };

  const getAudioContext = async (): Promise<AudioContext | null> => {
    if (typeof window === "undefined") return null;

    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      return ctx;
    } catch {
      return null;
    }
  };

  const ensureAlarmAudioElement = async (): Promise<HTMLAudioElement | null> => {
    if (typeof window === "undefined") return null;

    const signature = `${alarmProfile}:${alarmVolume}`;
    if (alarmAudioSettingsSignatureRef.current !== signature) {
      if (alarmAudioElementRef.current) {
        alarmAudioElementRef.current.pause();
        alarmAudioElementRef.current = null;
      }
      if (alarmAudioUrlRef.current) {
        URL.revokeObjectURL(alarmAudioUrlRef.current);
        alarmAudioUrlRef.current = null;
      }
      alarmAudioSettingsSignatureRef.current = signature;
    }

    if (!alarmAudioElementRef.current) {
      const url = createAlarmAudioUrl(alarmProfile, alarmVolume);
      if (!url) return null;

      const audio = new Audio(url);
      audio.preload = "auto";
      audio.loop = false;
      audio.setAttribute("playsinline", "true");
      alarmAudioElementRef.current = audio;
      alarmAudioUrlRef.current = url;
    }

    return alarmAudioElementRef.current;
  };

  const primeAlarmAudioElement = async () => {
    const audio = await ensureAlarmAudioElement();
    if (!audio) return;

    try {
      audio.muted = true;
      audio.volume = 0;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1;
    } catch {
      audio.muted = false;
      audio.volume = 1;
    }
  };

  const playAlarmAudioElement = async () => {
    const audio = await ensureAlarmAudioElement();
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = getAlarmVolumeScalar(alarmVolume);
      await audio.play();
    } catch {
      // Safari may still reject playback depending on tab/background state.
    }
  };

  const playAlarmTone = async () => {
    const ctx = await getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const tone = getAlarmToneConfig(alarmProfile);
      const volumeScalar = getAlarmVolumeScalar(alarmVolume);

      for (const [index, offset] of tone.beepOffsets.entries()) {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const freq = tone.frequencyPattern[index % tone.frequencyPattern.length];
        osc.type = index % 2 === 0 ? tone.oscA : tone.oscB;
        osc.frequency.value = freq;
        osc2.type = "triangle";
        osc2.frequency.value = freq * tone.harmonicRatio;

        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(
          Math.min(0.95, ALARM_TONE_PEAK_GAIN * volumeScalar),
          now + offset + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + tone.beepDuration);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc2.start(now + offset);
        osc.stop(now + offset + tone.beepDuration + 0.02);
        osc2.stop(now + offset + tone.beepDuration + 0.02);
      }
    } catch {
      // If playback fails, silent fallback to notification/vibration paths.
    }
  };

  const triggerVibrationBurst = () => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

    try {
      navigator.vibrate([350, 120, 350, 120, 500]);
      const vibrationInterval = setInterval(() => {
        if (!alarmActiveRef.current) return;
        navigator.vibrate(300);
      }, 900);

      vibrationStopTimeoutRef.current = setTimeout(() => {
        clearInterval(vibrationInterval);
        navigator.vibrate(0);
      }, 6500);
    } catch {
      // Some platforms expose vibrate but no-op due to browser/device policy.
    }
  };

  const stopAlarmEffects = () => {
    alarmActiveRef.current = false;
    clearTimeouts();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
    if (alarmAudioElementRef.current) {
      alarmAudioElementRef.current.pause();
      alarmAudioElementRef.current.currentTime = 0;
    }
  };

  const handleAlarm = () => {
    clearCountdown();
    stopAlarmEffects();
    endTimeRef.current = null;
    setSecondsLeft(0);
    setPhase("done");
    alarmActiveRef.current = true;
    persistState({
      phase: "done",
      configuredSeconds,
      endTime: null,
      doneAt: Date.now(),
    });

    triggerVibrationBurst();

    // Play alarm exactly 3 times (matches Android beep behavior) with 600ms delay between beeps.
    // This prevents endless looping if screen closes on iPhone.
    let beepCount = 0;
    void playAlarmTone();
    void playAlarmAudioElement();
    beepCount += 1;

    alarmRetryIntervalRef.current = setInterval(() => {
      if (!alarmActiveRef.current || beepCount >= 3) {
        if (alarmRetryIntervalRef.current !== null) {
          clearInterval(alarmRetryIntervalRef.current);
          alarmRetryIntervalRef.current = null;
        }
        return;
      }
      void playAlarmTone();
      void playAlarmAudioElement();
      beepCount += 1;
    }, 600);

    // Foreground notification (fires even if SW notification already fired)
    if (typeof window !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("Rest timer done! 💪", {
          body: "Time to get back to work.",
          icon: "/favicon.ico",
          tag: "rest-timer",
        });
      } catch {
        // Notifications may be blocked in some contexts
      }
    }

    // Auto-reset after a short acknowledgement window
    doneResetTimeoutRef.current = setTimeout(() => {
      stopAlarmEffects();
      setPhase((p) => (p === "done" ? "idle" : p));
      doneResetTimeoutRef.current = null;
      clearPersistedState();
    }, DONE_ACK_MS);
  };

  const startCountdownTicker = () => {
    clearCountdown();
    intervalRef.current = setInterval(() => {
      if (endTimeRef.current === null) return;
      const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        handleAlarm();
      } else {
        setSecondsLeft(remaining);
      }
    }, 500);
  };

  const startTimer = async () => {
    const granted = await requestNotificationPermission();
    const delayMs = configuredSeconds * 1000;
    const endTime = Date.now() + delayMs;

    clearCountdown();
    clearTimeouts();
    endTimeRef.current = endTime;
    setSecondsLeft(configuredSeconds);
    setPhase("running");
    setPickerOpen(false);
    persistState({
      phase: "running",
      configuredSeconds,
      endTime,
      doneAt: null,
    });

    // Prime WebAudio in a user-gesture context so later alarm playback is allowed.
    void getAudioContext();
    void primeAlarmAudioElement();

    // Ask SW to fire a background notification at the right time
    if (granted) {
      postToSW({ type: "SCHEDULE_TIMER", delayMs });
    }

    // Page-level countdown (kept in sync with real clock)
    startCountdownTicker();
  };

  const cancelTimer = () => {
    clearCountdown();
    stopAlarmEffects();
    endTimeRef.current = null;
    setPhase("idle");
    postToSW({ type: "CANCEL_TIMER" });
    clearPersistedState();
  };

  // Restore any in-progress timer state for this client when card is reopened.
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<PersistedTimerState>;
      const savedConfigured = typeof parsed.configuredSeconds === "number"
        ? Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, parsed.configuredSeconds))
        : DEFAULT_SECONDS;
      setConfiguredSeconds(savedConfigured);

      if (parsed.phase === "running" && typeof parsed.endTime === "number") {
        endTimeRef.current = parsed.endTime;
        const remaining = Math.ceil((parsed.endTime - Date.now()) / 1000);
        if (remaining <= 0) {
          handleAlarm();
        } else {
          setSecondsLeft(remaining);
          setPhase("running");
          startCountdownTicker();
        }
        return;
      }

      if (parsed.phase === "done" && typeof parsed.doneAt === "number") {
        const elapsed = Date.now() - parsed.doneAt;
        if (elapsed < DONE_ACK_MS) {
          setPhase("done");
          doneResetTimeoutRef.current = setTimeout(() => {
            stopAlarmEffects();
            setPhase("idle");
            doneResetTimeoutRef.current = null;
            clearPersistedState();
          }, DONE_ACK_MS - elapsed);
          return;
        }
      }

      clearPersistedState();
    } catch {
      clearPersistedState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Resync countdown when tab becomes visible again (e.g. returning from screen-off)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (phase !== "running" || endTimeRef.current === null) return;
      const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        handleAlarm();
      } else {
        setSecondsLeft(remaining);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearCountdown();
    stopAlarmEffects();
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (alarmAudioUrlRef.current) {
      URL.revokeObjectURL(alarmAudioUrlRef.current);
      alarmAudioUrlRef.current = null;
    }
    alarmAudioElementRef.current = null;
  }, []);

  // ── Done state ─────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <Button
        type="button"
        size="sm"
        className="h-10 gap-1.5 px-3 bg-green-600 hover:bg-green-700 text-white animate-pulse"
        onClick={() => {
          stopAlarmEffects();
          setPhase("idle");
          clearPersistedState();
        }}
      >
        <Timer className="h-4 w-4" />
        Done!
      </Button>
    );
  }

  // ── Running state ──────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 gap-1 px-3 font-mono text-sm border-orange-400 text-orange-500 hover:border-orange-500"
        onClick={cancelTimer}
        title="Tap to cancel timer"
      >
        <Timer className="h-4 w-4 shrink-0" />
        {formatTime(secondsLeft)}
        <X className="h-3 w-3 shrink-0 opacity-60" />
      </Button>
    );
  }

  // ── Idle / Picker ──────────────────────────────────────────────────────────
  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 p-0"
          title="Start rest timer"
        >
          <Timer className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center" side="top">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Rest timer
        </p>
        <div className="mb-3 flex items-center justify-between rounded-md border p-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setConfiguredSeconds((prev) => Math.max(MIN_SECONDS, prev - STEP_SECONDS))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-20 text-center font-mono text-lg font-semibold">
            {formatTime(configuredSeconds)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setConfiguredSeconds((prev) => Math.min(MAX_SECONDS, prev + STEP_SECONDS))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Button type="button" className="h-9 w-full" onClick={() => void startTimer()}>
          Start
        </Button>
        {showTestAlarm ? (
          <div className="mt-2 space-y-2 rounded-md border border-border/70 bg-muted/20 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Alarm lab
            </p>
            <div className="flex gap-1">
              {ALARM_VOLUME_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={alarmVolume === option.value ? "default" : "outline"}
                  className="h-7 flex-1 px-1 text-[10px]"
                  onClick={() => setAlarmVolume(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {ALARM_PROFILE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={alarmProfile === option.value ? "default" : "outline"}
                  className="h-7 px-1 text-[10px]"
                  onClick={() => setAlarmProfile(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {showTestAlarm ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-8 w-full"
            onClick={() => {
              setPickerOpen(false);
              handleAlarm();
            }}
          >
            Test Alarm
          </Button>
        ) : null}
        <p className="mt-2.5 text-[10px] text-muted-foreground leading-tight">
          Default is 2:30. Use +/- 30s, then tap Start.
        </p>
      </PopoverContent>
    </Popover>
  );
}
