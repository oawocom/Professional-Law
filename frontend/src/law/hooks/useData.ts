import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { reportPermissionDenied, handleExpiredLogin } from '../utils/apiHelper';
import type {
  UiLawyer,
  UiClient,
  UiContract,
  UiTask,
  UiApproval,
  UiNotification,
  UiTaskComment,
} from '../utils/dataMappers';

const API_BASE = '/api';

// ============================================================
// law_token varsa → /api/sf/... + Bearer token; yoxdursa → /api/...
// Büro ünvandan (domendən) tanınır.
// ============================================================
function getLawToken(): string {
  try {
    return localStorage.getItem('law_token') || '';
  } catch (e) {
    return '';
  }
}

async function fetchApi(endpoint: string, tenantId: number | null, options?: RequestInit) {
  if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');

  var token = getLawToken();
  var base = token ? API_BASE + '/sf' : API_BASE;
  var url = base + endpoint;

  var headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  var response = await fetch(url, {
    credentials: 'include',
    headers: {
      ...headers,
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    var errorText = await response.text().catch(function() { return 'Network error'; });
    if (response.status === 403) {
      reportPermissionDenied(errorText);
    }
    handleExpiredLogin(response.status, errorText);
    throw new Error(errorText || 'HTTP ' + response.status);
  }

  return response.json();
}

// ==================== MANAGER DATA HOOK ====================

export function useManagerData(tenantId: number | null) {
  const [lawyers, setLawyers] = useState<UiLawyer[]>([]);
  const [clients, setClients] = useState<UiClient[]>([]);
  const [contracts, setContracts] = useState<UiContract[]>([]);
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [approvals, setApprovals] = useState<UiApproval[]>([]);
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [managerTasks, setManagerTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;

    setError(null);

    try {
      const [
        lawyersData, clientsData, contractsData, tasksData,
        approvalsData, taskTypesData, managerTasksData, statsData,
      ] = await Promise.all([
        fetchApi('/lawyers', tenantId).catch(() => []),
        fetchApi('/clients', tenantId).catch(() => []),
        fetchApi('/contracts', tenantId).catch(() => []),
        fetchApi('/tasks', tenantId).catch(() => []),
        fetchApi('/approvals', tenantId).catch(() => []),
        fetchApi('/task-types', tenantId).catch(() => []),
        Promise.resolve([]), // manager-tasks removed - causes 404 when law_token present
        fetchApi('/stats', tenantId).catch(() => null),
      ]);

      setLawyers(lawyersData || []);
      setClients(clientsData || []);
      setContracts(contractsData || []);
      setTasks(tasksData || []);
      setApprovals(approvalsData || []);
      setTaskTypes(taskTypesData || []);
      setManagerTasks(managerTasksData || []);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch manager data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // İlk yüklənmə
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Avtomatik real-time refresh: hər 15 saniyə
  // Tab arxa fonda olarsa polling dayanır
  useEffect(() => {
    if (!tenantId) return;

    var intervalId: any = null;

    var startPolling = function() {
      if (intervalId) return;
      intervalId = setInterval(function() {
        if (document.visibilityState === 'visible') {
          fetchAll();
        }
      }, 15000);
    };

    var stopPolling = function() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    var onVisibility = function() {
      if (document.visibilityState === 'visible') {
        fetchAll();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return function() {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tenantId, fetchAll]);

  return {
    lawyers,
    clients,
    contracts,
    tasks,
    approvals,
    taskTypes,
    managerTasks,
    stats,
    loading,
    error,
    refresh: fetchAll,
  };
}

// ==================== CLIENT DATA HOOK ====================

export function useClientData(tenantId: number | null, clientId: number | null) {
  const [contracts, setContracts] = useState<UiContract[]>([]);
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [lawyers, setLawyers] = useState<UiLawyer[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const [contractsData, tasksData, lawyersData, statsData] = await Promise.all([
        fetchApi('/contracts', tenantId).catch(() => []),
        fetchApi('/tasks', tenantId).catch(() => []),
        fetchApi('/lawyers', tenantId).catch(() => []),
        fetchApi('/stats', tenantId).catch(() => null),
      ]);

      if (clientId) {
        const myContracts = (contractsData || []).filter((c: any) => c.client_id === clientId);
        setContracts(myContracts);
        // Tapşırığı birbaşa client_id sahəsinə görə süz (müqavilə vasitəsilə
        // deyil) — əks halda müqaviləsiz (contract_id boş) və ya müqavilə
        // siyahısında olmayan tapşırıqlar müştəridən gizlənirdi.
        setTasks((tasksData || []).filter((t: any) => t.client_id === clientId));
      } else {
        setContracts(contractsData || []);
        setTasks(tasksData || []);
      }

      setLawyers(lawyersData || []);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch client data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, clientId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // QEYD: bu hook əvvəllər YALNIZ ilk yüklənmədə məlumat çəkirdi (useManagerData-dan
  // fərqli olaraq heç bir avtomatik yenilənməsi yox idi). Nəticədə menecerin
  // yaratdığı/dəyişdiyi müqavilə, tapşırıq və ya vəkil təhkimatı, müştərinin
  // paneli artıq açıq olduğu halda, səhifəni yeniləməyənə qədər ORADA
  // GÖRÜNMÜRDÜ — "bir tərəfin etdiyi digər tərəfə çatmır" şikayətinin əsas
  // texniki səbəbi budur. Menecer paneli ilə eyni 15 saniyəlik "canlı"
  // yenilənmə (yalnız tab aktiv olduqda) buraya da əlavə edildi.
  useEffect(() => {
    if (!tenantId) return;

    var intervalId: any = null;

    var startPolling = function() {
      if (intervalId) return;
      intervalId = setInterval(function() {
        if (document.visibilityState === 'visible') {
          fetchAll();
        }
      }, 15000);
    };

    var stopPolling = function() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    var onVisibility = function() {
      if (document.visibilityState === 'visible') {
        fetchAll();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return function() {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tenantId, fetchAll]);

  return {
    contracts,
    tasks,
    lawyers,
    stats,
    loading,
    error,
    refresh: fetchAll,
  };
}

// ==================== LAWYER DATA HOOK ====================

export function useLawyerData(tenantId: number | null, lawyerId: number | null) {
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [clients, setClients] = useState<UiClient[]>([]);
  const [contracts, setContracts] = useState<UiContract[]>([]);
  const [managerTasks, setManagerTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const [tasksData, clientsData, contractsData, managerTasksData] = await Promise.all([
        fetchApi('/tasks', tenantId).catch(() => []),
        fetchApi('/clients', tenantId).catch(() => []),
        fetchApi('/contracts', tenantId).catch(() => []),
        Promise.resolve([]), // manager-tasks not needed
      ]);

      if (lawyerId) {
        var myTasks = (tasksData || []).filter((t: any) => t.assigned_to === lawyerId);
        setTasks(myTasks);
        setManagerTasks((managerTasksData || []).filter((t: any) => t.assigned_to === lawyerId));

        // "Müqavilələrim"/"Müştərilərim" — yalnız bu vəkilin təhkim olunduğu
        // tapşırıqlara aid müqavilə/müştəriləri göstər (bütün sistemi yox).
        var myContractIds = new Set(myTasks.map((t: any) => t.contract_id).filter(Boolean));
        var myContracts = (contractsData || []).filter((c: any) => myContractIds.has(c.id));
        setContracts(myContracts);

        var myClientIds = new Set<number>();
        myTasks.forEach((t: any) => { if (t.client_id) myClientIds.add(t.client_id); });
        myContracts.forEach((c: any) => { if (c.client_id) myClientIds.add(c.client_id); });
        setClients((clientsData || []).filter((c: any) => myClientIds.has(c.id)));
      } else {
        setTasks(tasksData || []);
        setManagerTasks(managerTasksData || []);
        setClients(clientsData || []);
        setContracts(contractsData || []);
      }
    } catch (err) {
      console.error('Failed to fetch lawyer data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, lawyerId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // QEYD: müştəri hook-unda olduğu kimi, vəkil paneli də əvvəllər yalnız ilk
  // yüklənmədə məlumat çəkirdi — menecerin yeni tapşırıq/müqavilə yaratması
  // və ya təhkim etməsi, vəkilin paneli açıq qaldığı müddətcə görünmürdü.
  // Menecer paneli ilə eyni 15 saniyəlik "canlı" yenilənmə əlavə edildi.
  useEffect(() => {
    if (!tenantId) return;

    var intervalId: any = null;

    var startPolling = function() {
      if (intervalId) return;
      intervalId = setInterval(function() {
        if (document.visibilityState === 'visible') {
          fetchAll();
        }
      }, 15000);
    };

    var stopPolling = function() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    var onVisibility = function() {
      if (document.visibilityState === 'visible') {
        fetchAll();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return function() {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tenantId, fetchAll]);

  return {
    tasks,
    clients,
    contracts,
    managerTasks,
    loading,
    error,
    refresh: fetchAll,
  };
}

// ==================== NOTIFICATIONS HOOK ====================

export function useNotifications(tenantId: number | null, userId?: number) {
  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      const params = userId ? '&user_id=' + userId : '';
      const data = await fetchApi('/notifications?' + params, tenantId);
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n: any) => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    refresh: fetchNotifications,
  };
}

// ==================== TASK COMMENTS HOOK ====================

export function useTaskComments(tenantId: number | null, taskId: number | null) {
  const [comments, setComments] = useState<UiTaskComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    if (!tenantId || !taskId) return;

    setLoading(true);
    try {
      const data = await fetchApi('/task-comments?task_id=' + taskId, tenantId);
      setComments(data || []);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, taskId]);

  const addComment = useCallback(async (content: string) => {
    if (!tenantId || !taskId) return;

    try {
      await fetchApi('/task-comments', tenantId, {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, content }),
      });
      await fetchComments();
      toast.success('Şərh əlavə edildi');
    } catch (err) {
      toast.error('Şərh əlavə edilmədi');
      throw err;
    }
  }, [tenantId, taskId, fetchComments]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return {
    comments,
    loading,
    addComment,
    refresh: fetchComments,
  };
}

// ==================== REPORTS HOOK ====================

export function useReports(tenantId: number | null, options?: { role?: string; lawyerId?: number | null; clientId?: number | null; period?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      var [tasksData, statsData] = await Promise.all([
        fetchApi('/tasks', tenantId).catch(() => []),
        fetchApi('/stats', tenantId).catch(() => ({})),
      ]);

      var tasks = Array.isArray(tasksData) ? tasksData : [];

      // Filter by role
      if (options?.lawyerId) {
        tasks = tasks.filter((t: any) => t.assigned_to === options.lawyerId);
      }
      if (options?.clientId) {
        tasks = tasks.filter((t: any) => t.client_id === options.clientId);
      }

      // Filter by period
      if (options?.period && options.period !== 'all') {
        var now = new Date();
        var cutoff = new Date();
        if (options.period === 'week') cutoff.setDate(now.getDate() - 7);
        else if (options.period === 'month') cutoff.setMonth(now.getMonth() - 1);
        else if (options.period === 'quarter') cutoff.setMonth(now.getMonth() - 3);
        else if (options.period === 'year') cutoff.setFullYear(now.getFullYear() - 1);

        tasks = tasks.filter((t: any) => {
          var created = new Date(t.created_at);
          return created >= cutoff;
        });
      }

      var completed = tasks.filter((t: any) => t.status === 'completed');
      var pending = tasks.filter((t: any) => t.status === 'pending' || t.status === 'new' || t.status === 'in_progress');
      var rejected = tasks.filter((t: any) => t.status === 'cancelled' || t.status === 'rejected');
      var overdue = tasks.filter((t: any) => {
        if (!t.deadline) return false;
        return new Date(t.deadline) < new Date() && t.status !== 'completed' && t.status !== 'cancelled';
      });

      var totalClaim = tasks.reduce((sum: number, t: any) => sum + (parseFloat(t.claim_amount) || 0), 0);

      setData({
        tasks_created: tasks.length,
        tasks_completed: completed.length,
        tasks_pending: pending.length,
        tasks_rejected: rejected.length,
        completion_rate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,
        avg_completion_days: 0,
        overdue_count: overdue.length,
        total_claim_amount: totalClaim,
      });
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.role, options?.lawyerId, options?.clientId, options?.period]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    data,
    loading,
    refresh: fetchReports,
  };
}

// ==================== DATA MUTATIONS HOOK ====================

export function useDataMutations(tenantId: number | null) {
  // Lawyers
  const createLawyer = useCallback(async (data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/lawyers', tenantId, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    toast.success('Vəkil əlavə edildi');
    return result;
  }, [tenantId]);

  const updateLawyer = useCallback(async (id: number, data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/lawyers/' + id, tenantId, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    toast.success('Vəkil yeniləndi');
    return result;
  }, [tenantId]);

  const deleteLawyer = useCallback(async (id: number) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    await fetchApi('/lawyers/' + id, tenantId, { method: 'DELETE' });
    toast.success('Vəkil silindi');
  }, [tenantId]);

  // Clients
  const createClient = useCallback(async (data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/clients', tenantId, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    toast.success('Müştəri əlavə edildi');
    return result;
  }, [tenantId]);

  const updateClient = useCallback(async (id: number, data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/clients/' + id, tenantId, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    toast.success('Müştəri yeniləndi');
    return result;
  }, [tenantId]);

  const deleteClient = useCallback(async (id: number) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    await fetchApi('/clients/' + id, tenantId, { method: 'DELETE' });
    toast.success('Müştəri silindi');
  }, [tenantId]);

  // Contracts
  const createContract = useCallback(async (data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/contracts', tenantId, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    toast.success('Müqavilə yaradıldı');
    return result;
  }, [tenantId]);

  const updateContract = useCallback(async (id: number, data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/contracts/' + id, tenantId, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    toast.success('Müqavilə yeniləndi');
    return result;
  }, [tenantId]);

  const deleteContract = useCallback(async (id: number) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    await fetchApi('/contracts/' + id, tenantId, { method: 'DELETE' });
    toast.success('Müqavilə silindi');
  }, [tenantId]);

  // Tasks
  const createTask = useCallback(async (data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/tasks', tenantId, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    toast.success('Tapşırıq yaradıldı');
    return result;
  }, [tenantId]);

  const updateTask = useCallback(async (id: number, data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/tasks/' + id, tenantId, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    toast.success('Tapşırıq yeniləndi');
    return result;
  }, [tenantId]);

  const deleteTask = useCallback(async (id: number) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    await fetchApi('/tasks/' + id, tenantId, { method: 'DELETE' });
    toast.success('Tapşırıq silindi');
  }, [tenantId]);

  // Approvals
  const createApproval = useCallback(async (data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/approvals', tenantId, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    toast.success('Təsdiq sorğusu göndərildi');
    return result;
  }, [tenantId]);

  const updateApproval = useCallback(async (id: number, data: any) => {
    if (!tenantId) throw new Error('Büro hələ müəyyən olunmayıb');
    const result = await fetchApi('/approvals/' + id, tenantId, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    toast.success('Təsdiq statusu yeniləndi');
    return result;
  }, [tenantId]);

  return {
    createLawyer,
    updateLawyer,
    deleteLawyer,
    createClient,
    updateClient,
    deleteClient,
    createContract,
    updateContract,
    deleteContract,
    createTask,
    updateTask,
    deleteTask,
    createApproval,
    updateApproval,
  };
}