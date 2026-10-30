import { query, transaction } from '../config/db.js';
import { logEvent, logError } from '../utils/logger.js';
import { detectProjectRisks } from '../services/riskService.js';

export async function getAllProjects(req, res) {
  try {
    const result = await query(`
      SELECT p.*,
        u.name as creator_name,
        (SELECT COUNT(*) FROM meetings m WHERE m.project_id = p.id) as meetings_count,
        (SELECT COUNT(*) FROM action_items a WHERE a.project_id = p.id) as tasks_count,
        (SELECT COUNT(*) FROM action_items a WHERE a.project_id = p.id AND a.status = 'Completed') as completed_tasks_count,
        (SELECT COUNT(*) FROM work_transfers w WHERE w.project_id = p.id AND w.status = 'Pending Acknowledgement') as active_transfers_count
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC;
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'PROJECTS_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve projects' });
  }
}

export async function getProjectById(req, res) {
  const { id } = req.params;
  try {
    const projectRes = await query(`
      SELECT p.*, u.name as creator_name, u.email as creator_email
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1;
    `, [id]);

    if (projectRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const project = projectRes.rows[0];

    // Fetch Members
    const membersRes = await query(`
      SELECT u.id, u.name, u.email, u.role as default_role, pm.role as project_role
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY u.name ASC;
    `, [id]);

    // Fetch Stats
    const statsRes = await query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as blocked_tasks,
        COUNT(CASE WHEN status != 'Completed' AND due_date < CURRENT_DATE THEN 1 END) as overdue_tasks,
        COUNT(CASE WHEN status != 'Completed' AND owner_id IS NULL THEN 1 END) as unassigned_tasks
      FROM action_items
      WHERE project_id = $1;
    `, [id]);

    res.json({
      success: true,
      data: {
        ...project,
        members: membersRes.rows,
        stats: statsRes.rows[0]
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'PROJECT_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve project details' });
  }
}

export async function createProject(req, res) {
  const { name, description, start_date, end_date, member_ids = [], created_by } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Project name is required' });
  }

  try {
    const newProject = await transaction(async (tx) => {
      // 1. Insert Project
      const insertProject = await tx.query(`
        INSERT INTO projects (name, description, start_date, end_date, created_by, status)
        VALUES ($1, $2, $3, $4, $5, 'Active')
        RETURNING *;
      `, [name.trim(), description || null, start_date || null, end_date || null, created_by || null]);

      const project = insertProject.rows[0];

      // 2. Add members
      if (Array.isArray(member_ids) && member_ids.length > 0) {
        for (const userId of member_ids) {
          await tx.query(`
            INSERT INTO project_members (project_id, user_id, role)
            VALUES ($1, $2, 'Member')
            ON CONFLICT (project_id, user_id) DO NOTHING;
          `, [project.id, userId]);
        }
      }

      // If created_by is provided and not in members, add as Lead
      if (created_by) {
        await tx.query(`
          INSERT INTO project_members (project_id, user_id, role)
          VALUES ($1, $2, 'Project Lead')
          ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'Project Lead';
        `, [project.id, created_by]);
      }

      return project;
    });

    logEvent('PROJECT_CREATED', { projectId: newProject.id, name: newProject.name, requestId: req.id });
    res.status(201).json({ success: true, data: newProject });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'PROJECT_CREATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
}

export async function updateProject(req, res) {
  const { id } = req.params;
  const { name, description, status, start_date, end_date } = req.body;

  try {
    const updateRes = await query(`
      UPDATE projects
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `, [name, description, status, start_date, end_date, id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    logEvent('PROJECT_UPDATED', { projectId: id, requestId: req.id });
    res.json({ success: true, data: updateRes.rows[0] });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'PROJECT_UPDATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
}

export async function deleteProject(req, res) {
  const { id } = req.params;
  try {
    const deleteRes = await query(`DELETE FROM projects WHERE id = $1 RETURNING id;`, [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    logEvent('PROJECT_DELETED', { projectId: id, requestId: req.id });
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'PROJECT_DELETE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
}

export async function getProjectRisks(req, res) {
  const { id } = req.params;
  try {
    const riskAnalysis = await detectProjectRisks(id, req.id);
    res.json({ success: true, data: riskAnalysis });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'RISK_DETECTION_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to detect project risks' });
  }
}

export async function getProjectActivity(req, res) {
  const { id } = req.params;
  try {
    const activities = await query(`
      SELECT 
        th.id, th.change_type, th.old_value, th.new_value, th.notes, th.created_at,
        u.name as actor_name,
        a.title as task_title
      FROM task_history th
      JOIN action_items a ON th.action_item_id = a.id
      LEFT JOIN users u ON th.changed_by = u.id
      WHERE a.project_id = $1
      ORDER BY th.created_at DESC
      LIMIT 50;
    `, [id]);

    res.json({ success: true, data: activities.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'ACTIVITY_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve project activity' });
  }
}

