import { useApp } from "@/App";
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
import { useState } from "react";
import { Image, Video, Plus, Mic, MicOff, Trash2, Camera, Film } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_USERS: Record<number, string> = {
  1: "Becky M.",
  2: "Robert Jr.",
  3: "Linda J.",
  4: "Sarah W.",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function MediaPage() {
  const { activeUser, selectedClientId } = useApp();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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
    if (!isRecording && "webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setForm(f => ({ ...f, voiceNoteText: text }));
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
      setIsRecording(true);
    }
  };

  const filtered = media.filter(m => filterType === "all" || m.type === filterType);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Photos & Videos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Share moments and updates with the family</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" data-testid="add-media-btn">
              <Plus size={16} /> Upload
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Photo or Video</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">📷 Photo</SelectItem>
                    <SelectItem value="video">🎥 Short Video (15-30s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Image URL (demo — paste a photo URL)</Label>
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." data-testid="media-url-input" />
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {DEMO_IMAGES.map((url, i) => (
                    <button key={i} onClick={() => setForm(f => ({ ...f, url }))} className="w-10 h-10 rounded-lg overflow-hidden border-2 hover:border-primary transition-colors border-border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Caption</Label>
                <Input value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Add a caption..." data-testid="media-caption-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  Voice Note
                  <button onClick={toggleVoice} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded-full", isRecording ? "bg-red-100 text-red-600 recording-pulse" : "bg-muted text-muted-foreground hover:text-foreground")} type="button">
                    {isRecording ? <><MicOff size={12} /> Stop</> : <><Mic size={12} /> Record</>}
                  </button>
                </Label>
                <Textarea value={form.voiceNoteText} onChange={e => setForm(f => ({ ...f, voiceNoteText: e.target.value }))} placeholder="Speak a voice note or type one..." rows={2} data-testid="media-note-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">🟢 Routine update</SelectItem>
                    <SelectItem value="yellow">🟡 Important to see</SelectItem>
                    <SelectItem value="red">🔴 Urgent — please review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.url || addMutation.isPending} data-testid="save-media-btn">
                {addMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "photo", "video"].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              filterType === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
            )} data-testid={`media-filter-${t}`}
          >
            {t === "all" ? "All" : t === "photo" ? "📷 Photos" : "🎥 Videos"}
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
          <p className="text-sm mt-1">Upload photos or videos to share with the family.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="group relative rounded-xl overflow-hidden border border-border bg-card" data-testid={`media-card-${item.id}`}>
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
              <div className="p-3">
                {item.caption && <p className="text-sm font-medium truncate">{item.caption}</p>}
                {item.voiceNoteText && (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Mic size={11} className="mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{item.voiceNoteText}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{DEMO_USERS[item.uploadedByUserId] || "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(item.uploadedAt)}</span>
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
        </div>
      )}
    </div>
  );
}
