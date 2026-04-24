import { useApp } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { User as UserIcon, Heart, AlertTriangle, Users, Bell, Edit2, Save, X, Shield, Eye, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  caregiver: "Caregiver",
  primary_family: "Primary Contact",
  secondary_family: "Family Member",
};

const ROLE_COLORS: Record<string, string> = {
  caregiver: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  primary_family: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  secondary_family: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function ClientPortalPage() {
  const { activeUser, selectedClientId } = useApp();
  const { toast } = useToast();
  const [editingClient, setEditingClient] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", selectedClientId],
    queryFn: () => apiRequest("GET", `/api/clients/${selectedClientId}`).then(r => r.json()),
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users").then(r => r.json()),
  });

  const familyMembers = allUsers.filter(u => u.clientId === selectedClientId);
  const caregiver = allUsers.find(u => u.role === "caregiver");

  const updateClientMutation = useMutation({
    mutationFn: (data: Partial<Client>) => apiRequest("PATCH", `/api/clients/${selectedClientId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId] });
      setEditingClient(false);
      toast({ title: "Profile updated" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => apiRequest("PATCH", `/api/users/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
  });

  const canEdit = activeUser.role === "caregiver";

  if (clientLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  const allergies: string[] = client?.allergies ? JSON.parse(client.allergies) : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Client Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Portal overview and family access settings</p>
        </div>
      </div>

      {/* Client Info Card */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <UserIcon size={16} /> Client Information
            </CardTitle>
            {canEdit && !editingClient && (
              <Button variant="ghost" size="sm" onClick={() => { setEditingClient(true); setEditForm(client || {}); }} className="gap-1.5 h-8" data-testid="edit-client-btn">
                <Edit2 size={13} /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editingClient ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Full Name</div>
                <div className="text-sm font-medium">{client?.name}</div>
              </div>
              {client?.dateOfBirth && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Date of Birth</div>
                  <div className="text-sm">{new Date(client.dateOfBirth).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</div>
                </div>
              )}
              {client?.primaryCondition && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Primary Condition</div>
                  <div className="text-sm">{client.primaryCondition}</div>
                </div>
              )}
              {allergies.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={11} className="text-red-500" /> Allergies & Contraindications
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allergies.map(a => (
                      <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900 font-medium">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {client?.notes && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">Care Notes</div>
                  <div className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg">{client.notes}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={editForm.dateOfBirth || ""} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Primary Condition</Label>
                <Input value={editForm.primaryCondition || ""} onChange={e => setEditForm(f => ({ ...f, primaryCondition: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Care Notes</Label>
                <Textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateClientMutation.mutate(editForm)} disabled={updateClientMutation.isPending} className="gap-1.5" data-testid="save-client-btn">
                  <Save size={13} /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingClient(false)}>
                  <X size={13} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Participants */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <Users size={16} /> Care Team & Family
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : (
            <div className="space-y-3">
              {caregiver && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50">
                  <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-700 dark:text-teal-400 text-sm font-bold flex-shrink-0">
                    {caregiver.avatarInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{caregiver.name}</div>
                    <div className="text-xs text-muted-foreground">{caregiver.email}</div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", ROLE_COLORS.caregiver)}>
                    {ROLE_LABELS.caregiver}
                  </span>
                </div>
              )}
              {familyMembers.map(member => (
                <div key={member.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {member.avatarInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{member.name}</span>
                      {member.id === client?.primaryContactId && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900">Primary Contact</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{member.email}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <NotifToggle label="All updates" userId={member.id} field="all" prefs={member.notificationPrefs} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                      <NotifToggle label="Medications" userId={member.id} field="medications" prefs={member.notificationPrefs} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                      <NotifToggle label="Urgent alerts" userId={member.id} field="alerts" prefs={member.notificationPrefs} onToggle={(prefs) => updateUserMutation.mutate({ id: member.id, data: { notificationPrefs: prefs } })} />
                    </div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full flex-shrink-0", ROLE_COLORS[member.role])}>
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Level Info */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <Shield size={16} /> Access Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { role: "caregiver", icon: Shield, desc: "Full access: log activities, manage schedule, all communications, media, archive. Can open and close chat threads." },
              { role: "primary_family", icon: UserCheck, desc: "Full read access: all updates, schedule, activity log, messages, media, archive summaries. Can send messages." },
              { role: "secondary_family", icon: Eye, desc: "Limited access: receives updates per notification preferences. Can view shared content and send messages." },
            ].map(({ role, icon: Icon, desc }) => (
              <div key={role} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", ROLE_COLORS[role])}>
                  <Icon size={14} />
                </div>
                <div>
                  <div className="text-sm font-medium">{ROLE_LABELS[role]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotifToggle({ label, userId, field, prefs, onToggle }: {
  label: string; userId: number; field: string; prefs: string | null;
  onToggle: (newPrefs: string) => void;
}) {
  const parsed = prefs ? JSON.parse(prefs) : {};
  const checked = parsed[field] === true;

  const handleChange = () => {
    const newPrefs = { ...parsed, [field]: !checked };
    onToggle(JSON.stringify(newPrefs));
  };

  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <Switch checked={checked} onCheckedChange={handleChange} className="scale-75" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </label>
  );
}
