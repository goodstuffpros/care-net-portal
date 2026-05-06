// Voice Command utility for Care Net Portal
// Uses webkitSpeechRecognition (Chrome/Edge only)
// Supports: single-tap mode + Hands-Free Mode with wake word detection

export type VoiceCommandStatus =
  | "idle"
  | "listening"       // tap-mode: single utterance listening
  | "hfm_armed"       // Hands-Free Mode: continuous, waiting for wake word
  | "hfm_triggered"   // Wake word detected, capturing command
  | "processing"
  | "unsupported";

export type VoiceCommandType =
  | "navigate"
  | "log_activity"
  | "send_message"
  | "open_log"       // navigate to care log + open new entry form
  | "open_message"   // navigate to messages + pre-select recipient thread
  | "read_summary"
  | "unknown";

export interface VoiceCommandResult {
  type: VoiceCommandType;
  raw: string;
  route?: string;
  text?: string;
  thread?: string;
  recipient?: string;  // extracted name for open_message routing
  category?: string;
  priority?: string;
}

export const isVoiceSupported = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

// ─── Category inference ───────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  medication: ["medication", "medicine", "pill", "dose", "administered", "insulin", "antibiotic", "meds", "drug", "prescri"],
  hygiene: ["bath", "shower", "hygiene", "cleaned", "groomed", "diaper", "toilet", "oral care", "teeth"],
  meal: ["breakfast", "lunch", "dinner", "ate", "meal", "feeding", "snack", "drank", "fluid", "water", "juice", "food"],
  mood: ["mood", "upset", "calm", "agitated", "happy", "anxious", "confused", "oriented", "alert", "restless"],
  medical: ["fall", "fell", "pain", "wound", "injury", "doctor", "nurse", "vitals", "blood pressure", "temperature", "pulse", "oxygen", "glucose", "emergency"],
};

export function inferCategory(text: string): string {
  const t = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => t.includes(kw))) return category;
  }
  return "general";
}

// ─── Priority inference ───────────────────────────────────────────────────────
const URGENT_KEYWORDS = ["fall", "fell", "emergency", "urgent", "pain", "bleeding", "chest", "breathing", "unresponsive", "911"];
const IMPORTANT_KEYWORDS = ["agitated", "confused", "refused", "not eating", "vomiting"];

export function inferPriority(text: string): string {
  const t = text.toLowerCase();
  if (URGENT_KEYWORDS.some(kw => t.includes(kw))) return "red";
  if (IMPORTANT_KEYWORDS.some(kw => t.includes(kw))) return "yellow";
  return "green";
}

// ─── Command parser ───────────────────────────────────────────────────────────
export function parseCommand(transcript: string, lang: "en" | "es" = "en"): VoiceCommandResult {
  const t = transcript.toLowerCase().trim();

  // ── Open new care log entry ──────────────────────────────────────────────────
  // "open new care log entry" / "new care log" / "open care log" / "nueva entrada"
  if (t.match(/(?:open\s+(?:a\s+)?new\s+(?:care\s+)?log|new\s+(?:care\s+)?log\s+entry|open\s+care\s+log|nueva\s+entrada|abrir\s+registro)/)) {
    return { type: "open_log", raw: transcript };
  }

  // ── Open message to [person] ──────────────────────────────────────────────────
  // "message to Robert Johnson Jr" / "send message to Robert" / "mensaje a Robert"
  const openMsgMatch = t.match(/^(?:open\s+)?(?:message|mensaje)\s+(?:to|a|para)\s+(.+)$/);
  if (openMsgMatch) {
    const recipient = openMsgMatch[1].trim();
    return { type: "open_message", raw: transcript, recipient };
  }

  // Navigate commands — EN + ES
  const navMap: [string[], string][] = [
    [["schedule", "horario"], "/schedule"],
    [["messages", "mensajes"], "/messages"],
    [["archive", "archivo", "summaries", "resúmenes"], "/archive"],
    [["care log", "activity", "actividad", "activity log", "registro", "care log"], "/activity"],
    [["notes", "notas"], "/notes"],
    [["dashboard", "home", "inicio", "go home", "ir a inicio"], "/"],
    [["care team", "caregivers", "equipo", "cuidadores"], "/caregivers"],
    [["media", "photos", "fotos"], "/media"],
    [["vitals", "vitales"], "/vitals"],
    [["trends", "tendencias"], "/trends"],
    [["documents", "documentos"], "/documents"],
    [["emergency", "emergencia"], "/emergency"],
  ];

  for (const [keywords, route] of navMap) {
    if (keywords.some(kw => t.includes(kw))) {
      // Only navigate if explicit navigation intent — don't capture incidental mentions in log commands
      if (t.match(/^(go to|open|navigate|ir a|abrir|navegar)/)) {
        return { type: "navigate", raw: transcript, route };
      }
    }
  }

  // Read summary
  if (t.match(/read summary|read today|listen to summary|leer resumen|leer hoy/)) {
    return { type: "read_summary", raw: transcript };
  }

  // Log activity — "log [activity]: [text]" OR "log: [text]" OR "registrar: [text]"
  const logMatch = t.match(/^(?:log(?:\s+activity)?[:\s]+|registrar(?:\s+actividad)?[:\s]+)(.+)$/i);
  if (logMatch) {
    const text = logMatch[1].trim();
    return {
      type: "log_activity",
      raw: transcript,
      text,
      category: inferCategory(text),
      priority: inferPriority(text),
    };
  }

  // Send message — "send [message] [to thread]: [text]" OR "enviar: [text]"
  const msgMatch = t.match(/^(?:send(?:\s+message)?(?:\s+to\s+(.+?))?\s*[:]|enviar(?:\s+mensaje)?[:])\s*(.+)$/i);
  if (msgMatch) {
    const text = (msgMatch[2] || msgMatch[1] || "").trim();
    const thread = msgMatch[1] && !msgMatch[2] ? undefined : msgMatch[1]?.trim();
    return {
      type: "send_message",
      raw: transcript,
      thread,
      text,
      priority: inferPriority(text),
    };
  }

  return { type: "unknown", raw: transcript };
}

// ─── Wake word detection ──────────────────────────────────────────────────────
const WAKE_WORDS_EN = ["hey carenet", "hey care net", "hi carenet", "ok carenet"];
const WAKE_WORDS_ES = ["hola carenet", "hola care net", "oye carenet"];

export function detectWakeWord(transcript: string, lang: "en" | "es"): boolean {
  const t = transcript.toLowerCase().trim();
  const wakeWords = lang === "es" ? [...WAKE_WORDS_ES, ...WAKE_WORDS_EN] : WAKE_WORDS_EN;
  return wakeWords.some(w => t.startsWith(w) || t.includes(w));
}

export function stripWakeWord(transcript: string, lang: "en" | "es"): string {
  const t = transcript.toLowerCase().trim();
  const wakeWords = lang === "es" ? [...WAKE_WORDS_ES, ...WAKE_WORDS_EN] : WAKE_WORDS_EN;
  for (const w of wakeWords) {
    if (t.includes(w)) {
      const idx = t.indexOf(w);
      const after = transcript.slice(idx + w.length).trim().replace(/^[,\s]+/, "");
      return after;
    }
  }
  return transcript;
}

// ─── Recognizer factory ───────────────────────────────────────────────────────
export interface VoiceRecognizer {
  startTap: () => void;
  stopTap: () => void;
  startHFM: () => void;
  stopHFM: () => void;
  setLang: (lang: "en" | "es") => void;
}

export function createVoiceRecognizer(
  onResult: (result: VoiceCommandResult) => void,
  onStatusChange: (status: VoiceCommandStatus) => void,
  onWakeWordDetected: () => void,
  initialLang: "en" | "es" = "en"
): VoiceRecognizer | null {
  if (!isVoiceSupported()) return null;

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  let currentLang: "en" | "es" = initialLang;
  let hfmActive = false;
  let awaitingCommand = false; // true = wake word heard, next phrase is the command
  let tapRecognition: any = null;
  let hfmRecognition: any = null;

  // ── TAP-MODE RECOGNITION (single utterance) ──
  function buildTapRecognition() {
    const r = new SpeechRecognition();
    r.continuous = false;
    r.interimResults = false;
    r.lang = currentLang === "es" ? "es-US" : "en-US";
    r.maxAlternatives = 1;
    r.onstart = () => onStatusChange("listening");
    r.onend = () => onStatusChange("idle");
    r.onerror = () => onStatusChange("idle");
    r.onresult = (event: any) => {
      onStatusChange("processing");
      const transcript: string = event.results[0][0].transcript;
      // In tap mode, strip wake word if they said it (just in case), then parse
      const cleaned = detectWakeWord(transcript, currentLang)
        ? stripWakeWord(transcript, currentLang)
        : transcript;
      if (cleaned.trim()) {
        onResult(parseCommand(cleaned, currentLang));
      }
    };
    return r;
  }

  // ── HFM RECOGNITION (continuous, restarts on end) ──
  function buildHFMRecognition() {
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = false;
    r.lang = currentLang === "es" ? "es-US" : "en-US";
    r.maxAlternatives = 1;

    r.onstart = () => {
      if (awaitingCommand) {
        onStatusChange("hfm_triggered");
      } else {
        onStatusChange("hfm_armed");
      }
    };

    r.onend = () => {
      // Auto-restart if HFM is still active (browser times out on silence)
      if (hfmActive) {
        try { r.start(); } catch {}
      } else {
        awaitingCommand = false;
        onStatusChange("idle");
      }
    };

    r.onerror = (event: any) => {
      if (event.error === "aborted" || !hfmActive) return;
      // Restart on transient errors
      if (hfmActive) {
        setTimeout(() => { try { r.start(); } catch {} }, 300);
      }
    };

    r.onresult = (event: any) => {
      const transcript: string = event.results[event.results.length - 1][0].transcript;

      if (!awaitingCommand) {
        // Listening for wake word
        if (detectWakeWord(transcript, currentLang)) {
          awaitingCommand = true;
          onWakeWordDetected();
          onStatusChange("hfm_triggered");
          // Check if the command is inline (e.g., "Hey Carenet log activity: patient fell")
          const remainder = stripWakeWord(transcript, currentLang);
          if (remainder.trim().length > 2) {
            // Command was inline — process immediately
            const result = parseCommand(remainder, currentLang);
            onResult(result);
            awaitingCommand = false;
            onStatusChange("hfm_armed");
          }
          // Otherwise wait for next utterance
        }
      } else {
        // Awaiting command after wake word
        awaitingCommand = false;
        onStatusChange("hfm_armed");
        const result = parseCommand(transcript, currentLang);
        onResult(result);
      }
    };

    return r;
  }

  return {
    startTap() {
      if (hfmActive) return; // Don't tap when HFM is running
      tapRecognition = buildTapRecognition();
      try { tapRecognition.start(); } catch {}
    },
    stopTap() {
      try { tapRecognition?.stop(); } catch {}
    },
    startHFM() {
      hfmActive = true;
      awaitingCommand = false;
      hfmRecognition = buildHFMRecognition();
      try { hfmRecognition.start(); } catch {}
    },
    stopHFM() {
      hfmActive = false;
      awaitingCommand = false;
      try { hfmRecognition?.abort(); } catch {}
      hfmRecognition = null;
      onStatusChange("idle");
    },
    setLang(lang: "en" | "es") {
      currentLang = lang;
      // If HFM is running, restart it with new lang
      if (hfmActive) {
        try { hfmRecognition?.abort(); } catch {}
        hfmRecognition = buildHFMRecognition();
        try { hfmRecognition.start(); } catch {}
      }
    },
  };
}
