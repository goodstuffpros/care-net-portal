import { useState, useEffect, useCallback } from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  registerTTSStateListener,
  unregisterTTSStateListener,
  pauseTTS,
  resumeTTS,
  stopTTS,
  setTTSSpeed,
  isTTSSupported,
  type TTSSpeed,
  type TTSState,
} from "@/lib/ttsUtils";

const SPEEDS: TTSSpeed[] = [0.75, 1, 1.25, 1.5];
const SPEED_LABELS: Record<TTSSpeed, string> = {
  0.75: "0.75×",
  1: "1×",
  1.25: "1.25×",
  1.5: "1.5×",
};

export default function TTSBar() {
  const [ttsState, setTtsState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    text: "",
    speed: 1,
  });

  useEffect(() => {
    registerTTSStateListener(setTtsState);
    return () => unregisterTTSStateListener();
  }, []);

  const isActive = ttsState.isPlaying || ttsState.isPaused;

  if (!isTTSSupported() || !isActive) return null;

  const truncated = ttsState.text.length > 60
    ? ttsState.text.slice(0, 57) + "..."
    : ttsState.text;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 border-t border-border bg-background/95 backdrop-blur-sm shadow-lg"
      data-testid="tts-bar"
    >
      <div className="flex items-center gap-2 text-primary flex-shrink-0">
        <Volume2 size={16} className={cn(ttsState.isPlaying && "animate-pulse")} />
        <span className="text-xs font-medium hidden sm:block">Listening</span>
      </div>

      <p className="flex-1 text-xs text-muted-foreground truncate min-w-0">{truncated}</p>

      {/* Speed selector */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => setTTSSpeed(s)}
            data-testid={`tts-speed-${s}`}
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full transition-colors font-medium",
              ttsState.speed === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {SPEED_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Pause / Resume */}
      <button
        onClick={ttsState.isPaused ? resumeTTS : pauseTTS}
        data-testid="tts-pause-resume"
        className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
        aria-label={ttsState.isPaused ? "Resume" : "Pause"}
      >
        {ttsState.isPaused ? <Play size={15} /> : <Pause size={15} />}
      </button>

      {/* Stop */}
      <button
        onClick={stopTTS}
        data-testid="tts-stop"
        className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Stop"
      >
        <Square size={15} />
      </button>
    </div>
  );
}
