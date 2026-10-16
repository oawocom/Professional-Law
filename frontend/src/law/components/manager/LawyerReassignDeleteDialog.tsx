'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatDate } from '../../utils/dateFormat';

// Vəkil silinərkən onun hələ son statusa çatdırmadığı tapşırıqları göstərir və
// hər biri üçün yeni vəkil seçilməsini tələb edir — seçim tamamlanmadan silmə
// düyməsi aktiv olmur.
interface LawyerReassignDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lawyer: any;
  pendingTasks: any[];
  otherLawyers: any[];
  onConfirm: (reassignments: Record<string, number>) => Promise<void>;
}

export function LawyerReassignDeleteDialog({ open, onOpenChange, lawyer, pendingTasks, otherLawyers, onConfirm }: LawyerReassignDeleteDialogProps) {
  var [assignments, setAssignments] = useState<Record<string, string>>({});
  var [submitting, setSubmitting] = useState(false);

  useEffect(function() { if (open) setAssignments({}); }, [open, lawyer]);

  var allAssigned = pendingTasks.length > 0 && pendingTasks.every(function(t) { return !!assignments[String(t.id)]; });

  var handleConfirm = async function() {
    if (!allAssigned) return;
    setSubmitting(true);
    try {
      var reassignments: Record<string, number> = {};
      Object.keys(assignments).forEach(function(k) { reassignments[k] = Number(assignments[k]); });
      await onConfirm(reassignments);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-5 w-5" />Tamamlanmamış tapşırıqlar var</DialogTitle>
          <DialogDescription>
            <strong>{lawyer?.name}</strong> hələ {pendingTasks.length} tamamlanmamış tapşırığa təhkim olunub. Silməzdən əvvəl hər biri üçün yeni vəkil seçin.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
          {pendingTasks.map(function(t: any) {
            var title = t.title || t.Title || ('Tapşırıq #' + t.id);
            return (
              <div key={t.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{title}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">{t.status}</Badge>
                </div>
                {t.deadline && <p className="text-[11px] text-muted-foreground">Son tarix: {formatDate(t.deadline)}</p>}
                <div className="space-y-1">
                  <Label className="text-xs">Yeni vəkil</Label>
                  <Select value={assignments[String(t.id)] || ''} onValueChange={function(v) { setAssignments(Object.assign({}, assignments, { [String(t.id)]: v })); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Vəkil seçin" /></SelectTrigger>
                    <SelectContent>
                      {otherLawyers.map(function(l: any) {
                        return <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={function() { onOpenChange(false); }} disabled={submitting}>Ləğv et</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!allAssigned || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Yenidən təhkim et və sil
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
