import React, { useState, useEffect } from 'react';
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
  Building2,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DemoBanner } from '../components/common/DemoBanner';

export const DashboardLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
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
        // Safe fallback in restricted environments
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

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['institution_admin', 'verification_officer'] },
    { label: 'Student Records', path: '/students', icon: Users, roles: ['institution_admin', 'verification_officer'] },
    // Bulk Import is strictly Admin only
    { label: 'Bulk Import', path: '/import', icon: UploadCloud, roles: ['institution_admin'] },
    { label: 'Verification Centre', path: '/verification', icon: ShieldCheck, roles: ['institution_admin', 'verification_officer'] },
    { label: 'Intake Monitoring', path: '/intake', icon: BarChart3, roles: ['institution_admin', 'verification_officer'] },
    { label: 'Reports', path: '/reports', icon: FileText, roles: ['institution_admin', 'verification_officer'] },
    { label: 'Audit Trail', path: '/audit', icon: History, roles: ['institution_admin', 'verification_officer'] },
  ];

  const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

  // Determine current breadcrumb
  const currentNav = navItems.find(item => item.path === location.pathname);
  const breadcrumb = currentNav ? currentNav.label : 'Overview';

  return (
    <div className="h-screen flex flex-col bg-[#F6F8FC] text-[#172033] overflow-hidden">
      {/* Top Demo Banner */}
      <div className="shrink-0 z-30">
        <DemoBanner />
      </div>

      {/* Main Shell: Sidebar + Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* DESKTOP FIXED & COLLAPSIBLE SIDEBAR */}
        <aside 
          className={`hidden md:flex flex-col shrink-0 bg-[#142B4A] text-white z-20 h-full select-none border-r border-white/10 transition-[width] duration-250 ease-in-out ${
            collapsed ? 'w-[76px]' : 'w-[260px]'
          }`}
          aria-label="Institutional Navigation"
        >
          {/* Sidebar Top: Logo & Toggle Button */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
            {collapsed ? (
              <div className="w-full flex items-center justify-center relative group">
                <button
                  onClick={toggleSidebar}
                  className="w-10 h-10 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  title="Expand sidebar (Ctrl+B)"
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpen className="w-5 h-5" />
                </button>
                {/* Floating tooltip */}
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50 border border-slate-700/60">
                  Expand sidebar (Ctrl+B)
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm font-bold tracking-tight text-white m-0 leading-tight truncate">APAAR GUARD</h1>
                    <p className="text-[10px] text-blue-200 font-normal m-0 tracking-wide uppercase">SIH Prototype</p>
                  </div>
                </div>
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  title="Collapse sidebar (Ctrl+B)"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.path} className="relative group">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center ${
                        collapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'space-x-3 px-3.5 py-2.5'
                      } rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm font-semibold'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>

                  {/* Floating tooltip in collapsed mode */}
                  {collapsed && (
                    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50 border border-slate-700/60">
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Profile & Sign Out Footer */}
          <div className="p-3 border-t border-white/10 bg-[#0e1f36] shrink-0">
            {collapsed ? (
              <div className="flex flex-col items-center space-y-2 py-1">
                {/* Collapsed user avatar with tooltip */}
                <div className="relative group">
                  <div 
                    className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold text-sm cursor-default"
                    aria-label={user?.full_name}
                  >
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50 border border-slate-700/60">
                    <p className="font-semibold text-white m-0">{user?.full_name}</p>
                    <p className="text-[10px] text-blue-300 capitalize m-0">
                      {user?.role === 'institution_admin' ? 'Institution Admin' : 'Verification Officer'}
                    </p>
                  </div>
                </div>

                {/* Collapsed logout button with tooltip */}
                <div className="relative group">
                  <button
                    onClick={handleLogout}
                    className="w-10 h-10 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50 border border-slate-700/60">
                    Sign out
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3 px-1">
                <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold text-sm shrink-0">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate m-0 leading-tight">{user?.full_name}</p>
                  <p className="text-[11px] text-blue-300 truncate m-0 capitalize mt-0.5">
                    {user?.role === 'institution_admin' ? 'Institution Admin' : 'Verification Officer'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="text-slate-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* MOBILE DRAWER (Off-canvas navigation) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu backdrop"
            />
            {/* Drawer Content */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#142B4A] text-white shadow-2xl z-10">
              <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block leading-tight">APAAR GUARD</span>
                    <span className="text-[10px] text-blue-200">SIH Prototype</span>
                  </div>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                          isActive ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-300 hover:bg-white/10'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-white/10 bg-[#0e1f36] shrink-0">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold text-sm shrink-0">
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate m-0">{user?.full_name}</p>
                    <p className="text-[11px] text-blue-300 capitalize truncate m-0">
                      {user?.role === 'institution_admin' ? 'Institution Admin' : 'Verification Officer'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#F6F8FC]">
          {/* Top Header Bar */}
          <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 z-10">
            <div className="flex items-center space-x-3">
              {/* Mobile Hamburger Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Open mobile navigation menu"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Desktop Quick Toggle Button */}
              <button
                onClick={toggleSidebar}
                className="hidden md:flex text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer items-center justify-center"
                title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="w-5 h-5 text-blue-600" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>

              {/* Breadcrumb Path */}
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <span className="hidden sm:inline">Portal</span>
                <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:inline" />
                <span className="font-semibold text-slate-900">{breadcrumb}</span>
              </div>
            </div>

            {/* Institution Badge & Role Chip */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="hidden sm:flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs text-slate-700 shadow-2xs">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-medium max-w-[200px] truncate">{user?.institution?.name}</span>
                <span className="text-slate-400 font-mono">({user?.institution?.code})</span>
              </div>

              <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isAdmin 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/70' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                }`}>
                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                  {isAdmin ? 'Institution Admin' : 'Verification Officer'}
                </span>
              </div>
            </div>
          </header>

          {/* Independent Scrollable Main Content Viewport */}
          <main 
            id="main-content" 
            className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 [scrollbar-gutter:stable] min-h-0 focus:outline-none"
            tabIndex={-1}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
