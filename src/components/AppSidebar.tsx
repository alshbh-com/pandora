import {
  LayoutDashboard, Package, Building2, Box,
  Truck, Wallet, CreditCard, ScrollText, Settings, LogOut, Archive, Building,
  PackageSearch, Search, Printer, DollarSign, MapPin, Users, BarChart3,
  TrendingUp, Calendar, UserCheck, MessageSquare, Locate, FileSpreadsheet,
  CircleDot, Calculator, Contact, ClipboardList, Trash2, FileBarChart, Navigation2, BookOpen
} from 'lucide-react';
import logo from '@/assets/logo.jpg';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, urlToSectionKey } from '@/hooks/usePermissions';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const mainItems = [
  { title: 'لوحة التحكم', url: '/', icon: LayoutDashboard },
  { title: 'الأوردرات', url: '/orders', icon: Package },
  { title: 'جميع الأوردرات', url: '/unassigned-orders', icon: PackageSearch },
  { title: 'الأوردرات القديمة', url: '/closed-orders', icon: Archive },
  { title: 'استيراد Excel', url: '/excel-import', icon: ClipboardList },
  { title: 'بحث شامل', url: '/search', icon: Search },
];

const managementItems = [
  { title: 'المكاتب', url: '/offices', icon: Building2 },
  { title: 'أسعار التوصيل', url: '/delivery-prices', icon: MapPin },
  { title: 'المنتجات', url: '/products', icon: Box },
  { title: 'العملاء', url: '/customers', icon: Contact },
  { title: 'المندوبين', url: '/couriers', icon: Truck },
  { title: 'المستخدمين', url: '/users', icon: Users },
  { title: 'إدارة الحالات', url: '/status-management', icon: CircleDot },
];

const accountingItems = [
  { title: 'تحصيلات المندوبين', url: '/courier-collections', icon: Wallet },
  { title: 'حسابات المكاتب', url: '/office-accounts', icon: Building },
  { title: 'السلفات والخصومات', url: '/advances', icon: DollarSign },
];

const reportsItems = [
  { title: 'التقرير اليومي', url: '/daily-report', icon: Calendar },
  { title: 'التقارير المالية', url: '/financial-reports', icon: BarChart3 },
  { title: 'تقرير المكاتب الجديد', url: '/office-report', icon: FileBarChart },
  { title: 'إحصائيات المناديب', url: '/courier-stats', icon: UserCheck },
  { title: 'تتبع المناديب', url: '/courier-tracking', icon: Navigation2 },
  { title: 'إحصائيات المكاتب', url: '/office-stats', icon: TrendingUp },
  { title: 'تقرير الأرباح', url: '/profit-report', icon: Calculator },
];

const toolsItems = [
  { title: 'شرح السيستم', url: '/system-guide', icon: BookOpen },
  { title: 'تتبع الشحنات', url: '/tracking', icon: Locate },
  { title: 'الطباعة', url: '/print', icon: Printer },
  { title: 'ملاحظات الأوردرات', url: '/order-notes', icon: MessageSquare },
  { title: 'التواصل الداخلي', url: '/chat', icon: MessageSquare },
  { title: 'تصدير البيانات', url: '/data-export', icon: FileSpreadsheet },
  { title: 'سجل الحركات', url: '/logs', icon: ScrollText },
  { title: 'سلة المحذوفات', url: '/trash', icon: Trash2 },
  { title: 'الإعدادات', url: '/settings', icon: Settings },
  { title: 'سيستم الحسابات', url: '/accounting-system', icon: Calculator },
];

const groups = [
  { label: 'الرئيسية', items: mainItems },
  { label: 'الإدارة', items: managementItems },
  { label: 'الحسابات', items: accountingItems },
  { label: 'التقارير', items: reportsItems },
  { label: 'الأدوات', items: toolsItems },
];

export function AppSidebar() {
  const { logout } = useAuth();
  const { canView } = usePermissions();

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <img src={logo} alt="The Pilito" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
          <span className="text-lg font-extrabold text-sidebar-foreground group-data-[collapsible=icon]:hidden tracking-wide">
            The Pilito
          </span>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {groups.map((group) => {
          const visibleItems = group.items.filter(item => canView(urlToSectionKey(item.url)));
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink to={item.url} end={item.url === '/'} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-2">
        <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={logout}>
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">تسجيل خروج</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
