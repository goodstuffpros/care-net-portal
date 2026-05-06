// Text-to-Speech utility for Care Net Portal
// speakText() — browser Web Speech API (general use)
// speakBecky() — ElevenLabs via backend proxy (Becky's voice, Wellbeing + University)

export type TTSSpeed = 0.75 | 1 | 1.25 | 1.5;

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  text: string;
  speed: TTSSpeed;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
let onStateChange: ((state: TTSState) => void) | null = null;
let currentSpeed: TTSSpeed = 1;
let currentText = "";

export const isTTSSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function getState(): TTSState {
  if (!isTTSSupported()) return { isPlaying: false, isPaused: false, text: "", speed: currentSpeed };
  return {
    isPlaying: window.speechSynthesis.speaking && !window.speechSynthesis.paused,
    isPaused: window.speechSynthesis.paused,
    text: currentText,
    speed: currentSpeed,
  };
}

export function registerTTSStateListener(cb: (state: TTSState) => void) {
  onStateChange = cb;
}

export function unregisterTTSStateListener() {
  onStateChange = null;
}

function notify() {
  if (onStateChange) onStateChange(getState());
}

export function speakText(text: string, speed: TTSSpeed = currentSpeed) {
  if (!isTTSSupported()) return;

  // Stop any active speech first
  window.speechSynthesis.cancel();

  currentText = text;
  currentSpeed = speed;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Prefer a natural English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Google"))
  ) || voices.find(v => v.lang.startsWith("en"));
  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => notify();
  utterance.onpause = () => notify();
  utterance.onresume = () => notify();
  utterance.onend = () => {
    currentText = "";
    currentUtterance = null;
    notify();
  };
  utterance.onerror = () => {
    currentText = "";
    currentUtterance = null;
    notify();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  notify();
}

export function pauseTTS() {
  if (!isTTSSupported()) return;
  window.speechSynthesis.pause();
  notify();
}

export function resumeTTS() {
  if (!isTTSSupported()) return;
  window.speechSynthesis.resume();
  notify();
}

export function stopTTS() {
  if (!isTTSSupported()) return;
  window.speechSynthesis.cancel();
  currentText = "";
  currentUtterance = null;
  notify();
}

export function setTTSSpeed(speed: TTSSpeed) {
  currentSpeed = speed;
  // If currently speaking, restart with new speed
  if (currentText && window.speechSynthesis.speaking) {
    const text = currentText;
    speakText(text, speed);
  }
}

export function getTTSState(): TTSState {
  return getState();
}

// ── Becky's Voice — ElevenLabs via backend proxy ───────────────────────────────
// API key is server-side only. This fetches audio from our own backend.

let beckyAudio: HTMLAudioElement | null = null;
let beckyStateListener: ((state: { isPlaying: boolean; isLoading: boolean }) => void) | null = null;
let beckyIsLoading = false;

export function registerBeckyStateListener(cb: (state: { isPlaying: boolean; isLoading: boolean }) => void) {
  beckyStateListener = cb;
}
export function unregisterBeckyStateListener() {
  beckyStateListener = null;
}
function notifyBecky(isPlaying: boolean, isLoading: boolean) {
  if (beckyStateListener) beckyStateListener({ isPlaying, isLoading });
}

// Resolve the correct API base URL — honours the __PORT_5000__ proxy rewrite on deployed sites
const API_BASE = ("__PORT_5000__" as string).startsWith("__") ? "" : "__PORT_5000__";

export async function speakBecky(text: string): Promise<void> {
  // Stop any currently playing Becky audio
  if (beckyAudio) {
    beckyAudio.pause();
    beckyAudio.src = "";
    beckyAudio = null;
  }
  // Also stop browser TTS if active
  if (isTTSSupported()) window.speechSynthesis.cancel();

  beckyIsLoading = true;
  notifyBecky(false, true);

  try {
    const response = await fetch(`${API_BASE}/api/tts/becky`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`TTS error ${response.status}`);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    beckyAudio = audio;
    beckyIsLoading = false;
    notifyBecky(false, false);

    audio.onplay = () => notifyBecky(true, false);
    audio.onpause = () => notifyBecky(false, false);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      beckyAudio = null;
      notifyBecky(false, false);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      beckyAudio = null;
      notifyBecky(false, false);
    };
    await audio.play();
  } catch (err) {
    beckyIsLoading = false;
    beckyAudio = null;
    notifyBecky(false, false);
    console.warn("Becky TTS failed:", err);
  }
}

export function stopBecky() {
  if (beckyAudio) {
    beckyAudio.pause();
    beckyAudio.src = "";
    beckyAudio = null;
  }
  notifyBecky(false, false);
}

export function isBeckyPlaying(): boolean {
  return !!beckyAudio && !beckyAudio.paused;
}
