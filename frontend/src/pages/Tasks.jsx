import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Plus,
  Clock,
  User,
  History,
  CheckCircle,
  AlertTriangle,
  Filter,
  Check,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { TasksAPI, ProjectsAPI } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Tasks() {
  const [searchParams] = useSearchParams();
  const { projects, users, currentUser, selectedProjectId, showNotification } = useWorkspace();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterProject, setFilterProject] = useState(searchParams.get('projectId') || selectedProjectId || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);

  // Active Task for modals
  const [activeTask, setActiveTask] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [outcomeText, setOutcomeText] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [newOwnerId, setNewOwnerId] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterProject) params.project_id = filterProject;
      if (filterStatus) params.status = filterStatus;
      if (filterOwner) params.owner_id = filterOwner;
      if (filterPriority) params.priority = filterPriority;

      const res = await TasksAPI.getAll(params);
      if (res.success) {
        setTasks(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filterProject, filterStatus, filterOwner, filterPriority]);

  const handleStatusChange = async (taskId, newStatus) => {
    if (newStatus === 'Completed') {
      const task = tasks.find(t => t.id === taskId);
      setActiveTask(task);
      setOutcomeText('');
      setCompletionNotes('');
      setOutcomeModalOpen(true);
      return;
    }

    try {
      const res = await TasksAPI.updateStatus(taskId, {
        status: newStatus,
        userId: currentUser?.id,
        notes: `Status changed to ${newStatus}`
      });
      if (res.success) {
        showNotification(`Task status updated to ${newStatus}`, 'success');
        fetchTasks();
      }
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleRecordOutcome = async (e) => {
    e.preventDefault();
    if (!outcomeText.trim() || !activeTask) return;

    try {
      setSubmitting(true);
      const res = await TasksAPI.recordOutcome(activeTask.id, {
        outcome: outcomeText.trim(),
        completion_notes: completionNotes.trim(),
        userId: currentUser?.id
      });
      if (res.success) {
        showNotification('Task marked completed and outcome recorded!', 'success');
        setOutcomeModalOpen(false);
        fetchTasks();
      }
    } catch (err) {
      alert(err.message || 'Failed to record outcome');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHistory = async (task) => {
    setActiveTask(task);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await TasksAPI.getHistory(task.id);
      if (res.success) {
        setTaskHistory(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenReassign = (task) => {
    setActiveTask(task);
    setNewOwnerId(task.owner_id || '');
    setReassignNotes('');
    setReassignModalOpen(true);
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!activeTask) return;

    try {
      setSubmitting(true);
      const res = await TasksAPI.assignOwner(activeTask.id, {
        owner_id: newOwnerId || null,
        notes: reassignNotes.trim(),
        userId: currentUser?.id
      });
      if (res.success) {
        showNotification('Task owner reassigned successfully', 'success');
        setReassignModalOpen(false);
        fetchTasks();
      }
    } catch (err) {
      alert(err.message || 'Failed to reassign owner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim() || !filterProject) {
      alert('Title and Project are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await TasksAPI.create({
        project_id: filterProject,
        title: title.trim(),
        description: description.trim(),
        owner_id: ownerId || null,
        due_date: dueDate || null,
        priority,
        userId: currentUser?.id
      });

      if (res.success) {
        showNotification('Action item created successfully!', 'success');
        setCreateModalOpen(false);
        setTitle('');
        setDescription('');
        setDueDate('');
        fetchTasks();
      }
    } catch (err) {
      alert(err.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Action Item Lifecycle</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track commitments, carry unfinished items forward, and preserve full change history.
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
          <span>New Action Item</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Project */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Blocked">Blocked</option>
        </select>

        {/* Owner */}
        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Owners</option>
          <option value="unassigned">Unassigned Only</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <span className="ml-auto text-xs text-slate-400 font-medium">
          Showing {tasks.length} item{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Task List / Table */}
      {loading ? (
        <LoadingSpinner message="Loading action items & audit records..." />
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800">No action items matching criteria</h3>
          <p className="text-xs text-slate-500 mt-1">Try resetting filters or log a new task.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isOverdue = task.status !== 'Completed' && task.due_date && new Date(task.due_date) < new Date();

            return (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left Task Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={task.status} size="xs" />
                    <StatusBadge status={task.priority} size="xs" />

                    {/* Carry forward indicator */}
                    {task.carry_forward_count > 0 && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"
                        title={`Carried forward across ${task.carry_forward_count} meeting(s)`}
                      >
                        🔄 Carried {task.carry_forward_count}x
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 font-medium">
                      {task.project_name}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Recorded Outcome Display */}
                  {task.outcome && (
                    <div className="mt-2 p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 text-[11px] text-emerald-800 flex items-start gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Outcome:</strong> {task.outcome}
                        {task.completion_notes && (
                          <span className="text-emerald-700 block mt-0.5">{task.completion_notes}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Source Meeting */}
                  {task.source_meeting_title && (
                    <div className="mt-2 text-[10px] text-slate-400">
                      Origin: {task.source_meeting_title}
                    </div>
                  )}
                </div>

                {/* Right Metadata & Interactive Controls */}
                <div className="flex flex-wrap items-center gap-4 shrink-0 md:border-l md:border-slate-100 md:pl-4">
                  {/* Owner Pill with Reassign trigger */}
                  <button
                    onClick={() => handleOpenReassign(task)}
                    className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    title="Click to reassign owner"
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                      {task.owner_name ? task.owner_name[0] : '?'}
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-slate-800 leading-tight">
                        {task.owner_name || 'Unassigned'}
                      </span>
                      <span className="block text-[10px] text-indigo-600">Reassign</span>
                    </div>
                  </button>

                  {/* Due Date */}
                  <div className="text-xs">
                    <span className="block text-[10px] text-slate-400">Due Date</span>
                    <span className={`font-medium flex items-center gap-1 ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                      <Clock className="w-3 h-3" />
                      {task.due_date || 'No date'} {isOverdue && '(Overdue)'}
                    </span>
                  </div>

                  {/* Quick Status Dropdown */}
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-0.5">Status</span>
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>

                  {/* History Button */}
                  <button
                    onClick={() => handleOpenHistory(task)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="View Task Audit Timeline"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: RECORD OUTCOME ON COMPLETION */}
      <Modal
        isOpen={outcomeModalOpen}
        onClose={() => setOutcomeModalOpen(false)}
        title="Record Task Outcome & Mark Completed"
        subtitle="Preserve what was achieved and any critical completion notes for future team reference."
      >
        <form onSubmit={handleRecordOutcome} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Actual Outcome / Deliverable *
            </label>
            <textarea
              required
              rows={3}
              value={outcomeText}
              onChange={(e) => setOutcomeText(e.target.value)}
              placeholder="e.g. Razorpay webhook handler implemented with HMAC verification. Verified passing unit tests."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Completion Notes
            </label>
            <textarea
              rows={2}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="e.g. Deployed to staging test environment."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOutcomeModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              {submitting ? 'Recording...' : 'Mark Completed & Save Outcome'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: TASK AUDIT HISTORY TIMELINE */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Audit Timeline: ${activeTask?.title || 'Action Item'}`}
        subtitle="Complete immutable history of status transitions, owner handoffs, and carry-forwards."
      >
        {loadingHistory ? (
          <LoadingSpinner message="Retrieving history logs from Task_History..." />
        ) : taskHistory.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No history logs recorded.</p>
        ) : (
          <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-2">
            {taskHistory.map((h) => (
              <div key={h.id} className="relative text-xs">
                {/* Dot */}
                <div className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white shadow-xs" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{h.change_type}</span>
                  <span className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleString()}</span>
                </div>
                {h.notes && (
                  <p className="mt-1 text-slate-600">{h.notes}</p>
                )}
                <div className="mt-1 text-[11px] text-slate-400">
                  By {h.actor_name || 'System'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* MODAL 3: REASSIGN OWNER */}
      <Modal
        isOpen={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title={`Reassign Owner: ${activeTask?.title || ''}`}
        subtitle="Update ownership and record rationale in the immutable task history."
      >
        <form onSubmit={handleReassignSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select New Owner</label>
            <select
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reassignment Notes</label>
            <textarea
              rows={2}
              value={reassignNotes}
              onChange={(e) => setReassignNotes(e.target.value)}
              placeholder="e.g. Handing off to QA engineer for test execution"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReassignModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              {submitting ? 'Saving...' : 'Confirm Reassignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: CREATE TASK MANUALLY */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Action Item"
        subtitle="Directly log an actionable deliverable with ownership and target deadline."
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Complete Razorpay API integration"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope details and expected deliverable..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Owner</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
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
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

