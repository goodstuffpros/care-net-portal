/**
 * SampleClientModal — lets a CG create a practice (sample) client.
 * Triggered from the "Take it for a ride" banner on the PreConnection screen.
 * Two fields: Date of Birth + Primary Condition. Name is always "Sample Client".
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Rocket, User } from "lucide-react";

const CONDITIONS = [
  "Dementia / Alzheimer's",
  "Parkinson's disease",
  "Stroke recovery",
  "ALS (Lou Gehrig's disease)",
  "Multiple sclerosis",
  "Hip or knee replacement recovery",
  "Heart failure / cardiac care",
  "COPD / respiratory care",
  "Cancer care",
  "Diabetes management",
  "General elderly care",
  "Post-surgical recovery",
  "Traumatic brain injury",
  "Spinal cord injury",
  "Developmental disability",
  "Other",
];

interface SampleClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void; // called after successful creation — triggers app reload
}

export function SampleClientModal({ open, onOpenChange, onCreated }: SampleClientModalProps) {
  const { toast } = useToast();
  const [dob, setDob] = useState("");
  const [condition, setCondition] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/clients/practice", {
        dateOfBirth: dob,
        primaryCondition: condition,
      }).then(r => r.json()),
    onSuccess: () => {
      toast({
        title: "Sample Client created",
        description: "Your practice portal is ready. Explore every feature — nothing here is real.",
      });
      onOpenChange(false);
      onCreated();
    },
    onError: (err: any) => {
      toast({
        title: "Could not create sample client",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = dob && condition && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-amber-500" />
            Set up your Sample Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Explanation */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
            This is a <strong>practice-only</strong> space. No real person, no real data. Use it to get comfortable with every part of the portal before your first client arrives.
          </div>

          {/* Name — read-only */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              Client Name
            </Label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/50">
              <span className="text-sm text-muted-foreground">Sample Client</span>
              <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 font-medium">Sample</span>
            </div>
            <p className="text-xs text-muted-foreground">Name is fixed. No real name will ever appear here.</p>
          </div>

          {/* Date of Birth */}
          <div className="space-y-1.5">
            <Label htmlFor="sample-dob">Date of Birth</Label>
            <Input
              id="sample-dob"
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              data-testid="sample-dob-input"
            />
            <p className="text-xs text-muted-foreground">Used to populate age-appropriate care scenarios.</p>
          </div>

          {/* Primary Condition */}
          <div className="space-y-1.5">
            <Label>Primary Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger data-testid="sample-condition-select">
                <SelectValue placeholder="Select a condition…" />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choose something close to your real caregiving experience.</p>
          </div>

          <Button
            className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            data-testid="create-sample-client-btn"
          >
            <Rocket className="w-4 h-4" />
            {createMutation.isPending ? "Creating…" : "Take it for a ride"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
