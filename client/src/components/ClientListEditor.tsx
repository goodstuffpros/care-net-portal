/**
 * ClientListEditor — reusable inline list editor for structured profile fields.
 * Used for Diagnoses, Allergies, and Assistive Devices on the Client Profile.
 * MC and CG can add/remove entries. Each entry is a key-value object.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "select" | "date";
  options?: string[];
  required?: boolean;
}

interface Props {
  label: string;
  items: Record<string, string>[];
  onSave: (items: Record<string, string>[]) => void;
  fields: FieldDef[];
}

export default function ClientListEditor({ label, items, onSave, fields }: Props) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState<Record<string, string>>({});

  function handleAdd() {
    const required = fields.filter(f => f.required);
    if (required.some(f => !newItem[f.key]?.trim())) return;
    onSave([...items, { ...newItem }]);
    setNewItem({});
    setAdding(false);
  }

  function handleRemove(index: number) {
    onSave(items.filter((_, i) => i !== index));
  }

  const primaryField = fields[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider">{label}</Label>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
              <span className="text-sm flex-1">{item[primaryField.key]}</span>
              {fields.slice(1).map(f => item[f.key] && (
                <span key={f.key} className="text-xs text-muted-foreground capitalize">{item[f.key]}</span>
              ))}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="ml-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                aria-label={`Remove ${item[primaryField.key]}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item form */}
      {adding && (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/10">
          {fields.map(field => (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs">{field.label}</Label>
              {field.type === "select" && field.options ? (
                <Select
                  value={newItem[field.key] || field.options[0]}
                  onValueChange={val => setNewItem(p => ({ ...p, [field.key]: val }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map(opt => (
                      <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={field.type === "date" ? "date" : "text"}
                  className="h-8 text-sm"
                  value={newItem[field.key] || ""}
                  onChange={e => setNewItem(p => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.label}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs px-3"
              onClick={handleAdd}
              disabled={fields.filter(f => f.required).some(f => !newItem[f.key]?.trim())}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => { setAdding(false); setNewItem({}); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground italic">None recorded</p>
      )}
    </div>
  );
}
