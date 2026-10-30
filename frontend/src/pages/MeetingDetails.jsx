import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Video,
  Calendar,
  Sparkles,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  BookOpen,
  Edit3,
  Check,
  FileText,
  AlertOctagon
} from 'lucide-react';
import { MeetingsAPI, KnowledgeAPI } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function MeetingDetails() {
  const { id } = useParams();
  const { currentUser, showNotification } = useWorkspace();

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState(null);

  // AI Recap Review & Edit Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [recapData, setRecapData] = useState(null);
  const [savingRecap, setSavingRecap] = useState(false);

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      const res = await MeetingsAPI.getById(id);
      if (res.success) {
        setMeeting(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  const handleGenerateRecap = async () => {
    try {
      setGeneratingAI(true);
      setAiError(null);
      const res = await MeetingsAPI.previewRecap({
        notes: meeting.raw_notes,
        project_id: meeting.project_id
      });

      if (res.success) {
        setRecapData(res.data);
        setReviewModalOpen(true);
      }
    } catch (err) {
      setAiError(err.message || 'AI recap generation failed');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleConfirmAndSaveRecap = async () => {
    if (!recapData) return;

    try {
      setSavingRecap(true);
      const res = await MeetingsAPI.saveRecap(id, {
        summary: recapData.summary,
        discussion_points: recapData.discussion_points,
        blockers: recapData.blockers,
        follow_up_topics: recapData.follow_up_topics,
        decisions: recapData.decisions,
        action_items: recapData.action_items,
        userId: currentUser?.id
      });

      if (res.success) {
        showNotification('Meeting recap, decisions, and action items saved to database!', 'success');
        setReviewModalOpen(false);
        fetchMeeting();
      }
    } catch (err) {
      alert(err.message || 'Failed to save confirmed recap');
    } finally {
      setSavingRecap(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading meeting context, decisions & action items..." />;
  }

  if (!meeting) {
    return (
      <div className="text-center py-12">
        <h3 className="text-base font-semibold text-slate-800">Meeting record not found</h3>
        <Link to="/meetings" className="mt-4 text-xs font-semibold text-indigo-600 hover:underline inline-block">
          ← Back to Meetings
        </Link>
      </div>
    );
  }

  const { decisions = [], action_items = [], participants = [], related_documents = [] } = meeting;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{meeting.title}</h1>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {meeting.project_name}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(meeting.meeting_date).toLocaleDateString()} at{' '}
                  {new Date(meeting.meeting_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>•</span>
                <span>Logged by {meeting.creator_name || 'Team'}</span>
              </div>

              {meeting.agenda && (
                <div className="mt-3 text-xs text-slate-600">
                  <strong className="text-slate-800">Agenda:</strong> {meeting.agenda}
                </div>
              )}
            </div>
          </div>

          {/* AI Recap Trigger Button */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={handleGenerateRecap}
              disabled={generatingAI}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
              <span>{generatingAI ? 'Analyzing Meeting Notes...' : 'Generate AI Meeting Recap'}</span>
            </button>
            <span className="text-[10px] text-slate-400">Powered by Gemini AI Intelligence</span>
          </div>
        </div>

        {/* AI Error Notification if API key missing or error */}
        {aiError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">AI Recap Request Notice</p>
              <p className="mt-0.5 text-rose-700">{aiError}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Ensure <code>GEMINI_API_KEY</code> is configured in backend <code>.env</code>.
              </p>
            </div>
          </div>
        )}

        {/* Participants Row */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            Attendees ({participants.length}):
          </span>
          {participants.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{p.name}</span>
              <span className="text-[10px] text-slate-400">({p.role})</span>
            </span>
          ))}
        </div>
      </div>

      {/* AI Summary Banner */}
      {meeting.ai_summary && (
        <div className="rounded-xl bg-purple-50/70 border border-purple-200/80 p-5">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>AI Executive Meeting Summary</span>
          </div>
          <p className="text-sm text-purple-900 leading-relaxed font-normal">
            {meeting.ai_summary}
          </p>

          {/* Discussion Points & Blockers */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-purple-100">
            {meeting.discussion_points?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-purple-900 mb-1.5">Key Discussion Points</h5>
                <ul className="list-disc list-inside text-xs text-purple-800 space-y-1">
                  {meeting.discussion_points.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.follow_up_topics?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-purple-900 mb-1.5">Follow-up Topics</h5>
                <ul className="list-disc list-inside text-xs text-purple-800 space-y-1">
                  {meeting.follow_up_topics.map((top, i) => (
                    <li key={i}>{top}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Middle Section: Decisions & Original Raw Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Decisions Section */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Decisions Made</h3>
              <p className="text-xs text-slate-500">Agreed architectural and operational conclusions</p>
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              {decisions.length} Decision{decisions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {decisions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No decisions recorded yet. Click "Generate AI Meeting Recap" to extract decisions from raw notes.
            </p>
          ) : (
            <div className="space-y-3">
              {decisions.map((d) => (
                <div key={d.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{d.title}</h4>
                    <StatusBadge status={d.status || 'Adopted'} size="xs" />
                  </div>
                  {d.reason && (
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      <strong>Rationale:</strong> {d.reason}
                    </p>
                  )}

                  {/* Linked Knowledge Documents */}
                  {d.linked_documents?.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                      <span className="text-[11px] font-medium text-slate-700">Linked Spec:</span>
                      {d.linked_documents.map((doc) => (
                        <Link
                          key={doc.id}
                          to={`/knowledge-base?docId=${doc.id}`}
                          className="text-[11px] font-semibold text-indigo-600 hover:underline"
                        >
                          {doc.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Original Meeting Notes */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Original Meeting Notes</h3>
                <p className="text-xs text-slate-500">Raw notes preserved alongside AI extractions</p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Verbatim Record</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-72 overflow-y-auto">
              {meeting.raw_notes}
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-400">
            Source notes are immutable proof of discussion and context continuity.
          </p>
        </div>
      </div>

      {/* Action Items Section (Both newly generated & carried forward!) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Meeting Action Items</h3>
            <p className="text-xs text-slate-500">Deliverables and commitments assigned during or carried into this meeting</p>
          </div>
          <Link
            to="/tasks"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            All Action Items <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {action_items.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No action items assigned to this meeting.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {action_items.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{task.title}</h4>
                    <StatusBadge status={task.status} size="xs" />
                  </div>

                  {task.description && (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{task.description}</p>
                  )}

                  {/* Carry Forward Indicator */}
                  {task.is_carried_forward && (
                    <div className="mt-2.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium inline-block">
                      🔄 Carried forward from previous meeting (Count: {task.carry_forward_count}x)
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-700">{task.owner_name || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3" />
                      {task.due_date || 'No deadline'}
                    </span>
                    <StatusBadge status={task.priority} size="xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI RECAP REVIEW & EDIT MODAL BEFORE PERSISTENCE (Requirement Section 7) */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title="Review & Confirm AI Meeting Recap"
        subtitle="Verify extracted decisions and action items before saving them to the persistent PostgreSQL database."
        maxWidth="max-w-3xl"
      >
        {recapData && (
          <div className="space-y-5">
            {/* Summary */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meeting Summary
              </label>
              <textarea
                rows={3}
                value={recapData.summary}
                onChange={(e) => setRecapData({ ...recapData, summary: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Extracted Decisions */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Extracted Decisions ({recapData.decisions.length})
              </label>
              <div className="space-y-2">
                {recapData.decisions.map((dec, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                    <input
                      type="text"
                      value={dec.title}
                      onChange={(e) => {
                        const updated = [...recapData.decisions];
                        updated[idx].title = e.target.value;
                        setRecapData({ ...recapData, decisions: updated });
                      }}
                      className="w-full px-2 py-1 text-xs font-semibold border border-slate-200 rounded bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Reason or rationale"
                      value={dec.reason || ''}
                      onChange={(e) => {
                        const updated = [...recapData.decisions];
                        updated[idx].reason = e.target.value;
                        setRecapData({ ...recapData, decisions: updated });
                      }}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Extracted Action Items */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Extracted Action Items ({recapData.action_items.length})
              </label>
              <div className="space-y-2">
                {recapData.action_items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const updated = [...recapData.action_items];
                        updated[idx].title = e.target.value;
                        setRecapData({ ...recapData, action_items: updated });
                      }}
                      className="w-full px-2 py-1 text-xs font-semibold border border-slate-200 rounded bg-white"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Owner</label>
                        <input
                          type="text"
                          value={item.owner_name || ''}
                          placeholder="Unassigned"
                          onChange={(e) => {
                            const updated = [...recapData.action_items];
                            updated[idx].owner_name = e.target.value || null;
                            setRecapData({ ...recapData, action_items: updated });
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Due Date</label>
                        <input
                          type="date"
                          value={item.due_date || ''}
                          onChange={(e) => {
                            const updated = [...recapData.action_items];
                            updated[idx].due_date = e.target.value || null;
                            setRecapData({ ...recapData, action_items: updated });
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Priority</label>
                        <select
                          value={item.priority || 'Medium'}
                          onChange={(e) => {
                            const updated = [...recapData.action_items];
                            updated[idx].priority = e.target.value;
                            setRecapData({ ...recapData, action_items: updated });
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSaveRecap}
                disabled={savingRecap}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{savingRecap ? 'Saving to Database...' : 'Confirm & Save Decisions & Tasks'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

