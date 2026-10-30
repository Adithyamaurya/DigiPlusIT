import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  Video,
  CheckSquare,
  ArrowRightLeft,
  Clock,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  User,
} from 'lucide-react';
import { DashboardAPI } from '../services/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import RiskHealthScore from '../components/RiskHealthScore';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await DashboardAPI.getStats();
      if (res?.success && res.data) {
        setData(res.data);
      } else {
        setError(res?.error || 'Failed to retrieve workspace metrics');
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Aggregating workspace intelligence & continuity metrics..." size="lg" />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-semibold text-rose-900">Dashboard Error</h3>
        <p className="text-sm text-rose-700 mt-1">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) {
    return <LoadingSpinner message="Aggregating workspace intelligence & continuity metrics..." size="lg" />;
  }

  const { stats, taskDistribution, upcomingDeadlines, recentMeetings, recentTransfers, projectHealth } = data;

  const COLORS = {
    'Pending': '#818cf8',
    'In Progress': '#3b82f6',
    'Completed': '#10b981',
    'Overdue': '#ef4444',
    'Blocked': '#f59e0b',
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Work Continuity Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Never lose the context behind your team's work.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>
          <Link
            to="/ai-catchup"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Catch Up on Progress</span>
          </Link>
        </div>
      </div>

      {/* 1. Core Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects}
          subtext="Active workspaces"
          icon={FolderKanban}
          color="indigo"
        />
        <StatCard
          title="Meetings Recorded"
          value={stats.totalMeetings}
          subtext="Knowledge captured"
          icon={Video}
          color="blue"
        />
        <StatCard
          title="Action Items"
          value={stats.totalTasks}
          subtext={`${stats.completedTasks} completed (${Math.round((stats.completedTasks / (stats.totalTasks || 1)) * 100)}%)`}
          icon={CheckSquare}
          color="emerald"
        />
        <StatCard
          title="Active Transfers"
          value={stats.activeTransfers}
          subtext={`${stats.overdueTasks} overdue tasks`}
          icon={ArrowRightLeft}
          color={stats.activeTransfers > 0 ? 'amber' : 'purple'}
        />
      </div>

      {/* 2. Special Feature: Context Risk Health Score */}
      <RiskHealthScore healthData={projectHealth} showAI={true} />

      {/* 3. Middle Section: Real Database Task Distribution Chart & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real Data Chart: Task Overview */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Task Lifecycle Distribution</h3>
              <p className="text-xs text-slate-500">Live breakdown of action items across all statuses</p>
            </div>
            <Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              View Board <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {taskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 pt-4 border-t border-slate-100 text-center">
            <div>
              <span className="block text-xs text-slate-500 font-medium">Pending</span>
              <span className="text-base font-bold text-slate-800">{stats.pendingTasks}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500 font-medium">In Progress</span>
              <span className="text-base font-bold text-blue-600">{stats.inProgressTasks}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500 font-medium">Completed</span>
              <span className="text-base font-bold text-emerald-600">{stats.completedTasks}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500 font-medium">Overdue</span>
              <span className="text-base font-bold text-rose-600">{stats.overdueTasks}</span>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Upcoming Deadlines</h3>
                <p className="text-xs text-slate-500">Scheduled deliverables approaching target dates</p>
              </div>
              <Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                All Tasks <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No tasks with upcoming deadlines.</p>
              ) : (
                upcomingDeadlines.map((task) => {
                  const isOverdue = new Date(task.due_date) < new Date();
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <Link
                          to={`/tasks`}
                          className="text-xs font-semibold text-slate-900 hover:text-indigo-600 truncate block"
                        >
                          {task.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span>{task.owner_name || 'Unassigned'}</span>
                          <span>•</span>
                          <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                            <Clock className="w-3 h-3" />
                            {task.due_date} {isOverdue && '(Overdue)'}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={task.priority} size="xs" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Critical alerts flagged in Context Risk Detector</span>
            <span className="font-semibold text-slate-700">{stats.overdueTasks} overdue</span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Recent Meetings & Recent Work Transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Meetings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Recent Meetings & Recaps</h3>
              <p className="text-xs text-slate-500">Discussions, decisions, and action items captured</p>
            </div>
            <Link to="/meetings" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              All Meetings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {recentMeetings.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No meetings logged yet.</p>
            ) : (
              recentMeetings.map((m) => (
                <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/meetings/${m.id}`} className="text-sm font-semibold text-slate-900 hover:text-indigo-600">
                      {m.title}
                    </Link>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      {new Date(m.meeting_date).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {m.ai_summary || 'Summary pending generation.'}
                  </p>

                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                      {m.decisions_count} Decision{m.decisions_count !== 1 ? 's' : ''}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                      {m.actions_count} Action Item{m.actions_count !== 1 ? 's' : ''}
                    </span>
                    <span>Logged by {m.creator_name || 'Team'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Work Transfers */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Active Work Transfers</h3>
              <p className="text-xs text-slate-500">Preserving context across employee handoffs</p>
            </div>
            <Link to="/work-transfers" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              All Transfers <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {recentTransfers.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No work transfers initiated yet.</p>
            ) : (
              recentTransfers.map((w) => (
                <div key={w.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-800">
                      <span className="font-semibold text-slate-900">{w.prev_owner_name}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-semibold text-indigo-600">{w.new_owner_name}</span>
                    </div>
                    <StatusBadge status={w.status} size="xs" />
                  </div>

                  <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                    {w.reason_for_transfer}
                  </p>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500">
                      {w.task_count} task{w.task_count !== 1 ? 's' : ''} in transfer package
                    </span>
                    <Link
                      to={`/work-transfers/${w.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      View Handoff Brief →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

