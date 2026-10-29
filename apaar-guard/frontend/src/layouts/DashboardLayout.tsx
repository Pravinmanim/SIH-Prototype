import React, { useState } from 'react';
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
  UserCheck
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DemoBanner } from '../components/common/DemoBanner';

export const DashboardLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Determine breadcrumb
  const currentNav = navItems.find(item => item.path === location.pathname);
  const breadcrumb = currentNav ? currentNav.label : 'Overview';

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-[#172033]">
      <DemoBanner />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-[#142B4A] text-white flex-shrink-0">
          {/* Logo & Brand */}
          <div className="p-5 flex items-center space-x-3 border-b border-white/10">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white m-0 leading-tight">APAAR GUARD</h1>
              <p className="text-[11px] text-blue-200 font-normal m-0 tracking-wide">SIH Prototype</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User profile footer */}
          <div className="p-4 border-t border-white/10 bg-[#0e1f36]">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-semibold text-sm">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate m-0">{user?.full_name}</p>
                <p className="text-xs text-blue-300 truncate m-0 capitalize">
                  {user?.role === 'institution_admin' ? 'Institution Admin' : 'Verification Officer'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="text-slate-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)}></div>
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#142B4A] text-white">
              <div className="p-4 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <Shield className="w-6 h-6 text-blue-400" />
                  <span className="font-bold text-white">APAAR GUARD</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-white p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-1">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                          isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-rose-600/80 text-white text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar */}
          <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 z-10">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <span>Portal</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-800">{breadcrumb}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{user?.institution?.name}</span>
                <span className="text-slate-400">({user?.institution?.code})</span>
              </div>

              <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  isAdmin ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                }`}>
                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                  {isAdmin ? 'Admin' : 'Verification Officer'}
                </span>
              </div>
            </div>
          </header>

          {/* Page View Body */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

