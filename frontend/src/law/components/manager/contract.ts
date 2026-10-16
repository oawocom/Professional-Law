// Contract types and interfaces

export type ContractStatus = 'active' | 'inactive' | 'completed';
export type TaskCategory = 'Lizinq' | 'Bank' | 'Əmək mübahisəsi' | 'Əmlak' | 'Vergi' | 'Gömrük' | 'Cinayət' | 'İnzibati' | 'Ailə' | 'Digər';

export interface Contract {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  taskQuota: number; // maksimum tapşırıq sayı
  tasksUsed: number; // istifadə edilmiş tapşırıq sayı
  tasksRemaining: number; // qalan tapşırıq sayı
  allowedCategories: TaskCategory[]; // bu müqavilə üzrə icazə verilən iş növləri
  autoRenew: boolean; // avtomatik yeniləmə
  staticLawyerFee: number; // statik vəkil haqqı (manatla)
  notes?: string;
  createdAt: string;
  lastModified: string;
  assignedLawyer?: string;
  completedTasks: number;
  inProgressTasks: number;
  categoryStats?: {
    category: TaskCategory;
    count: number;
  }[];
}

// Helper functions
export const getContractStatusColor = (status: ContractStatus): string => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'inactive': return 'bg-gray-100 text-gray-800';
    case 'completed': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getQuotaUsageColor = (percentage: number): string => {
  if (percentage >= 95) return 'bg-red-500';
  if (percentage >= 80) return 'bg-yellow-500';
  if (percentage >= 60) return 'bg-orange-500';
  return 'bg-green-500';
};

export const getQuotaUsageStatus = (percentage: number): string => {
  if (percentage >= 95) return 'Kritik';
  if (percentage >= 80) return 'Diqqət';
  if (percentage >= 60) return 'Yaxşı';
  return 'Əla';
};

export const calculateContractStatus = (contract: Contract): ContractStatus => {
  // Bütün tapşırıqlar tamamlandıqda müqavilə completed statusuna keçir
  if (contract.completedTasks === contract.tasksUsed && contract.tasksUsed > 0 && contract.inProgressTasks === 0) {
    return 'completed';
  }
  
  // Aktiv və ya passiv
  return contract.status;
};

export const getContractStatusLabel = (status: ContractStatus): string => {
  switch (status) {
    case 'active': return 'Aktiv';
    case 'inactive': return 'Passiv';
    case 'completed': return 'Tamamlanmış';
    default: return 'Naməlum';
  }
};
