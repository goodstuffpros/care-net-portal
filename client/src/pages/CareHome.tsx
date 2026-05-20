/**
 * CareHome — the "waiting room" between portals.
 * Shown when a user has 2+ client relationships.
 * They choose a portal here deliberately, then enter.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Heart, Plus, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ── Color theme config ────────────────────────────────────────────────────────
import { THEME_CONFIG } from "@/lib/portalThemes";
export { THEME_CONFIG }; // re-export so existing imports don't break

interface Portal {
  relationshipId: number;
  clientId: number;
  role: string;
  isPrimary: boolean;
  clientName: string;
  colorTheme: string;
  primaryCondition: string | null;
}

interface CareHomeProps {
  onEnterPortal: (clientId: number, colorTheme: string) => void;
  onAddClient?: () => void;
  // Passed from RealAuthGate so we don't need AppContext
  userName?: string;
  userRole?: string;
}

export default function CareHome({ onEnterPortal, onAddClient, userName, userRole }: CareHomeProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientTheme, setNewClientTheme] = useState("sage");

  const { data: portals = [], isLoading } = useQuery<Portal[]>({
    queryKey: ["/api/me/portals"],
    queryFn: () => apiRequest("GET", "/api/me/portals").then(r => r.json()),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (clientId: number) => apiRequest("POST", "/api/me/portals/set-primary", { clientId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/me/portals"] }),
  });

  const addClientMutation = useMutation({
    mutationFn: (data: { clientName: string; colorTheme: string }) =>
      apiRequest("POST", "/api/me/portals/add-client", data).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/portals"] });
      setShowAddForm(false);
      setNewClientName("");
      toast({ title: `${data.clientName}'s portal created`, description: "Complete their profile when you enter." });
      // Enter the new portal right away so MC can complete setup
      onEnterPortal(data.clientId, data.colorTheme || "sage");
    },
  });

  const isMC = userRole === "primary_family";
  const roleLabelMap: Record<string, string> = {
    mc: "Main Contact",
    caregiver: "Caregiver",
    secondary_family: "Family Member",
    self_care: "Self-Care",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Heart size={20} className="text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-foreground">Care Home</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {portals.length === 1
            ? (userName ? `Welcome back, ${userName.split(" ")[0]}.` : "Welcome back.")
            : (userName ? `Welcome back, ${userName.split(" ")[0]}.` : "Welcome back.")}{" "}
          {portals.length === 1 ? "Enter your portal or add another loved one." : "Choose a portal to enter."}
        </p>
      </div>

      {/* Portal cards */}
      <div className="flex-1 px-4 space-y-3 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : portals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No portals found. Something may have gone wrong — please contact support.
          </div>
        ) : portals.length === 1 && !showAddForm ? (
          // Single portal — show it plus a prominent "add another" prompt
          <>
            {portals.map((portal) => {
              const theme = THEME_CONFIG[portal.colorTheme] || THEME_CONFIG.teal;
              const initials = portal.clientName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div
                  key={portal.clientId}
                  className={cn("relative rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 active:scale-[0.98]", theme.bg, theme.border, theme.card)}
                  onClick={() => onEnterPortal(portal.clientId, portal.colorTheme)}
                >
                  <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-2xl", theme.accent)} />
                  <div className="flex items-center gap-4 mt-1">
                    <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0", theme.accent)}>{initials}</div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-base text-foreground">{portal.clientName}</span>
                      <p className={cn("text-xs font-medium mt-0.5", theme.text)}>Enter portal</p>
                    </div>
                    <ArrowRight size={18} className={cn("flex-shrink-0", theme.text)} />
                  </div>
                </div>
              );
            })}
            {isMC && (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 p-5 flex items-center gap-4 transition-colors group"
              >
                <div className="w-14 h-14 rounded-xl border-2 border-dashed border-border group-hover:border-primary/50 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Plus size={22} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">Add another loved one</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Each person gets their own private portal.</p>
                </div>
              </button>
            )}
          </>
        ) : (
          portals.map((portal) => {
            const theme = THEME_CONFIG[portal.colorTheme] || THEME_CONFIG.teal;
            const initials = portal.clientName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div
                key={portal.clientId}
                className={cn(
                  "relative rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 active:scale-[0.98]",
                  theme.bg, theme.border, theme.card
                )}
                onClick={() => onEnterPortal(portal.clientId, portal.colorTheme)}
                data-testid={`portal-card-${portal.clientId}`}
              >
                {/* Color accent bar */}
                <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-2xl", theme.accent)} />

                <div className="flex items-center gap-4 mt-1">
                  {/* Avatar */}
                  <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0", theme.accent)}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base text-foreground truncate">{portal.clientName}</span>
                      {portal.isPrimary && (
                        <Star size={12} className={cn("flex-shrink-0", theme.text)} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-xs font-medium", theme.text)}>
                        {roleLabelMap[portal.role] || portal.role}
                      </span>
                      {portal.primaryCondition && (
                        <>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs text-muted-foreground truncate">{portal.primaryCondition}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowRight size={18} className={cn("flex-shrink-0", theme.text)} />
                </div>

                {/* Set as default (if MC and not already primary) */}
                {isMC && !portal.isPrimary && portals.length > 1 && (
                  <button
                    className="mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrimaryMutation.mutate(portal.clientId);
                    }}
                  >
                    Set as default portal
                  </button>
                )}
              </div>
            );
          })
        )}

        {/* Add another person (MC only) */}
        {isMC && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full rounded-2xl border-2 border-dashed border-border py-5 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            data-testid="add-another-client-btn"
          >
            <Plus size={16} /> Add another person I care for
          </button>
        )}

        {/* Add client form */}
        {isMC && showAddForm && (
          <div className="rounded-2xl border-2 border-border p-4 space-y-4">
            <p className="font-semibold text-sm">Add Another Portal</p>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Their name</label>
              <input
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. Robert Johnson"
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                autoFocus
                data-testid="new-client-name-input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Portal color</label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(THEME_CONFIG).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setNewClientTheme(key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                      newClientTheme === key
                        ? cn(t.border, t.bg, t.text, "border-2")
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", t.dot)} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!newClientName.trim() || addClientMutation.isPending}
                onClick={() => addClientMutation.mutate({ clientName: newClientName.trim(), colorTheme: newClientTheme })}
                className="bg-primary text-primary-foreground"
                data-testid="create-portal-btn"
              >
                Create Portal
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewClientName(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-8 text-center">
        <p className="text-xs text-muted-foreground">Care Net Portal · Private & Secure</p>
      </div>
    </div>
  );
}
