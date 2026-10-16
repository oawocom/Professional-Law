"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import { Settings, Monitor, BarChart3, Bell, Users, Server, Save, RotateCcw } from "lucide-react";

var STORAGE_KEY = "law_system_settings";

var DEFAULT_SETTINGS = {
  theme: "light", accentColor: "blue", compactMode: false, fontSize: "medium",
  defaultView: "clients", itemsPerPage: 10, autoRefresh: true, refreshInterval: 30,
  showStats: true, showRecentActivity: true,
  emailNotifications: true, pushNotifications: true, notificationSound: true,
  highPriorityOnly: false, notificationFrequency: "instant",
  quietHours: false, quietStart: "22:00", quietEnd: "08:00",
  workloadBalance: true, maxTasksPerLawyer: 10, approvalRequired: true,
  language: "az", timezone: "Asia/Baku", dateFormat: "dd/mm/yyyy",
  currency: "AZN", backupFrequency: "daily", maintenanceMode: false, debugMode: false,
};

function loadSettings() {
  try { var saved = localStorage.getItem(STORAGE_KEY); if (saved) return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(saved)); } catch {}
  return Object.assign({}, DEFAULT_SETTINGS);
}

export function SystemSettingsModal({ open, onOpenChange }) {
  var [settings, setSettings] = useState(DEFAULT_SETTINGS);
  var [dirty, setDirty] = useState(false);

  useEffect(function() { if (open) setSettings(loadSettings()); }, [open]);

  var handleChange = function(key, value) {
    setSettings(function(prev) { var n = Object.assign({}, prev); n[key] = value; return n; });
    setDirty(true);
  };

  var handleSave = function() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      if (settings.theme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      document.documentElement.style.fontSize = settings.fontSize === "small" ? "14px" : settings.fontSize === "large" ? "18px" : "16px";
      toast.success("Tənzimləmələr yadda saxlanıldı");
      setDirty(false);
    } catch { toast.error("Xəta"); }
  };

  var handleReset = function() {
    setSettings(Object.assign({}, DEFAULT_SETTINGS));
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.classList.remove("dark");
    document.documentElement.style.fontSize = "16px";
    toast.info("Tənzimləmələr sıfırlandı");
    setDirty(true);
  };

  var colors = [
    { value: "blue", label: "Mavi", cls: "bg-blue-500" },
    { value: "green", label: "Yaşıl", cls: "bg-green-500" },
    { value: "purple", label: "Bənövşəyi", cls: "bg-purple-500" },
    { value: "orange", label: "Narıncı", cls: "bg-orange-500" },
    { value: "red", label: "Qırmızı", cls: "bg-red-500" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" data-modal="system-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Sistem tənzimləmələri</DialogTitle>
          <DialogDescription>Dashboard və sistem parametrlərini konfiqurasiya edin</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-5 shrink-0">
            <TabsTrigger value="appearance" className="text-xs flex items-center gap-1"><Monitor className="h-3 w-3" />Görünüş</TabsTrigger>
            <TabsTrigger value="dashboard" className="text-xs flex items-center gap-1"><BarChart3 className="h-3 w-3" />Dashboard</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs flex items-center gap-1"><Bell className="h-3 w-3" />Bildirişlər</TabsTrigger>
            <TabsTrigger value="users" className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />İstifadəçilər</TabsTrigger>
            <TabsTrigger value="system" className="text-xs flex items-center gap-1"><Server className="h-3 w-3" />Sistem</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0 mt-3">
            <TabsContent value="appearance" className="space-y-4 pr-1">
              <Card><CardContent className="p-4 space-y-4">
                <div><Label>Tema</Label>
                  <Select value={settings.theme} onValueChange={function(v) { handleChange("theme", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="light">Açıq tema</SelectItem><SelectItem value="dark">Qaranlıq tema</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Vurqu rəngi</Label>
                  <div className="flex gap-2 mt-1">{colors.map(function(c) { return (
                    <button key={c.value} className={"flex items-center gap-2 px-3 py-2 rounded-lg border transition-all " + (settings.accentColor === c.value ? "ring-2 ring-blue-500 bg-muted" : "")} onClick={function() { handleChange("accentColor", c.value); }}>
                      <div className={"w-4 h-4 rounded-full " + c.cls} /><span className="text-xs">{c.label}</span>
                    </button>
                  ); })}</div></div>
                <div><Label>Şrift ölçüsü</Label>
                  <Select value={settings.fontSize} onValueChange={function(v) { handleChange("fontSize", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="small">Kiçik</SelectItem><SelectItem value="medium">Orta</SelectItem><SelectItem value="large">Böyük</SelectItem></SelectContent>
                  </Select></div>
                <ToggleRow label="Sıx rejim" desc="Daha çox məlumat göstərmək üçün" checked={settings.compactMode} onChange={function(v) { handleChange("compactMode", v); }} />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-4 pr-1">
              <Card><CardContent className="p-4 space-y-4">
                <div><Label>İlkin görünüş</Label>
                  <Select value={settings.defaultView} onValueChange={function(v) { handleChange("defaultView", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="clients">Müştərilər</SelectItem><SelectItem value="tasks">Tapşırıqlar</SelectItem><SelectItem value="contracts">Müqavilələr</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Səhifə başına element</Label>
                  <Select value={String(settings.itemsPerPage)} onValueChange={function(v) { handleChange("itemsPerPage", parseInt(v)); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Yeniləmə intervalı (saniyə)</Label>
                  <Input type="number" value={settings.refreshInterval} onChange={function(e) { handleChange("refreshInterval", parseInt(e.target.value) || 30); }} /></div>
                <ToggleRow label="Avtomatik yeniləmə" desc="Məlumatları avtomatik yenilə" checked={settings.autoRefresh} onChange={function(v) { handleChange("autoRefresh", v); }} />
                <ToggleRow label="Statistikaları göstər" desc="Ana səhifədə statistik kartlar" checked={settings.showStats} onChange={function(v) { handleChange("showStats", v); }} />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4 pr-1">
              <Card><CardContent className="p-4 space-y-4">
                <ToggleRow label="Email bildirişləri" desc="Email ilə bildiriş al" checked={settings.emailNotifications} onChange={function(v) { handleChange("emailNotifications", v); }} />
                <ToggleRow label="Push bildirişləri" desc="Brauzer bildirişləri" checked={settings.pushNotifications} onChange={function(v) { handleChange("pushNotifications", v); }} />
                <ToggleRow label="Bildiriş səsi" desc="Yeni bildiriş üçün səs" checked={settings.notificationSound} onChange={function(v) { handleChange("notificationSound", v); }} />
                <ToggleRow label="Yalnız yüksək prioritet" desc="Yalnız vacib bildirişlər" checked={settings.highPriorityOnly} onChange={function(v) { handleChange("highPriorityOnly", v); }} />
                <div><Label>Bildiriş tezliyi</Label>
                  <Select value={settings.notificationFrequency} onValueChange={function(v) { handleChange("notificationFrequency", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="instant">Dərhal</SelectItem><SelectItem value="hourly">Saatlıq</SelectItem><SelectItem value="daily">Günlük</SelectItem></SelectContent>
                  </Select></div>
                <ToggleRow label="Sakit saatlar" desc="Müəyyən saatlarda bildiriş göndərmə" checked={settings.quietHours} onChange={function(v) { handleChange("quietHours", v); }} />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-4 pr-1">
              <Card><CardContent className="p-4 space-y-4">
                <ToggleRow label="İş yükü balansı" desc="Vəkillər arasında iş bölgüsü" checked={settings.workloadBalance} onChange={function(v) { handleChange("workloadBalance", v); }} />
                <div><Label>Vəkil başına maks. tapşırıq</Label>
                  <Input type="number" value={settings.maxTasksPerLawyer} onChange={function(e) { handleChange("maxTasksPerLawyer", parseInt(e.target.value) || 10); }} min="1" max="100" /></div>
                <ToggleRow label="Menecer təsdiqi" desc="Mühüm əməliyyatlar üçün təsdiq" checked={settings.approvalRequired} onChange={function(v) { handleChange("approvalRequired", v); }} />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-4 pr-1">
              <Card><CardContent className="p-4 space-y-4">
                <div><Label>Dil</Label>
                  <Select value={settings.language} onValueChange={function(v) { handleChange("language", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="az">Azərbaycan dili</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="ru">Русский</SelectItem><SelectItem value="tr">Türkçe</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Saat qurşağı</Label>
                  <Select value={settings.timezone} onValueChange={function(v) { handleChange("timezone", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Asia/Baku">Bakı (GMT+4)</SelectItem><SelectItem value="Europe/Moscow">Moskva (GMT+3)</SelectItem><SelectItem value="Europe/Istanbul">İstanbul (GMT+3)</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Tarix formatı</Label>
                  <Select value={settings.dateFormat} onValueChange={function(v) { handleChange("dateFormat", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="dd/mm/yyyy">GG/AA/İİİİ</SelectItem><SelectItem value="yyyy-mm-dd">İİİİ-AA-GG</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Valyuta</Label>
                  <Select value={settings.currency} onValueChange={function(v) { handleChange("currency", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="AZN">AZN (Azərbaycan manatı)</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                  </Select></div>
                <div><Label>Ehtiyat nüsxə tezliyi</Label>
                  <Select value={settings.backupFrequency} onValueChange={function(v) { handleChange("backupFrequency", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="hourly">Saatlıq</SelectItem><SelectItem value="daily">Günlük</SelectItem><SelectItem value="weekly">Həftəlik</SelectItem></SelectContent>
                  </Select></div>
                <ToggleRow label="Baxım rejimi" desc="Sistemi müvəqqəti bağla" checked={settings.maintenanceMode} onChange={function(v) { handleChange("maintenanceMode", v); }} />
                <ToggleRow label="Debug rejimi" desc="Əlavə log məlumatları" checked={settings.debugMode} onChange={function(v) { handleChange("debugMode", v); }} />
              </CardContent></Card>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-between pt-3 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="h-4 w-4 mr-1.5" />Sıfırla</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={function() { onOpenChange(false); }}>Ləğv et</Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty}><Save className="h-4 w-4 mr-1.5" />Saxla</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5"><Label>{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}