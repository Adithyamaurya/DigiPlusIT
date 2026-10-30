import { query, transaction } from '../config/db.js';
import { logEvent, logError } from '../utils/logger.js';
import { generateHandoffBrief } from '../services/aiService.js';
import { auditHandoffKnowledgeGaps } from '../services/gapDetectorService.js';
import { recordEvent } from '../services/contextRecorderService.js';

export async function getAllWorkTransfers(req, res) {
  const { project_id, status } = req.query;

  try {
    let sql = `
      SELECT 
        w.*,
        p.name as project_name,
        po.name as prev_owner_name,
        po.email as prev_owner_email,
        po.avatar_url as prev_owner_avatar,
        no.name as new_owner_name,
        no.email as new_owner_email,
        no.avatar_url as new_owner_avatar,
        (SELECT COUNT(*) FROM work_transfer_tasks wtt WHERE wtt.work_transfer_id = w.id) as transferred_tasks_count
      FROM work_transfers w
      JOIN projects p ON w.project_id = p.id
      JOIN users po ON w.previous_owner_id = po.id
      JOIN users no ON w.new_owner_id = no.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      params.push(project_id);
      sql += ` AND w.project_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND w.status = $${params.length}`;
    }

    sql += ` ORDER BY w.created_at DESC;`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TRANSFERS_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve work transfers' });
  }
}

export async function getWorkTransferById(req, res) {
  const { id } = req.params;

  try {
    const transferRes = await query(`
      SELECT 
        w.*,
        p.name as project_name,
        po.name as prev_owner_name,
        po.email as prev_owner_email,
        po.role as prev_owner_role,
        no.name as new_owner_name,
        no.email as new_owner_email,
        no.role as new_owner_role
      FROM work_transfers w
      JOIN projects p ON w.project_id = p.id
      JOIN users po ON w.previous_owner_id = po.id
      JOIN users no ON w.new_owner_id = no.id
      WHERE w.id = $1;
    `, [id]);

    if (transferRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Work transfer not found' });
    }

    const transfer = transferRes.rows[0];

    // Transferred Tasks
    const tasksRes = await query(`
      SELECT a.*, u.name as current_owner_name
      FROM work_transfer_tasks wtt
      JOIN action_items a ON wtt.action_item_id = a.id
      LEFT JOIN users u ON a.owner_id = u.id
      WHERE wtt.work_transfer_id = $1;
    `, [id]);

    // Acknowledgements
    const ackRes = await query(`
      SELECT ha.*, u.name as acknowledger_name
      FROM handoff_acknowledgements ha
      JOIN users u ON ha.acknowledged_by = u.id
      WHERE ha.work_transfer_id = $1
      ORDER BY ha.acknowledged_at DESC;
    `, [id]);

    // Relevant knowledge docs
    const docsRes = await query(`
      SELECT id, title, category, tags
      FROM knowledge_documents
      WHERE project_id = $1
      LIMIT 10;
    `, [transfer.project_id]);

    // Knowledge Gap Audit
    let knowledgeGaps = null;
    try {
      knowledgeGaps = await auditHandoffKnowledgeGaps(id);
    } catch (gapErr) {
      // Non-fatal
    }

    res.json({
      success: true,
      data: {
        ...transfer,
        tasks: tasksRes.rows,
        acknowledgements: ackRes.rows,
        related_documents: docsRes.rows,
        knowledge_gaps: knowledgeGaps
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TRANSFER_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve work transfer details' });
  }
}

export async function createWorkTransfer(req, res) {
  const {
    project_id,
    previous_owner_id,
    new_owner_id,
    reason_for_transfer,
    current_progress,
    additional_notes,
    task_ids = []
  } = req.body;

  if (!project_id || !previous_owner_id || !new_owner_id || !reason_for_transfer || !current_progress) {
    return res.status(400).json({
      success: false,
      error: 'Project, previous owner, new owner, transfer reason, and current progress are required'
    });
  }

  if (previous_owner_id === new_owner_id) {
    return res.status(400).json({ success: false, error: 'Previous owner and new owner cannot be the same person' });
  }

  try {
    // 1. Fetch metadata for AI Handoff Brief
    const [projectRes, prevUserRes, newUserRes] = await Promise.all([
      query(`SELECT id, name FROM projects WHERE id = $1`, [project_id]),
      query(`SELECT id, name, role FROM users WHERE id = $1`, [previous_owner_id]),
      query(`SELECT id, name, role FROM users WHERE id = $1`, [new_owner_id])
    ]);

    if (projectRes.rows.length === 0) throw new Error('Project not found');
    if (prevUserRes.rows.length === 0) throw new Error('Previous owner not found');
    if (newUserRes.rows.length === 0) throw new Error('New owner not found');

    const project = projectRes.rows[0];
    const prevUser = prevUserRes.rows[0];
    const newUser = newUserRes.rows[0];

    // Fetch tasks being transferred
    let tasks = [];
    if (task_ids.length > 0) {
      const tasksRes = await query(`
        SELECT id, title, description, status, priority, due_date
        FROM action_items
        WHERE id = ANY($1::uuid[])
      `, [task_ids]);
      tasks = tasksRes.rows;
    }

    // Fetch related docs
    const docsRes = await query(`
      SELECT id, title, category FROM knowledge_documents WHERE project_id = $1 LIMIT 5
    `, [project_id]);

    // 2. Try generating AI Handoff Brief
    let aiBrief = null;
    try {
      const generated = await generateHandoffBrief({
        transfer: { reason_for_transfer, current_progress, additional_notes },
        previousOwner: prevUser,
        newOwner: newUser,
        project,
        tasks,
        documents: docsRes.rows,
        requestId: req.id
      });
      aiBrief = JSON.stringify(generated);
    } catch (aiErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'AI_HANDOFF_BRIEF_WARN', message: aiErr.message });
      // Structured fallback handoff note
      aiBrief = JSON.stringify({
        previous_work_summary: `Handoff initiated from ${prevUser.name} to ${newUser.name}. Reason: ${reason_for_transfer}. Progress: ${current_progress}`,
        completed_milestones: ['Prior work handed over per status report'],
        unfinished_work: tasks.map(t => ({ task_title: t.title, current_state: t.status, priority: t.priority })),
        critical_decisions_to_remember: ['Review project decisions and documentation before making changes.'],
        immediate_first_actions: [`Schedule sync with ${prevUser.name}`, 'Verify access and repository branch'],
        key_documents_to_read: docsRes.rows.map(d => d.title)
      });
    }

    // 3. Persist Work Transfer in database transaction
    const newTransfer = await transaction(async (tx) => {
      const insertRes = await tx.query(`
        INSERT INTO work_transfers (
          project_id, previous_owner_id, new_owner_id,
          reason_for_transfer, current_progress, additional_notes,
          ai_handoff_brief, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending Acknowledgement')
        RETURNING *;
      `, [
        project_id,
        previous_owner_id,
        new_owner_id,
        reason_for_transfer.trim(),
        current_progress.trim(),
        additional_notes || null,
        aiBrief
      ]);

      const transfer = insertRes.rows[0];

      // Link tasks
      for (const taskId of task_ids) {
        await tx.query(`
          INSERT INTO work_transfer_tasks (work_transfer_id, action_item_id)
          VALUES ($1, $2)
          ON CONFLICT (work_transfer_id, action_item_id) DO NOTHING;
        `, [transfer.id, taskId]);
      }

      // Create notification for new owner
      await tx.query(`
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES ($1, $2, $3, 'warning', $4);
      `, [
        new_owner_id,
        'Work Transfer Pending Your Acknowledgement',
        `${prevUser.name} initiated a work transfer to you for project "${project.name}". Please review and acknowledge.`,
        `/work-transfers/${transfer.id}`
      ]);

      return transfer;
    });

    logEvent('WORK_TRANSFER_CREATED', { transferId: newTransfer.id, requestId: req.id });

    // Record in Context Graph
    try {
      await recordEvent({
        projectId: newTransfer.project_id,
        eventType: 'handoff',
        title: `Work Handoff Initiated: ${prevUser.name} ➔ ${newUser.name}`,
        description: reason_for_transfer,
        createdBy: previous_owner_id,
        sourceRecordId: newTransfer.id,
        sourceType: 'work_transfer',
        changes: tasks.map(t => ({
          entityType: 'handoff',
          entityId: t.id,
          entityTitle: t.title,
          changeType: 'reassigned',
          previousValue: { owner: prevUser.name },
          newValue: { owner: newUser.name }
        }))
      });
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    res.status(201).json({ success: true, data: newTransfer });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TRANSFER_CREATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to create work transfer' });
  }
}

/**
 * Acknowledge Work Transfer
 * Confirms receipt, reassigns selected tasks to the new owner, logs task_history!
 */
export async function acknowledgeWorkTransfer(req, res) {
  const { id } = req.params;
  const { comments, acknowledged_by } = req.body;

  try {
    const updated = await transaction(async (tx) => {
      // 1. Get transfer
      const transferRes = await tx.query(`
        SELECT w.*, po.name as prev_name, no.name as new_name
        FROM work_transfers w
        JOIN users po ON w.previous_owner_id = po.id
        JOIN users no ON w.new_owner_id = no.id
        WHERE w.id = $1
      `, [id]);

      if (transferRes.rows.length === 0) throw new Error('Work transfer not found');
      const transfer = transferRes.rows[0];

      if (transfer.status === 'Acknowledged' || transfer.status === 'Completed') {
        return transfer;
      }

      const ackUserId = acknowledged_by || transfer.new_owner_id;

      // 2. Record Acknowledgement
      await tx.query(`
        INSERT INTO handoff_acknowledgements (work_transfer_id, acknowledged_by, comments)
        VALUES ($1, $2, $3);
      `, [id, ackUserId, comments || 'Work transfer reviewed and acknowledged']);

      // 3. Update Transfer Status
      const updateRes = await tx.query(`
        UPDATE work_transfers
        SET 
          status = 'Acknowledged',
          acknowledged_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `, [id]);

      // 4. Reassign all linked tasks to the new owner!
      const tasksRes = await tx.query(`
        SELECT action_item_id FROM work_transfer_tasks WHERE work_transfer_id = $1
      `, [id]);

      for (const row of tasksRes.rows) {
        const taskId = row.action_item_id;

        // Update task owner
        await tx.query(`
          UPDATE action_items
          SET owner_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2;
        `, [transfer.new_owner_id, taskId]);

        // Audit log in task_history
        await tx.query(`
          INSERT INTO task_history (action_item_id, changed_by, change_type, old_value, new_value, notes)
          VALUES ($1, $2, 'OWNER_REASSIGNED', $3, $4, $5);
        `, [
          taskId,
          ackUserId,
          transfer.prev_name,
          transfer.new_name,
          `Ownership transferred via confirmed Handoff #${id.slice(0, 8)}: ${comments || 'Acknowledged by new owner'}`
        ]);
      }

      return updateRes.rows[0];
    });

    logEvent('WORK_TRANSFER_ACKNOWLEDGED', { transferId: id, requestId: req.id });

    // Record confirmed handoff in Context Graph
    try {
      await recordEvent({
        projectId: updated.project_id,
        eventType: 'handoff',
        title: `Handoff Confirmed: ${updated.prev_name} ➔ ${updated.new_name}`,
        description: `Transfer acknowledged. Responsibilities and tasks transitioned to ${updated.new_name}.`,
        createdBy: updated.new_owner_id,
        sourceRecordId: updated.id,
        sourceType: 'work_transfer'
      });
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    res.json({ success: true, message: 'Work transfer acknowledged and tasks reassigned', data: updated });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TRANSFER_ACK_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to acknowledge work transfer' });
  }
}

export async function getWorkTransferGaps(req, res) {
  const { id } = req.params;
  try {
    const gaps = await auditHandoffKnowledgeGaps(id);
    res.json({ success: true, data: gaps });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TRANSFER_GAP_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to audit knowledge gaps' });
  }
}

