"use client";
import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar as CalendarComponent } from "../ui/calendar";
import { fetchApi, uploadFile } from '../../utils/apiHelper';
import { toast } from "sonner";
import { DOCUMENT_TEMPLATES } from "../../utils/claimConstants";
import { Plus, FolderOpen, FileText, Calendar, X, CheckCircle } from "lucide-react";

function getField(obj: any, ...keys: string[]): any {
  if (!obj) return "";
  for (var k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return "";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId?: number | null;
  clientId?: number | null;
  contracts?: any[];
  onTaskCreated?: () => void;
}

export function ClientTaskCreationModal({ open, onOpenChange, tenantId, clientId, contracts, onTaskCreated }: Props) {

  // Only show non-archived contracts
  var safeContracts = (contracts || []).filter(function(c: any) {
    return !c.isArchived && !c.is_archived;
  });

  var [selectedContractId, setSelectedContractId] = useState("");
  var [title, setTitle] = useState("");
  var [priority, setPriority] = useState("medium");
  var [notes, setNotes] = useState("");
  var [deadline, setDeadline] = useState<Date | undefined>(undefined);
  var [deadlineText, setDeadlineText] = useState("");
  var [docs, setDocs] = useState<any[]>([]);
  var [customDocName, setCustomDocName] = useState("");
  var [saving, setSaving] = useState(false);

  var resetForm = useCallback(function() {
    setSelectedContractId("");
    setTitle("");
    setPriority("medium");
    setNotes("");
    setDeadline(undefined);
    setDeadlineText("");
    setDocs([]);
    setCustomDocName("");
    setSaving(false);
  }, []);

  var handleClose = useCallback(function() {
    if (saving) return; // don't close while submitting
    resetForm();
    onOpenChange(false);
  }, [saving, resetForm, onOpenChange]);

  // Prevent Dialog from closing due to internal interactions
  var handleOpenChange = useCallback(function(newOpen: boolean) {
    if (!newOpen) {
      handleClose();
    }
  }, [handleClose]);

  var addDocTemplate = function(templateKey: string) {
    var tmpl = (DOCUMENT_TEMPLATES as any[]).find(function(d) { return d.key === templateKey; });
    if (!tmpl) return;
    setDocs(function(prev) {
      return prev.concat([{ file: null, name: tmpl.label, description: tmpl.label, templateKey: templateKey, id: Date.now() + Math.random() }]);
    });
  };

  var removeDocTemplate = function(templateKey: string) {
    setDocs(function(prev) { return prev.filter(function(d) { return d.templateKey !== templateKey; }); });
  };

  var addCustomDoc = function() {
    if (!customDocName.trim()) return;
    var name = customDocName.trim();
    setDocs(function(prev) {
      return prev.concat([{ file: null, name: name, description: name, templateKey: "custom_" + Date.now(), id: Date.now() }]);
    });
    setCustomDocName("");
  };

  var handleFileForDoc = function(idx: number, e: any) {
    var file = e.target.files ? e.target.files[0] : null;
    if (!file) return;
    setDocs(function(prev) {
      var updated = prev.slice();
      updated[idx] = Object.assign({}, updated[idx], { file: file, name: file.name });
      return updated;
    });
    e.target.value = "";
  };

  var removeDoc = function(idx: number) {
    setDocs(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); });
  };

  var parseDateText = function(text: string) {
    setDeadlineText(text);
    var parts = text.split(".");
    if (parts.length === 3) {
      var d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y) && y > 2000) {
        var dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) setDeadline(dt);
      }
    }
  };

  var formatDate = function(d: Date) {
    return d.getDate().toString().padStart(2, "0") + "." + (d.getMonth() + 1).toString().padStart(2, "0") + "." + d.getFullYear();
  };

  var handleSubmit = async function() {
    if (!selectedContractId) {
      toast.error("Müqavilə seçin");
      return;
    }
    if (!title.trim()) {
      toast.error("Tapşırığın adı tələb olunur");
      return;
    }
    if (!deadline) {
      toast.error("Son tarix (deadline) tələb olunur");
      return;
    }
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (deadline < todayStart) {
      toast.error("Son tarix bugünkü tarixdən əvvəl ola bilməz");
      return;
    }

    setSaving(true);

    try {
      // Encode documents
      var encodedDocs: any[] = [];
      for (var i = 0; i < docs.length; i++) {
        if (!docs[i].file) continue;
        try {
          var up: any = await uploadFile(docs[i].file, docs[i].name);
          encodedDocs.push({
            name: docs[i].name,
            description: docs[i].description || "",
            url: up.url,
            file_type: docs[i].file.type,
            file_size: docs[i].file.size,
            uploaded_by: "client",
            uploaded_at: new Date().toISOString()
          });
        } catch (_) {}
      }

      var body: any = {
        title: title.trim(),
        // task_number göndərilmir — server tərəfdən sətrin öz ID-sinə görə
        // HƏMIŞƏ unikal olan bir nömrə təyin edilir (əvvəllər Math.random()
        // ilə 4 rəqəm generasiya olunurdu, 9000 mümkün dəyər arasında
        // toqquşma riski var idi).
        contract_id: Number(selectedContractId),
        status: "tehkim_gozleyir",
        priority: priority,
      };

      // client_id is required by backend (not null)
      if (clientId) body.client_id = Number(clientId);
      if (notes.trim()) body.notes = notes.trim();
      if (deadline) body.deadline = deadline.toISOString();
      if (encodedDocs.length > 0) body.document_checklist = JSON.stringify(encodedDocs);

      var created: any = await fetchApi("/tasks", { method: "POST", body: JSON.stringify(body) });
      var taskNumber = (created && (created.task_number || created.taskNumber)) || '';

      toast.success("Tapşırıq " + (taskNumber ? taskNumber + " " : "") + "uğurla yaradıldı");
      resetForm();
      onOpenChange(false);
      if (onTaskCreated) onTaskCreated();

    } catch (err: any) {
      var msg = err?.message || "Xəta baş verdi";
      toast.error("Xəta: " + msg);
      // Do NOT close modal on error — let user retry or fix
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onPointerDownOutside={function(e) { e.preventDefault(); }}
        onInteractOutside={function(e) { e.preventDefault(); }}
        onEscapeKeyDown={function(e) { if (saving) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />Yeni tapşırıq
          </DialogTitle>
          <DialogDescription>Müqavilə seçin və sənədləri yükləyin</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-5 pr-1">

          {/* 1. Müqavilə seçimi */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <FolderOpen className="h-4 w-4" />Müqavilə seçin *
            </Label>
            {safeContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">Aktiv müqavilə yoxdur</p>
            ) : (
              <div className="space-y-2">
                {safeContracts.map(function(c: any) {
                  var cId = String(c.id);
                  var isSelected = selectedContractId === cId;
                  var cTitle = getField(c, "title", "name") || ("Müqavilə #" + cId);
                  return (
                    <Card
                      key={cId}
                      className={"cursor-pointer transition-all " + (isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "hover:shadow-sm")}
                      onClick={function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedContractId(cId);
                      }}
                    >
                      <CardContent className="p-3 flex items-center justify-between">
                        <p className="text-sm font-medium">{cTitle}</p>
                        {isSelected && <CheckCircle className="h-5 w-5 text-blue-600 shrink-0" />}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 1b. Tapşırığın adı */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              Tapşırığın adı *
            </Label>
            <Input
              className="h-9"
              placeholder="Tapşırığın adını daxil edin"
              value={title}
              onChange={function(e) { setTitle(e.target.value); }}
            />
          </div>

          {/* 2. Sənədlər */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4" />Sənədlər (ixtiyari)
            </Label>
            <p className="text-[10px] text-muted-foreground mb-2">Bir sənəd növünə birdən çox fayl əlavə etmək üçün üzərinə bir neçə dəfə klikləyin, və ya aşağıdan bir neçə faylı eyni anda seçib birbaşa yükləyin</p>

            <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1 bg-muted/20 mb-3">
              {(DOCUMENT_TEMPLATES as any[]).filter(function(t) { return t.key !== "diger"; }).map(function(tmpl) {
                var count = docs.filter(function(d) { return d.templateKey === tmpl.key; }).length;
                return (
                  <div
                    key={tmpl.key}
                    className={"flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all " + (count > 0 ? "bg-green-100 border border-green-300" : "hover:bg-muted/50")}
                    onClick={function(e) {
                      e.preventDefault();
                      e.stopPropagation();
                      addDocTemplate(tmpl.key);
                    }}
                  >
                    <div className={"w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 " + (count > 0 ? "border-green-600 bg-green-600" : "border-gray-300")}>
                      {count > 0 && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm">{tmpl.label}{count > 0 ? " (" + count + ")" : ""}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mb-3">
              <Input
                className="flex-1 h-8 text-sm"
                placeholder="Digər sənəd adı daxil edin"
                value={customDocName}
                onChange={function(e) { setCustomDocName(e.target.value); }}
                onKeyDown={function(e) { if (e.key === "Enter") { e.preventDefault(); addCustomDoc(); } }}
              />
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={addCustomDoc} disabled={!customDocName.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" />Əlavə et
              </Button>
            </div>

            <label className="flex items-center gap-2 p-2 mb-3 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">Bir neçə faylı eyni anda seçib yükləyin</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={function(e) {
                  var files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) {
                    setDocs(function(prev) {
                      var added = files.map(function(f: any, i: number) {
                        return { file: f, name: f.name, description: f.name, templateKey: "custom_" + Date.now() + "_" + i, id: Date.now() + i + Math.random() };
                      });
                      return prev.concat(added);
                    });
                    e.target.value = "";
                  }
                }}
              />
            </label>

            {docs.length > 0 && (
              <div className="space-y-2">
                {docs.map(function(doc: any, idx: number) {
                  return (
                    <div key={doc.id} className="flex items-start gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                      <FileText className="h-4 w-4 text-green-600 shrink-0 mt-1" />
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-medium text-green-800">{doc.description || doc.name}</p>
                        {doc.file ? (
                          <p className="text-[10px] text-muted-foreground">{doc.file.name} ({(doc.file.size / 1024).toFixed(0)} KB)</p>
                        ) : (
                          <Input type="file" className="text-[10px] h-7 cursor-pointer" onChange={function(e) { handleFileForDoc(idx, e); }} />
                        )}
                      </div>
                      <button type="button" className="text-red-400 shrink-0 mt-1 hover:text-red-600" onClick={function(e) { e.preventDefault(); e.stopPropagation(); removeDoc(idx); }}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Son tarix */}
          <div>
            <Label className="text-xs flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />Son tarix *
            </Label>
            <div className="flex gap-1.5 mt-1">
              <Input
                className="flex-1 h-9"
                placeholder="gg.aa.iiii"
                value={deadlineText}
                onChange={function(e) { parseDateText(e.target.value); }}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-9 h-9 p-0">
                    <Calendar className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={deadline}
                    onSelect={function(d) { if (d) { setDeadline(d); setDeadlineText(formatDate(d)); } }}
                    disabled={function(d: Date) { var t = new Date(); t.setHours(0, 0, 0, 0); return d < t; }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* 4. Prioritet */}
          <div>
            <Label className="text-xs">Prioritet</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Aşağı</SelectItem>
                <SelectItem value="medium">Orta</SelectItem>
                <SelectItem value="high">Yüksək</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 5. Qeyd */}
          <div>
            <Label className="text-xs">Qeyd</Label>
            <textarea
              className="w-full border rounded-lg p-2 text-sm min-h-[50px] mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={notes}
              onChange={function(e) { setNotes(e.target.value); }}
              placeholder="Əlavə qeydlər (ixtiyari)"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={saving}>
            Ləğv et
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedContractId || !title.trim() || !deadline || saving}
            onClick={handleSubmit}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {saving ? "Göndərilir..." : "Tapşırıq yarat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}