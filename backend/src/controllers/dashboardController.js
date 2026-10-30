import { query } from '../config/db.js';
import { logError } from '../utils/logger.js';
import { detectProjectRisks } from '../services/riskService.js';

export async function getDashboardData(req, res) {
  try {
    const now = new Date();

    // 1. Core Statistics
    const [
      projectsCountRes,
      meetingsCountRes,
      tasksStatsRes,
      activeTransfersRes
    ] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM projects`),
      query(`SELECT COUNT(*) as total FROM meetings`),
      query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as blocked,
          COUNT(CASE WHEN status != 'Completed' AND due_date < CURRENT_DATE THEN 1 END) as overdue,
          COUNT(CASE WHEN status != 'Completed' AND owner_id IS NULL THEN 1 END) as unassigned,
          COUNT(CASE WHEN status != 'Completed' AND due_date IS NULL THEN 1 END) as no_deadline
        FROM action_items;
      `),
      query(`
        SELECT COUNT(*) as total 
        FROM work_transfers 
        WHERE status = 'Pending Acknowledgement';
      `)
    ]);

    const taskStats = tasksStatsRes.rows[0];

    // 2. Upcoming Deadlines (within next 14 days or overdue, not completed)
    const upcomingDeadlinesRes = await query(`
      SELECT 
        a.id, a.title, a.due_date, a.priority, a.status,
        p.id as project_id, p.name as project_name,
        u.name as owner_name, u.avatar_url as owner_avatar
      FROM action_items a
      JOIN projects p ON a.project_id = p.id
      LEFT JOIN users u ON a.owner_id = u.id
      WHERE a.status != 'Completed' AND a.due_date IS NOT NULL
      ORDER BY a.due_date ASC
      LIMIT 6;
    `);

    // 3. Recent Meetings
    const recentMeetingsRes = await query(`
      SELECT 
        m.id, m.title, m.meeting_date, m.ai_summary,
        p.id as project_id, p.name as project_name,
        u.name as creator_name,
        (SELECT COUNT(*) FROM decisions d WHERE d.meeting_id = m.id) as decisions_count,
        (SELECT COUNT(*) FROM meeting_action_items mai WHERE mai.meeting_id = m.id) as actions_count
      FROM meetings m
      JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.created_by = u.id
      ORDER BY m.meeting_date DESC
      LIMIT 4;
    `);

    // 4. Recent Work Transfers
    const recentTransfersRes = await query(`
      SELECT 
        w.id, w.reason_for_transfer, w.status, w.transfer_date, w.acknowledged_at,
        p.id as project_id, p.name as project_name,
        po.name as prev_owner_name,
        no.name as new_owner_name,
        (SELECT COUNT(*) FROM work_transfer_tasks wtt WHERE wtt.work_transfer_id = w.id) as task_count
      FROM work_transfers w
      JOIN projects p ON w.project_id = p.id
      JOIN users po ON w.previous_owner_id = po.id
      JOIN users no ON w.new_owner_id = no.id
      ORDER BY w.transfer_date DESC
      LIMIT 4;
    `);

    // 5. Aggregate Project Health & Risk Alerts
    // Fetch first active project to compute comprehensive health metrics
    const primaryProjectRes = await query(`SELECT id FROM projects ORDER BY created_at ASC LIMIT 1`);
    let healthData = {
      healthScore: 100,
      riskLevel: 'Healthy',
      risks: []
    };

    if (primaryProjectRes.rows.length > 0) {
      try {
        healthData = await detectProjectRisks(primaryProjectRes.rows[0].id, req.id);
      } catch (e) {
        // Fallback default
      }
    }

    res.json({
      success: true,
      data: {
        stats: {
          totalProjects: parseInt(projectsCountRes.rows[0].total, 10),
          totalMeetings: parseInt(meetingsCountRes.rows[0].total, 10),
          totalTasks: parseInt(taskStats.total, 10),
          pendingTasks: parseInt(taskStats.pending, 10),
          inProgressTasks: parseInt(taskStats.in_progress, 10),
          completedTasks: parseInt(taskStats.completed, 10),
          blockedTasks: parseInt(taskStats.blocked, 10),
          overdueTasks: parseInt(taskStats.overdue, 10),
          unassignedTasks: parseInt(taskStats.unassigned, 10),
          noDeadlineTasks: parseInt(taskStats.no_deadline, 10),
          activeTransfers: parseInt(activeTransfersRes.rows[0].total, 10)
        },
        taskDistribution: [
          { name: 'Pending', value: parseInt(taskStats.pending, 10), fill: '#6366f1' },
          { name: 'In Progress', value: parseInt(taskStats.in_progress, 10), fill: '#3b82f6' },
          { name: 'Completed', value: parseInt(taskStats.completed, 10), fill: '#10b981' },
          { name: 'Overdue', value: parseInt(taskStats.overdue, 10), fill: '#ef4444' },
          { name: 'Blocked', value: parseInt(taskStats.blocked, 10), fill: '#f59e0b' }
        ],
        upcomingDeadlines: upcomingDeadlinesRes.rows,
        recentMeetings: recentMeetingsRes.rows,
        recentTransfers: recentTransfersRes.rows,
        projectHealth: {
          score: healthData.healthScore,
          level: healthData.riskLevel,
          risks: healthData.risks,
          aiExplanation: healthData.aiExplanation,
          disclaimer: healthData.disclaimer
        }
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'DASHBOARD_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve dashboard metrics' });
  }
}

