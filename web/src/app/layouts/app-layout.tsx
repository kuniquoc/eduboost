import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth-store';
import {
  BookOpen, Bot, User, LayoutDashboard,
  GraduationCap, LogOut, ChevronLeft, Menu,
  Database, MessageCircle, Shield,
} from 'lucide-react';
import { ROUTES } from '@/shared/lib/constants';
import { Button } from '@/shared/ui/button';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useState } from 'react';
import type { UserRole } from '@/features/auth/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const teacherNav: NavItem[] = [
  { label: 'Lớp học', href: ROUTES.TEACHER_CLASSES, icon: BookOpen },
  { label: 'Kho quiz', href: ROUTES.TEACHER_QUIZ_POOL, icon: Database },
  { label: 'Hồ sơ', href: ROUTES.TEACHER_PROFILE, icon: User },
];

const studentNav: NavItem[] = [
  { label: 'Tổng quan', href: ROUTES.STUDENT_DASHBOARD, icon: LayoutDashboard },
  { label: 'Lớp học', href: ROUTES.STUDENT_CLASSES, icon: GraduationCap },
  { label: 'AI Chat', href: ROUTES.STUDENT_AI_CHAT, icon: MessageCircle },
  { label: 'Tài liệu', href: ROUTES.STUDENT_AI_LAB, icon: Bot },
  { label: 'Kho quiz', href: ROUTES.STUDENT_QUIZ_POOL, icon: Database },
  { label: 'Hồ sơ', href: ROUTES.STUDENT_PROFILE, icon: User },
];

const adminNav: NavItem[] = [
  { label: 'Tổng quan', href: ROUTES.ADMIN_DASHBOARD, icon: Shield },
];

function SidebarContent({
  items,
  collapsed,
}: {
  items: NavItem[];
  collapsed: boolean;
}) {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        const navLink = (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        );

        if (!collapsed) return navLink;

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger render={<NavLink to={item.href} className={cn(
              'flex items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )} />}>
              <item.icon className="h-5 w-5 shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

export function AppLayout({ role }: { role: UserRole }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = role === 'teacher' ? teacherNav : role === 'admin' ? adminNav : studentNav;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar transition-all duration-200 lg:relative lg:z-auto',
          collapsed ? 'w-16' : 'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className={cn('flex h-16 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'px-4')}>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              E
            </div>
            {!collapsed && <span className="text-lg font-semibold text-foreground">EduBoost</span>}
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarContent items={navItems} collapsed={collapsed} />
        </div>

        {/* Footer */}
        <div className="border-t border-border p-2">
          {!collapsed && user && (
            <div className="mb-2 px-3 py-2">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn('w-full justify-start gap-3 text-muted-foreground hover:text-destructive', collapsed && 'justify-center px-2')}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Đăng xuất</span>}
          </Button>
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground lg:flex"
        >
          <ChevronLeft className={cn('h-3 w-3 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 items-center gap-4 border-b border-border px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-lg font-semibold">EduBoost</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
