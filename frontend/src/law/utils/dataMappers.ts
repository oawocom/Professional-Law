'use client';

// Sistemdə hər yerdə müştəri "Şəxsin adı + Şirkətin adı" formasında göstərilsin
export function formatClientDisplayName(personName?: string | null, companyName?: string | null): string {
  var n = (personName || '').trim();
  var c = (companyName || '').trim();
  if (n && c) return n + ' — ' + c;
  return n || c || 'Naməlum müştəri';
}

// ==================== API INTERFACES (snake_case from backend) ====================

export interface ApiLawyer {
  id: number;
  user_id?: number;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  specialization?: string;
  license_number?: string;
  bar_association?: string;
  experience?: number;
  rating?: number;
  education?: any;
  career_history?: any[];
  certifications?: any[];
  languages?: any;
  achievements?: any;
  working_hours?: any;
  status?: string;
  is_archived?: boolean;
  active_cases?: number;
  completed_cases?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApiClient {
  id: number;
  user_id?: number;
  type?: string;
  parent_client_id?: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company_name?: string;
  tax_number?: string;
  contact_person?: string;
  notes?: string;
  documents?: any;
  status?: string;
  is_archived?: boolean;
  archived_at?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
  // Enriched from GetClient
  contract_count?: number;
  task_count?: number;
}

export interface ApiContract {
  id: number;
  contract_number?: string;
  client_id: number;
  task_type_id?: number;
  title: string;
  description?: string;
  category?: string;
  type?: string;
  status?: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  value?: number;
  currency?: string;
  payment_status?: string;
  payment_terms?: string;
  court_name?: string;
  case_number?: string;
  claim_amount?: number;
  claim_deadline?: string;
  documents?: any;
  notes?: string;
  terms?: string;
  task_quota?: number;
  tasks_used?: number;
  auto_renew?: boolean;
  static_lawyer_fee?: number;
  allowed_categories?: string[];
  is_archived?: boolean;
  archived_at?: string;
  created_by?: number;
  approved_by?: number;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
  // Enriched
  client_name?: string;
  task_type_name?: string;
  usage_percent?: number;
  tasks_used_actual?: number;
  // Nested
  client?: ApiClient;
  task_type?: ApiTaskType;
}

export interface ApiTaskType {
  id: number;
  name: string;
  description?: string;
  required_documents?: string[] | string;
  steps?: string[] | string;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApiTask {
  id: number;
  contract_id?: number;
  task_type_id?: number;
  parent_task_id?: number;
  title: string;
  respondent_name?: string;
  task_number?: string;
  description?: string;
  category?: string;
  status?: string;
  current_step?: number;
  priority?: string;
  deadline?: string;
  manager_deadline?: string;
  claim_deadline?: string;
  completed_at?: string;
  claim_amounts?: any;
  total_claim?: number;
  document_checklist?: any;
  attachments?: any;
  checklist?: any;
  notes?: string;
  rejection_reason?: string;
  created_by?: number;
  assigned_to?: number;
  client_id?: number;
  is_archived?: boolean;
  archived_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  created_at?: string;
  updated_at?: string;
  // Enriched
  contract_title?: string;
  client_name?: string;
  lawyer_name?: string;
  lawyer_specialization?: string;
  task_type_name?: string;
  // Nested
  contract?: ApiContract;
  assignee?: ApiLawyer;
  task_type?: ApiTaskType;
  client_info?: ApiClient;
}

export interface ApiManagerTask {
  id: number;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  deadline?: string;
  assigned_to?: number;
  created_by?: number;
  label?: string;
  location?: string;
  attachments?: any;
  completion_note?: string;
  completion_docs?: any;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  // Enriched
  assignee_name?: string;
  assignee?: ApiLawyer;
}

export interface ApiApproval {
  id: number;
  approval_type?: string;
  entity_type: string;
  entity_id: number;
  task_id?: number;
  requested_by: number;
  requested_at?: string;
  approver_id?: number;
  status: string;
  previous_data?: any;
  requested_data?: any;
  previous_status?: string;
  new_status?: string;
  step_index?: number;
  attachments?: any;
  reason?: string;
  decision?: string;
  decided_at?: string;
  created_at?: string;
  updated_at?: string;
  // Enriched
  task_title?: string;
  client_name?: string;
  requester_name?: string;
  lawyer_name?: string;
  task_type_name?: string;
  comment_content?: string;
  task?: ApiTask;
  comment?: ApiTaskComment;
}

export interface ApiTaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user_type?: string;
  user_name?: string;
  content: string;
  attachments?: any;
  is_approved?: boolean;
  is_pending?: boolean;
  is_rejected?: boolean;
  manager_note?: string;
  approved_at?: string;
  approved_by?: number;
  target_user_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApiNotification {
  id: number;
  user_id: number;
  user_type?: string;
  type?: string;
  title?: string;
  message?: string;
  entity_type?: string;
  entity_id?: number;
  is_read?: boolean;
  read_at?: string;
  created_at?: string;
}

export interface ApiCalendarEvent {
  id: number;
  title: string;
  date?: string;
  event_type: string;
  status: string;
  priority: string;
  entity_type: string;
}

export interface ApiStats {
  total_lawyers?: number;
  active_lawyers?: number;
  total_clients?: number;
  active_clients?: number;
  archived_clients?: number;
  total_contracts?: number;
  active_contracts?: number;
  archived_contracts?: number;
  total_tasks?: number;
  new_tasks?: number;
  pending_tasks?: number;
  completed_tasks?: number;
  cancelled_tasks?: number;
  in_progress_tasks?: number;
  archived_tasks?: number;
  overdue_tasks?: number;
  this_week_deadlines?: number;
  pending_approvals?: number;
  pending_status_changes?: number;
  pending_notes?: number;
  total_manager_tasks?: number;
  completed_manager_tasks?: number;
  pending_manager_tasks?: number;
  my_clients?: number;
  my_contracts?: number;
}

export interface ApiReports {
  tasks_created?: number;
  tasks_completed?: number;
  tasks_rejected?: number;
  tasks_pending?: number;
  completion_rate?: number;
  avg_completion_days?: number;
  overdue_count?: number;
  tasks_by_priority?: { priority: string; count: number }[];
  tasks_by_type?: { task_type_id: number; name: string; count: number }[];
  lawyer_performance?: { lawyer_id: number; name: string; active_cases: number; completed_cases: number; rating: number }[];
  total_contract_value?: number;
  total_claim_amount?: number;
}

// ==================== UI TYPES (camelCase for frontend) ====================

export interface UiLawyer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  specialization: string;
  experience: string;
  rating: number;
  licenseNumber?: string;
  barAssociation?: string;
  education?: any[];
  careerHistory?: any[];
  certifications?: any[];
  languages?: any[];
  achievements?: any[];
  workingHours?: any;
  status: 'active' | 'inactive';
  isArchived: boolean;
  activeTasks: number;
  activeCases: number;
  completedCases: number;
  clientSatisfaction: number;
  efficiency: number;
  workload: 'high' | 'medium' | 'low';
  lastActive: string;
  degree?: string;
  joinDate: string;
}

export interface UiClient {
  id: string;
  name: string;
  displayName?: string;
  email: string;
  phone: string;
  company: string;
  companyName?: string;
  type?: string;
  parentClientId?: number;
  address?: string;
  taxNumber?: string;
  contactPerson?: string;
  notes?: string;
  status: 'active' | 'inactive' | 'archived';
  isArchived: boolean;
  archivedAt?: string;
  activeTasks: number;
  completedTasks: number;
  contractCount: number;
  taskCount: number;
  totalSpent?: string;
  joinDate: string;
  lastActivity: string;
  assignedLawyer?: string;
  industry?: string;
  priority: 'high' | 'medium' | 'low';
  satisfaction: number;
}

export interface UiContract {
  id: string;
  name: string;
  contractNumber?: string;
  clientId: string;
  clientName: string;
  taskTypeId?: string;
  taskTypeName?: string;
  assignedLawyer?: string;
  lawyerId?: string;
  status: 'active' | 'inactive' | 'near-limit' | 'completed' | 'expired' | 'archived' | 'draft';
  startDate: string;
  endDate: string;
  taskQuota: number;
  tasksUsed: number;
  tasksRemaining: number;
  usagePercent: number;
  allowedCategories: string[];
  autoRenew: boolean;
  staticLawyerFee: number;
  isArchived: boolean;
  notes?: string;
  description?: string;
  createdAt: string;
  lastModified: string;
  completedTasks: number;
  inProgressTasks: number;
  value?: number;
  currency?: string;
  category?: string;
  type?: string;
  priority?: string;
}

export interface UiTask {
  id: string;
  title: string;
  respondentName?: string;
  taskNumber?: string;
  description?: string;
  clientName: string;
  clientId?: string;
  contractId?: string;
  taskTypeId?: string;
  taskTypeName?: string;
  assignedLawyer: string;
  lawyerId?: string;
  lawyerSpecialization?: string;
  status: string;
  currentStep: number;
  priority: 'high' | 'medium' | 'low' | 'normal' | 'urgent';
  deadline: string;
  managerDeadline?: string;
  claimDeadline?: string;
  category: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
  rejectionReason?: string;
  claimAmounts: { type: string; label: string; amount: number; customLabel?: string }[];
  totalClaim: number;
  documentChecklist: { name: string; uploaded: boolean; file_url?: string }[];
  attachments: any[];
  isArchived: boolean;
  createdBy?: number;
  assignedTo?: number;
  documents: { name: string; size: string; uploadedAt: string }[];
  subTasks?: UiTask[];
  parentTaskId?: string;
  checklist?: any;
  estimatedHours?: number;
  actualHours?: number;
  contractTitle?: string;
}

export interface UiManagerTask {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  deadline?: string;
  assignedTo?: number;
  createdBy?: number;
  label?: string;
  location?: string;
  attachments: any[];
  completionNote?: string;
  completionDocs: any[];
  completedAt?: string;
  createdAt: string;
  assigneeName?: string;
}

export interface UiApproval {
  id: string;
  approvalType: string;
  type: string;
  entityType: string;
  entityId: string;
  taskId?: string;
  clientName: string;
  taskTitle: string;
  requestedAt: string;
  requestedBy: string;
  urgency: 'high' | 'medium' | 'low';
  description: string;
  reason?: string;
  status: string;
  requesterName?: string;
  lawyerName?: string;
  taskTypeName?: string;
  decision?: string;
  previousStatus?: string;
  newStatus?: string;
  stepIndex?: number;
  attachments: any[];
  commentContent?: string;
  task?: UiTask;
}

export interface UiTaskComment {
  id: string;
  taskId: number;
  userId: number;
  userType: string;
  userName: string;
  content: string;
  attachments: any[];
  isApproved: boolean;
  isPending: boolean;
  isRejected: boolean;
  managerNote?: string;
  targetUserType?: string;
  createdAt: string;
}

export interface UiNotification {
  id: string;
  userId: number;
  userType?: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface UiCalendarEvent {
  id: number;
  title: string;
  date: string;
  eventType: string;
  status: string;
  priority: string;
  entityType: string;
}

export interface UiStats {
  totalLawyers: number;
  activeLawyers: number;
  totalClients: number;
  activeClients: number;
  archivedClients: number;
  totalContracts: number;
  activeContracts: number;
  archivedContracts: number;
  totalTasks: number;
  newTasks: number;
  pendingTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  inProgressTasks: number;
  archivedTasks: number;
  overdueTasks: number;
  thisWeekDeadlines: number;
  pendingApprovals: number;
  pendingStatusChanges: number;
  pendingNotes: number;
  totalManagerTasks: number;
  completedManagerTasks: number;
  pendingManagerTasks: number;
  myClients?: number;
  myContracts?: number;
}

// ==================== MAPPERS ====================

export function mapLawyer(api: ApiLawyer): UiLawyer {
  const activeCases = api.active_cases || 0;

  let education: any[] = [];
  if (Array.isArray(api.education)) {
    education = api.education;
  } else if (typeof api.education === 'string' && api.education) {
    try { education = JSON.parse(api.education); } catch { education = []; }
  }

  let languages: any[] = [];
  if (Array.isArray(api.languages)) {
    languages = api.languages;
  } else if (typeof api.languages === 'string' && api.languages) {
    try { languages = JSON.parse(api.languages); } catch { languages = []; }
  }

  let achievements: any[] = [];
  if (Array.isArray(api.achievements)) {
    achievements = api.achievements;
  } else if (typeof api.achievements === 'string' && api.achievements) {
    try { achievements = JSON.parse(api.achievements); } catch { achievements = []; }
  }

  return {
    id: String(api.id),
    name: api.name,
    email: api.email || '',
    phone: api.phone,
    avatar: api.avatar,
    specialization: api.specialization || 'Ümumi hüquq',
    experience: api.experience ? `${api.experience} il` : '0 il',
    rating: api.rating || 0,
    licenseNumber: api.license_number,
    barAssociation: api.bar_association,
    education,
    careerHistory: api.career_history || [],
    certifications: api.certifications || [],
    languages,
    achievements,
    workingHours: api.working_hours,
    status: (api.status as 'active' | 'inactive') || 'active',
    isArchived: api.is_archived || false,
    activeTasks: activeCases,
    activeCases,
    completedCases: api.completed_cases || 0,
    clientSatisfaction: Math.round((api.rating || 4) * 20),
    efficiency: 85 + Math.floor(Math.random() * 10),
    workload: activeCases > 6 ? 'high' : activeCases > 3 ? 'medium' : 'low',
    lastActive: formatRelativeTime(api.updated_at),
    degree: education.length > 0 ? education[0]?.degree : undefined,
    joinDate: formatDate(api.created_at),
  };
}

export function mapClient(api: ApiClient): UiClient {
  return {
    id: String(api.id),
    name: api.name,
    displayName: formatClientDisplayName(api.name, api.company_name),
    email: api.email || '',
    phone: api.phone || '',
    company: api.company_name || api.name,
    companyName: api.company_name,
    type: api.type,
    parentClientId: api.parent_client_id,
    address: api.address,
    taxNumber: api.tax_number,
    contactPerson: api.contact_person,
    notes: api.notes,
    status: (api.status as 'active' | 'inactive' | 'archived') || 'active',
    isArchived: api.is_archived || false,
    archivedAt: api.archived_at,
    activeTasks: 0,
    completedTasks: 0,
    contractCount: api.contract_count || 0,
    taskCount: api.task_count || 0,
    totalSpent: '₼0',
    joinDate: formatDate(api.created_at),
    lastActivity: formatRelativeTime(api.updated_at),
    industry: api.type === 'company' ? 'Korporativ' : 'Fərdi',
    priority: 'medium',
    satisfaction: 85 + Math.floor(Math.random() * 10),
  };
}

export function mapContract(api: ApiContract): UiContract {
  const taskQuota = api.task_quota || 10;
  const tasksUsed = api.tasks_used_actual || api.tasks_used || 0;
  const usagePercent = api.usage_percent || (taskQuota > 0 ? (tasksUsed / taskQuota) * 100 : 0);

  let allowedCategories: string[] = [];
  if (api.allowed_categories) {
    if (Array.isArray(api.allowed_categories)) {
      allowedCategories = api.allowed_categories;
    } else if (typeof api.allowed_categories === 'string') {
      try { allowedCategories = JSON.parse(api.allowed_categories as string); } catch { /* */ }
    }
  }

  // Determine status: near-limit if usage > 80%
  let status = mapContractStatus(api.status);
  if (status === 'active' && usagePercent >= 80) {
    status = 'near-limit';
  }

  return {
    id: String(api.id),
    name: api.title || `Müqavilə #${api.contract_number || api.id}`,
    contractNumber: api.contract_number,
    clientId: String(api.client_id),
    clientName: (api.client && api.client.name) ? formatClientDisplayName(api.client.name, (api.client as any).company_name) : (api.client_name || 'Naməlum müştəri'),
    taskTypeId: api.task_type_id ? String(api.task_type_id) : undefined,
    taskTypeName: api.task_type_name || api.task_type?.name,
    status,
    startDate: formatDate(api.start_date),
    endDate: formatDate(api.end_date),
    taskQuota,
    tasksUsed,
    tasksRemaining: Math.max(0, taskQuota - tasksUsed),
    usagePercent: Math.round(usagePercent * 100) / 100,
    allowedCategories,
    autoRenew: api.auto_renew || false,
    staticLawyerFee: api.static_lawyer_fee || 0,
    isArchived: api.is_archived || false,
    notes: api.notes,
    description: api.description,
    createdAt: formatDate(api.created_at),
    lastModified: formatDate(api.updated_at),
    completedTasks: 0,
    inProgressTasks: 0,
    value: api.value,
    currency: api.currency || 'AZN',
    category: api.category,
    type: api.type,
    priority: api.priority,
  };
}

export function mapTask(api: ApiTask): UiTask {
  // Parse claim amounts
  let claimAmounts: any[] = [];
  if (api.claim_amounts) {
    if (Array.isArray(api.claim_amounts)) {
      claimAmounts = api.claim_amounts;
    } else if (typeof api.claim_amounts === 'string') {
      try { claimAmounts = JSON.parse(api.claim_amounts); } catch { /* */ }
    }
  }

  // Parse document checklist
  let documentChecklist: any[] = [];
  if (api.document_checklist) {
    if (Array.isArray(api.document_checklist)) {
      documentChecklist = api.document_checklist;
    } else if (typeof api.document_checklist === 'string') {
      try { documentChecklist = JSON.parse(api.document_checklist); } catch { /* */ }
    }
  }

  // Parse attachments
  let attachments: any[] = [];
  if (api.attachments) {
    if (Array.isArray(api.attachments)) {
      attachments = api.attachments;
    } else if (typeof api.attachments === 'string') {
      try { attachments = JSON.parse(api.attachments); } catch { /* */ }
    }
  }

  // Client name from various sources — "Şəxsin adı + Şirkətin adı" formasında
  let clientName = api.client_name || 'Naməlum müştəri';
  if (!api.client_name && api.contract?.client) {
    clientName = formatClientDisplayName(api.contract.client.name, (api.contract.client as any).company_name);
  }
  if (!api.client_name && api.client_info) {
    clientName = formatClientDisplayName((api.client_info as any).name, (api.client_info as any).company_name);
  }

  return {
    id: String(api.id),
    title: api.title,
    respondentName: api.respondent_name,
    taskNumber: api.task_number,
    description: api.description,
    clientName,
    clientId: api.client_id ? String(api.client_id) : undefined,
    contractId: api.contract_id ? String(api.contract_id) : undefined,
    taskTypeId: api.task_type_id ? String(api.task_type_id) : undefined,
    taskTypeName: api.task_type_name || api.task_type?.name,
    assignedLawyer: api.lawyer_name || api.assignee?.name || 'Təyin edilməyib',
    lawyerId: api.assigned_to ? String(api.assigned_to) : undefined,
    lawyerSpecialization: api.lawyer_specialization || api.assignee?.specialization,
    status: api.status || 'new',
    currentStep: api.current_step || 0,
    priority: (api.priority as any) || 'normal',
    deadline: formatDate(api.deadline),
    managerDeadline: api.manager_deadline ? formatDate(api.manager_deadline) : undefined,
    claimDeadline: api.claim_deadline ? formatDate(api.claim_deadline) : undefined,
    category: api.category || 'Ümumi',
    createdAt: formatDate(api.created_at),
    completedAt: api.completed_at ? formatDate(api.completed_at) : undefined,
    notes: api.notes || api.description,
    rejectionReason: api.rejection_reason,
    claimAmounts,
    totalClaim: api.total_claim || 0,
    documentChecklist,
    attachments,
    isArchived: api.is_archived || false,
    createdBy: api.created_by,
    assignedTo: api.assigned_to,
    documents: attachments.map((a: any) => ({
      name: a.name || a.file_url || 'Sənəd',
      size: a.size || '',
      uploadedAt: a.uploaded_at || '',
    })),
    parentTaskId: api.parent_task_id ? String(api.parent_task_id) : undefined,
    checklist: api.checklist,
    estimatedHours: api.estimated_hours,
    actualHours: api.actual_hours,
    contractTitle: api.contract_title || api.contract?.title,
  };
}

export function mapManagerTask(api: ApiManagerTask): UiManagerTask {
  let attachments: any[] = [];
  if (api.attachments) {
    if (Array.isArray(api.attachments)) attachments = api.attachments;
    else if (typeof api.attachments === 'string') {
      try { attachments = JSON.parse(api.attachments); } catch { /* */ }
    }
  }

  let completionDocs: any[] = [];
  if (api.completion_docs) {
    if (Array.isArray(api.completion_docs)) completionDocs = api.completion_docs;
    else if (typeof api.completion_docs === 'string') {
      try { completionDocs = JSON.parse(api.completion_docs); } catch { /* */ }
    }
  }

  return {
    id: String(api.id),
    title: api.title,
    description: api.description,
    priority: api.priority || 'normal',
    status: api.status || 'new',
    deadline: api.deadline ? formatDate(api.deadline) : undefined,
    assignedTo: api.assigned_to,
    createdBy: api.created_by,
    label: api.label,
    location: api.location,
    attachments,
    completionNote: api.completion_note,
    completionDocs,
    completedAt: api.completed_at ? formatDate(api.completed_at) : undefined,
    createdAt: formatDate(api.created_at),
    assigneeName: api.assignee_name || api.assignee?.name,
  };
}

export function mapApproval(api: ApiApproval): UiApproval {
  let attachments: any[] = [];
  if (api.attachments) {
    if (Array.isArray(api.attachments)) attachments = api.attachments;
    else if (typeof api.attachments === 'string') {
      try { attachments = JSON.parse(api.attachments); } catch { /* */ }
    }
  }

  return {
    id: String(api.id),
    approvalType: api.approval_type || 'new_task',
    type: api.entity_type,
    entityType: api.entity_type,
    entityId: String(api.entity_id),
    taskId: api.task_id ? String(api.task_id) : undefined,
    clientName: api.client_name || 'Naməlum',
    taskTitle: api.task_title || `${api.entity_type} #${api.entity_id}`,
    requestedAt: formatDateTime(api.requested_at || api.created_at),
    requestedBy: String(api.requested_by),
    urgency: 'medium',
    description: api.reason || '',
    reason: api.reason,
    status: api.status,
    requesterName: api.requester_name,
    lawyerName: api.lawyer_name,
    taskTypeName: api.task_type_name,
    decision: api.decision,
    previousStatus: api.previous_status,
    newStatus: api.new_status,
    stepIndex: api.step_index,
    attachments,
    commentContent: api.comment_content,
    task: api.task ? mapTask(api.task) : undefined,
  };
}

export function mapTaskComment(api: ApiTaskComment): UiTaskComment {
  let attachments: any[] = [];
  if (api.attachments) {
    if (Array.isArray(api.attachments)) attachments = api.attachments;
    else if (typeof api.attachments === 'string') {
      try { attachments = JSON.parse(api.attachments); } catch { /* */ }
    }
  }

  return {
    id: String(api.id),
    taskId: api.task_id,
    userId: api.user_id,
    userType: api.user_type || '',
    userName: api.user_name || '',
    content: api.content,
    attachments,
    isApproved: api.is_approved || false,
    isPending: api.is_pending !== false,
    isRejected: api.is_rejected || false,
    managerNote: api.manager_note,
    targetUserType: api.target_user_type,
    createdAt: formatDateTime(api.created_at),
  };
}

export function mapNotification(api: ApiNotification): UiNotification {
  return {
    id: String(api.id),
    userId: api.user_id,
    userType: api.user_type,
    type: api.type || '',
    title: api.title || '',
    message: api.message || '',
    entityType: api.entity_type,
    entityId: api.entity_id ? String(api.entity_id) : undefined,
    isRead: api.is_read || false,
    createdAt: formatDateTime(api.created_at),
  };
}

export function mapCalendarEvent(api: ApiCalendarEvent): UiCalendarEvent {
  return {
    id: api.id,
    title: api.title,
    date: api.date || '',
    eventType: api.event_type,
    status: api.status,
    priority: api.priority,
    entityType: api.entity_type,
  };
}

export function mapStats(api: ApiStats): UiStats {
  return {
    totalLawyers: api.total_lawyers || 0,
    activeLawyers: api.active_lawyers || 0,
    totalClients: api.total_clients || 0,
    activeClients: api.active_clients || 0,
    archivedClients: api.archived_clients || 0,
    totalContracts: api.total_contracts || 0,
    activeContracts: api.active_contracts || 0,
    archivedContracts: api.archived_contracts || 0,
    totalTasks: api.total_tasks || 0,
    newTasks: api.new_tasks || 0,
    pendingTasks: api.pending_tasks || 0,
    completedTasks: api.completed_tasks || 0,
    cancelledTasks: api.cancelled_tasks || 0,
    inProgressTasks: api.in_progress_tasks || 0,
    archivedTasks: api.archived_tasks || 0,
    overdueTasks: api.overdue_tasks || 0,
    thisWeekDeadlines: api.this_week_deadlines || 0,
    pendingApprovals: api.pending_approvals || 0,
    pendingStatusChanges: api.pending_status_changes || 0,
    pendingNotes: api.pending_notes || 0,
    totalManagerTasks: api.total_manager_tasks || 0,
    completedManagerTasks: api.completed_manager_tasks || 0,
    pendingManagerTasks: api.pending_manager_tasks || 0,
    myClients: api.my_clients,
    myContracts: api.my_contracts,
  };
}

export function mapTaskType(api: ApiTaskType) {
  let requiredDocuments: string[] = [];
  if (api.required_documents) {
    if (Array.isArray(api.required_documents)) requiredDocuments = api.required_documents;
    else if (typeof api.required_documents === 'string') {
      try { requiredDocuments = JSON.parse(api.required_documents); } catch { /* */ }
    }
  }

  let steps: string[] = [];
  if (api.steps) {
    if (Array.isArray(api.steps)) steps = api.steps;
    else if (typeof api.steps === 'string') {
      try { steps = JSON.parse(api.steps); } catch { /* */ }
    }
  }

  return {
    id: String(api.id),
    name: api.name,
    description: api.description || '',
    requiredDocuments,
    steps,
    isActive: api.is_active !== false,
    sortOrder: api.sort_order || 0,
    createdAt: formatDate(api.created_at),
    updatedAt: formatDate(api.updated_at),
  };
}

// ==================== HELPER FUNCTIONS ====================

function mapContractStatus(status?: string): UiContract['status'] {
  switch (status) {
    case 'active': return 'active';
    case 'inactive': return 'inactive';
    case 'completed': return 'completed';
    case 'expired': return 'expired';
    case 'archived': return 'archived';
    case 'draft': return 'draft';
    default: return 'active';
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('az-AZ');
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Bilinmir';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'İndicə';
    if (diffMins < 60) return `${diffMins} dəq əvvəl`;
    if (diffHours < 24) return `${diffHours} saat əvvəl`;
    if (diffDays < 7) return `${diffDays} gün əvvəl`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} həftə əvvəl`;
    return `${Math.floor(diffDays / 30)} ay əvvəl`;
  } catch {
    return 'Bilinmir';
  }
}

// ==================== BATCH MAPPERS ====================

export function mapLawyers(data: ApiLawyer[]): UiLawyer[] { return (data || []).map(mapLawyer); }
export function mapClients(data: ApiClient[]): UiClient[] { return (data || []).map(mapClient); }
export function mapContracts(data: ApiContract[]): UiContract[] { return (data || []).map(mapContract); }
export function mapTasks(data: ApiTask[]): UiTask[] { return (data || []).map(mapTask); }
export function mapManagerTasks(data: ApiManagerTask[]): UiManagerTask[] { return (data || []).map(mapManagerTask); }
export function mapApprovals(data: ApiApproval[]): UiApproval[] { return (data || []).map(mapApproval); }
export function mapTaskComments(data: ApiTaskComment[]): UiTaskComment[] { return (data || []).map(mapTaskComment); }
export function mapNotifications(data: ApiNotification[]): UiNotification[] { return (data || []).map(mapNotification); }
export function mapTaskTypes(data: ApiTaskType[]) { return (data || []).map(mapTaskType); }

// ==================== CALCULATE STATS FROM DATA ====================

export function calculateStats(
  clients: UiClient[],
  lawyers: UiLawyer[],
  tasks: UiTask[],
  contracts: UiContract[],
  approvals: UiApproval[]
) {
  return {
    totalClients: clients.length,
    activeClients: clients.filter(c => c.status === 'active').length,
    totalLawyers: lawyers.length,
    activeLawyers: lawyers.filter(l => l.status === 'active').length,
    pendingApprovals: approvals.filter(a => a.status === 'pending').length,
    pendingNewTaskApprovals: approvals.filter(a => a.status === 'pending' && a.approvalType === 'new_task').length,
    pendingStatusChanges: approvals.filter(a => a.status === 'pending' && a.approvalType === 'status_change').length,
    pendingNotes: approvals.filter(a => a.status === 'pending' && a.approvalType === 'note').length,
    totalTasks: tasks.length,
    activeTasks: tasks.filter(t => !['completed', 'cancelled'].includes(t.status)).length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    pendingTasks: tasks.filter(t => ['pending', 'new'].includes(t.status)).length,
    inProgressTasks: tasks.filter(t => !['completed', 'cancelled', 'new', 'pending', 'rejected'].includes(t.status)).length,
    cancelledTasks: tasks.filter(t => t.status === 'cancelled').length,
    rejectedTasks: tasks.filter(t => t.status === 'rejected').length,
    totalContracts: contracts.length,
    activeContracts: contracts.filter(c => c.status === 'active').length,
  };
}