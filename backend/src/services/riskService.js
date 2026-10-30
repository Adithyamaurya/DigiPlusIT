import { query } from '../config/db.js';
import { explainContextRisks } from './aiService.js';
import logger from '../utils/logger.js';

export async function detectProjectRisks(projectId, requestId = null) {
  // 1. Fetch Project
  const projectRes = await query(`SELECT * FROM projects WHERE id = $1`, [projectId]);
  if (projectRes.rows.length === 0) {
    throw new Error('Project not found');
  }
  const project = projectRes.rows[0];

  // 2. Fetch Tasks for Project
  const tasksRes = await query(`
    SELECT a.*, u.name as owner_name, u.email as owner_email
    FROM action_items a
    LEFT JOIN users u ON a.owner_id = u.id
    WHERE a.project_id = $1
  `, [projectId]);
  const tasks = tasksRes.rows;

  // 3. Fetch Work Transfers
  const transfersRes = await query(`
    SELECT w.*, p.name as prev_owner_name, n.name as new_owner_name
    FROM work_transfers w
    JOIN users p ON w.previous_owner_id = p.id
    JOIN users n ON w.new_owner_id = n.id
    WHERE w.project_id = $1
  `, [projectId]);
  const transfers = transfersRes.rows;

  // 4. Fetch Decisions and their linked document count
  const decisionsRes = await query(`
    SELECT d.*, COUNT(dd.document_id) as linked_doc_count
    FROM decisions d
    LEFT JOIN decision_documents dd ON d.id = dd.decision_id
    WHERE d.project_id = $1
    GROUP BY d.id
  `, [projectId]);
  const decisions = decisionsRes.rows;

  const now = new Date();
  const detectedRisks = [];
  let scoreDeduction = 0;

  // CHECK 1: Overdue Tasks
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'Completed' || !t.due_date) return false;
    const due = new Date(t.due_date);
    return due < now;
  });

  if (overdueTasks.length > 0) {
    const penalty = overdueTasks.length * 15;
    scoreDeduction += penalty;
    detectedRisks.push({
      id: 'risk_overdue_tasks',
      type: 'OVERDUE_TASKS',
      title: `${overdueTasks.length} Overdue Action Item${overdueTasks.length > 1 ? 's' : ''}`,
      severity: overdueTasks.length > 2 ? 'Critical' : 'High',
      description: `Tasks past their scheduled deadline: ${overdueTasks.map(t => `"${t.title}" (Due: ${t.due_date})`).join(', ')}`,
      items: overdueTasks.map(t => ({ id: t.id, title: t.title, owner: t.owner_name, due_date: t.due_date })),
      defaultRecommendation: 'Immediately review overdue items with owners and reset realistic deadlines or eliminate blockers.',
      deduction: penalty
    });
  }

  // CHECK 2: Unassigned Tasks
  const unassignedTasks = tasks.filter(t => t.status !== 'Completed' && !t.owner_id);
  if (unassignedTasks.length > 0) {
    const penalty = unassignedTasks.length * 10;
    scoreDeduction += penalty;
    detectedRisks.push({
      id: 'risk_unassigned_tasks',
      type: 'UNASSIGNED_TASKS',
      title: `${unassignedTasks.length} Pending Task${unassignedTasks.length > 1 ? 's' : ''} Without Assigned Owner`,
      severity: unassignedTasks.length > 1 ? 'High' : 'Medium',
      description: `Tasks without clear individual ownership risk being dropped: ${unassignedTasks.map(t => `"${t.title}"`).join(', ')}`,
      items: unassignedTasks.map(t => ({ id: t.id, title: t.title })),
      defaultRecommendation: 'Assign specific owners to all pending deliverables during the next sprint or standup.',
      deduction: penalty
    });
  }

  // CHECK 3: Blocked Tasks
  const blockedTasks = tasks.filter(t => t.status === 'Blocked');
  if (blockedTasks.length > 0) {
    const penalty = blockedTasks.length * 15;
    scoreDeduction += penalty;
    detectedRisks.push({
      id: 'risk_blocked_tasks',
      type: 'BLOCKED_TASKS',
      title: `${blockedTasks.length} Blocked Action Item${blockedTasks.length > 1 ? 's' : ''}`,
      severity: 'High',
      description: `Blocked tasks stalling progress: ${blockedTasks.map(t => `"${t.title}"`).join(', ')}`,
      items: blockedTasks.map(t => ({ id: t.id, title: t.title, owner: t.owner_name })),
      defaultRecommendation: 'Escalate blockers immediately in the project channel to unfreeze dependent milestones.',
      deduction: penalty
    });
  }

  // CHECK 4: Tasks Carried Forward Across Multiple Meetings
  const multiCarriedTasks = tasks.filter(t => t.status !== 'Completed' && t.carry_forward_count >= 2);
  if (multiCarriedTasks.length > 0) {
    const penalty = multiCarriedTasks.length * 10;
    scoreDeduction += penalty;
    detectedRisks.push({
      id: 'risk_carried_forward',
      type: 'CARRIED_FORWARD_TASKS',
      title: `${multiCarriedTasks.length} Task${multiCarriedTasks.length > 1 ? 's' : ''} Carried Forward Across 2+ Meetings`,
      severity: 'High',
      description: `Tasks repeatedly deferred across multiple meetings: ${multiCarriedTasks.map(t => `"${t.title}" (${t.carry_forward_count}x)`).join(', ')}`,
      items: multiCarriedTasks.map(t => ({ id: t.id, title: t.title, carryCount: t.carry_forward_count })),
      defaultRecommendation: 'Re-evaluate whether these tasks are genuinely actionable, break them into smaller increments, or remove them.',
      deduction: penalty
    });
  }

  // CHECK 5: Unacknowledged Work Transfers
  const unacknowledgedTransfers = transfers.filter(w => w.status === 'Pending Acknowledgement');
  if (unacknowledgedTransfers.length > 0) {
    const penalty = unacknowledgedTransfers.length * 10;
    scoreDeduction += penalty;
    detectedRisks.push({
      id: 'risk_unacknowledged_transfers',
      type: 'UNACKNOWLEDGED_TRANSFERS',
      title: `${unacknowledgedTransfers.length} Unacknowledged Work Transfer${unacknowledgedTransfers.length > 1 ? 's' : ''}`,
      severity: 'High',
      description: `Work transfers initiated but not confirmed by new owners: ${unacknowledgedTransfers.map(w => `From ${w.prev_owner_name} to ${w.new_owner_name}`).join(', ')}`,
      items: unacknowledgedTransfers.map(w => ({ id: w.id, from: w.prev_owner_name, to: w.new_owner_name, transferDate: w.transfer_date })),
      defaultRecommendation: 'Ensure the new owner reviews the handoff brief and formally acknowledges responsibility to prevent tasks falling into a vacuum.',
      deduction: penalty
    });
  }

  // CHECK 6: Tasks Missing Deadlines
  const noDeadlineTasks = tasks.filter(t => t.status !== 'Completed' && !t.due_date);
  if (noDeadlineTasks.length > 0) {
    const penalty = noDeadlineTasks.length * 5;
    scoreDeduction += penalty;
    detectedRisks.push({
      id: 'risk_missing_deadlines',
      type: 'MISSING_DEADLINES',
      title: `${noDeadlineTasks.length} Active Task${noDeadlineTasks.length > 1 ? 's' : ''} Without Deadlines`,
      severity: 'Medium',
      description: `Tasks operating without committed delivery dates: ${noDeadlineTasks.map(t => `"${t.title}"`).join(', ')}`,
      items: noDeadlineTasks.map(t => ({ id: t.id, title: t.title })),
      defaultRecommendation: 'Attach clear target dates to maintain team pacing and delivery predictability.',
      deduction: penalty
    });
  }

  // CHECK 7: Important Decisions Without Linked Documentation
  const unlinkedDecisions = decisions.filter(d => parseInt(d.linked_doc_count, 10) === 0);
  if (unlinkedDecisions.length > 0) {
    const penalty = unlinkedDecisions.length * 5;
    scoreDeduction += penalty;
    detectedRisks.push({
      id: 'risk_unlinked_decisions',
      type: 'UNLINKED_DECISIONS',
      title: `${unlinkedDecisions.length} Decision${unlinkedDecisions.length > 1 ? 's' : ''} Lacking Linked Documentation`,
      severity: 'Low',
      description: `Key decisions without associated architectural or requirement documentation: ${unlinkedDecisions.map(d => `"${d.title}"`).join(', ')}`,
      items: unlinkedDecisions.map(d => ({ id: d.id, title: d.title })),
      defaultRecommendation: 'Link or author a knowledge base article capturing rationale and operational specs for new team members.',
      deduction: penalty
    });
  }

  // Compute Health Score: 0 - 100
  const healthScore = Math.max(0, Math.min(100, 100 - scoreDeduction));

  let riskLevel = 'Healthy';
  if (healthScore < 40) riskLevel = 'Critical Risk';
  else if (healthScore < 65) riskLevel = 'High Risk';
  else if (healthScore < 85) riskLevel = 'Moderate Risk';

  // Get AI recommendations if risks exist
  let aiExplanation = null;
  if (detectedRisks.length > 0) {
    try {
      aiExplanation = await explainContextRisks({
        project,
        detectedRisks,
        healthScore,
        requestId
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to get AI risk explanation; falling back to deterministic recommendations');
      aiExplanation = {
        summary: `Deterministic analysis detected ${detectedRisks.length} context risk(s) affecting sprint continuity.`,
        risk_evaluations: detectedRisks.map(r => ({
          risk_title: r.title,
          severity: r.severity,
          impact: r.description,
          recommendation: r.defaultRecommendation
        }))
      };
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    healthScore,
    riskLevel,
    riskFactorsCount: detectedRisks.length,
    scoreFormula: '100 - (Overdue x 15) - (Unassigned x 10) - (Blocked x 15) - (Unack Handoffs x 10) - (Multi-carry x 10) - (No Deadline x 5) - (Unlinked Decisions x 5)',
    disclaimer: 'The health score is an internal project-risk indicator based on task hygiene and handoff state, not an objective forecast.',
    risks: detectedRisks,
    aiExplanation
  };
}

export default {
  detectProjectRisks
};

