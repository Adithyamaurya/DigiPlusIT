import { query } from '../config/db.js';
import { logEvent, logError } from '../utils/logger.js';
import { generateProjectCatchup, generateHandoffBrief, generateOnboardingBrief } from '../services/aiService.js';

export async function getProjectCatchup(req, res) {
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ success: false, error: 'projectId is required' });
  }

  try {
    // 1. Fetch Project
    const projRes = await query(`SELECT * FROM projects WHERE id = $1`, [projectId]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const project = projRes.rows[0];

    // 2. Fetch Recent Meetings (up to 5)
    const meetingsRes = await query(`
      SELECT id, title, meeting_date, ai_summary, blockers
      FROM meetings
      WHERE project_id = $1
      ORDER BY meeting_date DESC
      LIMIT 5;
    `, [projectId]);

    // Aggregate blockers from meetings
    const blockers = [];
    meetingsRes.rows.forEach(m => {
      if (Array.isArray(m.blockers)) {
        blockers.push(...m.blockers);
      }
    });

    // 3. Fetch Decisions
    const decisionsRes = await query(`
      SELECT id, title, reason, status, created_at
      FROM decisions
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 10;
    `, [projectId]);

    // 4. Fetch Open Action Items
    const openTasksRes = await query(`
      SELECT a.id, a.title, a.due_date, a.priority, a.status, u.name as owner_name
      FROM action_items a
      LEFT JOIN users u ON a.owner_id = u.id
      WHERE a.project_id = $1 AND a.status != 'Completed'
      ORDER BY 
        CASE WHEN a.due_date IS NULL THEN 1 ELSE 0 END,
        a.due_date ASC
      LIMIT 15;
    `, [projectId]);

    // 5. Fetch Completed Action Items
    const completedTasksRes = await query(`
      SELECT a.id, a.title, a.outcome, a.completed_at
      FROM action_items a
      WHERE a.project_id = $1 AND a.status = 'Completed'
      ORDER BY a.completed_at DESC NULLS LAST
      LIMIT 10;
    `, [projectId]);

    // 6. Fetch Project Documents
    const docsRes = await query(`
      SELECT id, title, category, tags
      FROM knowledge_documents
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 10;
    `, [projectId]);

    // 7. Call Gemini AI with retrieved DB context
    const brief = await generateProjectCatchup({
      project,
      recentMeetings: meetingsRes.rows,
      openTasks: openTasksRes.rows,
      completedTasks: completedTasksRes.rows,
      decisions: decisionsRes.rows,
      documents: docsRes.rows,
      blockers,
      requestId: req.id
    });

    logEvent('PROJECT_CATCHUP_GENERATED', { projectId, requestId: req.id });

    res.json({
      success: true,
      data: {
        brief,
        retrievedContext: {
          meetingsCount: meetingsRes.rows.length,
          decisionsCount: decisionsRes.rows.length,
          openTasksCount: openTasksRes.rows.length,
          completedTasksCount: completedTasksRes.rows.length,
          docsCount: docsRes.rows.length
        }
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'PROJECT_CATCHUP_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      code: err.code || 'CATCHUP_GENERATION_FAILED',
      error: err.message || 'Failed to generate project catch-up brief'
    });
  }
}

export async function getHandoffCatchup(req, res) {
  const { transferId } = req.body;

  if (!transferId) {
    return res.status(400).json({ success: false, error: 'transferId is required' });
  }

  try {
    // 1. Fetch Transfer
    const transferRes = await query(`
      SELECT w.*, p.name as project_name, p.description as project_description,
        po.id as prev_id, po.name as prev_name, po.role as prev_role,
        no.id as new_id, no.name as new_name, no.role as new_role
      FROM work_transfers w
      JOIN projects p ON w.project_id = p.id
      JOIN users po ON w.previous_owner_id = po.id
      JOIN users no ON w.new_owner_id = no.id
      WHERE w.id = $1;
    `, [transferId]);

    if (transferRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Work transfer not found' });
    }

    const t = transferRes.rows[0];

    // 2. Fetch Tasks linked to this transfer
    const tasksRes = await query(`
      SELECT a.id, a.title, a.description, a.status, a.priority, a.due_date
      FROM work_transfer_tasks wtt
      JOIN action_items a ON wtt.action_item_id = a.id
      WHERE wtt.work_transfer_id = $1;
    `, [transferId]);

    // 3. Fetch Related Documents
    const docsRes = await query(`
      SELECT id, title, category FROM knowledge_documents WHERE project_id = $1 LIMIT 5;
    `, [t.project_id]);

    // 4. Generate AI brief
    const brief = await generateHandoffBrief({
      transfer: {
        id: t.id,
        reason_for_transfer: t.reason_for_transfer,
        current_progress: t.current_progress,
        additional_notes: t.additional_notes
      },
      previousOwner: { id: t.prev_id, name: t.prev_name, role: t.prev_role },
      newOwner: { id: t.new_id, name: t.new_name, role: t.new_role },
      project: { id: t.project_id, name: t.project_name, description: t.project_description },
      tasks: tasksRes.rows,
      documents: docsRes.rows,
      requestId: req.id
    });

    logEvent('HANDOFF_CATCHUP_GENERATED', { transferId, requestId: req.id });

    res.json({
      success: true,
      data: {
        brief,
        transfer: {
          id: t.id,
          project_name: t.project_name,
          previous_owner: t.prev_name,
          new_owner: t.new_name,
          status: t.status,
          transfer_date: t.transfer_date
        }
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'HANDOFF_CATCHUP_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      code: err.code || 'HANDOFF_CATCHUP_FAILED',
      error: err.message || 'Failed to generate handoff catch-up brief'
    });
  }
}

export async function getOnboardingBrief(req, res) {
  const { projectId } = req.body;
  const memberId = req.body.memberId || req.body.userId;

  if (!projectId || !memberId) {
    return res.status(400).json({ success: false, error: 'projectId and memberId (or userId) are required' });
  }

  try {
    const [projectRes, memberRes, meetingsRes, decisionsRes, tasksRes, docsRes] = await Promise.all([
      query(`SELECT id, name, description FROM projects WHERE id = $1`, [projectId]),
      query(`SELECT id, name, role FROM users WHERE id = $1`, [memberId]),
      query(`
        SELECT id, title, meeting_date, ai_summary
        FROM meetings
        WHERE project_id = $1
        ORDER BY meeting_date DESC
        LIMIT 5
      `, [projectId]),
      query(`SELECT id, title, reason, status FROM decisions WHERE project_id = $1`, [projectId]),
      query(`
        SELECT a.id, a.title, a.status, a.priority, u.name as owner_name
        FROM action_items a
        LEFT JOIN users u ON a.owner_id = u.id
        WHERE a.project_id = $1
      `, [projectId]),
      query(`SELECT id, title, category FROM knowledge_documents WHERE project_id = $1 LIMIT 8`, [projectId])
    ]);

    if (projectRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Project not found' });
    if (memberRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Member not found' });

    const brief = await generateOnboardingBrief({
      project: projectRes.rows[0],
      member: memberRes.rows[0],
      recentMeetings: meetingsRes.rows,
      decisions: decisionsRes.rows,
      tasks: tasksRes.rows,
      documents: docsRes.rows,
      requestId: req.id
    });

    logEvent('ONBOARDING_BRIEF_GENERATED', { projectId, memberId, requestId: req.id });

    res.json({
      success: true,
      data: {
        brief,
        member: memberRes.rows[0],
        project: projectRes.rows[0]
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'ONBOARDING_BRIEF_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      code: err.code || 'ONBOARDING_BRIEF_FAILED',
      error: err.message || 'Failed to generate onboarding brief'
    });
  }
}

