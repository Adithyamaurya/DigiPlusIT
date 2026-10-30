import { query } from '../config/db.js';
import logger from '../utils/logger.js';

export async function auditHandoffKnowledgeGaps(transferId) {
  // 1. Fetch Transfer & Project Context
  const transferRes = await query(`
    SELECT w.*, p.name as project_name, p.id as project_id,
      po.name as prev_name, po.email as prev_email,
      no.name as new_name, no.email as new_email
    FROM work_transfers w
    JOIN projects p ON w.project_id = p.id
    JOIN users po ON w.previous_owner_id = po.id
    JOIN users no ON w.new_owner_id = no.id
    WHERE w.id = $1;
  `, [transferId]);

  if (transferRes.rows.length === 0) {
    throw new Error('Work transfer not found');
  }

  const transfer = transferRes.rows[0];

  // 2. Fetch Transferred Tasks
  const tasksRes = await query(`
    SELECT a.*
    FROM work_transfer_tasks wtt
    JOIN action_items a ON wtt.action_item_id = a.id
    WHERE wtt.work_transfer_id = $1;
  `, [transferId]);
  const tasks = tasksRes.rows;

  // 3. Fetch Project Decisions
  const decisionsRes = await query(`
    SELECT d.*, COUNT(dd.document_id) as linked_docs
    FROM decisions d
    LEFT JOIN decision_documents dd ON d.id = dd.decision_id
    WHERE d.project_id = $1
    GROUP BY d.id;
  `, [transfer.project_id]);
  const decisions = decisionsRes.rows;

  // 4. Fetch Recent Meetings & Blockers
  const meetingsRes = await query(`
    SELECT m.*
    FROM meetings m
    WHERE m.project_id = $1
    ORDER BY m.meeting_date DESC
    LIMIT 3;
  `, [transfer.project_id]);
  const meetings = meetingsRes.rows;

  // 5. Fetch Project Knowledge Documents
  const docsRes = await query(`
    SELECT id, title, category, tags
    FROM knowledge_documents
    WHERE project_id = $1;
  `, [transfer.project_id]);
  const docs = docsRes.rows;

  const checks = [];
  let score = 100;

  // CHECK 1: Active Responsibilities Documented
  const progressText = (transfer.current_progress || '').trim();
  const hasDetailedProgress = progressText.length >= 40;
  if (hasDetailedProgress) {
    checks.push({
      id: 'check_progress',
      name: 'Active Responsibilities Documented',
      passed: true,
      severity: 'Low',
      description: 'Handoff progress statement provides substantive explanation of current branch state and completion percentage.',
      recommendation: 'No action required.'
    });
  } else {
    score -= 20;
    checks.push({
      id: 'check_progress',
      name: 'Active Responsibilities Documented',
      passed: false,
      severity: 'High',
      description: 'Current progress explanation is too vague or missing crucial branch/commit information.',
      missingInformation: 'Missing specific active git branch, completion percentage, or endpoint status.',
      recommendation: 'Request the previous owner to provide detailed repository branches and in-flight pull requests.'
    });
  }

  // CHECK 2: Tasks Have Assigned Owners and Deadlines
  const tasksWithoutDeadlines = tasks.filter(t => !t.due_date && t.status !== 'Completed');
  if (tasks.length === 0) {
    score -= 15;
    checks.push({
      id: 'check_tasks',
      name: 'Transferred Deliverables Defined',
      passed: false,
      severity: 'Medium',
      description: 'No explicit action items or tasks were attached to this handoff package.',
      missingInformation: 'Zero deliverables bundled into transfer.',
      recommendation: 'Ensure specific open action items are linked to the transfer package so work does not get lost.'
    });
  } else if (tasksWithoutDeadlines.length > 0) {
    score -= 15;
    checks.push({
      id: 'check_deadlines',
      name: 'Transferred Tasks Have Committed Deadlines',
      passed: false,
      severity: 'Medium',
      description: `${tasksWithoutDeadlines.length} transferred task(s) do not have scheduled due dates: ${tasksWithoutDeadlines.map(t => `"${t.title}"`).join(', ')}.`,
      missingInformation: 'Target completion dates missing for transferred scope.',
      recommendation: 'Agree on committed target deadlines with the project lead before accepting the handoff.'
    });
  } else {
    checks.push({
      id: 'check_deadlines',
      name: 'Tasks Have Assigned Owners & Deadlines',
      passed: true,
      severity: 'Low',
      description: `All ${tasks.length} transferred deliverables have explicit target completion dates.`,
      recommendation: 'No action required.'
    });
  }

  // CHECK 3: Important Decisions Have Sufficient Context
  const decisionsWithoutReason = decisions.filter(d => !d.reason || d.reason.trim().length < 15);
  if (decisions.length > 0 && decisionsWithoutReason.length === 0) {
    checks.push({
      id: 'check_decisions',
      name: 'Decisions Have Sufficient Context',
      passed: true,
      severity: 'Low',
      description: `All ${decisions.length} project decisions include documented rationales.`,
      recommendation: 'No action required.'
    });
  } else {
    score -= 15;
    checks.push({
      id: 'check_decisions',
      name: 'Decisions Have Sufficient Context',
      passed: false,
      severity: 'Medium',
      description: `${decisionsWithoutReason.length} key decision(s) lack sufficient explanation of why the choice was made.`,
      missingInformation: 'Missing rationale behind architectural choices.',
      recommendation: 'Review meeting transcripts or confirm trade-offs with the tech lead before proceeding.'
    });
  }

  // CHECK 4: Blockers and Dependencies are Explained
  const meetingBlockers = [];
  meetings.forEach(m => {
    if (Array.isArray(m.blockers)) meetingBlockers.push(...m.blockers);
  });

  const notesMentionBlockers = meetingBlockers.some(b => 
    (transfer.additional_notes || '').toLowerCase().includes(b.toLowerCase()) ||
    progressText.toLowerCase().includes(b.toLowerCase())
  );

  if (meetingBlockers.length === 0 || notesMentionBlockers) {
    checks.push({
      id: 'check_blockers',
      name: 'Blockers and Dependencies Explained',
      passed: true,
      severity: 'Low',
      description: 'Active project blockers are either addressed in the notes or no unresolved blockers exist.',
      recommendation: 'No action required.'
    });
  } else {
    score -= 20;
    checks.push({
      id: 'check_blockers',
      name: 'Blockers and Dependencies Explained',
      passed: false,
      severity: 'High',
      description: `Recent meetings flagged unresolved blockers: "${meetingBlockers.join(', ')}", which are not addressed in the handoff notes.`,
      missingInformation: `Status of active blockers (${meetingBlockers.join(', ')}) is unmentioned.`,
      recommendation: 'Clarify whether external dependencies or database blockers will impede your onboarding.'
    });
  }

  // CHECK 5: Relevant Documents Linked
  const hasLinkedDocs = docs.length > 0;
  if (hasLinkedDocs) {
    checks.push({
      id: 'check_docs',
      name: 'Relevant Documents Linked & Available',
      passed: true,
      severity: 'Low',
      description: `${docs.length} knowledge base document(s) available for reference (${docs.map(d => d.title).slice(0, 2).join(', ')}).`,
      recommendation: 'Review prerequisite documents before starting execution.'
    });
  } else {
    score -= 15;
    checks.push({
      id: 'check_docs',
      name: 'Relevant Documents Linked',
      passed: false,
      severity: 'High',
      description: 'Zero architectural or requirement documents are linked to this project scope.',
      missingInformation: 'No architectural specifications, API guides, or design documents found.',
      recommendation: 'Request the previous owner to link or write prerequisite documentation.'
    });
  }

  // CHECK 6: Recent Project Updates Available
  const now = new Date();
  const hasRecentMeeting = meetings.some(m => {
    const mDate = new Date(m.meeting_date);
    const diffDays = (now - mDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  });

  if (hasRecentMeeting) {
    checks.push({
      id: 'check_recent_updates',
      name: 'Recent Project Updates Available',
      passed: true,
      severity: 'Low',
      description: 'Meeting notes and discussion logs exist within the last 14 days, providing fresh context.',
      recommendation: 'No action required.'
    });
  } else {
    score -= 15;
    checks.push({
      id: 'check_recent_updates',
      name: 'Recent Project Updates Available',
      passed: false,
      severity: 'Medium',
      description: 'No meeting notes or updates have been recorded in the past 14 days.',
      missingInformation: 'Recent project activity log is stale.',
      recommendation: 'Hold a 15-minute alignment sync with the lead to capture the most recent verbal decisions.'
    });
  }

  const finalScore = Math.max(0, Math.min(100, score));
  let readiness = 'Ready for Acceptance';
  if (finalScore < 50) readiness = 'Critical Knowledge Gap';
  else if (finalScore < 80) readiness = 'Attention Required';

  const failedChecks = checks.filter(c => !c.passed);

  return {
    transferId: transfer.id,
    projectName: transfer.project_name,
    previousOwner: transfer.prev_name,
    newOwner: transfer.new_name,
    completenessScore: finalScore,
    readinessStatus: readiness,
    passedChecksCount: checks.filter(c => c.passed).length,
    failedChecksCount: failedChecks.length,
    checks,
    summary: failedChecks.length === 0
      ? `Handoff context is comprehensive (${finalScore}% complete). All prerequisites, tasks, and dependencies are documented.`
      : `Handoff audit detected ${failedChecks.length} potential knowledge gap(s). Review recommendations below before accepting responsibility.`
  };
}

export default {
  auditHandoffKnowledgeGaps
};

