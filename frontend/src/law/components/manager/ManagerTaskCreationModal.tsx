"use client";
import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar as CalendarComponent } from "../ui/calendar";
import { fetchApi, uploadFile } from '../../utils/apiHelper';
import { toast } from "sonner";
import { Plus, User, FolderOpen, Briefcase, Calendar, CheckCircle, FileText, DollarSign, Upload, X, Tag } from "lucide-react";

function g(obj, ...keys) {
  if (!obj) return "";
  for (var k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k]; }
  return "";
}

export function ManagerTaskCreationModal({ open, onOpenChange, clients, contracts, lawyers, tenantId, onCreated }) {
  var safeClients = clients || [];
  var safeContracts = contracts || [];

  var [step, setStep] = useState(1);
  // İSTƏK (2026-09, istifadəçi bildirişi: "müştəri seçərkən search funksiyası
  // olsa daha yaxşı olar") — müştəri siyahısı böyüdükcə sadə açılan siyahıda
  // (Select) axtarmaq çətinləşir, ona görə axtarış qutusu + filtrələnmiş kart
  // siyahısı əlavə olundu (aşağıdakı "Müqavilə" seçimi ilə eyni üslub).
  var [clientSearch, setClientSearch] = useState("");
  var [selectedClientId, setSelectedClientId] = useState("");
  var [selectedContractId, setSelectedContractId] = useState("");
  var [title, setTitle] = useState("");
  var [description, setDescription] = useState("");
  var [priority, setPriority] = useState("medium");
  var [category, setCategory] = useState("");
  var [deadline, setDeadline] = useState(undefined);
  var [deadlineText, setDeadlineText] = useState("");
  var [claimDeadline, setClaimDeadline] = useState(undefined);
  var [claimDeadlineText, setClaimDeadlineText] = useState("");
  // Tərəflərin subyektliliyi
  var [clientRole, setClientRole] = useState("iddiacı");
  var [clientRoleCustom, setClientRoleCustom] = useState("");
  var [oppositeRole, setOppositeRole] = useState("cavabdeh");
  var [oppositeRoleCustom, setOppositeRoleCustom] = useState("");
  var [oppositePartyName, setOppositePartyName] = useState("");
  // İddia məbləğləri
  var [claimAmounts, setClaimAmounts] = useState([{ label: "Əsas borc", amount: 0 }]);
  // Sənədlər
  var [docs, setDocs] = useState([]);
  var [customDocName, setCustomDocName] = useState("");
  var [saving, setSaving] = useState(false);
  var [taskTypes, setTaskTypes] = useState([]);
  var [docCategories, setDocCategories] = useState([]);
  var [partyRoles, setPartyRoles] = useState([]);

  useEffect(function() {
    if (!open) return;
    fetchApi("/library?type=task_category")
      .then(function(d) { setTaskTypes(Array.isArray(d) ? d : []); })
      .catch(function() {
        fetchApi("/task-types").then(function(d) { setTaskTypes(d || []); }).catch(function() {});
      });
    fetchApi("/library?type=document_category")
      .then(function(d) { setDocCategories(Array.isArray(d) ? d : []); })
      .catch(function() { setDocCategories([]); });
    fetchApi("/library?type=party_role")
      .then(function(d) { setPartyRoles(Array.isArray(d) ? d : []); })
      .catch(function() { setPartyRoles([]); });
  }, [open]);

  var clientContracts = useMemo(function() {
    if (!selectedClientId) return [];
    return safeContracts.filter(function(c) { return String(g(c, "client_id", "clientId")) === selectedClientId && !c.isArchived && !c.is_archived; });
  }, [safeContracts, selectedClientId]);

  var filteredClients = useMemo(function() {
    var active = safeClients.filter(function(c) { return !c.isArchived && !c.is_archived; });
    var q = clientSearch.trim().toLowerCase();
    if (!q) return active;
    return active.filter(function(c) {
      var name = String(c.name || "").toLowerCase();
      var company = String(c.company_name || "").toLowerCase();
      var phone = String(c.phone || "").toLowerCase();
      return name.indexOf(q) >= 0 || company.indexOf(q) >= 0 || phone.indexOf(q) >= 0;
    });
  }, [safeClients, clientSearch]);

  var selectedClient = safeClients.find(function(c) { return String(c.id) === selectedClientId; });
  var selectedContract = safeContracts.find(function(c) { return String(c.id) === selectedContractId; });

  var resetForm = function() {
    setStep(1); setClientSearch(""); setSelectedClientId(""); setSelectedContractId("");
    setTitle(""); setDescription(""); setPriority("medium"); setCategory("");
    setDeadline(undefined); setDeadlineText(""); setClaimDeadline(undefined); setClaimDeadlineText("");
    setClientRole("iddiacı"); setClientRoleCustom(""); setOppositeRole("cavabdeh");
    setOppositeRoleCustom(""); setOppositePartyName("");
    setClaimAmounts([{ label: "Əsas borc", amount: 0 }]); setDocs([]);
  };

  var handleSubmit = async function() {
    if (!selectedContractId || !title.trim()) { toast.error("Müqavilə və başlıq tələb olunur"); return; }
    if (!deadline) { toast.error("Son tarix (deadline) tələb olunur"); return; }
    var todayStart = new Date(); todayStart.setHours(0,0,0,0);
    if (deadline < todayStart) { toast.error("Son tarix bugünkü tarixdən əvvəl ola bilməz"); return; }
    setSaving(true);
    try {
      var encodedDocs = [];
      for (var i = 0; i < docs.length; i++) {
        try {
          var up = await uploadFile(docs[i].file, docs[i].name || docs[i].file.name);
          var isCustomDoc=!docs[i].categoryId;var docName=isCustomDoc?("Digər — "+(docs[i].name||docs[i].file.name)):docs[i].name;encodedDocs.push({ name: docName, description: docs[i].description||docName, doc_category_id: docs[i].categoryId||null, url: up.url, file_type: docs[i].file.type, file_size: docs[i].file.size, uploaded_by: "manager", uploaded_at: new Date().toISOString() });
        } catch (e) {}
      }
      var validClaims = claimAmounts.filter(function(c) { return c.amount > 0 && c.label.trim(); });
      var totalClaim = validClaims.reduce(function(s, c) { return s + c.amount; }, 0);
      var body = {
        title: title.trim(), description: description.trim(), contract_id: Number(selectedContractId),
        client_id: selectedClient ? Number(selectedClient.id) : undefined,
        // Vəkil təhkimi bu pəncərədən götürülüb — tapşırıq "yeni" statusunda
        // yaradılır və vəkil sonradan Nəzarət panelindən təhkim olunur.
        priority: priority, category: category,
        respondent_name: oppositePartyName.trim(),
        deadline: deadline ? deadline.toISOString() : undefined,
        claim_deadline: claimDeadline ? claimDeadline.toISOString() : undefined,
        notes: JSON.stringify({
          client_role: clientRole === "digər" ? clientRoleCustom : clientRole,
          opposite_role: oppositeRole === "digər" ? oppositeRoleCustom : oppositeRole,
          opposite_party_name: oppositePartyName,
        }),
      };
      if (validClaims.length > 0) { body.claim_amounts = JSON.stringify(validClaims); body.total_claim = totalClaim; }
      if (encodedDocs.length > 0) { body.document_checklist = JSON.stringify(encodedDocs); }
      await fetchApi("/tasks", { method: "POST", body: JSON.stringify(body) });
      toast.success("Tapşırıq yaradıldı. Vəkili Nəzarət panelindən təhkim edə bilərsiniz.");
      resetForm(); onOpenChange(false); if (onCreated) onCreated();
    } catch (err) { toast.error("Xəta baş verdi"); }
    finally { setSaving(false); }
  };

  var parseDateText = function(text, setTextFn, setDateFn) {
    setTextFn(text);
    var parts = text.split(".");
    if (parts.length === 3) { var d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]); if (!isNaN(d) && !isNaN(m) && !isNaN(y) && y > 2000) { var dt = new Date(y, m, d); if (!isNaN(dt.getTime())) setDateFn(dt); } }
  };

  var formatDate = function(d) { if (!d) return ""; return d.getDate().toString().padStart(2,"0")+"."+(d.getMonth()+1).toString().padStart(2,"0")+"."+d.getFullYear(); };

  var ROLE_OPTIONS = partyRoles.length > 0
    ? partyRoles.map(function(r){ return r.name; }).concat(["digər"])
    : ["İddiaçı", "Cavabdeh", "Ərizəçi", "Maraqlı şəxs", "Üçüncü şəxs", "digər"];

  return (
    <Dialog open={open} onOpenChange={function(o) { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Yeni tapşırıq yarat</DialogTitle>
          <DialogDescription>Tapşırıq yaradın — vəkili sonradan Nəzarət panelindən təhkim edəcəksiniz</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 shrink-0">
          {[1,2,3].map(function(s) {
            var labels = ["Müştəri & Müqavilə", "Tapşırıq detalları", "Tərəflər"];
            return (<div key={s} className="flex items-center gap-2 flex-1"><div className={"w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold "+(step===s?"bg-blue-600 text-white":step>s?"bg-green-500 text-white":"bg-muted text-muted-foreground")}>{step>s?"✓":s}</div><span className="text-[10px] text-muted-foreground hidden sm:inline">{labels[s-1]}</span>{s<3&&<div className="flex-1 h-px bg-muted"/>}</div>);
          })}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">

          {step === 1 && (<div className="space-y-4">
            <div><Label className="flex items-center gap-2 mb-2"><User className="h-4 w-4" />Müştəri</Label>
              <Input
                className="mb-2 h-9 text-sm"
                placeholder="Müştəri adı, şirkət və ya telefon üzrə axtar..."
                value={clientSearch}
                onChange={function(e){ setClientSearch(e.target.value); }}
              />
              {selectedClient && !clientSearch && (
                <div className="flex items-center justify-between p-2.5 mb-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">{selectedClient.name}{selectedClient.company_name?" ("+selectedClient.company_name+")":""}</span>
                  <button type="button" className="text-xs text-blue-600 hover:underline" onClick={function(){setSelectedClientId("");setSelectedContractId("");}}>Dəyiş</button>
                </div>
              )}
              {(!selectedClientId || clientSearch) && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-lg p-1.5 bg-muted/10">
                  {filteredClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">Axtarışa uyğun müştəri tapılmadı</p>
                  ) : filteredClients.map(function(c){
                    var cId = String(c.id);
                    var isSel = selectedClientId === cId;
                    return (
                      <div
                        key={cId}
                        className={"flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors "+(isSel?"bg-blue-100 border border-blue-300":"hover:bg-muted/50 border border-transparent")}
                        onClick={function(){ setSelectedClientId(cId); setSelectedContractId(""); setClientSearch(""); }}
                      >
                        <span className="text-sm">{c.name}{c.company_name?" ("+c.company_name+")":""}</span>
                        {isSel && <CheckCircle className="h-4 w-4 text-blue-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {selectedClientId&&(<div><Label className="flex items-center gap-2 mb-2"><FolderOpen className="h-4 w-4" />Müqavilə</Label>
              {clientContracts.length===0?<p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">Bu müştərinin aktiv müqaviləsi yoxdur</p>:(
                <div className="space-y-2">{clientContracts.map(function(c){var cId=String(c.id);var isS=selectedContractId===cId;return(<Card key={cId} className={"cursor-pointer transition-all "+(isS?"ring-2 ring-blue-500 bg-blue-50":"hover:shadow-sm")} onClick={function(){setSelectedContractId(cId);}}>
                  <CardContent className="p-3 flex items-center justify-between"><div><p className="text-sm font-medium">{g(c,"title","name")||"Müqavilə #"+cId}</p><p className="text-xs text-muted-foreground">Kvota: {g(c,"tasks_used","tasksUsed")||0}/{g(c,"task_quota","taskQuota")||100}</p></div>{isS&&<CheckCircle className="h-5 w-5 text-blue-600"/>}</CardContent></Card>);})}</div>)}
            </div>)}
          </div>)}

          {step === 2 && (<div className="space-y-4">
            <div><Label>Başlıq *</Label><Input value={title} onChange={function(e){setTitle(e.target.value);}} placeholder="Tapşırığın adı" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kateqoriya</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger><SelectContent>{taskTypes.map(function(t){return <SelectItem key={t.id} value={t.name||String(t.id)}>{t.name}</SelectItem>;})}<SelectItem value="digər">Digər</SelectItem></SelectContent></Select></div>
              <div><Label>Prioritet</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Aşağı</SelectItem><SelectItem value="medium">Orta</SelectItem><SelectItem value="high">Yüksək</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Son tarix *</Label><div className="flex gap-1"><Input className="flex-1 h-8 text-sm" placeholder="gg.aa.iiii" value={deadlineText} onChange={function(e){parseDateText(e.target.value,setDeadlineText,setDeadline);}}/><Popover><PopoverTrigger asChild><Button variant="outline" className="w-8 h-8 p-0"><Calendar className="h-3.5 w-3.5"/></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><CalendarComponent mode="single" selected={deadline} onSelect={function(d){setDeadline(d);if(d)setDeadlineText(formatDate(d));}} disabled={function(d){var t=new Date();t.setHours(0,0,0,0);return d<t;}} initialFocus/></PopoverContent></Popover></div></div>
              <div><Label className="text-xs">İddia müddatətinin sonu</Label><div className="flex gap-1"><Input className="flex-1 h-8 text-sm" placeholder="gg.aa.iiii" value={claimDeadlineText} onChange={function(e){parseDateText(e.target.value,setClaimDeadlineText,setClaimDeadline);}}/><Popover><PopoverTrigger asChild><Button variant="outline" className="w-8 h-8 p-0"><Calendar className="h-3.5 w-3.5"/></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><CalendarComponent mode="single" selected={claimDeadline} onSelect={function(d){setClaimDeadline(d);if(d)setClaimDeadlineText(formatDate(d));}} initialFocus/></PopoverContent></Popover></div></div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Son tarix bugünkü tarixdən əvvəl seçilə bilməz</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5"/>İddia məbləğləri</Label><Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={function(){setClaimAmounts(claimAmounts.concat([{label:"",amount:0}]));}}>+ Əlavə</Button></div>
              {claimAmounts.map(function(c,idx){return(<div key={idx} className="flex gap-2"><Input className="flex-1 h-8 text-sm" placeholder="Növ" value={c.label} onChange={function(e){var u=claimAmounts.slice();u[idx]={label:e.target.value,amount:u[idx].amount};setClaimAmounts(u);}}/><Input className="w-28 h-8 text-sm" type="number" min="0" step="0.01" placeholder="0" value={c.amount||""} onChange={function(e){var raw=e.target.value.replace(/[^0-9.]/g,"");var n=Number(raw);var u=claimAmounts.slice();u[idx]={label:u[idx].label,amount:isNaN(n)||n<0?0:n};setClaimAmounts(u);}}/><span className="text-xs text-muted-foreground self-center">AZN</span>{claimAmounts.length>1&&<button className="text-red-400 text-xs" onClick={function(){setClaimAmounts(claimAmounts.filter(function(_,i){return i!==idx;}));}}>x</button>}</div>);})}
            </div>
            <div><Label>Təsvir</Label><textarea className="w-full border rounded-lg p-2 text-sm min-h-[60px] resize-none focus:ring-2 focus:ring-blue-200 focus:outline-none" value={description} onChange={function(e){setDescription(e.target.value);}} placeholder="Əlavə qeydlər..."/></div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><FileText className="h-3.5 w-3.5"/>Sənədlər</Label>
              <p className="text-[10px] text-muted-foreground">Bir sənəd növünə birdən çox fayl əlavə etmək üçün üzərinə bir neçə dəfə klikləyin, və ya aşağıdan bir neçə faylı eyni anda seçib birbaşa yükləyin</p>
              <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1 bg-muted/20">
                {docCategories.length > 0 ? docCategories.map(function(cat){
                  var catId=String(cat.id);
                  var catCount=docs.filter(function(d){return d.categoryId===catId;}).length;
                  return(
                  <div key={catId} className={"flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all "+(catCount>0?"bg-green-100 border border-green-300":"hover:bg-muted/50")} onClick={function(){
                    setDocs(docs.concat([{file:null,name:cat.name,description:cat.name,categoryId:catId,id:Date.now()+Math.random()}]));
                  }}>
                    <div className={"w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 "+(catCount>0?"border-green-600 bg-green-600":"border-gray-300")}>{catCount>0&&<CheckCircle className="h-2.5 w-2.5 text-white"/>}</div>
                    <span className="text-xs">{cat.name}{catCount>0?" ("+catCount+")":""}</span>
                  </div>);}) : <p className="text-xs text-muted-foreground p-1">Yüklənir...</p>}
              </div>
              <div className="flex gap-1.5">
                <Input className="flex-1 h-7 text-xs" placeholder="Digər sənəd adı" value={customDocName||""} onChange={function(e){setCustomDocName(e.target.value);}} />
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={function(){if((customDocName||"").trim()){setDocs(docs.concat([{file:null,name:customDocName.trim(),description:customDocName.trim(),categoryId:null,id:Date.now()+Math.random()}]));setCustomDocName("");}}} disabled={!(customDocName||"").trim()}>Əlavə et</Button>
              </div>
              <label className="flex items-center gap-2 p-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground flex-1">Bir neçə faylı eyni anda seçib yükləyin</span>
                <input type="file" multiple className="hidden" onChange={function(e){
                  var files=e.target.files?Array.from(e.target.files):[];
                  if(files.length>0){
                    var added=files.map(function(f,i){return {file:f,name:f.name,description:f.name,categoryId:null,id:Date.now()+i+Math.random()};});
                    setDocs(docs.concat(added));
                    e.target.value="";
                  }
                }}/>
              </label>
              {docs.length>0&&<Label className="flex items-center gap-1 mt-2"><FileText className="h-3.5 w-3.5"/>Seçilmiş sənədlər ({docs.length})</Label>}
              {docs.map(function(d,idx){return(<div key={d.id} className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded-lg"><FileText className="h-4 w-4 text-green-600 shrink-0 mt-1"/><div className="flex-1 space-y-1"><p className="text-xs font-medium truncate">{!d.categoryId?("Digər — "+d.name):(d.name)}</p>{d.file?<p className="text-[10px] text-muted-foreground">{d.file.name}</p>:<Input type="file" className="text-[10px] h-7 cursor-pointer" onChange={function(e){var f=e.target.files?e.target.files[0]:null;if(f){var u=docs.slice();u[idx]=Object.assign({},u[idx],{file:f,name:f.name});setDocs(u);e.target.value="";}}}/>}</div><button className="text-red-400 mt-1" onClick={function(){setDocs(docs.filter(function(_,i){return i!==idx;}));}}><X className="h-4 w-4"/></button></div>);})}
            </div>
          </div>)}

          {step === 3 && (<div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm space-y-1">
              <p><span className="text-muted-foreground">Müştəri:</span> <strong>{selectedClient?selectedClient.name:""}</strong></p>
              <p><span className="text-muted-foreground">Müqavilə:</span> <strong>{selectedContract?g(selectedContract,"title","name")||"#"+selectedContractId:""}</strong></p>
              <p><span className="text-muted-foreground">Tapşırıq:</span> <strong>{title}</strong></p>
            </div>

            {/* Tərəflərin subyektliliyi */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2"><User className="h-4 w-4"/>Tərəflərin subyektliliyi</Label>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                <p className="text-xs font-medium text-blue-800">Müştərimizin rolu</p>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_OPTIONS.map(function(opt){return(<Badge key={opt} variant={clientRole===opt?"default":"outline"} className={"cursor-pointer text-xs "+(clientRole===opt?"bg-blue-600":"")} onClick={function(){setClientRole(opt);}}>{opt === "digər" ? "Digər" : opt}</Badge>);})}
                </div>
                {clientRole==="digər"&&<Input placeholder="Rolu qeyd edin" value={clientRoleCustom} onChange={function(e){setClientRoleCustom(e.target.value);}} className="text-sm"/>}
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
                <p className="text-xs font-medium text-amber-800">Qarşı tərəfin rolu</p>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_OPTIONS.map(function(opt){return(<Badge key={opt} variant={oppositeRole===opt?"default":"outline"} className={"cursor-pointer text-xs "+(oppositeRole===opt?"bg-amber-600":"")} onClick={function(){setOppositeRole(opt);}}>{opt === "digər" ? "Digər" : opt}</Badge>);})}
                </div>
                {oppositeRole==="digər"&&<Input placeholder="Rolu qeyd edin" value={oppositeRoleCustom} onChange={function(e){setOppositeRoleCustom(e.target.value);}} className="text-sm"/>}
                <Input placeholder="Qarşı tərəfin adı" value={oppositePartyName} onChange={function(e){setOppositePartyName(e.target.value);}} className="text-sm"/>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              Tapşırıq vəkilsiz yaradılacaq — Nəzarət panelindən iş yükünə baxıb uyğun vəkili sonradan təhkim edə bilərsiniz.
            </p>
          </div>)}
        </div>

        <div className="flex items-center justify-between pt-3 border-t shrink-0">
          <div>{step>1&&<Button variant="outline" size="sm" onClick={function(){setStep(step-1);}}>Geri</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={function(){resetForm();onOpenChange(false);}}>Ləğv et</Button>
            {step<3?(
              <Button size="sm" disabled={step===1?(!selectedClientId||!selectedContractId):!title.trim()} onClick={function(){setStep(step+1);}}>Davam et</Button>
            ):(
              <Button size="sm" disabled={saving} onClick={handleSubmit}><CheckCircle className="h-4 w-4 mr-1.5"/>{saving?"Yaradılır...":"Tapşırıq yarat"}</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}