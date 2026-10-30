import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FolderKanban,
  ArrowRightLeft,
  Copy,
  Check,
  Calendar,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  HelpCircle,
  FileText,
  UserPlus,
  Users,
  Compass,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { CatchupAPI, WorkTransfersAPI } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AICatchup() {
  const { projects, users, selectedProjectId, setSelectedProjectId } = useWorkspace();
  const [activeTab, setActiveTab] = useState('project'); // 'project', 'transfer', or 'onboarding'

  // Project Catch-up state
  const [targetProjectId, setTargetProjectId] = useState(selectedProjectId || '');
  const [projectCatchupData, setProjectCatchupData] = useState(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [projectError, setProjectError] = useState(null);

  // Transfer Catch-up state
  const [transfers, setTransfers] = useState([]);
  const [targetTransferId, setTargetTransferId] = useState('');
  const [transferCatchupData, setTransferCatchupData] = useState(null);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [transferError, setTransferError] = useState(null);

  // Onboarding Brief state
  const [onboardingProjectId, setOnboardingProjectId] = useState(selectedProjectId || '');
  const [onboardingUserId, setOnboardingUserId] = useState('');
  const [onboardingData, setOnboardingData] = useState(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);
  const [onboardingError, setOnboardingError] = useState(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedProjectId && !targetProjectId) {
      setTargetProjectId(selectedProjectId);
    }
    if (selectedProjectId && !onboardingProjectId) {
      setOnboardingProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (users?.length > 0 && !onboardingUserId) {
      setOnboardingUserId(users[0].id);
    }
  }, [users]);

  useEffect(() => {
    async function loadTransfers() {
      try {
        const res = await WorkTransfersAPI.getAll();
        if (res.success && res.data.length > 0) {
          setTransfers(res.data);
          setTargetTransferId(res.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadTransfers();
  }, []);

  const handleGenerateProjectCatchup = async () => {
    if (!targetProjectId) return;

    try {
      setLoadingProject(true);
      setProjectError(null);
      const res = await CatchupAPI.getProjectCatchup({ projectId: targetProjectId });
      if (res.success) {
        setProjectCatchupData(res.data);
      }
    } catch (err) {
      setProjectError(err.message || 'Failed to generate project catch-up brief');
    } finally {
      setLoadingProject(false);
    }
  };

  const handleGenerateTransferCatchup = async () => {
    if (!targetTransferId) return;

    try {
      setLoadingTransfer(true);
      setTransferError(null);
      const res = await CatchupAPI.getHandoffCatchup({ transferId: targetTransferId });
      if (res.success) {
        setTransferCatchupData(res.data);
      }
    } catch (err) {
      setTransferError(err.message || 'Failed to generate handoff catch-up brief');
    } finally {
      setLoadingTransfer(false);
    }
  };

  const handleGenerateOnboarding = async () => {
    if (!onboardingProjectId || !onboardingUserId) return;

    try {
      setLoadingOnboarding(true);
      setOnboardingError(null);
      const res = await CatchupAPI.getOnboardingBrief({
        projectId: onboardingProjectId,
        userId: onboardingUserId
      });
      if (res.success) {
        setOnboardingData(res.data);
      } else {
        setOnboardingError(res.error || 'Failed to generate onboarding brief');
      }
    } catch (err) {
      setOnboardingError(err.message || 'Failed to generate onboarding brief');
    } finally {
      setLoadingOnboarding(false);
    }
  };

  const copyBriefToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Continuity Assistant</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Catch-up & Onboarding</h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Missed recent sprint meetings, taking over someone's tasks, or just joined the team? WorkTrace aggregates real database records into an executive briefing answering what happened, what was decided, and what you need to know.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setActiveTab('project')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'project'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            Project Catch-up
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'transfer'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            Work Transfer Catch-up
          </button>
          <button
            onClick={() => setActiveTab('onboarding')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'onboarding'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-purple-300" />
            <span>New Member Onboarding</span>
          </button>
        </div>
      </div>

      {/* 1. PROJECT CATCH-UP TAB */}
      {activeTab === 'project' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 shrink-0">Select Project:</label>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateProjectCatchup}
              disabled={loadingProject || !targetProjectId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>{loadingProject ? 'Aggregating Database & Querying Gemini...' : 'Generate My Catch-up Brief'}</span>
            </button>
          </div>

          {/* Error Notice */}
          {projectError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">AI Brief Generation Notice</h4>
                <p className="mt-1">{projectError}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Ensure <code>GEMINI_API_KEY</code> is set in backend environment variables.
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loadingProject && (
            <LoadingSpinner message="Retrieving meetings, decisions, tasks & documents from PostgreSQL, then feeding to Gemini..." size="lg" />
          )}

          {/* Generated Brief */}
          {projectCatchupData && !loadingProject && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-mono text-purple-600 font-semibold uppercase tracking-wider block">
                    Verified Source of Truth: PostgreSQL Database
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
                    Executive Continuity Brief
                  </h2>
                </div>

                <button
                  onClick={() => copyBriefToClipboard(JSON.stringify(projectCatchupData.brief, null, 2))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Brief' : 'Copy Brief'}</span>
                </button>
              </div>

              {/* Overview */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed">
                <h3 className="font-bold text-slate-900 mb-1">Project Standing:</h3>
                <p>{projectCatchupData.brief.project_overview}</p>
              </div>

              {/* What Happened Recently */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  What Happened Recently?
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed bg-indigo-50/40 p-4 rounded-lg border border-indigo-100">
                  {projectCatchupData.brief.recent_activity}
                </p>
              </div>

              {/* Key Decisions */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Important Decisions to Not Forget ({projectCatchupData.brief.key_decisions?.length || 0})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projectCatchupData.brief.key_decisions?.map((dec, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                      <h4 className="font-bold text-slate-900">{dec.title}</h4>
                      {dec.context && <p className="mt-1 text-slate-600 leading-relaxed">{dec.context}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Outstanding Tasks & Completed Work */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Outstanding Action Items
                  </h3>
                  <div className="space-y-2">
                    {projectCatchupData.brief.outstanding_tasks?.map((task, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900 block">{task.title}</span>
                          <span className="text-[11px] text-slate-500">Owner: {task.owner} • Due: {task.due_date || 'No deadline'}</span>
                        </div>
                        {task.urgency && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 font-medium">{task.urgency}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Recently Completed Milestones
                  </h3>
                  <ul className="space-y-2">
                    {projectCatchupData.brief.completed_work?.map((comp, idx) => (
                      <li key={idx} className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{comp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Suggested Next Steps */}
              {projectCatchupData.brief.suggested_next_steps?.length > 0 && (
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 text-xs text-purple-950">
                  <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Suggested Next Steps For You:
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {projectCatchupData.brief.suggested_next_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. NEW MEMBER ONBOARDING TAB */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 shrink-0">Project:</label>
                <select
                  value={onboardingProjectId}
                  onChange={(e) => setOnboardingProjectId(e.target.value)}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 shrink-0">Onboarding Member:</label>
                <select
                  value={onboardingUserId}
                  onChange={(e) => setOnboardingUserId(e.target.value)}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role || 'Member'})</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateOnboarding}
              disabled={loadingOnboarding || !onboardingProjectId || !onboardingUserId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60 shrink-0"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>{loadingOnboarding ? 'Synthesizing Onboarding Brief...' : 'Generate Onboarding Brief'}</span>
            </button>
          </div>

          {/* Error Notice */}
          {onboardingError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Onboarding Brief Notice</h4>
                <p className="mt-1">{onboardingError}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Ensure GEMINI_API_KEY is configured in backend environment variables.
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loadingOnboarding && (
            <LoadingSpinner message="Synthesizing team decisions, documents, and assigned tasks for new member..." size="lg" />
          )}

          {/* Generated Onboarding Brief */}
          {onboardingData && !loadingOnboarding && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-purple-600 font-semibold uppercase tracking-wider block">
                      Role-Tailored Onboarding Kit
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-medium">{onboardingData.project?.name || onboardingData.project_name}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
                    Welcome Brief: {onboardingData.member?.name || onboardingData.member_name} ({onboardingData.member?.role || onboardingData.role})
                  </h2>
                </div>

                <button
                  onClick={() => copyBriefToClipboard(JSON.stringify(onboardingData.brief, null, 2))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Kit' : 'Copy Brief'}</span>
                </button>
              </div>

              {/* Mission & Role Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 leading-relaxed">
                  <h3 className="font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-indigo-600" />
                    <span>Project Mission</span>
                  </h3>
                  <p>{onboardingData.brief?.project_mission || onboardingData.brief?.welcome_overview}</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-950 leading-relaxed">
                  <h3 className="font-bold text-purple-900 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                    <span>Role Responsibilities</span>
                  </h3>
                  <p>{onboardingData.brief?.role_responsibilities}</p>
                </div>
              </div>

              {/* Confirmed Architecture & Engineering Rules */}
              {(onboardingData.brief?.confirmed_architecture || onboardingData.brief?.confirmed_architecture_and_rules)?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Confirmed Architecture & Non-Negotiable Rules
                  </h3>
                  <ul className="space-y-2">
                    {(onboardingData.brief?.confirmed_architecture || onboardingData.brief?.confirmed_architecture_and_rules).map((rule, idx) => (
                      <li key={idx} className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Decisions to Know */}
              {onboardingData.brief?.key_decisions?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Key Historical Decisions You Need to Know
                  </h3>
                  <div className="space-y-2">
                    {onboardingData.brief.key_decisions.map((dec, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <span className="font-bold text-slate-900 block">{dec.title || dec.decision}</span>
                        <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                          {dec.context || dec.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Team Workstreams */}
              {onboardingData.brief?.active_team_workstreams?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Active Team Workstreams
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {onboardingData.brief.active_team_workstreams.map((ws, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <span className="font-bold text-slate-900 block">{ws.stream}</span>
                        <span className="text-[11px] text-indigo-600 block mt-0.5">Lead: {ws.lead_owner}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Status: {ws.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inferred Work Priorities */}
              {onboardingData.brief?.inferred_work_priorities?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
                    Immediate First Priorities (Day 1 - 7)
                  </h3>
                  <ul className="space-y-2">
                    {onboardingData.brief.inferred_work_priorities.map((item, idx) => (
                      <li key={idx} className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 text-xs text-indigo-950 font-medium">
                        👉 {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing or Pending Context */}
              {onboardingData.brief?.missing_or_pending_context?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Open Context & Items Needing Clarification
                  </h3>
                  <ul className="space-y-1.5 list-disc list-inside bg-amber-50/50 p-4 rounded-lg border border-amber-200 text-xs text-amber-950">
                    {onboardingData.brief.missing_or_pending_context.map((ctx, idx) => (
                      <li key={idx}>{ctx}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Prerequisite Documents to Read */}
              {(onboardingData.brief?.prerequisite_documents_to_read || onboardingData.brief?.prerequisite_documents)?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Prerequisite Reading & Specifications
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(onboardingData.brief?.prerequisite_documents_to_read || onboardingData.brief?.prerequisite_documents).map((doc, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="font-semibold text-slate-900">{typeof doc === 'string' ? doc : doc.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. WORK TRANSFER CATCH-UP TAB */}
      {activeTab === 'transfer' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 shrink-0">Select Work Transfer:</label>
              <select
                value={targetTransferId}
                onChange={(e) => setTargetTransferId(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {transfers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.prev_owner_name} → {t.new_owner_name} ({t.project_name})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateTransferCatchup}
              disabled={loadingTransfer || !targetTransferId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>{loadingTransfer ? 'Synthesizing Handoff Records...' : 'Generate Handoff Brief'}</span>
            </button>
          </div>

          {/* Error Notice */}
          {transferError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">AI Brief Generation Notice</h4>
                <p className="mt-1">{transferError}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loadingTransfer && (
            <LoadingSpinner message="Retrieving handoff context and generating step-by-step onboarding plan..." size="lg" />
          )}

          {/* Generated Transfer Brief */}
          {transferCatchupData && !loadingTransfer && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-mono text-purple-600 font-semibold uppercase tracking-wider block">
                    Tailored Work Continuity Synthesis
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
                    Handoff Brief for {transferCatchupData.transfer?.new_owner}
                  </h2>
                </div>

                <button
                  onClick={() => copyBriefToClipboard(JSON.stringify(transferCatchupData.brief, null, 2))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Brief' : 'Copy Brief'}</span>
                </button>
              </div>

              {/* What was previously worked on */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed">
                <h3 className="font-bold text-slate-900 mb-1">What Was Previously Being Worked On:</h3>
                <p>{transferCatchupData.brief.previous_work_summary}</p>
              </div>

              {/* Immediate First Actions */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
                  What Should You Do First?
                </h3>
                <ul className="space-y-2">
                  {transferCatchupData.brief.immediate_first_actions?.map((act, idx) => (
                    <li key={idx} className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 text-xs text-indigo-950 font-medium">
                      👉 {act}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Unfinished Work */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  What Remains Unfinished?
                </h3>
                <div className="space-y-2">
                  {transferCatchupData.brief.unfinished_work?.map((work, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900 block">{work.task_title}</span>
                        <span className="text-[11px] text-slate-500">{work.current_state}</span>
                      </div>
                      {work.priority && <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 font-medium">{work.priority}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Decisions */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Which Decisions Should Not Be Forgotten?
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 bg-amber-50/50 p-4 rounded-lg border border-amber-200">
                  {transferCatchupData.brief.critical_decisions_to_remember?.map((dec, idx) => (
                    <li key={idx}>{dec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

