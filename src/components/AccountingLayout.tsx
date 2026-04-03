import { Outlet, useNavigate } from 'react-router-dom';
import {
  Building2, Calculator, ClipboardList, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator,
  SidebarProvider, SidebarTrigger, SidebarInset,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import AccountingPasswordGate from '@/components/AccountingPasswordGate';

const navItems = [
  { title: 'المكاتب - اليوميات', url: '/accounting-system', icon: Building2, end: true },
  { title: 'الحسابات', url: '/accounting-system/dashboard', icon: Calculator },
  { title: 'تقفيلة المكاتب', url: '/accounting-system/office-settlement', icon: ClipboardList },
];

export default function AccountingLayout() {
  const navigate = useNavigate();

  return (
    <AccountingPasswordGate>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar side="right" collapsible="icon">
            <SidebarHeader className="p-4">
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                  ح
                </div>
                <span className="text-lg font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                  سيستم الحسابات
                </span>
              </div>
            </SidebarHeader>
            <SidebarSeparator />
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">الأقسام</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild tooltip={item.title}>
                          <NavLink to={item.url} end={item.end} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="p-2">
              <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate('/')}>
                <ArrowRight className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">العودة للنظام الرئيسي</span>
              </Button>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex-1 min-w-0">
            <header className="flex h-12 items-center border-b border-border px-4">
              <SidebarTrigger />
            </header>
            <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden" dir="rtl">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AccountingPasswordGate>
  );
}
