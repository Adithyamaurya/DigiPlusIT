import React, { useState } from 'react';
import { Menu, Search, Sparkles, Bell, UserCheck, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ setMobileOpen }) {
  const { users, currentUser, currentUserId, setCurrentUserId, selectedProject, notification } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/knowledge-base?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Toggle & Project Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400 hidden sm:inline">Workspace</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            {selectedProject ? selectedProject.name : 'All Projects'}
            {selectedProject && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {selectedProject.status}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Global Toast Notification */}
      {notification && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Right: Search, Persona Switcher & Profile */}
      <div className="flex items-center gap-3">
        {/* Quick Search */}
        <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search docs, decisions, tasks..."
            className="w-48 lg:w-64 pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </form>

        {/* Quick AI Catch-up Button */}
        <Link
          to="/ai-catchup"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>AI Catch-up</span>
        </Link>

        {/* Persona Switcher Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-colors text-xs text-slate-700 font-medium"
            title="Switch active team persona to test workflows"
          >
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                className="w-6 h-6 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                {currentUser?.name?.[0] || 'U'}
              </div>
            )}
            <div className="text-left hidden sm:block">
              <span className="block font-medium leading-none text-slate-900">{currentUser?.name || 'User'}</span>
              <span className="block text-[10px] text-slate-500 leading-tight">{currentUser?.role || 'Member'}</span>
            </div>
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 animate-fadeIn">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Switch Active Persona
                </p>
                <p className="text-[11px] text-slate-500">Test handoffs and task approvals</p>
              </div>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUserId(u.id);
                    setShowUserMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    u.id === currentUserId ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <img
                    src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'}
                    alt={u.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <div>
                    <span className="block text-slate-900">{u.name}</span>
                    <span className="block text-[10px] text-slate-500">{u.role}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

