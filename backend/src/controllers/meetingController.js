import { query, transaction } from '../config/db.js';
import { logEvent, logError } from '../utils/logger.js';
import { generateMeetingRecap } from '../services/aiService.js';
import { recordEvent } from '../services/contextRecorderService.js';

export async function getAllMeetings(req, res) {
  const { project_id } = req.query;

  try {
    let sql = `
      SELECT m.*,
        p.name as project_name,
        u.name as creator_name,
        (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id) as participants_count,
        (SELECT COUNT(*) FROM decisions d WHERE d.meeting_id = m.id) as decisions_count,
        (SELECT COUNT(*) FROM meeting_action_items mai WHERE mai.meeting_id = m.id) as action_items_count
      FROM meetings m
      JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.created_by = u.id
    `;
    const params = [];

    if (project_id) {
      params.push(project_id);
      sql += ` WHERE m.project_id = $1`;
    }

    sql += ` ORDER BY m.meeting_date DESC;`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'MEETINGS_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve meetings' });
  }
}

export async function getMeetingById(req, res) {
  const { id } = req.params;

  try {
    const meetingRes = await query(`
      SELECT m.*, p.name as project_name, u.name as creator_name
      FROM meetings m
      JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1;
    `, [id]);

    if (meetingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const meeting = meetingRes.rows[0];

    // Participants
    const participantsRes = await query(`
      SELECT u.id, u.name, u.email, u.role, mp.attended
      FROM meeting_participants mp
      JOIN users u ON mp.user_id = u.id
      WHERE mp.meeting_id = $1
      ORDER BY u.name ASC;
    `, [id]);

    // Decisions
    const decisionsRes = await query(`
      SELECT d.*, 
        u.name as creator_name,
        COALESCE(
          json_agg(
            json_build_object('id', kd.id, 'title', kd.title, 'category', kd.category)
          ) FILTER (WHERE kd.id IS NOT NULL), '[]'
        ) as linked_documents
      FROM decisions d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN decision_documents dd ON d.id = dd.decision_id
      LEFT JOIN knowledge_documents kd ON dd.document_id = kd.id
      WHERE d.meeting_id = $1
      GROUP BY d.id, u.name;
    `, [id]);

    // Action items (both native and carried forward)
    const actionItemsRes = await query(`
      SELECT a.*, 
        u.name as owner_name, 
        u.email as owner_email,
        mai.is_carried_forward,
        mai.discussion_notes as meeting_discussion_notes,
        orig_m.title as source_meeting_title
      FROM meeting_action_items mai
      JOIN action_items a ON mai.action_item_id = a.id
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN meetings orig_m ON a.source_meeting_id = orig_m.id
      WHERE mai.meeting_id = $1
      ORDER BY a.created_at ASC;
    `, [id]);

    // Related knowledge documents matching project
    const relatedDocsRes = await query(`
      SELECT id, title, category, tags, created_at
      FROM knowledge_documents
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 10;
    `, [meeting.project_id]);

    res.json({
      success: true,
      data: {
        ...meeting,
        participants: participantsRes.rows,
        decisions: decisionsRes.rows,
        action_items: actionItemsRes.rows,
        related_documents: relatedDocsRes.rows
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'MEETING_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve meeting details' });
  }
}

/**
 * Get pending action items from prior meetings available for carry-forward
 */
export async function getPendingItemsForCarryForward(req, res) {
  const { projectId } = req.query;
  const { id: meetingId } = req.params;

  try {
    let targetProjectId = projectId;

    if (!targetProjectId && meetingId) {
      const mRes = await query(`SELECT project_id FROM meetings WHERE id = $1`, [meetingId]);
      if (mRes.rows.length > 0) targetProjectId = mRes.rows[0].project_id;
    }

    if (!targetProjectId) {
      return res.status(400).json({ success: false, error: 'Project ID is required' });
    }

    // Find open items (Pending, In Progress, Blocked)
    // If meetingId provided, exclude items already linked to this meeting
    let sql = `
      SELECT 
        a.id, a.title, a.description, a.due_date, a.status, a.priority, a.carry_forward_count,
        u.name as owner_name,
        m.title as source_meeting_title,
        m.meeting_date as source_meeting_date
      FROM action_items a
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN meetings m ON a.source_meeting_id = m.id
      WHERE a.project_id = $1
        AND a.status != 'Completed'
    `;
    const params = [targetProjectId];

    if (meetingId && meetingId !== 'new') {
      sql += ` AND a.id NOT IN (
        SELECT action_item_id FROM meeting_action_items WHERE meeting_id = $2
      )`;
      params.push(meetingId);
    }

    sql += ` ORDER BY a.carry_forward_count DESC, a.created_at ASC;`;

    const pendingItems = await query(sql, params);
    res.json({ success: true, data: pendingItems.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CARRY_FORWARD_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to fetch pending items for carry-forward' });
  }
}

/**
 * Create Meeting
 * Includes automatic carry-forward linkage
 */
export async function createMeeting(req, res) {
  const {
    project_id,
    title,
    meeting_date,
    agenda,
    raw_notes,
    participant_ids = [],
    carried_forward_task_ids = [],
    created_by
  } = req.body;

  if (!project_id || !title || !raw_notes) {
    return res.status(400).json({
      success: false,
      error: 'Project ID, meeting title, and raw notes are mandatory'
    });
  }

  try {
    const newMeeting = await transaction(async (tx) => {
      // 1. Insert meeting
      const meetingRes = await tx.query(`
        INSERT INTO meetings (
          project_id, title, meeting_date, agenda, raw_notes, created_by
        )
        VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP), $4, $5, $6)
        RETURNING *;
      `, [project_id, title.trim(), meeting_date || null, agenda || null, raw_notes.trim(), created_by || null]);

      const meeting = meetingRes.rows[0];

      // 2. Add participants
      if (Array.isArray(participant_ids) && participant_ids.length > 0) {
        for (const userId of participant_ids) {
          await tx.query(`
            INSERT INTO meeting_participants (meeting_id, user_id, attended)
            VALUES ($1, $2, true)
            ON CONFLICT (meeting_id, user_id) DO NOTHING;
          `, [meeting.id, userId]);
        }
      }

      // 3. Process Automatic Carry-Forward (NO DUPLICATE ROWS!)
      if (Array.isArray(carried_forward_task_ids) && carried_forward_task_ids.length > 0) {
        for (const taskId of carried_forward_task_ids) {
          // Link in relationship table
          await tx.query(`
            INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward, discussion_notes)
            VALUES ($1, $2, true, 'Carried forward from previous meeting into ' || $3)
            ON CONFLICT (meeting_id, action_item_id) DO NOTHING;
          `, [meeting.id, taskId, meeting.title]);

          // Increment carry_forward_count on the original action item
          await tx.query(`
            UPDATE action_items
            SET 
              carry_forward_count = carry_forward_count + 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1;
          `, [taskId]);

          // Log in task_history table
          await tx.query(`
            INSERT INTO task_history (action_item_id, changed_by, change_type, notes)
            VALUES ($1, $2, 'CARRIED_FORWARD', 'Carried forward into meeting: ' || $3);
          `, [taskId, created_by || null, meeting.title]);
        }
      }

      return meeting;
    });

    // Record in Context Graph
    try {
      await recordEvent({
        projectId: newMeeting.project_id,
        eventType: 'meeting',
        title: `Meeting: ${newMeeting.title}`,
        description: newMeeting.agenda || newMeeting.title,
        createdBy: newMeeting.created_by,
        timestamp: newMeeting.meeting_date || newMeeting.created_at,
        sourceRecordId: newMeeting.id,
        sourceType: 'meeting',
        changeSnapshot: { meeting_id: newMeeting.id, title: newMeeting.title }
      });
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    logEvent('MEETING_CREATED', {
      meetingId: newMeeting.id,
      title: newMeeting.title,
      carriedForwardCount: carried_forward_task_ids.length,
      requestId: req.id
    });

    res.status(201).json({ success: true, data: newMeeting });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'MEETING_CREATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to create meeting' });
  }
}

/**
 * Preview AI Meeting Recap
 * Sends raw notes to Gemini and returns structured recap for user review/edit
 */
export async function previewMeetingRecap(req, res) {
  const { notes, project_id } = req.body;

  if (!notes || notes.trim() === '') {
    return res.status(400).json({ success: false, error: 'Raw notes are required for AI analysis' });
  }

  try {
    let projectContext = '';
    let members = [];

    if (project_id) {
      const projRes = await query(`SELECT name, description FROM projects WHERE id = $1`, [project_id]);
      if (projRes.rows.length > 0) {
        projectContext = `${projRes.rows[0].name}: ${projRes.rows[0].description || ''}`;
      }

      const memRes = await query(`
        SELECT u.id, u.name, u.role
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = $1
      `, [project_id]);
      members = memRes.rows;
    }

    // Call real Gemini API
    const recap = await generateMeetingRecap({
      notes,
      projectContext,
      availableMembers: members,
      requestId: req.id
    });

    res.json({ success: true, data: recap });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'AI_RECAP_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      code: err.code || 'AI_GENERATION_FAILED',
      error: err.message || 'AI meeting recap generation failed'
    });
  }
}

/**
 * Save Confirmed AI Recap & Actions
 * Persists summary, decisions, action items with validated member mapping
 */
export async function saveMeetingRecap(req, res) {
  const { id: meetingId } = req.params;
  const {
    summary,
    discussion_points = [],
    blockers = [],
    follow_up_topics = [],
    decisions = [],
    action_items = [],
    userId
  } = req.body;

  try {
    const updatedMeeting = await transaction(async (tx) => {
      // 1. Get meeting and project
      const meetingCheck = await tx.query(`SELECT project_id, title FROM meetings WHERE id = $1`, [meetingId]);
      if (meetingCheck.rows.length === 0) {
        throw new Error('Meeting not found');
      }
      const { project_id: projectId, title: meetingTitle } = meetingCheck.rows[0];

      // 2. Fetch available users to resolve owner_name to user_id
      const usersRes = await tx.query(`SELECT id, name, email FROM users`);
      const userMap = new Map();
      usersRes.rows.forEach(u => {
        userMap.set(u.name.toLowerCase().trim(), u.id);
        userMap.set(u.email.toLowerCase().trim(), u.id);
      });

      // 3. Update meeting recap fields
      await tx.query(`
        UPDATE meetings
        SET 
          ai_summary = $1,
          discussion_points = $2::jsonb,
          blockers = $3::jsonb,
          follow_up_topics = $4::jsonb,
          ai_generated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5;
      `, [
        summary,
        JSON.stringify(discussion_points),
        JSON.stringify(blockers),
        JSON.stringify(follow_up_topics),
        meetingId
      ]);

      // 4. Insert Decisions
      for (const dec of decisions) {
        if (!dec.title || dec.title.trim() === '') continue;
        await tx.query(`
          INSERT INTO decisions (project_id, meeting_id, title, reason, created_by)
          VALUES ($1, $2, $3, $4, $5);
        `, [projectId, meetingId, dec.title.trim(), dec.reason || null, userId || null]);
      }

      // 5. Insert Action Items
      for (const item of action_items) {
        if (!item.title || item.title.trim() === '') continue;

        // Resolve owner ID if owner_name provided
        let resolvedOwnerId = item.owner_id || null;
        if (!resolvedOwnerId && item.owner_name) {
          const matchKey = item.owner_name.toLowerCase().trim();
          resolvedOwnerId = userMap.get(matchKey) || null;
        }

        const taskInsert = await tx.query(`
          INSERT INTO action_items (
            project_id, source_meeting_id, title, description, owner_id, due_date, status, priority
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *;
        `, [
          projectId,
          meetingId,
          item.title.trim(),
          item.description || null,
          resolvedOwnerId,
          item.due_date || null,
          item.status || 'Pending',
          item.priority || 'Medium'
        ]);

        const createdTask = taskInsert.rows[0];

        // Link in meeting_action_items
        await tx.query(`
          INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward)
          VALUES ($1, $2, false)
          ON CONFLICT (meeting_id, action_item_id) DO NOTHING;
        `, [meetingId, createdTask.id]);

        // Audit log in task_history
        await tx.query(`
          INSERT INTO task_history (action_item_id, changed_by, change_type, notes)
          VALUES ($1, $2, 'CREATED', 'Extracted and confirmed from meeting recap: ' || $3);
        `, [createdTask.id, userId || null, meetingTitle]);
      }

      return meetingCheck.rows[0];
    });

    logEvent('AI_RECAP_CONFIRMED', {
      meetingId,
      decisionsCount: decisions.length,
      tasksCreatedCount: action_items.length,
      requestId: req.id
    });

    // Record decisions in Context Graph
    try {
      if (Array.isArray(decisions) && decisions.length > 0) {
        for (const dec of decisions) {
          if (!dec.title || dec.title.trim() === '') continue;
          await recordEvent({
            projectId: updatedMeeting.project_id,
            eventType: 'decision',
            title: `Decision: ${dec.title.trim()}`,
            description: dec.reason || `Decision finalized during ${updatedMeeting.title}`,
            createdBy: userId || null,
            sourceRecordId: meetingId,
            sourceType: 'decision',
            changes: [{
              entityType: 'decision',
              entityTitle: dec.title.trim(),
              changeType: 'added',
              newValue: { title: dec.title.trim(), reason: dec.reason || null }
            }]
          });
        }
      }
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    res.json({
      success: true,
      message: 'Meeting recap, decisions, and action items persisted successfully',
      data: updatedMeeting
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'RECAP_PERSIST_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message || 'Failed to save meeting recap' });
  }
}

/**
 * Update Meeting notes/agenda manually
 */
export async function updateMeeting(req, res) {
  const { id } = req.params;
  const { title, agenda, raw_notes, meeting_date } = req.body;

  try {
    const updateRes = await query(`
      UPDATE meetings
      SET 
        title = COALESCE($1, title),
        agenda = COALESCE($2, agenda),
        raw_notes = COALESCE($3, raw_notes),
        meeting_date = COALESCE($4, meeting_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `, [title, agenda, raw_notes, meeting_date, id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    logEvent('MEETING_UPDATED', { meetingId: id, requestId: req.id });
    res.json({ success: true, data: updateRes.rows[0] });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'MEETING_UPDATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to update meeting' });
  }
}

export async function deleteMeeting(req, res) {
  const { id } = req.params;
  try {
    const deleteRes = await query(`DELETE FROM meetings WHERE id = $1 RETURNING id;`, [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    logEvent('MEETING_DELETED', { meetingId: id, requestId: req.id });
    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'MEETING_DELETE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to delete meeting' });
  }
}

