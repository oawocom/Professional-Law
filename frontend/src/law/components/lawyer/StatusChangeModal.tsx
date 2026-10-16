'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { fetchApi } from '../../utils/apiHelper';
import { toast } from 'sonner';
import { COMPLETION_OPTIONS, getStatusLabel, getStatusColor } from '../../utils/taskStatusConstants';
import { CheckCircle, Activity, ChevronRight, FileText, DollarSign, Send, MoreHorizontal } from 'lucide-react';

export function StatusChangeModal({ task, isOpen, onClose, onStatusChanged, tenantId, lawyerId }) {
  var [selectedStatus, setSelectedStatus] = useState('');
  var [completionResult, setCompletionResult] = useState('');
  var [claimType, setClaimType] = useState('valued'); // valued | unvalued
  var [resultAmounts, setResultAmounts] = useState([{ label: '', amount: 0 }]);
  var [unvaluedText, setUnvaluedText] = useState('');
  var [customStatusText, setCustomStatusText] = useState('');
  var [showOther, setShowOther] = useState(false);
  var [note, setNote] = useState('');
  var [saving, setSaving] = useState(false);
  var [libraryStatuses, setLibraryStatuses] = useState([]);

  // Kitabxanadan statusları yüklə
  useEffect(function() {
    if (!isOpen) return;
    fetchApi('/library?type=status')
      .then(function(d: any) { setLibraryStatuses(Array.isArray(d) ? d : []); })
      .catch(function() { setLibraryStatuses([]); });
  }, [isOpen]);

  var resetForm = function() {
    setSelectedStatus(''); setCompletionResult(''); setClaimType('valued');
    setResultAmounts([{ label: '', amount: 0 }]); setUnvaluedText('');
    setCustomStatusText(''); setShowOther(false); setNote('');
  };

  var handleSubmit = async function() {
    if (!task || !selectedStatus) return;
    var taskId = task.id || task.ID;
    if (!taskId) return;

    var finalStatus = selectedStatus;
    if (selectedStatus === 'diger' && customStatusText.trim()) {
      finalStatus = 'diger:' + customStatusText.trim();
    }

    setSaving(true);
    try {
      // Statusu birbaşa dəyiş — təsdiqə ehtiyac yoxdur (icazə backend tərəfində yoxlanılır)
      var updateBody: any = { status: finalStatus };

      // Add completion details
      if (selectedStatus === 'is_yekunlasdi' && completionResult) {
        updateBody.completion_result = completionResult;
        if (claimType === 'valued' && completionResult === 'iddia_qismen_temin') {
          updateBody.result_amounts = JSON.stringify(resultAmounts.filter(function(r) { return r.amount > 0; }));
        }
        if (claimType === 'unvalued') {
          updateBody.unvalued_claim_text = unvaluedText;
        }
      }

      // Qeyd tapşırığın daimi "notes" sahəsini əvəz etmir — yalnız tarixçə
      // qeydi kimi göndərilir (backend UpdateTask bu status dəyişikliyini
      // özü avtomatik saniyəyə qədər dəqiq tarixçəyə yazır).
      if (note.trim()) updateBody.history_reason = note.trim();

      await fetchApi('/tasks/' + taskId, { method: 'PUT', body: JSON.stringify(updateBody) });

      toast.success('Status yeniləndi: ' + getStatusLabel(finalStatus));
      resetForm();
      onClose();
      if (onStatusChanged) onStatusChanged();
    } catch (err: any) {
      if (!(err && err.message && err.message.indexOf('permission_denied') >= 0)) {
        toast.error('Xəta: ' + (err?.message || 'Status dəyişdirilə bilmədi'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!task) return null;

  var currentStatus = task.status || task.rawStatus || '';

  return (
    <Dialog open={isOpen} onOpenChange={function(o) { if (!o) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 !flex !flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b shrink-0 pr-12">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5" />Status dəyiş</h2>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{task.title || 'Tapşırıq'} — Cari: {getStatusLabel(currentStatus)}</p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-6 py-4">

          {/* Statuslar — hamısı konfiqurasiya kitabxanasından */}
          <div>
            <Label className="text-xs font-semibold mb-2 block">Status seçin</Label>
            {libraryStatuses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center bg-muted/30 rounded-lg">
                Kitabxanada status tapılmadı. Konfiqurasiya kitabxanasında status əlavə edin.
              </p>
            ) : (
              <div className="space-y-2">
                {libraryStatuses.map(function(s: any) {
                  var sKey = s.code || s.name;
                  var isS = selectedStatus === sKey;
                  var kids = s.children || [];
                  var hasKids = kids.length > 0;
                  return (
                    <Card key={s.id} className={'transition-all ' + (isS ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-sm')}>
                      <CardContent className="p-0">
                        {/* Əsas status — üzərinə basanda birbaşa seçilir */}
                        <div className="p-3 flex items-center justify-between cursor-pointer" onClick={function() { setSelectedStatus(sKey); setCompletionResult(''); }}>
                          <div className="flex items-center gap-2">
                            {sKey === 'mehkemeye_gonderildi'
                              ? <Send className="h-4 w-4 text-blue-600" />
                              : <CheckCircle className={'h-4 w-4 ' + (isS ? 'text-blue-600' : 'text-green-600')} />}
                            <span className="text-sm font-medium">{s.name}</span>
                            {hasKids && <Badge variant="outline" className="text-[9px]">{kids.length} alt-status</Badge>}
                          </div>
                          {isS && <CheckCircle className="h-5 w-5 text-blue-600" />}
                        </div>

                        {/* Alt-statuslar — əsas status seçiləndə açılır */}
                        {hasKids && isS && (
                          <div className="px-3 pb-3 ml-4 space-y-1 border-l-2 border-blue-200 pl-3">
                            <p className="text-[10px] text-muted-foreground mb-1">Alt-status (ixtiyari):</p>
                            {kids.map(function(child: any) {
                              var cKey = child.code || child.name;
                              var isC = selectedStatus === cKey;
                              return (
                                <div key={child.id}
                                  className={'flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all ' + (isC ? 'bg-blue-100' : 'hover:bg-muted')}
                                  onClick={function(e) { e.stopPropagation(); setSelectedStatus(cKey); setCompletionResult(''); }}>
                                  <div className={'w-3 h-3 rounded-full border-2 flex items-center justify-center ' + (isC ? 'border-blue-600 bg-blue-600' : 'border-gray-300')}>
                                    {isC && <div className="w-1 h-1 bg-white rounded-full" />}
                                  </div>
                                  <span className="text-xs">{child.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* İş yekunlaşdı seçildikdə */}
          {selectedStatus === 'is_yekunlasdi' && (
            <div className="space-y-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Label className="text-xs font-semibold">Nəticə</Label>
              <div className="space-y-1.5">
                {COMPLETION_OPTIONS.map(function(opt) {
                  var isS = completionResult === opt.key;
                  return (
                    <div key={opt.key} className={'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ' + (isS ? 'bg-green-200' : 'hover:bg-green-100')} onClick={function() { setCompletionResult(opt.key); }}>
                      <div className={'w-4 h-4 rounded-full border-2 flex items-center justify-center ' + (isS ? 'border-green-600 bg-green-600' : 'border-gray-300')}>
                        {isS && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <span className="text-sm">{opt.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Qismən təmin — iddia növü seçimi */}
              {completionResult === 'iddia_qismen_temin' && (
                <div className="space-y-3 mt-2 p-3 bg-white rounded-lg border">
                  <div className="flex gap-2">
                    <Button size="sm" variant={claimType === 'valued' ? 'default' : 'outline'} className="text-xs" onClick={function() { setClaimType('valued'); }}>Qiymətləndirilən iddialar</Button>
                    <Button size="sm" variant={claimType === 'unvalued' ? 'default' : 'outline'} className="text-xs" onClick={function() { setClaimType('unvalued'); }}>Qiymətləndirilməyən iddialar</Button>
                  </div>
                  {claimType === 'valued' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Təmin edilən məbləğlər</span>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={function() { setResultAmounts(resultAmounts.concat([{ label: '', amount: 0 }])); }}>+ Əlavə</Button>
                      </div>
                      {resultAmounts.map(function(r, idx) {
                        return (
                          <div key={idx} className="flex gap-2">
                            <Input className="flex-1 h-8 text-sm" placeholder="Məbləğ növü" value={r.label} onChange={function(e) { var u = resultAmounts.slice(); u[idx] = { label: e.target.value, amount: u[idx].amount }; setResultAmounts(u); }} />
                            <Input className="w-28 h-8 text-sm" type="number" placeholder="0" value={r.amount || ''} onChange={function(e) { var u = resultAmounts.slice(); u[idx] = { label: u[idx].label, amount: Number(e.target.value) || 0 }; setResultAmounts(u); }} />
                            <span className="text-xs self-center">AZN</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea className="w-full border rounded-lg p-2 text-sm min-h-[60px] resize-none" placeholder="İddianın nədən ibarət olduğunu qeyd edin" value={unvaluedText} onChange={function(e) { setUnvaluedText(e.target.value); }} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* "Digər" statusu seçilibsə — sərbəst mətn */}
          {selectedStatus === 'diger' && (
            <div>
              <Label className="text-xs font-semibold">Statusu təsvir edin</Label>
              <Input className="mt-1" value={customStatusText} onChange={function(e) { setCustomStatusText(e.target.value); }} placeholder="Yeni statusun adını yazın" />
            </div>
          )}

          {/* Qeyd */}
          <div>
            <Label className="text-xs">Qeyd (ixtiyari)</Label>
            <textarea className="w-full border rounded-lg p-2 text-sm min-h-[40px] mt-1 resize-none" value={note} onChange={function(e) { setNote(e.target.value); }} placeholder="Əlavə qeyd..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-white">
          <Button variant="outline" size="sm" onClick={function() { resetForm(); onClose(); }}>Ləğv et</Button>
          <Button size="sm" disabled={!selectedStatus || saving || (selectedStatus === 'diger' && !customStatusText.trim())} className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmit}>
            <Send className="h-4 w-4 mr-1.5" />{saving ? 'Yenilənir...' : 'Statusu yenilə'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}