import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightLeft,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { WorkTransfersAPI, TasksAPI } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function WorkTransfers() {
  const { projects, users, currentUser, selectedProjectId, showNotification } = useWorkspace();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form State
  const [projectId, setProjectId] = useState(selectedProjectId || '');
  const [prevOwnerId, setPrevOwnerId] = useState(currentUser?.id || '');
  const [newOwnerId, setNewOwnerId] = useState('');
  const [reason, setReason] = useState('');
  const [progress, setProgress] = useState('');
  const [notes, setNotes] = useState('');
  const [userTasks, setUserTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await WorkTransfersAPI.getAll();
      if (res.success) {
        setTransfers(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  // When project or previous owner changes, load pending tasks belonging to that owner
  useEffect(() => {
    async function loadTasksForTransfer() {
      if (!projectId || !prevOwnerId) return;
      try {
        const res = await TasksAPI.getAll({ project_id: projectId, owner_id: prevOwnerId, status: 'Pending,In Progress,Blocked' });
        if (res.success) {
          // Filter to non-completed
          setUserTasks(res.data.filter(t => t.status !== 'Completed'));
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (createModalOpen) {
      loadTasksForTransfer();
    }
  }, [projectId, prevOwnerId, createModalOpen]);

  const toggleTaskSelection = (taskId) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!projectId || !prevOwnerId || !newOwnerId || !reason.trim() || !progress.trim()) {
      alert('Please fill out all mandatory fields.');
      return;
    }

    if (prevOwnerId === newOwnerId) {
      alert('Previous owner and new owner cannot be the same person.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await WorkTransfersAPI.create({
        project_id: projectId,
        previous_owner_id: prevOwnerId,
        new_owner_id: newOwnerId,
        reason_for_transfer: reason.trim(),
        current_progress: progress.trim(),
        additional_notes: notes.trim(),
        task_ids: selectedTaskIds
      });

      if (res.success) {
        showNotification('Work transfer created and AI handoff brief generated!', 'success');
        setCreateModalOpen(false);
        setReason('');
        setProgress('');
        setNotes('');
        setSelectedTaskIds([]);
        fetchTransfers();
      }
    } catch (err) {
      alert(err.message || 'Failed to create work transfer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && transfers.length === 0) {
    return <LoadingSpinner message="Retrieving work handoffs & continuity records..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Work Transfer & Handoff Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ensure zero context loss when team members take leave, rotate projects, or reassign responsibilities.
          </p>
        </div>

        <button
          onClick={() => {
            setProjectId(selectedProjectId || (projects[0]?.id || ''));
            setPrevOwnerId(currentUser?.id || (users[0]?.id || ''));
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Initiate Work Transfer</span>
        </button>
      </div>

      {/* Transfers List */}
      <div className="grid grid-cols-1 gap-4">
        {transfers.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No work transfers initiated</h3>
            <p className="text-xs text-slate-500 mt-1">Initiate a handoff to transfer task ownership with an AI brief.</p>
          </div>
        ) : (
          transfers.map((w) => (
            <div
              key={w.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{w.prev_owner_name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-indigo-600 text-sm">{w.new_owner_name}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {w.project_name}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-700 font-medium leading-relaxed">
                    <strong>Reason:</strong> {w.reason_for_transfer}
                  </p>

                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                    <strong>Progress:</strong> {w.current_progress}
                  </p>

                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(w.transfer_date).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-slate-700">
                      {w.transferred_tasks_count || 0} task(s) transferred
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Review CTA */}
              <div className="flex flex-col md:items-end justify-between gap-3 shrink-0">
                <StatusBadge status={w.status} size="sm" />
                <Link
                  to={`/work-transfers/${w.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 rounded-lg transition-colors"
                >
                  <span>Review Handoff Brief</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* INITIATE WORK TRANSFER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Initiate Work Transfer Handoff"
        subtitle="Select pending tasks and provide progress context. An AI handoff brief will be generated automatically."
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project *</label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Previous Owner *</label>
              <select
                required
                value={prevOwnerId}
                onChange={(e) => setPrevOwnerId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Owner *</label>
              <select
                required
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">Select team member...</option>
                {users.filter(u => u.id !== prevOwnerId).map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Work Transfer *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Scheduled medical leave next week; handover of payment gateway API integration"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Progress Summary *
            </label>
            <textarea
              required
              rows={3}
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              placeholder="Detail what has been accomplished, active branches, open pull requests, and current blockers..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Pending Tasks Selection */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Select Pending Deliverables to Transfer ({selectedTaskIds.length})
              </label>
              <span className="text-[11px] text-slate-500">Ownership reassigns upon confirmation</span>
            </div>

            {userTasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No active pending tasks currently assigned to the selected previous owner in this project.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto overscroll-contain pr-1">
                {userTasks.map((task) => {
                  const isChecked = selectedTaskIds.includes(task.id);
                  return (
                    <label
                      key={task.id}
                      className={`flex items-center gap-3 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-purple-50 border-purple-200 text-purple-950 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTaskSelection(task.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="flex-1 truncate">{task.title}</span>
                      <StatusBadge status={task.priority} size="xs" />
                      <span className="text-[11px] text-slate-400">{task.due_date || 'No due date'}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Notes & Crucial Warnings
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ensure webhook HMAC signature algorithm uses SHA-256 secret key from .env"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{submitting ? 'Generating AI Brief...' : 'Initiate Transfer & Generate AI Brief'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

