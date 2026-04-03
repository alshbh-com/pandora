import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PermissionLevel = 'view' | 'edit' | 'hidden';

export interface SectionPermission {
  section: string;
  permission: PermissionLevel;
}

// All sections that can be permissioned
export const ALL_SECTIONS = [
  { key: 'dashboard', label: 'لوحة التحكم', url: '/' },
  { key: 'orders', label: 'الأوردرات', url: '/orders' },
  { key: 'unassigned-orders', label: 'جميع الأوردرات', url: '/unassigned-orders' },
  { key: 'closed-orders', label: 'الأوردرات القديمة', url: '/closed-orders' },
  { key: 'search', label: 'بحث شامل', url: '/search' },
  { key: 'offices', label: 'المكاتب', url: '/offices' },
  { key: 'delivery-prices', label: 'أسعار التوصيل', url: '/delivery-prices' },
  { key: 'companies', label: 'الشركات', url: '/companies' },
  { key: 'products', label: 'المنتجات', url: '/products' },
  { key: 'customers', label: 'العملاء', url: '/customers' },
  { key: 'couriers', label: 'المندوبين', url: '/couriers' },
  { key: 'users', label: 'المستخدمين', url: '/users' },
  { key: 'status-management', label: 'إدارة الحالات', url: '/status-management' },
  { key: 'courier-collections', label: 'تحصيلات المندوبين', url: '/courier-collections' },
  { key: 'company-accounts', label: 'حسابات الشركات', url: '/company-accounts' },
  { key: 'office-accounts', label: 'حسابات المكاتب', url: '/office-accounts' },
  { key: 'advances', label: 'السلفات والخصومات', url: '/advances' },
  { key: 'office-settlement', label: 'تقفيلة المكاتب', url: '/office-settlement' },
  { key: 'daily-report', label: 'التقرير اليومي', url: '/daily-report' },
  { key: 'financial-reports', label: 'التقارير المالية', url: '/financial-reports' },
  { key: 'courier-stats', label: 'إحصائيات المناديب', url: '/courier-stats' },
  { key: 'office-stats', label: 'إحصائيات المكاتب', url: '/office-stats' },
  { key: 'profit-report', label: 'تقرير الأرباح', url: '/profit-report' },
  { key: 'tracking', label: 'تتبع الشحنات', url: '/tracking' },
  { key: 'print', label: 'الطباعة', url: '/print' },
  { key: 'order-notes', label: 'ملاحظات الأوردرات', url: '/order-notes' },
  { key: 'data-export', label: 'تصدير البيانات', url: '/data-export' },
  { key: 'logs', label: 'سجل الحركات', url: '/logs' },
  { key: 'trash', label: 'سلة المحذوفات', url: '/trash' },
  { key: 'office-report', label: 'تقرير المكاتب', url: '/office-report' },
  { key: 'settings', label: 'الإعدادات', url: '/settings' },
  { key: 'accounting-system', label: 'سيستم الحسابات', url: '/accounting-system' },
];

export function urlToSectionKey(url: string): string {
  if (url === '/') return 'dashboard';
  if (url.startsWith('/accounting-system')) return 'accounting-system';
  return url.replace(/^\//, '');
}

export function usePermissions() {
  const { user, isOwner, isOwnerOrAdmin } = useAuth();
  const [permissions, setPermissions] = useState<SectionPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPermissions([]); setLoading(false); return; }
    if (isOwner) { setPermissions([]); setLoading(false); return; } // Owner has full access

    const load = async () => {
      const { data } = await supabase
        .from('user_permissions')
        .select('section, permission')
        .eq('user_id', user.id);
      setPermissions((data || []) as SectionPermission[]);
      setLoading(false);
    };
    load();
  }, [user, isOwner]);

  const getPermission = (sectionKey: string): PermissionLevel => {
    if (isOwner) return 'edit'; // Owner always has full access
    const found = permissions.find(p => p.section === sectionKey);
    if (!found) return 'edit'; // Default: full access if no restriction set
    return found.permission as PermissionLevel;
  };

  const canView = (sectionKey: string): boolean => {
    const perm = getPermission(sectionKey);
    return perm === 'view' || perm === 'edit';
  };

  const canEdit = (sectionKey: string): boolean => {
    return getPermission(sectionKey) === 'edit';
  };

  const isHidden = (sectionKey: string): boolean => {
    return getPermission(sectionKey) === 'hidden';
  };

  return { permissions, loading, getPermission, canView, canEdit, isHidden };
}
