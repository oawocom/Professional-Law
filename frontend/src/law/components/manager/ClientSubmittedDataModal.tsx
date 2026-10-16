'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import {
  FileText, DollarSign, Calendar, User, Briefcase,
  CheckCircle, XCircle, Clock, AlertTriangle, Upload, Download, Eye
} from 'lucide-react';
import { Button } from '../ui/button';
import { FileViewerModal } from '../shared/FileViewerModal';
import { formatDate as fmtDate } from '../../utils/dateFormat';

function parseJSON(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

function g(obj: any, ...keys: string[]): any {
  if (!obj) return '';
  for (var k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return '';
}

interface ClientSubmittedDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any;
  contract?: any;
  tenantId?: number | null;
  onSave?: (taskId: string, data: any) => void;
  taskTitle?: string;
  clientName?: string;
  taskData?: any;
}

export function ClientSubmittedDataModal({
  open, onOpenChange, task, contract,
  taskTitle: legacyTitle, clientName: legacyClient, taskData: legacyData,
}: ClientSubmittedDataModalProps) {

  var [viewerDoc, setViewerDoc] = useState<any>(null);

  var t = task || {};
  var title = g(t, 'title', 'Title') || legacyTitle || 'Tapshiriq';
  var respondentName = g(t, 'respondent_name', 'respondentName');
  var description = g(t, 'description', 'Description') || legacyData?.description || '';
  var priority = g(t, 'priority', 'Priority') || legacyData?.priority || 'normal';
  var category = g(t, 'category', 'Category');
  var deadline = g(t, 'deadline', 'Deadline') || legacyData?.deadline || '';
  var createdAt = g(t, 'created_at', 'createdAt', 'CreatedAt') || legacyData?.createdAt || '';
  var clientName = g(t, 'client_name', 'clientName') || t.client?.name || legacyClient || '';
  var contractTitle = g(t, 'contract_title', 'contractTitle') || t.contract?.title || '';

  var claimAmounts = parseJSON(g(t, 'claim_amounts', 'claimAmounts'));
  var totalClaim = Number(g(t, 'total_claim', 'totalClaim', 'claim_amount') || 0);
  var docChecklist = parseJSON(g(t, 'document_checklist', 'documentChecklist'));

  var calculatedTotal = claimAmounts.reduce(function(sum: number, c: any) { return sum + (Number(c.amount) || 0); }, 0);
  var displayTotal = totalClaim || calculatedTotal;
  var uploadedCount = docChecklist.filter(function(d: any) { return d.uploaded; }).length;

  var priorityLabel = priority === 'high' || priority === 'urgent' ? 'Yuksek' :
    priority === 'normal' || priority === 'medium' ? 'Orta' : 'Ashagi';
  var priorityColor = priority === 'high' || priority === 'urgent' ? 'bg-red-100 text-red-800' :
    priority === 'normal' || priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Mushteri Melumatlari
          </DialogTitle>
          <DialogDescription>
            Mushterinin daxil etdiyi tapshiriq melumatlari
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <div className="space-y-4 pr-2">

            {/* Task Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Tapshiriq Melumatlari
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Tapshiriq</p>
                    <p className="text-sm font-medium">{title}</p>
                  </div>
                  {respondentName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Cavabdeh (Respondent)</p>
                      <p className="text-sm font-medium">{respondentName}</p>
                    </div>
                  )}
                  {clientName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Mushteri</p>
                      <p className="text-sm font-medium flex items-center gap-1"><User className="h-3 w-3" />{clientName}</p>
                    </div>
                  )}
                  {contractTitle && (
                    <div>
                      <p className="text-xs text-muted-foreground">Muqavile</p>
                      <p className="text-sm font-medium">{contractTitle}</p>
                    </div>
                  )}
                  {category && (
                    <div>
                      <p className="text-xs text-muted-foreground">Kateqoriya</p>
                      <Badge variant="outline" className="text-xs">{category}</Badge>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Prioritet</p>
                    <Badge className={'text-xs ' + priorityColor}>{priorityLabel}</Badge>
                  </div>
                  {deadline && (
                    <div>
                      <p className="text-xs text-muted-foreground">Son tarix</p>
                      <p className="text-sm flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(deadline)}</p>
                    </div>
                  )}
                  {createdAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Yaradildi</p>
                      <p className="text-sm flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(createdAt)}</p>
                    </div>
                  )}
                </div>

                {description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tesvir</p>
                      <p className="text-sm whitespace-pre-wrap">{description}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Claim Amounts */}
            {claimAmounts.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                    Iddia Meblegleri
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {claimAmounts.filter(function(c: any) { return Number(c.amount) > 0; }).map(function(claim: any, i: number) {
                      return (
                        <div key={i} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100">
                          <span className="text-sm">{claim.label || claim.type || 'Meblegh'}</span>
                          <span className="text-sm font-semibold text-amber-700">
                            {Number(claim.amount).toLocaleString()} AZN
                          </span>
                        </div>
                      );
                    })}
                    <Separator />
                    <div className="flex items-center justify-between p-2 bg-amber-100 rounded-lg">
                      <span className="text-sm font-medium">Umumi</span>
                      <span className="text-base font-bold text-amber-800">
                        {displayTotal.toLocaleString()} AZN
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Document Checklist */}
            {docChecklist.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Upload className="h-4 w-4 text-blue-600" />
                      Senedler
                    </CardTitle>
                    <Badge variant="outline" className={'text-xs ' + (uploadedCount === docChecklist.length ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                      {uploadedCount}/{docChecklist.length} yuklenib
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {docChecklist.map(function(doc: any, i: number) {
                      var isUploaded = !!doc.uploaded;
                      var uploadMode = doc.upload_mode || 'individual';
                      var hasFile = !!doc.file_data;

                      var handleDownload = function() {
                        if (!doc.file_data) return;
                        var link = document.createElement('a');
                        link.href = doc.file_data;
                        link.download = doc.file_name || doc.name + '.pdf';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      };

                      return (
                        <div key={i} className={'p-2.5 rounded-lg border ' + (isUploaded ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isUploaded ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="text-sm">{doc.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {uploadMode === 'bundle' && (
                                <Badge variant="outline" className="text-[10px]">Umumi fayl</Badge>
                              )}
                              <Badge className={'text-[10px] ' + (isUploaded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                                {isUploaded ? 'Yuklenib' : 'Catismir'}
                              </Badge>
                              {hasFile && (
                                <Button variant="outline" size="sm" className="h-7 px-2" onClick={function() { setViewerDoc(doc); }}>
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  <span className="text-xs">Bax</span>
                                </Button>
                              )}
                              {hasFile && (
                                <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleDownload}>
                                  <Download className="h-3.5 w-3.5 mr-1" />
                                  <span className="text-xs">Yükle</span>
                                </Button>
                              )}
                            </div>
                          </div>
                          {hasFile && doc.file_name && (
                            <p className="text-[10px] text-muted-foreground mt-1 ml-6">
                              {doc.file_name} ({doc.file_size ? (doc.file_size / 1024).toFixed(0) + ' KB' : ''})
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No data */}
            {claimAmounts.length === 0 && docChecklist.length === 0 && !description && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Mushteri elave melumat daxil etmeyib</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
      <FileViewerModal doc={viewerDoc} open={!!viewerDoc} onClose={function() { setViewerDoc(null); }} />
    </Dialog>
  );
}