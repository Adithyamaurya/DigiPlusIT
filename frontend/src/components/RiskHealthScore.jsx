import React from 'react';
import { AlertTriangle, CheckCircle, AlertOctagon, Info, Sparkles, ShieldCheck } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function RiskHealthScore({ healthData, showAI = true }) {
  if (!healthData) return null;

  const {
    score = 100,
    level = 'Healthy',
    risks = [],
    aiExplanation,
    disclaimer
  } = healthData;

  const getScoreColor = (val) => {
    if (val >= 85) return 'text-emerald-600 border-emerald-500 bg-emerald-50';
    if (val >= 65) return 'text-amber-600 border-amber-500 bg-amber-50';
    if (val >= 40) return 'text-orange-600 border-orange-500 bg-orange-50';
    return 'text-rose-600 border-rose-500 bg-rose-50';
  };

  const getProgressColor = (val) => {
    if (val >= 85) return 'bg-emerald-500';
    if (val >= 65) return 'bg-amber-500';
    if (val >= 40) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Context Continuity & Risk Detector</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              Deterministic Engine
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Automated detection of knowledge bottlenecks, missing handoffs, and task decay across meetings.
          </p>
        </div>

        {/* Health Score Gauge */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
          <div className="text-right">
            <span className="text-xs text-slate-500 block leading-tight font-medium">Project Health</span>
            <span className="text-xs font-semibold text-slate-700">{level}</span>
          </div>
          <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold text-lg ${getScoreColor(score)}`}>
            {score}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
          <span>0 (Critical Risk)</span>
          <span>50 (Moderate)</span>
          <span>100 (Optimal Flow)</span>
        </div>
      </div>

      {/* Detected Risk List */}
      <div className="mt-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Detected Risk Factors ({risks.length})
        </h4>

        {risks.length === 0 ? (
          <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Zero critical risk conditions detected. Team handoffs and deadlines are healthy.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {risks.map((risk) => (
              <div
                key={risk.id}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {risk.severity === 'Critical' ? (
                      <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : risk.severity === 'High' ? (
                      <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h5 className="text-xs font-semibold text-slate-900">{risk.title}</h5>
                      <p className="mt-0.5 text-xs text-slate-600">{risk.description}</p>
                      {risk.defaultRecommendation && (
                        <p className="mt-1.5 text-[11px] text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded border border-indigo-100 inline-block">
                          💡 <strong>Recommendation:</strong> {risk.defaultRecommendation}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={risk.severity} size="xs" />
                    <span className="text-[11px] font-mono text-rose-600 font-medium">-{risk.deduction} pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Risk Guidance Panel */}
      {showAI && aiExplanation && (
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="rounded-xl bg-purple-50/60 border border-purple-200/70 p-4">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-purple-900">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>AI Continuity Analysis & Mitigations</span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed mb-3">
              {aiExplanation.summary}
            </p>

            {aiExplanation.risk_evaluations?.length > 0 && (
              <div className="space-y-2 mt-2">
                {aiExplanation.risk_evaluations.slice(0, 3).map((evalItem, idx) => (
                  <div key={idx} className="bg-white/80 rounded-lg p-2.5 border border-purple-100 text-xs">
                    <span className="font-semibold text-slate-900">{evalItem.risk_title}:</span>
                    <span className="text-slate-600 ml-1.5">{evalItem.recommendation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {disclaimer && (
        <p className="mt-4 text-[10px] text-slate-400 text-center">
          {disclaimer}
        </p>
      )}
    </div>
  );
}

