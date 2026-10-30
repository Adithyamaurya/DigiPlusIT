import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Search,
  Tag,
  FolderKanban,
  FileText,
  Calendar,
  ExternalLink,
  Trash2,
  Edit2,
  Check,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import { KnowledgeAPI } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function KnowledgeBase() {
  const [searchParams] = useSearchParams();
  const { projects, currentUser, selectedProjectId, showNotification } = useWorkspace();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterProject, setFilterProject] = useState(searchParams.get('projectId') || selectedProjectId || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [filterCategory, setFilterCategory] = useState('');

  // Selected doc for viewing/editing
  const [activeDoc, setActiveDoc] = useState(null);

  // AI Q&A State
  const [aiQuestion, setAiQuestion] = useState('');
  const [askingAI, setAskingAI] = useState(false);
  const [qaResult, setQaResult] = useState(null);
  const [qaError, setQaError] = useState(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Architecture');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterProject) params.project_id = filterProject;
      if (searchQuery) params.search = searchQuery;
      if (filterCategory) params.category = filterCategory;

      const res = await KnowledgeAPI.getAll(params);
      if (res.success) {
        setDocs(res.data);
        if (res.data.length > 0 && !activeDoc) {
          // If query param docId specified, find it, else default to first
          const targetDocId = searchParams.get('docId');
          const found = targetDocId ? res.data.find(d => d.id === targetDocId) : res.data[0];
          setActiveDoc(found || res.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [filterProject, searchQuery, filterCategory]);

  const handleCreateDoc = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !filterProject) {
      alert('Title, project, and content are required.');
      return;
    }

    try {
      setSubmitting(true);
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const res = await KnowledgeAPI.create({
        project_id: filterProject,
        title: title.trim(),
        content: content.trim(),
        category,
        tags,
        created_by: currentUser?.id
      });

      if (res.success) {
        showNotification('Knowledge document created successfully!', 'success');
        setCreateModalOpen(false);
        setTitle('');
        setContent('');
        setTagsInput('');
        fetchDocs();
      }
    } catch (err) {
      alert(err.message || 'Failed to create document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this knowledge document?')) return;

    try {
      const res = await KnowledgeAPI.delete(docId);
      if (res.success) {
        showNotification('Document deleted successfully', 'info');
        setActiveDoc(null);
        fetchDocs();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const handleAskMemory = async (presetQuestion) => {
    const query = (presetQuestion || aiQuestion || '').trim();
    if (!query) return;
    const targetProject = filterProject || selectedProjectId || (projects[0]?.id);
    if (!targetProject) {
      alert('Please select a project first.');
      return;
    }

    try {
      setAskingAI(true);
      setQaError(null);
      if (presetQuestion) setAiQuestion(presetQuestion);

      const res = await KnowledgeAPI.ask({
        projectId: targetProject,
        question: query
      });

      if (res.success) {
        setQaResult(res.data);
      } else {
        setQaError(res.error || 'Failed to answer question about project memory');
      }
    } catch (err) {
      setQaError(err.message || 'Failed to connect to AI continuity service');
    } finally {
      setAskingAI(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Knowledge Base</h1>
          <p className="mt-1 text-sm text-slate-500">
            Central repository for architectural specifications, security rules, and linked decision rationale.
          </p>
        </div>

        <button
          onClick={() => {
            if (!filterProject && projects.length > 0) {
              setFilterProject(projects[0].id);
            }
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Document</span>
        </button>
      </div>

      {/* AI Memory Interrogation: Ask Project Memory */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Ask Project Memory (AI Q&A)</h2>
                <p className="text-xs text-slate-300">
                  Query across all meetings, decisions, architecture specs, and completed task outcomes with source attribution.
                </p>
              </div>
            </div>

            {/* Project Picker for Memory Query */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Memory Scope:</span>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="bg-slate-800/90 text-white text-xs border border-slate-700 rounded-lg px-2.5 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Question Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskMemory();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask about previous discussions, architectural constraints, task ownership..."
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={askingAI || !aiQuestion.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-sm shrink-0"
            >
              {askingAI ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  <span>Ask Memory</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Prompt Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-400 font-medium">Try asking:</span>
            {[
              'What did we decide regarding payment gateway retry limits?',
              'Who is responsible for Redis caching and what are the open tasks?',
              'What are the unresolved blockers before checkout service release?'
            ].map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAskMemory(prompt)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/70 text-slate-300 hover:text-white transition-all text-left"
              >
                "{prompt}"
              </button>
            ))}
          </div>

          {/* Error Notice */}
          {qaError && (
            <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{qaError}</span>
            </div>
          )}

          {/* Answer Card */}
          {qaResult && (
            <div className="mt-4 p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Synthesized Memory Response</span>
                  {qaResult.confidence && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      qaResult.confidence.toLowerCase() === 'high'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {qaResult.confidence} Confidence
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setQaResult(null)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Dismiss
                </button>
              </div>

              {/* Main Answer text */}
              <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80">
                {qaResult.answer}
              </div>

              {/* 3 Categories: Confirmed Facts, Inferred Points, Missing/Unknown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Confirmed Facts */}
                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmed Facts</span>
                  </div>
                  {qaResult.confirmed_facts?.length > 0 ? (
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      {qaResult.confirmed_facts.map((fact, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">None specifically recorded</span>
                  )}
                </div>

                {/* Inferred Points */}
                <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-900/40">
                  <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-xs mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Inferred Context</span>
                  </div>
                  {qaResult.inferred_points?.length > 0 ? (
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      {qaResult.inferred_points.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">No inferences made</span>
                  )}
                </div>

                {/* Missing / Unknown */}
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/40">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs mb-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Missing Information</span>
                  </div>
                  {qaResult.missing_or_unknown?.length > 0 ? (
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      {qaResult.missing_or_unknown.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">All details documented</span>
                  )}
                </div>
              </div>

              {/* Source References */}
              {qaResult.sources?.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                    Verified Source References ({qaResult.sources.length}):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {qaResult.sources.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
                      >
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 uppercase">
                          {s.type}
                        </span>
                        <span className="font-medium text-white">{s.title}</span>
                        {s.date && <span className="text-slate-500 font-mono">({s.date})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by keyword or topic..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Project Filter */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          <option value="Architecture">Architecture</option>
          <option value="Security">Security</option>
          <option value="API">API</option>
          <option value="Database">Database</option>
          <option value="General">General</option>
        </select>
      </div>

      {/* Split View: Documents List on Left & Content Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
        {/* Left: Document Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-3 max-h-[700px] overflow-y-auto">
          {loading ? (
            <LoadingSpinner message="Searching documents..." />
          ) : docs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No documents found matching criteria.</p>
            </div>
          ) : (
            docs.map((d) => (
              <div
                key={d.id}
                onClick={() => setActiveDoc(d)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  activeDoc?.id === d.id
                    ? 'bg-indigo-50/50 border-indigo-400 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight">{d.title}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                    {d.category}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {d.content.replace(/[#*`_]/g, '')}
                </p>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    {d.tags?.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Document Viewer (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          {activeDoc ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-600 px-2 py-0.5 rounded bg-indigo-50">
                      {activeDoc.category}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">{activeDoc.project_name}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{activeDoc.title}</h2>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Author: {activeDoc.creator_name || 'Team'} • Last updated{' '}
                    {new Date(activeDoc.updated_at || activeDoc.created_at).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() => handleDeleteDoc(activeDoc.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete Document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Tags */}
              {activeDoc.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeDoc.tags.map((t, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-purple-50 text-purple-700 border border-purple-100">
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Document Markdown / Text Content */}
              <div className="text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap bg-slate-50/50 p-5 rounded-xl border border-slate-100 max-h-[500px] overflow-y-auto">
                {activeDoc.content}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Select a document from the left to view contents.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE DOCUMENT MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Knowledge Base Document"
        subtitle="Record architectural design, API specifications, or operational protocols."
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateDoc} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project *</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="Architecture">Architecture</option>
                <option value="Security">Security</option>
                <option value="API">API</option>
                <option value="Database">Database</option>
                <option value="Testing">Testing</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Payment Gateway Architecture & Razorpay API Guidelines"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. payments, razorpay, api, backend"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Content (Markdown Supported) *</label>
            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Overview&#10;Describe system architecture, webhook specifications, or security standards..."
              className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              {submitting ? 'Saving Document...' : 'Publish Document'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

