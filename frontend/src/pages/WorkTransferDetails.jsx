import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowRightLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  BookOpen,
  Check,
  AlertCircle,
  FileText
} from 'lucide-react';
import { WorkTransfersAPI } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import KnowledgeGapAudit from '../components/KnowledgeGapAudit';

export default function WorkTransferDetails() {
  const { id } = useParams();
  const { currentUser, showNotification } = useWorkspace();

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [ackComments, setAckComments] = useState('');

  const fetchTransfer = async () => {
    try {
      setLoading(true);
      const res = await WorkTransfersAPI.getById(id);
      if (res.success) {
        setTransfer(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfer();
  }, [id]);

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    try {
      setAcknowledging(true);
      const res = await WorkTransfersAPI.acknowledge(id, {
        comments: ackComments.trim() || 'Work transfer reviewed and confirmed.',
        acknowledged_by: currentUser?.id
      });

      if (res.success) {
        showNotification('Work transfer acknowledged and task ownership reassigned!', 'success');
        setAckModalOpen(false);
        fetchTransfer();
      }
    } catch (err) {
      alert(err.message || 'Failed to acknowledge work transfer');
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading work transfer & AI handoff brief..." />;
  }

  if (!transfer) {
    return (
      <div className="text-center py-12">
        <h3 className="text-base font-semibold text-slate-800">Transfer record not found</h3>
        <Link to="/work-transfers" className="mt-4 text-xs font-semibold text-indigo-600 hover:underline inline-block">
          ← Back to Transfers
        </Link>
      </div>
    );
  }

  // Parse AI Handoff Brief if stored as JSON string
  let aiBrief = null;
  if (transfer.ai_handoff_brief) {
    try {
      aiBrief = typeof transfer.ai_handoff_brief === 'string'
        ? JSON.parse(transfer.ai_handoff_brief)
        : transfer.ai_handoff_brief;
    } catch (e) {
      aiBrief = { previous_work_summary: transfer.ai_handoff_brief };
    }
  }

  const isPendingAck = transfer.status === 'Pending Acknowledgement';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-slate-900">{transfer.prev_owner_name}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className="text-lg font-bold text-indigo-600">{transfer.new_owner_name}</span>
                <StatusBadge status={transfer.status} size="sm" />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span>Project: <strong className="text-slate-800">{transfer.project_name}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Initiated {new Date(transfer.transfer_date).toLocaleDateString()}
                </span>
                {transfer.acknowledged_at && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">
                      Acknowledged {new Date(transfer.acknowledged_at).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-3 text-xs text-slate-700">
                <strong>Reason:</strong> {transfer.reason_for_transfer}
              </div>
            </div>
          </div>

          {/* Acknowledgement CTA */}
          {isPendingAck ? (
            <button
              onClick={() => setAckModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm self-start md:self-auto"
            >
              <Check className="w-4 h-4" />
              <span>Acknowledge Work Transfer</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Transfer Acknowledged</span>
            </div>
          )}
        </div>
      </div>

      {/* Special Feature: Knowledge Gap Detector Audit Gate */}
      {transfer.knowledge_gaps && (
        <KnowledgeGapAudit auditData={transfer.knowledge_gaps} />
      )}

      {/* AI Handoff Brief Banner */}
      {aiBrief && (
        <div className="rounded-xl bg-purple-50/70 border border-purple-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-purple-900 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>AI Continuity & Handoff Brief</span>
          </div>

          <div className="space-y-4 text-xs text-purple-950">
            {aiBrief.previous_work_summary && (
              <div>
                <h4 className="font-bold text-purple-900 mb-1">What Was Previously Being Worked On:</h4>
                <p className="leading-relaxed bg-white/70 rounded-lg p-3 border border-purple-100">
                  {aiBrief.previous_work_summary}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiBrief.immediate_first_actions?.length > 0 && (
                <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                  <h4 className="font-bold text-indigo-950 mb-1.5">Immediate First Actions for {transfer.new_owner_name}:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {aiBrief.immediate_first_actions.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiBrief.critical_decisions_to_remember?.length > 0 && (
                <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                  <h4 className="font-bold text-indigo-950 mb-1.5">Critical Decisions to Remember:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {aiBrief.critical_decisions_to_remember.map((dec, idx) => (
                      <li key={idx}>{dec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {aiBrief.key_documents_to_read?.length > 0 && (
              <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                <h4 className="font-bold text-indigo-950 mb-1">Key Documents to Review:</h4>
                <div className="flex flex-wrap gap-2 mt-1">
                  {aiBrief.key_documents_to_read.map((doc, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono text-[11px]">
                      📄 {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress & Additional Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Original Progress Statement</h3>
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
            {transfer.current_progress}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Additional Context & Warnings</h3>
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
            {transfer.additional_notes || 'No extra warnings attached to this handoff.'}
          </p>
        </div>
      </div>

      {/* Transferred Tasks List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Transferred Tasks ({transfer.tasks?.length || 0})
            </h3>
            <p className="text-xs text-slate-500">
              Tasks included in this handoff package.
            </p>
          </div>
        </div>

        {transfer.tasks?.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No individual tasks linked to this transfer.</p>
        ) : (
          <div className="space-y-3">
            {transfer.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">{task.title}</span>
                    <StatusBadge status={task.status} size="xs" />
                    <StatusBadge status={task.priority} size="xs" />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                    <span>Current Owner: {task.current_owner_name || 'Unassigned'}</span>
                    <span>•</span>
                    <span>Due Date: {task.due_date || 'No date'}</span>
                  </div>
                </div>

                <Link
                  to="/tasks"
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  View Task →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acknowledgements History */}
      {transfer.acknowledgements?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Acknowledgement Sign-Off</h3>
          <div className="space-y-2">
            {transfer.acknowledgements.map((ack) => (
              <div key={ack.id} className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{ack.acknowledger_name}</span> confirmed receipt on{' '}
                  {new Date(ack.acknowledged_at).toLocaleString()}
                  {ack.comments && <p className="mt-1 text-emerald-800 italic font-normal">"{ack.comments}"</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACKNOWLEDGE WORK TRANSFER MODAL */}
      <Modal
        isOpen={ackModalOpen}
        onClose={() => setAckModalOpen(false)}
        title="Confirm Work Transfer Receipt"
        subtitle={`You are confirming receipt of responsibilities from ${transfer.prev_owner_name}.`}
      >
        <form onSubmit={handleAcknowledge} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            By confirming, all <strong>{transfer.tasks?.length || 0} transferred task(s)</strong> will be
            reassigned to you (<strong>{currentUser?.name}</strong>), and the change will be logged in the immutable task history.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Acknowledgement Comments / Notes
            </label>
            <textarea
              rows={3}
              value={ackComments}
              onChange={(e) => setAckComments(e.target.value)}
              placeholder="e.g. Reviewed branch feat/razorpay-core. Verified webhook credentials and local test suite."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAckModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={acknowledging}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{acknowledging ? 'Confirming...' : 'Confirm Receipt & Reassign Tasks'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

