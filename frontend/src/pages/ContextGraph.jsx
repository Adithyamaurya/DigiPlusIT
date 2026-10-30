import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Video,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Sparkles,
  BookOpen,
  Filter,
  Users,
  Calendar,
  X,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  AlertCircle,
  Check,
  Search,
  Layers,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Eye,
  UserCheck,
  ArrowUpDown
} from 'lucide-react';
import { ProjectsAPI } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ContextGraph() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    projects, 
    users, 
    currentUser, 
    currentUserId, 
    setCurrentUserId, 
    selectedProjectId, 
    setSelectedProjectId,
    showNotification 
  } = useWorkspace();

  const [projectId, setProjectId] = useState(searchParams.get('projectId') || selectedProjectId || '');
  const [selectedMemberId, setSelectedMemberId] = useState(searchParams.get('memberId') || '');
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterEventType, setFilterEventType] = useState('all');
  const [filterBranchId, setFilterBranchId] = useState('all');
  const [onlyGapFilter, setOnlyGapFilter] = useState(false);
  const [viewMode, setViewMode] = useState('git'); // 'git' or 'swimlane'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Modals & Drawers
  const [inspectNode, setInspectNode] = useState(null);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffData, setDiffData] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState(null);

  // Actions
  const [acknowledging, setAcknowledging] = useState(false);

  // Node refs for smooth jump navigation
  const nodeRefs = useRef({});

  useEffect(() => {
    if (selectedProjectId && !projectId) {
      setProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  const fetchGraph = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const params = {};
      if (selectedMemberId) params.memberId = selectedMemberId;
      if (currentUserId) params.userId = currentUserId;

      const res = await ProjectsAPI.getContextGraph(projectId, params);
      if (res.success) {
        setGraphData(res.data);
      }
    } catch (err) {
      console.error('Failed to load context graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [projectId, selectedMemberId, currentUserId]);

  // Acknowledge context position
  const handleAcknowledge = async (targetEventId = null) => {
    if (!projectId || !currentUserId) return;
    try {
      setAcknowledging(true);
      const res = await ProjectsAPI.acknowledgeContext(projectId, {
        eventId: targetEventId || null,
        userId: currentUserId
      });
      if (res.success) {
        showNotification('Context position updated and acknowledged successfully!', 'success');
        if (diffModalOpen) setDiffModalOpen(false);
        fetchGraph();
      }
    } catch (err) {
      showNotification(err.message || 'Failed to acknowledge context position', 'error');
    } finally {
      setAcknowledging(false);
    }
  };

  // Compare Context Positions (Diff View)
  const handleOpenDiff = async (fromId = null, toId = null) => {
    const from = fromId || graphData?.userPosition?.lastAcknowledgedEventId;
    const to = toId || graphData?.userPosition?.latestNode?.id;

    if (!from || !to) {
      showNotification('Cannot compare: Missing reference context node', 'warning');
      return;
    }

    try {
      setDiffLoading(true);
      setDiffError(null);
      setDiffModalOpen(true);

      const res = await ProjectsAPI.getContextDiff(projectId, {
        fromEventId: from,
        toEventId: to
      });
      if (res.success) {
        setDiffData(res.data);
      }
    } catch (err) {
      setDiffError(err.message || 'Failed to compare context positions');
    } finally {
      setDiffLoading(false);
    }
  };

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    return graphData.nodes.filter(node => {
      if (filterEventType !== 'all' && node.eventType !== filterEventType) return false;
      if (filterBranchId !== 'all' && node.branchId !== filterBranchId) return false;
      if (onlyGapFilter && !node.isGap) return false;
      return true;
    });
  }, [graphData, filterEventType, filterBranchId, onlyGapFilter]);

  // Group nodes by chronological date bucket for readable visual timeline
  const groupedTimeline = useMemo(() => {
    const dateMap = new Map();
    filteredNodes.forEach(node => {
      const d = node.date || 'Undated';
      if (!dateMap.has(d)) dateMap.set(d, []);
      dateMap.get(d).push(node);
    });

    return Array.from(dateMap.entries()).map(([date, nodes]) => ({
      date,
      nodes
    }));
  }, [filteredNodes]);

  // Sorted nodes based on sortOrder ('asc' = chronological oldest to latest, 'desc' = latest first)
  const sortedNodes = useMemo(() => {
    const list = [...filteredNodes];
    if (sortOrder === 'desc') {
      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else {
      list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    return list;
  }, [filteredNodes, sortOrder]);

  const lanes = useMemo(() => {
    return graphData?.lanes || [];
  }, [graphData]);

  const laneIndexMap = useMemo(() => {
    const map = new Map();
    lanes.forEach((l, idx) => {
      map.set(l.id, idx);
    });
    return map;
  }, [lanes]);

  const LANE_WIDTH = 28;
  const X_OFFSET = 22;
  const ROW_HEIGHT = 68;
  const svgWidth = Math.max(140, lanes.length * LANE_WIDTH + X_OFFSET * 2);
  const totalSvgHeight = Math.max(340, sortedNodes.length * ROW_HEIGHT);

  const graphEdges = useMemo(() => {
    if (!graphData?.edges || sortedNodes.length === 0) return [];

    const nodeRowMap = new Map();
    sortedNodes.forEach((n, idx) => nodeRowMap.set(n.id, idx));

    const result = [];

    // 1. Process explicit edges
    (graphData.edges || []).forEach(edge => {
      if (nodeRowMap.has(edge.source) && nodeRowMap.has(edge.target)) {
        const sRow = nodeRowMap.get(edge.source);
        const tRow = nodeRowMap.get(edge.target);
        const sNode = sortedNodes[sRow];
        const tNode = sortedNodes[tRow];

        const sLaneIdx = laneIndexMap.get(sNode.laneId) ?? 0;
        const tLaneIdx = laneIndexMap.get(tNode.laneId) ?? 0;

        const x1 = X_OFFSET + sLaneIdx * LANE_WIDTH;
        const y1 = sRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const x2 = X_OFFSET + tLaneIdx * LANE_WIDTH;
        const y2 = tRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        result.push({
          id: edge.id || `e_${edge.source}_${edge.target}`,
          sourceId: edge.source,
          targetId: edge.target,
          x1, y1, x2, y2,
          isCurve: x1 !== x2,
          color: edge.color || (x1 === x2 ? sNode.color : '#8b5cf6'),
          type: edge.type,
          isHandoff: edge.type === 'handoff'
        });
      }
    });

    // 2. Sequential continuity on same branch
    const laneConsecutive = new Map();
    sortedNodes.forEach((node, rowIdx) => {
      const lId = node.laneId || 'main';
      if (!laneConsecutive.has(lId)) laneConsecutive.set(lId, []);
      laneConsecutive.get(lId).push({ node, rowIdx });
    });

    laneConsecutive.forEach((items, lId) => {
      const laneIdx = laneIndexMap.get(lId) ?? 0;
      const x = X_OFFSET + laneIdx * LANE_WIDTH;
      for (let i = 0; i < items.length - 1; i++) {
        const fromItem = items[i];
        const toItem = items[i + 1];
        const y1 = fromItem.rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const y2 = toItem.rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

        const exists = result.some(e =>
          (e.sourceId === fromItem.node.id && e.targetId === toItem.node.id) ||
          (e.sourceId === toItem.node.id && e.targetId === fromItem.node.id)
        );

        if (!exists) {
          result.push({
            id: `seq_${fromItem.node.id}_${toItem.node.id}`,
            sourceId: fromItem.node.id,
            targetId: toItem.node.id,
            x1: x, y1, x2: x, y2,
            isCurve: false,
            color: fromItem.node.color || '#4f46e5',
            type: 'continuation',
            isHandoff: false
          });
        }
      }
    });

    return result;
  }, [graphData, sortedNodes, laneIndexMap]);

  // Smooth jump to node
  const jumpToNode = (nodeId) => {
    if (nodeRefs.current[nodeId]) {
      nodeRefs.current[nodeId].scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight
      nodeRefs.current[nodeId].classList.add('ring-4', 'ring-indigo-400', 'transition-all');
      setTimeout(() => {
        nodeRefs.current[nodeId]?.classList.remove('ring-4', 'ring-indigo-400');
      }, 2000);
    }
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'meeting': return Video;
      case 'decision': return Sparkles;
      case 'task': return CheckCircle2;
      case 'work_transfer': return ArrowRightLeft;
      case 'milestone': return GitMerge;
      case 'document': return BookOpen;
      default: return GitCommit;
    }
  };

  const userPosition = graphData?.userPosition;

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* 1. TOP HEADER & WORKSPACE CONTEXT */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <GitBranch className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Git-Style Context History Graph
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Personalized
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
              Every member has a personalized perspective of the project's evolving context history. Trace your last-known position, what occurred since, and compare state changes.
            </p>
          </div>

          {/* Active Persona Indicator with One-Click Testing Switcher */}
          <div className="flex flex-col sm:items-end gap-1.5 self-start md:self-auto">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Viewing As Active User:
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800">
                <img
                  src={currentUser?.avatar_url || ''}
                  alt={currentUser?.name}
                  className="w-5 h-5 rounded-full object-cover border border-slate-300"
                />
                <span>{currentUser?.name} ({currentUser?.role})</span>
              </div>
            </div>

            {/* Persona Quick Switcher Pills for Testing */}
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
              <span className="text-[10px] text-slate-400">Switch user:</span>
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setCurrentUserId(u.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    currentUserId === u.id
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={`Switch to ${u.name} to see their personalized context`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. CONTEXT GAP ALERT BANNER */}
        {userPosition && (
          <div className="pt-1">
            {!userPosition.isCaughtUp ? (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50/50 border border-amber-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-amber-950">
                        Context Gap Detected: You Are {userPosition.contextGapCount} Updates Behind
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                        Action Recommended
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-900 leading-relaxed max-w-3xl">
                      Your last acknowledged context is <strong>"{userPosition.lastAcknowledgedNode?.title}"</strong> on {userPosition.lastAcknowledgedNode?.date}. Other team members have since contributed new decisions, tasks, and milestone updates.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenDiff(userPosition.lastAcknowledgedEventId, userPosition.latestNode?.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    <Search className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Review What Changed (Diff)</span>
                  </button>

                  <button
                    onClick={() => handleAcknowledge(userPosition.latestNode?.id)}
                    disabled={acknowledging}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{acknowledging ? 'Syncing...' : 'Mark as Acknowledged'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold block">You Are Fully Caught Up!</span>
                    <span className="text-[11px] text-emerald-700">
                      Your position matches the latest project context: <em>"{userPosition.latestNode?.title}"</em> ({userPosition.latestNode?.date}).
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenDiff(userPosition.lastAcknowledgedEventId, userPosition.latestNode?.id)}
                  className="px-2.5 py-1 rounded-md bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100/50"
                >
                  View Current State
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. CONTROLS, PERSPECTIVE & EVENT FILTERS */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            {/* Project Picker */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-600">Project:</span>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setSelectedProjectId(e.target.value);
                }}
                className="font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Member Perspective */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-600">Member Lane:</span>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Lanes & Branches</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name}'s Journey ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type Filter Pills */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px]">
              {[
                { id: 'all', label: 'All' },
                { id: 'meeting', label: 'Meetings' },
                { id: 'decision', label: 'Decisions' },
                { id: 'task', label: 'Tasks' },
                { id: 'work_transfer', label: 'Handoffs' },
                { id: 'milestone', label: 'Milestones' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterEventType(t.id)}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    filterEventType === t.id
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Only Gap Toggle */}
            <button
              onClick={() => setOnlyGapFilter(!onlyGapFilter)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                onlyGapFilter
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Only Missed Updates ({userPosition?.contextGapCount || 0})</span>
            </button>
          </div>

          {/* Quick Jump Buttons, View Mode & Sort */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* View Mode Toggle: Git Graph vs Swimlanes */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('git')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'git'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Git railway commit graph with branches and merge tracks"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Git Graph</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('swimlane')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'swimlane'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Grouped cards timeline view"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Swimlanes</span>
              </button>
            </div>

            {/* Sort Order Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-medium transition-colors"
              title="Toggle chronological vs reverse chronological order"
            >
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <span>{sortOrder === 'asc' ? 'Oldest ➔ Latest' : 'Latest ➔ Oldest'}</span>
            </button>

            {userPosition?.lastAcknowledgedEventId && (
              <button
                type="button"
                onClick={() => jumpToNode(userPosition.lastAcknowledgedEventId)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold transition-colors"
                title="Scroll to your last acknowledged context marker"
              >
                <span>📍 Jump to HEAD</span>
              </button>
            )}

            {userPosition?.latestNode?.id && (
              <button
                type="button"
                onClick={() => jumpToNode(userPosition.latestNode.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold transition-colors"
                title="Scroll to latest project update"
              >
                <span>🌟 Latest</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. MAIN VISUAL GIT-STYLE GRAPH CANVAS */}
      {loading ? (
        <LoadingSpinner message="Calculating Git-style lineage graph, swimlanes, and user positions..." size="lg" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Git Branch Legend Bar */}
          <div className="bg-slate-900 text-white px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between text-xs font-semibold gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-indigo-400">
                <GitBranch className="w-4 h-4" />
                <span className="font-mono uppercase tracking-wider text-[11px] text-slate-200">Git Branches:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {lanes.map((lane) => (
                  <div key={lane.id} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: lane.color }}
                    />
                    <span className="text-slate-200 font-medium text-[11px]">{lane.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              {sortedNodes.length} context commits • {lanes.length} branches
            </div>
          </div>

          {/* Empty State */}
          {sortedNodes.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <GitBranch className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold">No context events match the active filter criteria.</p>
              <button
                onClick={() => {
                  setFilterEventType('all');
                  setOnlyGapFilter(false);
                  setSelectedMemberId('');
                }}
                className="mt-3 text-xs text-indigo-600 font-semibold hover:underline"
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'git' ? (
            /* AUTHENTIC GIT RAILWAY COMMIT GRAPH */
            <div className="relative overflow-x-auto bg-white min-h-[400px]">
              {/* Table Column Headers */}
              <div className="flex items-center h-9 border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 select-none">
                <div style={{ width: `${svgWidth}px` }} className="shrink-0 text-center font-mono">
                  Branch Rails
                </div>
                <div className="w-48 shrink-0 px-2 font-mono">Commit / Ref</div>
                <div className="flex-1 px-3">Description & Decisions</div>
                <div className="w-36 hidden md:block px-3">Contributor</div>
                <div className="w-32 hidden lg:block px-3 text-right">Timestamp</div>
                <div className="w-16 px-2 text-right">Action</div>
              </div>

              {/* Rows Container with Absolute Overlay SVG */}
              <div className="relative" style={{ minHeight: `${totalSvgHeight}px` }}>
                {/* SVG Graph Canvas on left */}
                <svg
                  className="absolute top-0 left-0 pointer-events-none z-10"
                  width={svgWidth}
                  height={totalSvgHeight}
                  style={{ minWidth: `${svgWidth}px`, width: `${svgWidth}px`, height: `${totalSvgHeight}px` }}
                >
                  {/* Track guide lines */}
                  {lanes.map((lane, idx) => {
                    const lx = X_OFFSET + idx * LANE_WIDTH;
                    return (
                      <line
                        key={`rail_${lane.id}`}
                        x1={lx}
                        y1={0}
                        x2={lx}
                        y2={totalSvgHeight}
                        stroke={lane.color}
                        strokeWidth={1.5}
                        strokeOpacity={0.15}
                        strokeDasharray="2 3"
                      />
                    );
                  })}

                  {/* Edges */}
                  {graphEdges.map((edge) => {
                    const isHighlighted = hoveredNodeId && (edge.sourceId === hoveredNodeId || edge.targetId === hoveredNodeId);
                    if (edge.isCurve) {
                      const midY = (edge.y1 + edge.y2) / 2;
                      return (
                        <path
                          key={edge.id}
                          d={`M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`}
                          fill="none"
                          stroke={edge.color}
                          strokeWidth={isHighlighted ? 3.5 : (edge.isHandoff ? 2.5 : 2.2)}
                          strokeDasharray={edge.isHandoff ? '4 3' : 'none'}
                          strokeLinecap="round"
                          opacity={hoveredNodeId ? (isHighlighted ? 1 : 0.35) : 0.9}
                          className="transition-all duration-150"
                        />
                      );
                    } else {
                      return (
                        <line
                          key={edge.id}
                          x1={edge.x1}
                          y1={edge.y1}
                          x2={edge.x2}
                          y2={edge.y2}
                          stroke={edge.color}
                          strokeWidth={isHighlighted ? 3.5 : 2.2}
                          strokeLinecap="round"
                          opacity={hoveredNodeId ? (isHighlighted ? 1 : 0.35) : 0.9}
                          className="transition-all duration-150"
                        />
                      );
                    }
                  })}

                  {/* Commit Dots */}
                  {sortedNodes.map((node, rowIdx) => {
                    const laneIdx = laneIndexMap.get(node.laneId) ?? 0;
                    const cx = X_OFFSET + laneIdx * LANE_WIDTH;
                    const cy = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const isHovered = hoveredNodeId === node.id;

                    if (node.isLastAcknowledged) {
                      return (
                        <g key={`dot_${node.id}`} className="transition-transform duration-150">
                          <circle
                            cx={cx}
                            cy={cy}
                            r={11}
                            fill="#818cf8"
                            fillOpacity={0.35}
                            stroke="#4f46e5"
                            strokeWidth={2}
                            className="animate-pulse"
                          />
                          <circle cx={cx} cy={cy} r={5.5} fill="#4f46e5" stroke="#ffffff" strokeWidth={1.5} />
                        </g>
                      );
                    }

                    if (node.isLatest) {
                      return (
                        <g key={`dot_${node.id}`} className="transition-transform duration-150">
                          <circle
                            cx={cx}
                            cy={cy}
                            r={9.5}
                            fill="#34d399"
                            fillOpacity={0.3}
                            stroke="#059669"
                            strokeWidth={2}
                          />
                          <circle cx={cx} cy={cy} r={5} fill="#059669" stroke="#ffffff" strokeWidth={1.5} />
                        </g>
                      );
                    }

                    if (node.isGap) {
                      return (
                        <g key={`dot_${node.id}`} className="transition-transform duration-150">
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 7.5 : 6}
                            fill={node.color}
                            stroke="#f59e0b"
                            strokeWidth={2.5}
                          />
                        </g>
                      );
                    }

                    return (
                      <circle
                        key={`dot_${node.id}`}
                        cx={cx}
                        cy={cy}
                        r={isHovered ? 7 : 5}
                        fill={node.color}
                        stroke="#ffffff"
                        strokeWidth={2}
                        className="transition-all duration-150"
                      />
                    );
                  })}
                </svg>

                {/* Commit Rows */}
                {sortedNodes.map((node, rowIdx) => {
                  const Icon = getNodeIcon(node.eventType);
                  const isHovered = hoveredNodeId === node.id;

                  return (
                    <div
                      key={node.id}
                      ref={el => nodeRefs.current[node.id] = el}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onClick={() => setInspectNode(node)}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className={`group relative flex items-center border-b border-slate-100 hover:bg-indigo-50/40 cursor-pointer transition-colors ${
                        node.isLastAcknowledged
                          ? 'bg-indigo-50/70'
                          : node.isLatest
                          ? 'bg-emerald-50/30'
                          : node.isGap
                          ? 'bg-amber-50/25'
                          : 'bg-white'
                      }`}
                    >
                      {/* Left spacer for SVG rails */}
                      <div style={{ width: `${svgWidth}px` }} className="shrink-0" />

                      {/* Commit SHA-1 & Ref Badges */}
                      <div className="flex items-center gap-1.5 shrink-0 px-2 font-mono text-[11px] w-48">
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                          <GitCommit className="w-3 h-3 text-slate-400" />
                          <span>{node.id.slice(0, 7)}</span>
                        </span>

                        {/* Branch Tag */}
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs truncate max-w-[110px]"
                          style={{ backgroundColor: node.color }}
                          title={node.branchName}
                        >
                          {node.branchName.replace("'s Branch", "").replace(" Branch", "")}
                        </span>

                        {/* HEAD / Latest / Gap Badges */}
                        {node.isLastAcknowledged && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white shadow-xs">
                            HEAD
                          </span>
                        )}
                        {node.isLatest && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                            latest
                          </span>
                        )}
                        {node.isGap && !node.isLastAcknowledged && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            missed
                          </span>
                        )}
                      </div>

                      {/* Commit Title, Event Badge & Summary */}
                      <div className="flex-1 min-w-0 px-3 flex items-center gap-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          node.eventType === 'meeting' ? 'bg-purple-100 text-purple-800' :
                          node.eventType === 'decision' ? 'bg-indigo-100 text-indigo-800' :
                          node.eventType === 'task' ? 'bg-blue-100 text-blue-800' :
                          node.eventType === 'work_transfer' ? 'bg-fuchsia-100 text-fuchsia-800' :
                          node.eventType === 'milestone' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          <Icon className="w-3 h-3" />
                          <span>{node.badge}</span>
                        </span>

                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors block truncate">
                            {node.title}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {node.summary}
                          </span>
                        </div>

                        {node.changesCount > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 border border-slate-200">
                            +{node.changesCount} change{node.changesCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Author */}
                      <div className="hidden md:flex items-center gap-2 px-3 shrink-0 w-36">
                        {node.memberAvatar ? (
                          <img
                            src={node.memberAvatar}
                            alt={node.memberName}
                            className="w-5 h-5 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {node.memberName?.[0] || 'U'}
                          </div>
                        )}
                        <div className="truncate">
                          <span className="block text-xs font-semibold text-slate-800 truncate">{node.memberName}</span>
                          <span className="block text-[10px] text-slate-400 truncate leading-none">{node.memberRole}</span>
                        </div>
                      </div>

                      {/* Date / Timestamp */}
                      <div className="hidden lg:block px-3 shrink-0 w-32 text-right">
                        <span className="block text-xs font-medium text-slate-700">{node.date}</span>
                        <span className="block text-[10px] text-slate-400">{node.time}</span>
                      </div>

                      {/* Action Button */}
                      <div className="px-3 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectNode(node);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all"
                          title="Inspect context node"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* SWIMLANE TIMELINE VIEW */
            <div className="p-6 space-y-8 bg-slate-50/30">
              {groupedTimeline.map((group, groupIdx) => (
                <div key={groupIdx} className="relative">
                  {/* Date Header Stamp */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{group.date}</span>
                    </div>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  {/* Nodes Grid for this Date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4 border-l-2 border-indigo-200 ml-4">
                    {group.nodes.map((node) => {
                      const Icon = getNodeIcon(node.eventType);
                      const isTransfer = node.eventType === 'work_transfer';

                      return (
                        <div
                          key={node.id}
                          ref={el => nodeRefs.current[node.id] = el}
                          onClick={() => setInspectNode(node)}
                          className={`relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] shadow-2xs ${
                            node.isLastAcknowledged
                              ? 'bg-indigo-50/90 border-2 border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                              : node.isLatest
                              ? 'bg-emerald-50/80 border-2 border-emerald-500 shadow-md'
                              : node.isGap
                              ? 'bg-amber-50/50 border-amber-300 border-dashed hover:border-amber-400'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`absolute -left-[23px] top-5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                              node.isLastAcknowledged ? 'ring-2 ring-indigo-600 animate-pulse' : ''
                            }`}
                            style={{ backgroundColor: node.color || '#6366f1' }}
                          />

                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: node.color || '#6366f1' }}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {node.badge}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {node.isLastAcknowledged && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                                  📍 HEAD
                                </span>
                              )}
                              {node.isLatest && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                                  🌟 Latest
                                </span>
                              )}
                              {node.isGap && !node.isLastAcknowledged && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                  ⚡ Gap
                                </span>
                              )}
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-snug">
                            {node.title}
                          </h4>

                          <p className="mt-1 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {node.summary}
                          </p>

                          {isTransfer && (
                            <div className="mt-2.5 p-2 rounded-lg bg-purple-100/70 border border-purple-200 text-[10px] font-semibold text-purple-900 flex items-center justify-between">
                              <span>🌉 Handoff Bridge: {node.details.prev_name} ➔ {node.details.new_name}</span>
                              <span className="text-purple-700">Inspect →</span>
                            </div>
                          )}

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <div className="flex items-center gap-1.5">
                              {node.memberAvatar ? (
                                <img
                                  src={node.memberAvatar}
                                  alt={node.memberName}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                                  {node.memberName?.[0] || 'U'}
                                </div>
                              )}
                              <span className="font-medium text-slate-700">{node.memberName}</span>
                            </div>
                            <span className="font-mono text-slate-400">{node.time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. NODE INSPECTION SLIDE-OVER DRAWER */}
      {inspectNode && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
          {/* Backdrop with clean luminous blur and click dismiss */}
          <div
            className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity duration-150 animate-fadeIn"
            onClick={() => setInspectNode(null)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-xl bg-white h-full shadow-[0_0_50px_-10px_rgba(0,0,0,0.15)] border-l border-slate-200/80 flex flex-col z-10 animate-fadeIn">
            {/* Drawer Header (PINNED) */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                    {inspectNode.eventType.replace('_', ' ')} Context Node
                  </span>
                  {inspectNode.isLastAcknowledged && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      📍 Your Context Point
                    </span>
                  )}
                  {inspectNode.isLatest && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      🌟 Latest Project State
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{inspectNode.title}</h3>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Recorded: {new Date(inspectNode.timestamp).toLocaleString()} • Contributor: <strong>{inspectNode.memberName}</strong>
                </span>
              </div>
              <button
                onClick={() => setInspectNode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Navigation: Previous / Next Event (PINNED below header) */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 text-xs shrink-0">
              <button
                onClick={() => {
                  const idx = filteredNodes.findIndex(n => n.id === inspectNode.id);
                  if (idx > 0) setInspectNode(filteredNodes[idx - 1]);
                }}
                disabled={filteredNodes.findIndex(n => n.id === inspectNode.id) <= 0}
                className="flex items-center gap-1 font-semibold text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Event</span>
              </button>
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredNodes.findIndex(n => n.id === inspectNode.id) + 1} of {filteredNodes.length}
              </span>
              <button
                onClick={() => {
                  const idx = filteredNodes.findIndex(n => n.id === inspectNode.id);
                  if (idx >= 0 && idx < filteredNodes.length - 1) setInspectNode(filteredNodes[idx + 1]);
                }}
                disabled={filteredNodes.findIndex(n => n.id === inspectNode.id) >= filteredNodes.length - 1}
                className="flex items-center gap-1 font-semibold text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none"
              >
                <span>Next Event</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body (SCROLLABLE, OVERSCROLL-CONTAIN) */}
            <div className="px-6 py-5 overflow-y-auto overscroll-contain flex-1 space-y-5 text-xs">
              {/* Position Action: Set My Position Here */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleAcknowledge(inspectNode.id)}
                  disabled={acknowledging || inspectNode.isLastAcknowledged}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                    inspectNode.isLastAcknowledged
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {inspectNode.isLastAcknowledged
                      ? 'You Are Already At This Context'
                      : 'Sync My Position To This Event'}
                  </span>
                </button>

                <button
                  onClick={() => handleOpenDiff(inspectNode.id, graphData?.userPosition?.latestNode?.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                  title="Compare this node against the latest project update"
                >
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Compare with Latest</span>
                </button>
              </div>

            {/* Executive Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed">
              <h4 className="font-bold text-slate-900 mb-1">Context Summary:</h4>
              <p>{inspectNode.description || inspectNode.summary}</p>
            </div>

            {/* Direct Link to Original Record */}
            <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-100 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-indigo-950 block">Source Record Linked</span>
                <span className="text-[11px] text-slate-500">Explore complete original record in workspace</span>
              </div>
              {inspectNode.sourceType === 'meetings' && (
                <Link
                  to={`/meetings/${inspectNode.sourceRecordId}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                >
                  <span>Open Meeting</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              {inspectNode.sourceType === 'work_transfers' && (
                <Link
                  to={`/work-transfers/${inspectNode.sourceRecordId}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700"
                >
                  <span>Open Handoff</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              {inspectNode.sourceType === 'action_items' && (
                <Link
                  to="/tasks"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700"
                >
                  <span>Open Tasks</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              {inspectNode.sourceType === 'knowledge_documents' && (
                <Link
                  to={`/knowledge-base?docId=${inspectNode.sourceRecordId}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                >
                  <span>Open Doc</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* Granular Changes Snapshot */}
            {inspectNode.changes?.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Granular Changes Recorded ({inspectNode.changes.length}):
                </h4>
                <div className="space-y-1.5 text-xs">
                  {inspectNode.changes.map((ch, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{ch.entity_title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          ch.change_type === 'added' ? 'bg-emerald-100 text-emerald-800' :
                          ch.change_type === 'completed' ? 'bg-blue-100 text-blue-800' :
                          ch.change_type === 'reassigned' ? 'bg-purple-100 text-purple-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {ch.change_type}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 font-mono">
                        Type: {ch.entity_type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* 6. CONTEXT DIFFERENCE (DIFF VIEW) MODAL */}
      {diffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-hidden">
          {/* Backdrop with clean luminous blur and click dismiss */}
          <div
            className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity duration-150 animate-fadeIn"
            onClick={() => setDiffModalOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12),0_0_1px_1px_rgba(0,0,0,0.04)] border border-slate-200/80 overflow-hidden flex flex-col max-h-[88vh] z-10 animate-fadeIn">
            {/* Modal Header: Clean, minimalist light-themed */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Context Difference & Change Analysis</h3>
                  <p className="text-xs text-slate-500">
                    Comparing your context baseline with the target project state
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDiffModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5 overflow-y-auto overscroll-contain space-y-6 flex-1 text-xs">
              {diffLoading ? (
                <LoadingSpinner message="Calculating granular diffs across meetings, decisions, and tasks..." size="lg" />
              ) : diffError ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{diffError}</span>
                </div>
              ) : diffData ? (
                <div className="space-y-6">
                  {/* Boundary Comparison Banner */}
                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-indigo-700 block">Baseline Context:</span>
                        <span className="font-bold text-slate-900 text-xs">{diffData.fromEvent?.title}</span>
                        <span className="text-[11px] text-slate-500 block">{diffData.fromEvent?.date}</span>
                      </div>
                      <ArrowRight className="w-5 h-5 text-indigo-400 shrink-0 hidden sm:block" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">Target Context:</span>
                        <span className="font-bold text-slate-900 text-xs">{diffData.toEvent?.title}</span>
                        <span className="text-[11px] text-slate-500 block">{diffData.toEvent?.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white">
                        {diffData.totalEventsDifference} Updates in Gap
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-cyan-50/60 rounded-xl border border-cyan-200">
                      <span className="text-[10px] text-cyan-900 font-bold uppercase tracking-wider block">New Decisions</span>
                      <span className="text-xl font-bold text-cyan-950 mt-0.5 block">{diffData.differences?.newDecisions?.length || 0}</span>
                    </div>
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                      <span className="text-[10px] text-blue-900 font-bold uppercase tracking-wider block">Deliverables</span>
                      <span className="text-xl font-bold text-blue-950 mt-0.5 block">{diffData.differences?.newTasks?.length || 0}</span>
                    </div>
                    <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
                      <span className="text-[10px] text-purple-900 font-bold uppercase tracking-wider block">Handoffs</span>
                      <span className="text-xl font-bold text-purple-950 mt-0.5 block">{diffData.differences?.handoffs?.length || 0}</span>
                    </div>
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-900 font-bold uppercase tracking-wider block">Milestones</span>
                      <span className="text-xl font-bold text-emerald-950 mt-0.5 block">{diffData.differences?.milestones?.length || 0}</span>
                    </div>
                  </div>

                  {/* Section: New Decisions */}
                  {diffData.differences?.newDecisions?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-cyan-600" />
                        <span>Decisions Adopted in Gap ({diffData.differences.newDecisions.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {diffData.differences.newDecisions.map((dec, i) => (
                          <div key={i} className="p-3 bg-cyan-50/40 rounded-xl border border-cyan-200">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">{dec.title}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">
                                + Added
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                              <strong>Rationale: </strong>{dec.rationale}
                            </p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              Author: {dec.author} • Date: {dec.date}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section: New & In-Flight Tasks */}
                  {diffData.differences?.newTasks?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>New Deliverables & Commitments ({diffData.differences.newTasks.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {diffData.differences.newTasks.map((t, i) => (
                          <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between gap-2">
                            <div>
                              <span className="font-semibold text-slate-900 block">{t.title}</span>
                              <span className="text-[10px] text-slate-500">Owner: {t.owner} • Due: {t.dueDate}</span>
                            </div>
                            <StatusBadge status={t.status} size="xs" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section: Work Transfers / Handoffs */}
                  {diffData.differences?.handoffs?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                        <span>Work Transfers & Responsibility Shifts ({diffData.differences.handoffs.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {diffData.differences.handoffs.map((h, i) => (
                          <div key={i} className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
                            <span className="font-bold text-purple-950 block">{h.title}</span>
                            <p className="mt-1 text-purple-900 text-[11px]">{h.reason}</p>
                            <span className="text-[10px] text-purple-700 mt-1 block">
                              From <strong>{h.fromOwner}</strong> ➔ To <strong>{h.toOwner}</strong> ({h.date})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section: Meetings Held */}
                  {diffData.differences?.newMeetings?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-indigo-600" />
                        <span>Meetings Conducted ({diffData.differences.newMeetings.length})</span>
                      </h4>
                      <div className="space-y-1.5">
                        {diffData.differences.newMeetings.map((m, i) => (
                          <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-slate-900 block">{m.title}</span>
                              <span className="text-[10px] text-slate-500">{m.date}</span>
                            </div>
                            {m.blockersCount > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                                {m.blockersCount} Blockers
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 hidden sm:inline">
                Acknowledge to update your position persistently in the project database.
              </span>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setDiffModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>

                <button
                  onClick={() => handleAcknowledge(diffData?.toEvent?.id)}
                  disabled={acknowledging}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{acknowledging ? 'Syncing...' : 'Acknowledge & Sync to Target'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
