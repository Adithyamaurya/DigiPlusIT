import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Video,
  ArrowRightLeft,
  CheckSquare,
  Sparkles,
  BookOpen,
  Layers,
  ChevronDown,
  ShieldAlert,
  GitBranch,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'Meetings', path: '/meetings', icon: Video },
  { name: 'Work Transfers', path: '/work-transfers', icon: ArrowRightLeft },
  { name: 'Tasks', path: '/tasks', icon: CheckSquare },
  { name: 'Context Graph', path: '/context-graph', icon: GitBranch, badge: 'New' },
  { name: 'AI Catch-up', path: '/ai-catchup', icon: Sparkles, badge: 'AI' },
  { name: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen },
];

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { projects, selectedProject, selectedProjectId, setSelectedProjectId } = useWorkspace();

  const handleLinkClick = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] transition-opacity lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out border-r border-slate-800 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 bg-slate-950/40">
          <Link to="/" className="flex items-center gap-2.5 font-semibold text-white tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base font-bold bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                WorkTrace
              </span>
              <p className="text-[10px] text-slate-400 font-normal leading-none mt-0.5">Organizational Memory</p>
            </div>
          </Link>
        </div>

        {/* Project Selector Widget */}
        <div className="px-4 py-3 border-b border-slate-800/60">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5 px-2">
            Active Project
          </label>
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full appearance-none bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-8 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Risk Status Indicator at Bottom of Sidebar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/30">
          <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>Context Continuity</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Every meeting decision and handoff is tracked in real-time.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

