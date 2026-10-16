'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const ManagerDashboard = dynamic(() => import('@/law/components/manager/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })), { ssr: false });
const LawyerDashboard = dynamic(() => import('@/law/components/lawyer/LawyerDashboard').then(m => ({ default: m.LawyerDashboard })), { ssr: false });
const CustomerDashboard = dynamic(() => import('@/law/components/client/CustomerDashboard').then(m => ({ default: m.CustomerDashboard })), { ssr: false });

interface User {
  id: number;
  email: string;
  name: string;
  role: 'manager' | 'lawyer' | 'client';
  lawyer_id?: number;
  client_id?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('law_token');
    const storedUser = localStorage.getItem('law_user');
    
    if (!token || !storedUser) {
      router.push('/login');
      return;
    }
    
    try {
      setUser(JSON.parse(storedUser));
    } catch (e) {
      localStorage.removeItem('law_token');
      localStorage.removeItem('law_user');
      router.push('/login');
      return;
    }
    
    // the office of this address (its id gates the data hooks)
    fetch('/api/tenant')
      .then((res) => (res.ok ? res.json() : null))
      .then((t) => { if (t && t.id) setTenantId(t.id); })
      .catch(() => console.error('Failed to get office'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F07B6E] mx-auto"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {user.role === 'manager' && <ManagerDashboard tenantId={tenantId} />}
      {user.role === 'lawyer' && <LawyerDashboard tenantId={tenantId} lawyerId={user.lawyer_id} />}
      {user.role === 'client' && <CustomerDashboard tenantId={tenantId} clientId={user.client_id} />}
    </>
  );
}
