import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { MeetingsAPI, ProjectsAPI, TasksAPI } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

export default function Meetings() {
  const [searchParams] = useSearchParams();
  const { projects, users, currentUser, selectedProjectId, showNotification } = useWorkspace();

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProjectId, setFilterProjectId] = useState(searchParams.get('projectId') || '');
  const [createModalOpen, setCreateModalOpen] = useState(searchParams.get('create') === 'true');

  // Form State
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(selectedProjectId || '');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 16));
  const [agenda, setAgenda] = useState('');
  const [rawNotes, setRawNotes] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [pendingTasksForCarryForward, setPendingTasksForCarryForward] = useState([]);
  const [selectedCarryForwardIds, setSelectedCarryForwardIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterProjectId) params.project_id = filterProjectId;
      const res = await MeetingsAPI.getAll(params);
      if (res.success) {
        setMeetings(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [filterProjectId]);

  // When project changes in the create modal, load pending items for carry-forward
  useEffect(() => {
    async function loadCarryForwardItems() {
      if (!projectId) return;
      try {
        const res = await MeetingsAPI.getPendingCarryForward({ projectId });
        if (res.success) {
          setPendingTasksForCarryForward(res.data);
        }
      } catch (err) {
        console.error('Failed to load pending carry-forward tasks:', err);
      }
    }

    if (createModalOpen) {
      loadCarryForwardItems();
    }
  }, [projectId, createModalOpen]);

  const handleToggleParticipant = (userId) => {
    if (selectedParticipants.includes(userId)) {
      setSelectedParticipants(selectedParticipants.filter(id => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const handleToggleCarryForward = (taskId) => {
    if (selectedCarryForwardIds.includes(taskId)) {
      setSelectedCarryForwardIds(selectedCarryForwardIds.filter(id => id !== taskId));
    } else {
      setSelectedCarryForwardIds([...selectedCarryForwardIds, taskId]);
    }
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!title.trim() || !projectId || !rawNotes.trim()) {
      alert('Please fill out all mandatory fields: Title, Project, and Meeting Notes.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await MeetingsAPI.create({
        project_id: projectId,
        title: title.trim(),
        meeting_date: meetingDate,
        agenda: agenda.trim(),
        raw_notes: rawNotes.trim(),
        participant_ids: selectedParticipants,
        carried_forward_task_ids: selectedCarryForwardIds,
        created_by: currentUser?.id
      });

      if (res.success) {
        showNotification(`Meeting "${res.data.title}" created with ${selectedCarryForwardIds.length} carried-forward item(s)!`, 'success');
        setCreateModalOpen(false);
        setTitle('');
        setAgenda('');
        setRawNotes('');
        setSelectedParticipants([]);
        setSelectedCarryForwardIds([]);
        fetchMeetings();
      }
    } catch (err) {
      alert(err.message || 'Failed to create meeting');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && meetings.length === 0) {
    return <LoadingSpinner message="Retrieving recorded meetings & knowledge recaps..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Meeting Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Capture unstructured discussions, carry pending work forward, and generate AI recaps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project Filter */}
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setProjectId(selectedProjectId || (projects[0]?.id || ''));
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Log Meeting</span>
          </button>
        </div>
      </div>

      {/* Meetings List */}
      <div className="grid grid-cols-1 gap-4">
        {meetings.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Video className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No meetings found</h3>
            <p className="text-xs text-slate-500 mt-1">Log your first meeting to begin capturing knowledge.</p>
          </div>
        ) : (
          meetings.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/meetings/${m.id}`}
                        className="text-base font-bold text-slate-900 hover:text-indigo-600 tracking-tight"
                      >
                        {m.title}
                      </Link>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {m.project_name}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(m.meeting_date).toLocaleDateString()} at{' '}
                        {new Date(m.meeting_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span>Logged by {m.creator_name || 'Team Member'}</span>
                    </div>

                    {/* AI Summary Banner */}
                    <div className="mt-3 p-3 rounded-lg bg-slate-50/70 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                      {m.ai_summary ? (
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                          <span>{m.ai_summary}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">
                          Raw notes captured. Open meeting details to generate AI recap.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right badges & action */}
                <div className="flex flex-col md:items-end justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                      {m.decisions_count || 0} Decision{m.decisions_count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                      {m.action_items_count || 0} Task{m.action_items_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <Link
                    to={`/meetings/${m.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 rounded-lg transition-colors"
                  >
                    <span>View Full Details & AI Recap</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE MEETING MODAL WITH AUTOMATIC CARRY-FORWARD */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Log New Meeting & Carry Forward Context"
        subtitle="Record meeting notes and select open action items from previous meetings to review."
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateMeeting} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meeting Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Payment Gateway Integration Discussion"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project *
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Agenda
              </label>
              <input
                type="text"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="e.g. Review payment provider, error protocols, deliverables"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Participants
            </label>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => {
                const isSelected = selectedParticipants.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleToggleParticipant(u.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{u.name}</span>
                    <span className="text-[10px] opacity-75">({u.role})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MANDATORY MODULE 5: AUTOMATIC CARRY-FORWARD SECTION */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Pending Items From Previous Meetings (Automatic Carry-Forward)
                </h4>
              </div>
              <span className="text-[11px] text-amber-700 font-medium">
                {selectedCarryForwardIds.length} selected
              </span>
            </div>

            <p className="text-xs text-amber-800 mb-3 leading-relaxed">
              Select existing unfinished action items from prior project meetings to discuss again.
              <strong> Preserves original task ID, owner, and timeline history.</strong>
            </p>

            {pendingTasksForCarryForward.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No open pending items found from previous meetings for this project.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto overscroll-contain pr-1">
                {pendingTasksForCarryForward.map((task) => {
                  const isChecked = selectedCarryForwardIds.includes(task.id);
                  return (
                    <label
                      key={task.id}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCarryForward(task.id)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{task.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-800 font-mono">
                            Carried: {task.carry_forward_count || 0}x
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                          <span>Owner: {task.owner_name || 'Unassigned'}</span>
                          <span>•</span>
                          <span>Due: {task.due_date || 'No date'}</span>
                          <span>•</span>
                          <span>Status: {task.status}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Raw Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Raw Meeting Notes *
              </label>
              <span className="text-[11px] text-purple-600 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Gemini will parse decisions & action items
              </span>
            </div>
            <textarea
              required
              rows={6}
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              placeholder="Paste or type meeting notes freely, e.g.:&#10;Discussed payment gateway integration. Rahul will complete the API integration by November 3. Priya will test payment failures. The team decided to use Razorpay instead of Stripe. Database changes are still pending. We will discuss testing progress in the next meeting."
              className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
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
              {submitting ? 'Creating Meeting...' : 'Save Meeting & Context'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

