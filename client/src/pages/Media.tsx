import { useApp } from "@/App";
import { useLang } from "@/lib/useLang";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MediaItem } from "@shared/schema";
import { PriorityBadge } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { Image, Video, Plus, Mic, MicOff, Trash2, Camera, Film, Circle, Square, RotateCcw, Download, Music } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_USERS: Record<number, string> = {
  1: "Becky M.",
  2: "Robert Jr.",
  3: "Linda J.",
  4: "Sarah W.",
};

const VIDEO_LIMIT = 15; // seconds
const AUDIO_LIMIT = 120; // seconds

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Video Recorder ─────────────────────────────────────────────────────────
function VideoRecorder({ onRecorded }: { onRecorded: (url: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phase, setPhase] = useState<"idle" | "preview" | "recording" | "done">("idle");
  const [countdown, setCountdown] = useState(VIDEO_LIMIT);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startPreview = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.muted = true; videoRef.current.play(); }
      setPhase("preview");
    } catch { setError("Camera access denied or unavailable."); }
  }, []);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setPhase("done");
      if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.src = url; videoRef.current.muted = false; videoRef.current.loop = true; videoRef.current.play(); }
    };
    mediaRecorderRef.current = mr;
    mr.start(100);
    setCountdown(VIDEO_LIMIT);
    setPhase("recording");
    let remaining = VIDEO_LIMIT;
    timerRef.current = setInterval(() => {
      remaining -= 1; setCountdown(remaining);
      if (remaining <= 0) stopRecording();
    }, 1000);
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
  }, []);

  const retake = useCallback(async () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null); setCountdown(VIDEO_LIMIT);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(prev => { prev?.getTracks().forEach(t => t.stop()); return s; });
      if (videoRef.current) { videoRef.current.src = ""; videoRef.current.srcObject = s; videoRef.current.muted = true; videoRef.current.loop = false; videoRef.current.play(); }
      setPhase("preview");
    } catch { setError("Camera access denied or unavailable."); }
  }, [recordedUrl]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stream?.getTracks().forEach(t => t.stop());
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [stream, recordedUrl]);

  const progressPct = ((VIDEO_LIMIT - countdown) / VIDEO_LIMIT) * 100;
  if (error) return <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error} <span className="underline cursor-pointer" onClick={() => setError(null)}>Dismiss</span></div>;

  return (
    <div className="space-y-3">
      {phase !== "idle" && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline />
          {phase === "recording" && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border-4 border-red-500 rounded-xl animate-pulse" />
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 text-white text-sm font-mono px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />{countdown}s
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
          {phase === "done" && <div className="absolute top-3 left-3 bg-green-600 text-white text-xs font-medium px-2.5 py-1 rounded-full">✓ Clip ready</div>}
        </div>
      )}
      {phase === "idle" && <Button type="button" variant="outline" className="w-full gap-2" onClick={startPreview}><Camera size={16} /> Open Camera</Button>}
      {phase === "preview" && <Button type="button" className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white" onClick={startRecording}><Circle size={14} className="fill-white" /> Start Recording (max 15s)</Button>}
      {phase === "recording" && <Button type="button" variant="outline" className="w-full gap-2 border-red-300 text-red-600 hover:bg-red-50" onClick={stopRecording}><Square size={14} className="fill-red-600" /> Stop ({countdown}s left)</Button>}
      {phase === "done" && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 gap-2" onClick={retake}><RotateCcw size={14} /> Retake</Button>
          <Button type="button" className="flex-1 gap-2" onClick={() => recordedUrl && onRecorded(recordedUrl)}><Video size={14} /> Use This Clip</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center">
        {phase === "idle" && "Camera permission required. Max 15 seconds."}
        {phase === "preview" && "Preview active — press record when ready."}
        {phase === "recording" && "Recording… auto-stops at 15s"}
        {phase === "done" && "Review your clip, then press \"Use This Clip\"."}
      </p>
    </div>
  );
}

// ── Audio Recorder ─────────────────────────────────────────────────────────
function AudioRecorder({ onRecorded }: { onRecorded: (url: string, duration: number) => void }) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        stream.getTracks().forEach(t => t.stop());
        setRecordedUrl(url);
        setPhase("done");
      };
      mediaRecorderRef.current = mr;
      mr.start(100);
      setElapsed(0);
      setPhase("recording");
      let secs = 0;
      timerRef.current = setInterval(() => {
        secs += 1; setElapsed(secs);
        if (secs >= AUDIO_LIMIT) stopRecording();
      }, 1000);
    } catch { setError("Microphone access denied or unavailable."); }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordedDuration(elapsed);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
  }, [elapsed]);

  const retake = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null); setElapsed(0); setPhase("idle");
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [recordedUrl]);

  const remaining = AUDIO_LIMIT - elapsed;
  const progressPct = (elapsed / AUDIO_LIMIT) * 100;

  if (error) return <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-3">
      {phase === "recording" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-red-600 font-medium"><Mic size={14} className="animate-pulse" /> Recording…</span>
            <span className="font-mono text-red-600">{formatDuration(elapsed)} / {formatDuration(AUDIO_LIMIT)}</span>
          </div>
          <div className="h-1.5 bg-red-100 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 transition-all duration-1000 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-red-500">{remaining}s remaining</p>
        </div>
      )}
      {phase === "done" && recordedUrl && (
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <audio controls src={recordedUrl} className="w-full h-8" />
          <p className="text-xs text-muted-foreground">Duration: {formatDuration(recordedDuration)}</p>
        </div>
      )}
      {phase === "idle" && <Button type="button" variant="outline" className="w-full gap-2" onClick={startRecording}><Mic size={16} /> Start Recording (max 2 min)</Button>}
      {phase === "recording" && <Button type="button" variant="outline" className="w-full gap-2 border-red-300 text-red-600 hover:bg-red-50" onClick={stopRecording}><Square size={14} className="fill-red-600" /> Stop Recording</Button>}
      {phase === "done" && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 gap-2" onClick={retake}><RotateCcw size={14} /> Re-record</Button>
          <Button type="button" className="flex-1 gap-2" onClick={() => recordedUrl && onRecorded(recordedUrl, recordedDuration)}><Music size={14} /> Use This Recording</Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MediaPage() {
  const { activeUser, selectedClientId } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: "photo", url: "", caption: "", voiceNoteText: "", priority: "green",
  });

  const DEMO_IMAGES = [
    "https://images.unsplash.com/photo-1447452001602-7090c7ab2db3?w=600",
    "https://images.unsplash.com/photo-1509822929464-92b5704d0f77?w=600",
    "https://images.unsplash.com/photo-1516562309708-05f3b2b2c238?w=600",
    "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600",
  ];

  const { data: media = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: ["/api/clients", selectedClientId, "media"],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}/media`).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clients/${selectedClientId}/media`, {
      ...form,
      uploadedByUserId: activeUser.id,
      uploadedAt: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "media"] });
      setAddOpen(false);
      setForm({ type: "photo", url: "", caption: "", voiceNoteText: "", priority: "green" });
      toast({ title: "Media added", description: "Uploaded successfully." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "media"] });
      toast({ title: "Removed", description: "Media item deleted." });
    },
  });

  const toggleVoice = () => {
    if (!isVoiceRecording && "webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false; recognition.interimResults = false;
      recognition.onresult = (e: any) => { setForm(f => ({ ...f, voiceNoteText: e.results[0][0].transcript })); setIsVoiceRecording(false); };
      recognition.onerror = () => setIsVoiceRecording(false);
      recognition.onend = () => setIsVoiceRecording(false);
      recognition.start(); setIsVoiceRecording(true);
    }
  };

  // Download helper
  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.click();
  };

  const filtered = media.filter(m => filterType === "all" || m.type === filterType);

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6 w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="pb-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center flex-shrink-0">
            <Image size={20} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{t("media.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">Photos · Videos · Voice</p>
          </div>
        </div>
        <Dialog open={addOpen} onOpenChange={open => {
          setAddOpen(open);
          if (!open) setForm({ type: "photo", url: "", caption: "", voiceNoteText: "", priority: "green" });
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 w-full" data-testid="add-media-btn">
              <Plus size={16} /> Add Media
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Media</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, url: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">📷 Photo</SelectItem>
                    <SelectItem value="video">🎥 Short Video (max 15s)</SelectItem>
                    <SelectItem value="audio">🎙️ Voice Recording (max 2 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type === "photo" && (
                <div className="space-y-1.5">
                  <Label>Photo URL (demo — paste or pick below)</Label>
                  <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." data-testid="media-url-input" />
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {DEMO_IMAGES.map((url, i) => (
                      <button key={i} type="button" onClick={() => setForm(f => ({ ...f, url }))}
                        className={cn("w-10 h-10 rounded-lg overflow-hidden border-2 transition-colors",
                          form.url === url ? "border-primary" : "border-border hover:border-primary"
                        )}>
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {form.type === "video" && (
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    Record Video <span className="text-xs text-muted-foreground font-normal">15-second limit</span>
                  </Label>
                  <VideoRecorder onRecorded={url => setForm(f => ({ ...f, url }))} />
                  {form.url?.startsWith("blob:") && <p className="text-xs text-green-600 font-medium">✓ Clip recorded and ready</p>}
                </div>
              )}

              {form.type === "audio" && (
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    Voice Recording <span className="text-xs text-muted-foreground font-normal">2-minute limit</span>
                  </Label>
                  <AudioRecorder onRecorded={(url, duration) => setForm(f => ({ ...f, url, voiceNoteText: f.voiceNoteText || `Voice recording (${formatDuration(duration)})` }))} />
                  {form.url?.startsWith("blob:") && <p className="text-xs text-green-600 font-medium">✓ Recording ready</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Caption</Label>
                <Input value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Add a caption..." data-testid="media-caption-input" />
              </div>

              {form.type !== "audio" && (
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    Voice Note
                    <button onClick={toggleVoice} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-full transition-colors", isVoiceRecording ? "bg-red-100 text-red-600 recording-pulse" : "bg-muted text-muted-foreground hover:text-foreground")} type="button">
                      {isVoiceRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Record</>}
                    </button>
                  </Label>
                  <Textarea value={form.voiceNoteText} onChange={e => setForm(f => ({ ...f, voiceNoteText: e.target.value }))} placeholder="Speak a voice note or type one..." rows={2} data-testid="media-note-input" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">🟢 Normal update</SelectItem>
                    <SelectItem value="yellow">🟡 Important to see</SelectItem>
                    <SelectItem value="red">🔴 Urgent — please review</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.url || addMutation.isPending} data-testid="save-media-btn">
                {addMutation.isPending ? "Uploading..." : "Save to Media"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "photo", "video", "audio"].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              filterType === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
            )} data-testid={`media-filter-${t}`}
          >
            {t === "all" ? "All" : t === "photo" ? "📷 Photos" : t === "video" ? "🎥 Videos" : "🎙️ Audio"}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Camera size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium">No media yet</p>
          <p className="text-sm mt-1">Upload photos, videos, or voice recordings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="group relative rounded-xl overflow-hidden border border-border bg-card" data-testid={`media-card-${item.id}`}>
              {/* Audio card */}
              {item.type === "audio" ? (
                <div className="aspect-square bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950/30 dark:to-teal-900/30 flex flex-col items-center justify-center gap-3 p-4">
                  <div className="w-14 h-14 rounded-full bg-teal-200 dark:bg-teal-800 flex items-center justify-center">
                    <Music size={24} className="text-teal-700 dark:text-teal-300" />
                  </div>
                  <audio controls src={item.url} className="w-full h-8" />
                </div>
              ) : (
                <div className="aspect-square relative cursor-pointer" onClick={() => setLightboxImg(item.url)}>
                  <img src={item.url} alt={item.caption || ""} className="w-full h-full object-cover" />
                  {item.type === "video" && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Film size={20} className="text-slate-800" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    {item.priority && item.priority !== "green" && <PriorityBadge priority={item.priority} />}
                  </div>
                  {activeUser.role === "caregiver" && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteMutation.mutate(item.id); }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center transition-opacity"
                      data-testid={`delete-media-${item.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}

              <div className="p-3">
                {item.caption && <p className="text-sm font-medium truncate">{item.caption}</p>}
                {item.voiceNoteText && (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Mic size={11} className="mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{item.voiceNoteText}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground block truncate">{DEMO_USERS[item.uploadedByUserId] || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(item.uploadedAt)}</span>
                  </div>
                  {/* Download button */}
                  <button
                    onClick={() => handleDownload(item.url, `care-net-${item.type}-${item.id}`)}
                    className="flex-shrink-0 w-7 h-7 rounded-lg border border-border hover:bg-muted flex items-center justify-center transition-colors"
                    title="Download"
                    data-testid={`download-media-${item.id}`}
                  >
                    <Download size={13} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          <button onClick={() => setLightboxImg(null)} className="absolute top-4 right-4 text-white text-2xl w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">✕</button>
          <button
            onClick={e => { e.stopPropagation(); handleDownload(lightboxImg, "care-net-photo"); }}
            className="absolute bottom-6 right-6 flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
          >
            <Download size={14} /> Download
          </button>
        </div>
      )}
    </div>
  );
}
