import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FolderKanban,
  Calendar,
  Users,
  Video,
  CheckSquare,
  ArrowRightLeft,
  BookOpen,
  Activity,
  Plus,
  ShieldAlert,
  ArrowRight,
  GitBranch
} from 'lucide-react';
import { ProjectsAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import RiskHealthScore from '../components/RiskHealthScore';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ProjectDetails() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [risks, setRisks] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        const [projRes, riskRes, actRes] = await Promise.all([
          ProjectsAPI.getById(id),
          ProjectsAPI.getRisks(id),
          ProjectsAPI.getActivity(id)
        ]);

        if (projRes.success) setProject(projRes.data);
        if (riskRes.success) setRisks(riskRes.data);
        if (actRes.success) setActivity(actRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id]);

  if (loading) {
    return <LoadingSpinner message="Loading project workspace & continuity records..." />;
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-slate-800">Project not found</h3>
        <Link to="/projects" className="mt-4 text-xs font-semibold text-indigo-600 hover:underline inline-block">
          ← Back to Projects
        </Link>
      </div>
    );
  }

  const { stats, members } = project;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Project Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
                <StatusBadge status={project.status} size="sm" />
              </div>
              <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
                {project.description || 'Continuous project workspace.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                {project.start_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {project.start_date} to {project.end_date || 'Ongoing'}
                  </span>
                )}
                <span>•</span>
                <span>Lead: {project.creator_name || 'Admin'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Link
              to={`/context-graph?projectId=${project.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Context Graph</span>
            </Link>
            <Link
              to={`/meetings?projectId=${project.id}&create=true`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Meeting</span>
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex border-b border-slate-100 text-xs font-medium space-x-6">
          {[
            { key: 'overview', label: 'Overview & Health', icon: ShieldAlert },
            { key: 'members', label: `Team Members (${members.length})`, icon: Users },
            { key: 'activity', label: `Audit Stream (${activity.length})`, icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 flex items-center gap-2 font-semibold border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Git-Style Context Lineage Graph Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight">Git-Style Context Lineage Graph</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Interactive
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Trace how project decisions, meetings, and responsibilities evolved over time across members. Inspect branching workstreams and handoff transitions.
                </p>
              </div>
            </div>

            <Link
              to={`/context-graph?projectId=${project.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 transition-colors shrink-0 shadow-sm"
            >
              <span>Explore Context Graph</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Risk Health Score */}
          <RiskHealthScore healthData={risks} showAI={true} />

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-medium text-slate-500 block">Total Action Items</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats?.total_tasks || 0}</span>
              <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
                {stats?.completed_tasks || 0} completed
              </span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-medium text-slate-500 block">In Progress</span>
              <span className="text-2xl font-bold text-blue-600 mt-1 block">{stats?.in_progress_tasks || 0}</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Active development</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-medium text-slate-500 block">Overdue Items</span>
              <span className="text-2xl font-bold text-rose-600 mt-1 block">{stats?.overdue_tasks || 0}</span>
              <span className="text-[11px] text-rose-500 mt-1 block font-medium">Flagged in risk detector</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-medium text-slate-500 block">Unassigned Tasks</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">{stats?.unassigned_tasks || 0}</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Needs owner assignment</span>
            </div>
          </div>

          {/* Shortcuts to Project Resources */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to={`/meetings?projectId=${project.id}`}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Project Meetings</h4>
                  <p className="text-[11px] text-slate-500">View notes & AI recaps</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              to={`/tasks?projectId=${project.id}`}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Action Items</h4>
                  <p className="text-[11px] text-slate-500">Track tasks & carry-forwards</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              to={`/knowledge-base?projectId=${project.id}`}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Knowledge Base</h4>
                  <p className="text-[11px] text-slate-500">Specs & linked decisions</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>
      )}

      {/* Team Members Tab */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Project Roster & Responsibilities</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {members.map((m) => (
              <div key={m.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <img
                  src={m.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={m.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{m.name}</h4>
                  <p className="text-[11px] text-indigo-600 font-medium">{m.project_role || m.default_role}</p>
                  <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity History Audit Stream */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Task Lifecycle Audit History</h3>
          <div className="space-y-4">
            {activity.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No activity history recorded yet.</p>
            ) : (
              activity.map((act) => (
                <div key={act.id} className="flex items-start gap-3 text-xs border-b border-slate-100 pb-3 last:border-none">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-slate-800">
                      <span className="font-semibold text-slate-900">{act.actor_name || 'System'}</span>{' '}
                      performed <span className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded text-[11px]">{act.change_type}</span>{' '}
                      on task <span className="font-medium">"{act.task_title}"</span>
                    </p>
                    {act.notes && (
                      <p className="mt-1 text-slate-500 text-[11px]">{act.notes}</p>
                    )}
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

