import { query, transaction } from '../config/db.js';
import { logEvent, logError } from '../utils/logger.js';
import { recordEvent } from '../services/contextRecorderService.js';

export async function getAllTasks(req, res) {
  const { project_id, status, owner_id, priority } = req.query;

  try {
    let sql = `
      SELECT 
        a.*,
        p.name as project_name,
        u.name as owner_name,
        u.email as owner_email,
        u.avatar_url as owner_avatar,
        m.title as source_meeting_title,
        m.meeting_date as source_meeting_date
      FROM action_items a
      JOIN projects p ON a.project_id = p.id
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN meetings m ON a.source_meeting_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      params.push(project_id);
      sql += ` AND a.project_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND a.status = $${params.length}`;
    }

    if (owner_id) {
      if (owner_id === 'unassigned') {
        sql += ` AND a.owner_id IS NULL`;
      } else {
        params.push(owner_id);
        sql += ` AND a.owner_id = $${params.length}`;
      }
    }

    if (priority) {
      params.push(priority);
      sql += ` AND a.priority = $${params.length}`;
    }

    sql += ` ORDER BY 
      CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END,
      CASE WHEN a.due_date IS NULL THEN 1 ELSE 0 END,
      a.due_date ASC,
      a.created_at DESC;`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TASKS_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve tasks' });
  }
}

export async function getTaskById(req, res) {
  const { id } = req.params;

  try {
    const taskRes = await query(`
      SELECT 
        a.*,
        p.name as project_name,
        u.name as owner_name,
        u.email as owner_email,
        m.title as source_meeting_title,
        m.meeting_date as source_meeting_date
      FROM action_items a
      JOIN projects p ON a.project_id = p.id
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN meetings m ON a.source_meeting_id = m.id
      WHERE a.id = $1;
    `, [id]);

    if (taskRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const task = taskRes.rows[0];

    // Meetings this task appeared in (including carry forwards)
    const meetingsRes = await query(`
      SELECT m.id, m.title, m.meeting_date, mai.is_carried_forward, mai.discussion_notes
      FROM meeting_action_items mai
      JOIN meetings m ON mai.meeting_id = m.id
      WHERE mai.action_item_id = $1
      ORDER BY m.meeting_date ASC;
    `, [id]);

    // Complete audit history from task_history table
    const historyRes = await query(`
      SELECT th.*, u.name as actor_name, u.email as actor_email
      FROM task_history th
      LEFT JOIN users u ON th.changed_by = u.id
      WHERE th.action_item_id = $1
      ORDER BY th.created_at DESC;
    `, [id]);

    res.json({
      success: true,
      data: {
        ...task,
        meetings: meetingsRes.rows,
        history: historyRes.rows
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TASK_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve task details' });
  }
}

export async function createTask(req, res) {
  const {
    project_id,
    source_meeting_id,
    title,
    description,
    owner_id,
    due_date,
    priority = 'Medium',
    status = 'Pending',
    userId
  } = req.body;

  if (!project_id || !title) {
    return res.status(400).json({ success: false, error: 'Project ID and title are required' });
  }

  try {
    const newTask = await transaction(async (tx) => {
      const insertRes = await tx.query(`
        INSERT INTO action_items (
          project_id, source_meeting_id, title, description, owner_id, due_date, priority, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `, [
        project_id,
        source_meeting_id || null,
        title.trim(),
        description || null,
        owner_id || null,
        due_date || null,
        priority,
        status
      ]);

      const task = insertRes.rows[0];

      // If source meeting provided, link in relationship table
      if (source_meeting_id) {
        await tx.query(`
          INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward)
          VALUES ($1, $2, false)
          ON CONFLICT (meeting_id, action_item_id) DO NOTHING;
        `, [source_meeting_id, task.id]);
      }

      // Log in task_history
      await tx.query(`
        INSERT INTO task_history (action_item_id, changed_by, change_type, old_value, new_value, notes)
        VALUES ($1, $2, 'CREATED', NULL, $3, 'Task created manually');
      `, [task.id, userId || null, status]);

      return task;
    });

    logEvent('TASK_CREATED', { taskId: newTask.id, title: newTask.title, requestId: req.id });

    // Record in Context Graph
    try {
      await recordEvent({
        projectId: newTask.project_id,
        eventType: 'task_update',
        title: `Task Added: ${newTask.title}`,
        description: newTask.description || `Priority: ${newTask.priority}, Status: ${newTask.status}`,
        createdBy: userId || null,
        sourceRecordId: newTask.id,
        sourceType: 'task',
        changes: [{
          entityType: 'task',
          entityId: newTask.id,
          entityTitle: newTask.title,
          changeType: 'added',
          newValue: { status: newTask.status, priority: newTask.priority, due_date: newTask.due_date }
        }]
      });
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    res.status(201).json({ success: true, data: newTask });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TASK_CREATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
}

export async function updateTask(req, res) {
  const { id } = req.params;
  const { title, description, priority, due_date, userId, notes } = req.body;

  try {
    const updated = await transaction(async (tx) => {
      const current = await tx.query(`SELECT * FROM action_items WHERE id = $1`, [id]);
      if (current.rows.length === 0) throw new Error('Task not found');
      const curTask = current.rows[0];

      const updateRes = await tx.query(`
        UPDATE action_items
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          priority = COALESCE($3, priority),
          due_date = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *;
      `, [title, description, priority, due_date !== undefined ? due_date : curTask.due_date, id]);

      // Check if deadline changed
      if (due_date !== undefined && due_date !== curTask.due_date) {
        await tx.query(`
          INSERT INTO task_history (action_item_id, changed_by, change_type, old_value, new_value, notes)
          VALUES ($1, $2, 'DEADLINE_CHANGED', $3, $4, $5);
        `, [id, userId || null, curTask.due_date ? String(curTask.due_date) : 'None', due_date ? String(due_date) : 'None', notes || 'Deadline updated']);
      }

      return updateRes.rows[0];
    });

    logEvent('TASK_UPDATED', { taskId: id, requestId: req.id });
    res.json({ success: true, data: updated });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TASK_UPDATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to update task' });
  }
}

export async function updateTaskStatus(req, res) {
  const { id } = req.params;
  const { status, notes, userId } = req.body;

  const validStatuses = ['Pending', 'In Progress', 'Completed', 'Blocked'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const updated = await transaction(async (tx) => {
      const current = await tx.query(`SELECT * FROM action_items WHERE id = $1`, [id]);
      if (current.rows.length === 0) throw new Error('Task not found');
      const curTask = current.rows[0];

      let completedAt = curTask.completed_at;
      if (status === 'Completed' && curTask.status !== 'Completed') {
        completedAt = new Date().toISOString();
      } else if (status !== 'Completed') {
        completedAt = null;
      }

      const updateRes = await tx.query(`
        UPDATE action_items
        SET 
          status = $1,
          completed_at = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *;
      `, [status, completedAt, id]);

      // Record in task_history
      await tx.query(`
        INSERT INTO task_history (action_item_id, changed_by, change_type, old_value, new_value, notes)
        VALUES ($1, $2, 'STATUS_CHANGED', $3, $4, $5);
      `, [id, userId || null, curTask.status, status, notes || `Status transitioned to ${status}`]);

      return updateRes.rows[0];
    });

    logEvent('TASK_STATUS_CHANGED', { taskId: id, newStatus: status, requestId: req.id });

    // Record in Context Graph
    try {
      await recordEvent({
        projectId: updated.project_id,
        eventType: status === 'Completed' ? 'milestone' : 'task_update',
        title: status === 'Completed' ? `Task Completed: ${updated.title}` : `Task Status: ${updated.title} ➔ ${status}`,
        description: notes || `Status changed to ${status}`,
        createdBy: userId || null,
        sourceRecordId: updated.id,
        sourceType: 'task',
        changes: [{
          entityType: 'task',
          entityId: updated.id,
          entityTitle: updated.title,
          changeType: status === 'Completed' ? 'completed' : 'status_changed',
          newValue: { status }
        }]
      });
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TASK_STATUS_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to update task status' });
  }
}

export async function assignTaskOwner(req, res) {
  const { id } = req.params;
  const { owner_id, notes, userId } = req.body;

  try {
    const updated = await transaction(async (tx) => {
      const current = await tx.query(`
        SELECT a.*, u.name as old_owner_name
        FROM action_items a
        LEFT JOIN users u ON a.owner_id = u.id
        WHERE a.id = $1
      `, [id]);

      if (current.rows.length === 0) throw new Error('Task not found');
      const curTask = current.rows[0];

      let newOwnerName = 'Unassigned';
      if (owner_id) {
        const uRes = await tx.query(`SELECT name FROM users WHERE id = $1`, [owner_id]);
        if (uRes.rows.length === 0) throw new Error('New owner user not found');
        newOwnerName = uRes.rows[0].name;
      }

      const updateRes = await tx.query(`
        UPDATE action_items
        SET owner_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `, [owner_id || null, id]);

      // Record in task_history
      await tx.query(`
        INSERT INTO task_history (action_item_id, changed_by, change_type, old_value, new_value, notes)
        VALUES ($1, $2, 'OWNER_REASSIGNED', $3, $4, $5);
      `, [
        id,
        userId || null,
        curTask.old_owner_name || 'Unassigned',
        newOwnerName,
        notes || `Owner reassigned from ${curTask.old_owner_name || 'Unassigned'} to ${newOwnerName}`
      ]);

      return updateRes.rows[0];
    });

    logEvent('TASK_REASSIGNED', { taskId: id, newOwnerId: owner_id, requestId: req.id });

    // Record in Context Graph
    try {
      await recordEvent({
        projectId: updated.project_id,
        eventType: 'task_update',
        title: `Task Reassigned: ${updated.title}`,
        description: notes || `Assigned to new owner`,
        createdBy: userId || null,
        sourceRecordId: updated.id,
        sourceType: 'task',
        changes: [{
          entityType: 'task',
          entityId: updated.id,
          entityTitle: updated.title,
          changeType: 'reassigned',
          newValue: { owner_id }
        }]
      });
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TASK_ASSIGN_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to reassign task owner' });
  }
}

export async function recordTaskOutcome(req, res) {
  const { id } = req.params;
  const { completion_notes, outcome, completed_at, userId } = req.body;

  if (!outcome || outcome.trim() === '') {
    return res.status(400).json({ success: false, error: 'Outcome explanation is required when completing task' });
  }

  try {
    const updated = await transaction(async (tx) => {
      const updateRes = await tx.query(`
        UPDATE action_items
        SET 
          status = 'Completed',
          outcome = $1,
          completion_notes = $2,
          completed_at = COALESCE($3, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *;
      `, [outcome.trim(), completion_notes || null, completed_at || null, id]);

      if (updateRes.rows.length === 0) throw new Error('Task not found');

      // Record in task_history
      await tx.query(`
        INSERT INTO task_history (action_item_id, changed_by, change_type, old_value, new_value, notes)
        VALUES ($1, $2, 'OUTCOME_RECORDED', NULL, 'Completed', $3);
      `, [id, userId || null, `Outcome: ${outcome.trim()}`]);

      return updateRes.rows[0];
    });

    logEvent('TASK_OUTCOME_RECORDED', { taskId: id, requestId: req.id });

    // Record in Context Graph
    try {
      await recordEvent({
        projectId: updated.project_id,
        eventType: 'milestone',
        title: `Task Delivered: ${updated.title}`,
        description: `Outcome: ${outcome.trim()}`,
        createdBy: userId || null,
        sourceRecordId: updated.id,
        sourceType: 'task',
        changes: [{
          entityType: 'task',
          entityId: updated.id,
          entityTitle: updated.title,
          changeType: 'completed',
          newValue: { outcome: outcome.trim(), status: 'Completed' }
        }]
      });
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TASK_OUTCOME_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to record task outcome' });
  }
}

export async function getTaskHistory(req, res) {
  const { id } = req.params;
  try {
    const historyRes = await query(`
      SELECT th.*, u.name as actor_name, u.email as actor_email
      FROM task_history th
      LEFT JOIN users u ON th.changed_by = u.id
      WHERE th.action_item_id = $1
      ORDER BY th.created_at DESC;
    `, [id]);

    res.json({ success: true, data: historyRes.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'TASK_HISTORY_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve task history' });
  }
}

