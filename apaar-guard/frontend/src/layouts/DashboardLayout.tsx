import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UploadCloud, 
  ShieldCheck, 
  BarChart3, 
  FileText, 
  History, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  HelpCircle,
  Settings,
  Wrench
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n/LanguageContext';
import { InstitutionalHeader } from '../components/common/InstitutionalHeader';
import { InstitutionalFooter } from '../components/common/InstitutionalFooter';

export const DashboardLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Persisted Collapsed State
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('apaar_sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Toggle with safe localStorage persistence
  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('apaar_sidebar_collapsed', String(next));
      } catch {
        // Safe fallback
      }
      return next;
    });
  };

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock mobile body scroll when drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Navigation Items organized per PAKSHYA architecture
  const mainNavItems = [
    { label: t('navDashboard'), path: '/dashboard', icon: LayoutDashboard, roles: ['institution_admin', 'verification_officer'] },
    { label: t('navStudents'), path: '/students', icon: Users, roles: ['institution_admin', 'verification_officer'] },
    { label: t('navBulkImport'), path: '/import', icon: UploadCloud, roles: ['institution_admin'] },
    { label: t('navVerification'), path: '/verification', icon: ShieldCheck, roles: ['institution_admin', 'verification_officer'] },
    { label: t('navIntake'), path: '/intake', icon: BarChart3, roles: ['institution_admin', 'verification_officer'] },
    { label: t('navReports'), path: '/reports', icon: FileText, roles: ['institution_admin', 'verification_officer'] },
  ];

  const additionalNavItems = [
    { label: t('navAudit'), path: '/audit', icon: History, roles: ['institution_admin', 'verification_officer'] },
    { label: t('navRules'), path: '/rules', icon: BookOpen, roles: ['institution_admin', 'verification_officer'] },
    { label: t('navHelp'), path: '/help', icon: HelpCircle, roles: ['institution_admin', 'verification_officer'] },
    { label: t('navSettings'), path: '/settings', icon: Settings, roles: ['institution_admin'] },
    { label: t('navTools'), path: '/tools', icon: Wrench, roles: ['institution_admin', 'verification_officer'] },
  ];

  const filteredMainNav = mainNavItems.filter(item => user && item.roles.includes(user.role));
  const filteredAdditionalNav = additionalNavItems.filter(item => user && item.roles.includes(user.role));

  const allNav = [...mainNavItems, ...additionalNavItems];
  const currentNav = allNav.find(item => item.path === location.pathname);
  const breadcrumb = currentNav ? currentNav.label : 'Overview';

  // Floating Collapsed Sidebar Navigation Tooltip State & Handlers
  const [activeTooltip, setActiveTooltip] = useState<{
    id: string;
    label: string;
    top: number;
  } | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = (id: string, label: string, element: HTMLElement) => {
    if (!collapsed) return;
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    const rect = element.getBoundingClientRect();
    setActiveTooltip({
      id,
      label,
      top: rect.top + rect.height / 2,
    });
  };

  const hideTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 120);
  };

  const keepTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    setActiveTooltip(null);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
  }, [collapsed, location.pathname]);

  const displayTooltipLabel = activeTooltip
    ? (allNav.find(x => x.path === activeTooltip.id)?.label || 
       (activeTooltip.id === 'toggle_sidebar' ? 'Expand sidebar (Ctrl+B)' : 
        activeTooltip.id === 'logout' ? t('signOut', 'Sign Out') : activeTooltip.label))
    : '';

  return (
    <div className="h-screen flex flex-col bg-[#F6F8FC] text-[#172033] overflow-hidden">
      {/* Institutional Branding Masthead (Inspired by PAKSHYA) */}
      <InstitutionalHeader />

      {/* Main App Shell */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* DESKTOP FIXED & COLLAPSIBLE SIDEBAR */}
        <aside 
          className={`hidden md:flex flex-col shrink-0 bg-[#142B4A] text-white z-20 h-full select-none border-r border-white/10 transition-[width] duration-250 ease-in-out ${
            collapsed ? 'w-[76px]' : 'w-[260px]'
          }`}
          aria-label="Institutional Navigation"
        >
          {/* Sidebar Section 1: Top Navigation Controls */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
            {collapsed ? (
              <div className="w-full flex items-center justify-center relative">
                <button
                  onClick={toggleSidebar}
                  onMouseEnter={(e) => showTooltip('toggle_sidebar', 'Expand sidebar (Ctrl+B)', e.currentTarget)}
                  onMouseLeave={hideTooltip}
                  onFocus={(e) => showTooltip('toggle_sidebar', 'Expand sidebar (Ctrl+B)', e.currentTarget)}
                  onBlur={() => setActiveTooltip(null)}
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-blue-600 text-blue-300 hover:text-white flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Expand sidebar (Ctrl+B)"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-[11px] font-bold tracking-wider uppercase text-blue-300/80">
                  Navigation
                </span>
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  title="Collapse sidebar (Ctrl+B)"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Nav Items List */}
          <nav 
            onScroll={() => setActiveTooltip(null)}
            className="flex-1 px-3 py-3 space-y-4 overflow-y-auto overflow-x-hidden"
          >
            {/* Main Modules Group */}
            <div className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('nav_main_modules', 'Main Modules')}
                </div>
              )}
              {filteredMainNav.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.path} className="relative">
                    <NavLink
                      to={item.path}
                      aria-label={item.label}
                      aria-describedby={collapsed && activeTooltip?.id === item.path ? 'sidebar-nav-tooltip' : undefined}
                      onMouseEnter={(e) => showTooltip(item.path, item.label, e.currentTarget)}
                      onMouseLeave={hideTooltip}
                      onFocus={(e) => showTooltip(item.path, item.label, e.currentTarget)}
                      onBlur={() => setActiveTooltip(null)}
                      className={({ isActive }) =>
                        `flex items-center ${
                          collapsed ? 'justify-center px-0 w-11 h-10 mx-auto' : 'space-x-3 px-3 py-2'
                        } rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm font-semibold'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </div>
                );
              })}
            </div>

            {/* Additional Modules Group */}
            <div className="space-y-1 pt-2 border-t border-white/10">
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('nav_operations_support', 'Operations & Support')}
                </div>
              )}
              {filteredAdditionalNav.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.path} className="relative">
                    <NavLink
                      to={item.path}
                      aria-label={item.label}
                      aria-describedby={collapsed && activeTooltip?.id === item.path ? 'sidebar-nav-tooltip' : undefined}
                      onMouseEnter={(e) => showTooltip(item.path, item.label, e.currentTarget)}
                      onMouseLeave={hideTooltip}
                      onFocus={(e) => showTooltip(item.path, item.label, e.currentTarget)}
                      onBlur={() => setActiveTooltip(null)}
                      className={({ isActive }) =>
                        `flex items-center ${
                          collapsed ? 'justify-center px-0 w-11 h-10 mx-auto' : 'space-x-3 px-3 py-2'
                        } rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm font-semibold'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* User Status Bar in Sidebar Footer */}
          <div className="p-3 border-t border-white/10 bg-[#0e1f36] shrink-0">
            {collapsed ? (
              <div className="flex justify-center">
                <button
                  onClick={handleLogout}
                  onMouseEnter={(e) => showTooltip('logout', t('signOut', 'Sign Out'), e.currentTarget)}
                  onMouseLeave={hideTooltip}
                  onFocus={(e) => showTooltip('logout', t('signOut', 'Sign Out'), e.currentTarget)}
                  onBlur={() => setActiveTooltip(null)}
                  className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  aria-label={t('signOut', 'Sign Out')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold text-xs shrink-0">
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate m-0 leading-tight">
                      {user?.full_name}
                    </p>
                    <p className="text-[10px] text-blue-300 capitalize truncate m-0">
                      {isAdmin ? t('roleAdmin') : t('roleOfficer')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title={t('signOut', 'Sign Out')}
                  className="text-slate-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* FLOATING COLLAPSED SIDEBAR NAVIGATION TOOLTIP */}
        {collapsed && activeTooltip && (
          <div
            role="tooltip"
            id="sidebar-nav-tooltip"
            onMouseEnter={keepTooltip}
            onMouseLeave={hideTooltip}
            className="fixed z-[9999] pointer-events-auto flex items-center transition-all duration-150 ease-out animate-in fade-in zoom-in-95"
            style={{
              left: '84px',
              top: `${activeTooltip.top}px`,
              transform: 'translateY(-50%)',
            }}
          >
            {/* Transparent hover bridge bridging the 8px gap between icon and tooltip */}
            <div className="absolute right-full top-0 w-3 h-full cursor-default" />

            {/* Tooltip Card */}
            <div className="relative px-3 py-1.5 bg-[#142B4A] text-white text-xs font-semibold rounded-xl whitespace-nowrap shadow-2xl border border-blue-900/80 tracking-tight flex items-center gap-1.5 ring-1 ring-white/10 select-none">
              {/* Arrow pointing left */}
              <div 
                className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-4 border-y-transparent border-r-4 border-r-[#142B4A]" 
                aria-hidden="true" 
              />
              <span>{displayTooltipLabel}</span>
            </div>
          </div>
        )}

        {/* MOBILE DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#142B4A] text-white shadow-2xl z-10">
              <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block leading-tight">{t('appName')}</span>
                    <span className="text-[10px] text-blue-200">{t('sihPrototype')}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pb-1">
                  {t('nav_main_modules', 'Main Modules')}
                </div>
                {filteredMainNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                          isActive ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-300 hover:bg-white/10'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-3 pb-1">
                  {t('nav_operations_support', 'Operations & Support')}
                </div>
                {filteredAdditionalNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                          isActive ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-300 hover:bg-white/10'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-white/10 bg-[#0e1f36] shrink-0">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-rose-600/90 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('signOut')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN VIEWPORT */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#F6F8FC]">
          {/* Sub-Header Navigation Bar */}
          <div className="h-12 shrink-0 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 z-10">
            <div className="flex items-center space-x-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Open mobile menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Desktop quick toggle */}
              <button
                onClick={toggleSidebar}
                className="hidden md:flex text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer items-center justify-center"
                title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              >
                {collapsed ? <PanelLeftOpen className="w-4 h-4 text-blue-600" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>

              {/* Breadcrumb Path */}
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span className="hidden sm:inline">{t('nav_portal', 'Portal')}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                <span className="font-semibold text-slate-900">{breadcrumb}</span>
              </div>
            </div>

            {/* Sub-Header Quick Action: Help Link */}
            <div className="flex items-center space-x-2 text-xs">
              <NavLink 
                to="/help" 
                className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('navHelp')}</span>
              </NavLink>
            </div>
          </div>

          {/* Scrollable Viewport with Footer */}
          <main 
            id="main-content" 
            className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 [scrollbar-gutter:stable] min-h-0 focus:outline-none"
            tabIndex={-1}
          >
            <Outlet />
            <InstitutionalFooter />
          </main>
        </div>
      </div>
    </div>
  );
};
