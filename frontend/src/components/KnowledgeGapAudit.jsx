import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function KnowledgeGapAudit({ auditData }) {
  if (!auditData) return null;

  const {
    completenessScore = 100,
    readinessStatus = 'Ready for Acceptance',
    checks = [],
    summary,
    previousOwner,
    newOwner
  } = auditData;

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-300';
    if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-300';
    return 'text-rose-700 bg-rose-50 border-rose-300';
  };

  const getBarColor = (score) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const failedChecks = checks.filter(c => !c.passed);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Pre-Handoff Knowledge Gap Detector
            </h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              Transfer Gate
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Automated verification ensuring {newOwner} receives sufficient context from {previousOwner} before accepting responsibility.
          </p>
        </div>

        {/* Completeness Gauge */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shrink-0">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Transfer Completeness</span>
            <span className="text-xs font-semibold text-slate-700">{readinessStatus}</span>
          </div>
          <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold text-base ${getScoreColor(completenessScore)}`}>
            {completenessScore}%
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getBarColor(completenessScore)}`}
            style={{ width: `${completenessScore}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed font-medium">
          {summary}
        </p>
      </div>

      {/* 6 Core Verification Checks */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Continuity Verification Checks ({checks.filter(c => c.passed).length}/{checks.length} Passed)
        </h4>

        <div className="grid grid-cols-1 gap-2.5">
          {checks.map((check, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border text-xs transition-colors ${
                check.passed
                  ? 'bg-emerald-50/40 border-emerald-100 text-slate-800'
                  : 'bg-amber-50/60 border-amber-200 text-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {check.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : check.severity === 'High' ? (
                    <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}

                  <div>
                    <h5 className="font-semibold text-slate-900 flex items-center gap-2">
                      <span>{check.name}</span>
                      {!check.passed && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900">
                          {check.severity} Gap
                        </span>
                      )}
                    </h5>
                    <p className="mt-0.5 text-slate-600 leading-relaxed">{check.description}</p>

                    {/* Missing Information Callout */}
                    {check.missingInformation && (
                      <div className="mt-2 p-2 rounded bg-white/80 border border-amber-200 text-[11px] text-amber-950 font-medium">
                        ⚠️ <strong>Missing Context:</strong> {check.missingInformation}
                      </div>
                    )}

                    {/* Actionable Recommendation */}
                    {!check.passed && check.recommendation && (
                      <p className="mt-1 text-[11px] text-indigo-700">
                        💡 <strong>Pre-acceptance Action:</strong> {check.recommendation}
                      </p>
                    )}
                  </div>
                </div>

                <span className={`text-[11px] font-bold shrink-0 ${check.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {check.passed ? 'VERIFIED' : 'ACTION REQUIRED'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

