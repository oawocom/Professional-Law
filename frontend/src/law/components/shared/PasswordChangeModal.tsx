"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { fetchApi } from "../../utils/apiHelper";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Save } from "lucide-react";

export function PasswordChangeModal({ open, onOpenChange }) {
  var [current, setCurrent] = useState("");
  var [newPwd, setNewPwd] = useState("");
  var [confirm, setConfirm] = useState("");
  var [showCurrent, setShowCurrent] = useState(false);
  var [showNew, setShowNew] = useState(false);
  var [saving, setSaving] = useState(false);

  var resetForm = function() { setCurrent(""); setNewPwd(""); setConfirm(""); };

  var handleSubmit = async function() {
    if (!current || !newPwd) { toast.error("Bütün xanaları doldurun"); return; }
    if (newPwd.length < 6) { toast.error("Şifrə minimum 6 simvol olmalıdır"); return; }
    if (newPwd !== confirm) { toast.error("Şifrələr uyğun gəlmir"); return; }
    setSaving(true);
    try {
      await fetchApi("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: newPwd }),
      });
      toast.success("Şifrə uğurla dəyişdirildi");
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      // BUG DÜZƏLİŞİ (2026-09): əvvəllər bütün xətalar (şəbəkə problemi, server
      // xətası, sessiya bitməsi və s. daxil olmaqla) həmişə "Cari şifrə yanlışdır"
      // kimi göstərilirdi — bu, real səbəbi gizlədib istifadəçini çaşdıra bilərdi.
      // Backend-in qaytardığı konkret mesaj oxunub uyğun tərcümə göstərilir.
      var backendMsg = "";
      try { backendMsg = JSON.parse(String(err && err.message || "")).error || ""; } catch (e) { /* JSON deyil */ }
      var azMessages: Record<string, string> = {
        "Current password is incorrect": "Cari şifrə yanlışdır",
        "Current and new password required": "Bütün xanaları doldurun",
        "User not authenticated": "Sessiyanız bitib, yenidən daxil olun",
        "User not found": "İstifadəçi tapılmadı",
      };
      toast.error("Xəta: " + (azMessages[backendMsg] || backendMsg || "Şifrə dəyişdirilmədi, yenidən cəhd edin"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={function(o) { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Şifrəni dəyiş</DialogTitle>
          <DialogDescription>Hesabınızın təhlükəsizliyi üçün</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Cari şifrə</Label>
            <div className="relative">
              <Input type={showCurrent ? "text" : "password"} value={current} onChange={function(e) { setCurrent(e.target.value); }} placeholder="Cari şifrənizi daxil edin" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={function() { setShowCurrent(!showCurrent); }}>
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Yeni şifrə</Label>
            <div className="relative">
              <Input type={showNew ? "text" : "password"} value={newPwd} onChange={function(e) { setNewPwd(e.target.value); }} placeholder="Yeni şifrə (min. 6 simvol)" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={function() { setShowNew(!showNew); }}>
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Yeni şifrəni təsdiqlə</Label>
            <Input type="password" value={confirm} onChange={function(e) { setConfirm(e.target.value); }} placeholder="Yeni şifrəni təkrar daxil edin" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={function() { resetForm(); onOpenChange(false); }}>Ləğv et</Button>
            <Button size="sm" disabled={saving || !current || !newPwd || !confirm} onClick={handleSubmit}>
              <Save className="h-4 w-4 mr-1.5" />{saving ? "Dəyişdirilir..." : "Dəyişdir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}