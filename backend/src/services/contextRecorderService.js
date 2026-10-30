import { query } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Find or create a context branch for a project/member.
 */
export async function getOrCreateBranch(projectId, memberId = null, branchName = null) {
  // If no member, use the main branch
  if (!memberId) {
    const mainRes = await query(
      `SELECT * FROM context_branches WHERE project_id = $1 AND is_main = true LIMIT 1;`,
      [projectId]
    );
    if (mainRes.rows.length > 0) return mainRes.rows[0];

    const insertMain = await query(`
      INSERT INTO context_branches (project_id, name, is_main, color)
      VALUES ($1, 'Main Architecture & Consensus', true, '#4f46e5')
      RETURNING *;
    `, [projectId]);
    return insertMain.rows[0];
  }

  // Look for member's personal branch
  const memberBranchRes = await query(
    `SELECT * FROM context_branches WHERE project_id = $1 AND member_id = $2 LIMIT 1;`,
    [projectId, memberId]
  );
  if (memberBranchRes.rows.length > 0) return memberBranchRes.rows[0];

  // Retrieve member details to name the branch
  const userRes = await query(`SELECT name, role FROM users WHERE id = $1;`, [memberId]);
  const userName = userRes.rows[0]?.name || 'Member';
  const roleName = userRes.rows[0]?.role || 'Workstream';
  const name = branchName || `${userName}'s ${roleName} Branch`;

  const colors = ['#0284c7', '#059669', '#d97706', '#9333ea', '#e11d48', '#0891b2'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const newBranch = await query(`
    INSERT INTO context_branches (project_id, name, member_id, color, is_main)
    VALUES ($1, $2, $3, $4, false)
    RETURNING *;
  `, [projectId, name, memberId, randomColor]);

  return newBranch.rows[0];
}

/**
 * Record a single context event with granular changes and relationships.
 */
export async function recordEvent({
  projectId,
  branchId = null,
  eventType,
  title,
  description = null,
  createdBy = null,
  timestamp = new Date(),
  sourceRecordId = null,
  sourceType = null,
  prevEventId = null,
  changeSnapshot = {},
  changes = [],
  relationships = []
}) {
  try {
    let resolvedBranchId = branchId;
    if (!resolvedBranchId) {
      const branch = await getOrCreateBranch(projectId, createdBy);
      resolvedBranchId = branch.id;
    }

    // 1. If prevEventId not explicitly given, find the latest event in the branch or project
    let resolvedPrevEventId = prevEventId;
    if (!resolvedPrevEventId) {
      const lastEventRes = await query(`
        SELECT id FROM context_events 
        WHERE project_id = $1 
        ORDER BY timestamp DESC LIMIT 1;
      `, [projectId]);
      if (lastEventRes.rows.length > 0) {
        resolvedPrevEventId = lastEventRes.rows[0].id;
      }
    }

    // 2. Insert Context Event
    const eventRes = await query(`
      INSERT INTO context_events (
        project_id, branch_id, event_type, title, description,
        created_by, timestamp, source_record_id, source_type,
        prev_event_id, change_snapshot
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `, [
      projectId,
      resolvedBranchId,
      eventType,
      title,
      description,
      createdBy,
      timestamp,
      sourceRecordId,
      sourceType,
      resolvedPrevEventId,
      JSON.stringify(changeSnapshot || {})
    ]);

    const createdEvent = eventRes.rows[0];

    // 3. Update branch latest event pointer
    await query(`
      UPDATE context_branches 
      SET latest_event_id = $1 
      WHERE id = $2;
    `, [createdEvent.id, resolvedBranchId]);

    // 4. Insert Granular Changes
    if (changes && changes.length > 0) {
      for (const ch of changes) {
        await query(`
          INSERT INTO context_changes (
            event_id, entity_type, entity_id, entity_title,
            change_type, previous_value, new_value, changed_by, timestamp
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        `, [
          createdEvent.id,
          ch.entityType || 'task',
          ch.entityId || null,
          ch.entityTitle || title,
          ch.changeType || 'added',
          JSON.stringify(ch.previousValue || {}),
          JSON.stringify(ch.newValue || {}),
          createdBy,
          timestamp
        ]);
      }
    }

    // 5. Insert Relationships
    // Add continuation edge from previous event if available
    if (resolvedPrevEventId && resolvedPrevEventId !== createdEvent.id) {
      await query(`
        INSERT INTO context_relationships (source_event_id, target_event_id, relationship_type, label)
        VALUES ($1, $2, 'continuation', 'Timeline progression')
        ON CONFLICT (source_event_id, target_event_id, relationship_type) DO NOTHING;
      `, [resolvedPrevEventId, createdEvent.id]);
    }

    // Add custom relationships (e.g. branch, merge, handoff, decision_adopted)
    if (relationships && relationships.length > 0) {
      for (const rel of relationships) {
        if (rel.targetEventId) {
          await query(`
            INSERT INTO context_relationships (source_event_id, target_event_id, relationship_type, label)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (source_event_id, target_event_id, relationship_type) DO NOTHING;
          `, [
            rel.sourceEventId || createdEvent.id,
            rel.targetEventId,
            rel.relationshipType || 'continuation',
            rel.label || ''
          ]);
        }
      }
    }

    logger.info({ eventId: createdEvent.id, title }, 'Recorded context graph event');
    return createdEvent;
  } catch (err) {
    logger.error({ err: err.message, projectId, title }, 'Failed to record context event');
    return null;
  }
}

/**
 * Backfill / Synchronize all existing project records into context graph tables.
 * Safe to run multiple times: idempotent checks prevent duplication.
 */
export async function syncProjectContextGraph(projectId) {
  try {
    // 1. Check if events already exist
    const countRes = await query(
      `SELECT COUNT(*) as count FROM context_events WHERE project_id = $1;`,
      [projectId]
    );
    const existingCount = parseInt(countRes.rows[0]?.count || '0', 10);
    if (existingCount > 0) {
      logger.info({ projectId, existingCount }, 'Context graph events already synchronized');
      return { count: existingCount };
    }

    logger.info({ projectId }, 'Backfilling historical data into context graph tables...');

    // 2. Fetch Project & Members
    const [projectRes, membersRes] = await Promise.all([
      query(`SELECT * FROM projects WHERE id = $1;`, [projectId]),
      query(`
        SELECT pm.*, u.name as user_name, u.role as user_role, u.avatar_url
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = $1;
      `, [projectId])
    ]);

    if (projectRes.rows.length === 0) return { count: 0 };
    const project = projectRes.rows[0];
    const members = membersRes.rows;

    // 3. Create Branches: Main branch + each Member lane branch
    const mainBranch = await getOrCreateBranch(projectId, null);
    const memberBranchMap = new Map();

    for (const m of members) {
      const branch = await getOrCreateBranch(projectId, m.user_id, `${m.user_name} (${m.role || m.user_role})`);
      memberBranchMap.set(m.user_id, branch);
    }

    // 4. Fetch All Existing Domain Records
    const [
      meetingsRes,
      decisionsRes,
      tasksRes,
      transfersRes,
      updatesRes,
      docsRes
    ] = await Promise.all([
      query(`SELECT * FROM meetings WHERE project_id = $1 ORDER BY meeting_date ASC;`, [projectId]),
      query(`SELECT d.*, m.title as meeting_title FROM decisions d LEFT JOIN meetings m ON d.meeting_id = m.id WHERE d.project_id = $1 ORDER BY d.created_at ASC;`, [projectId]),
      query(`SELECT a.*, u.name as owner_name FROM action_items a LEFT JOIN users u ON a.owner_id = u.id WHERE a.project_id = $1 ORDER BY a.created_at ASC;`, [projectId]),
      query(`SELECT w.*, po.name as prev_name, no.name as new_name FROM work_transfers w JOIN users po ON w.previous_owner_id = po.id JOIN users no ON w.new_owner_id = no.id WHERE w.project_id = $1 ORDER BY w.transfer_date ASC;`, [projectId]),
      query(`SELECT * FROM project_updates WHERE project_id = $1 ORDER BY created_at ASC;`, [projectId]),
      query(`SELECT * FROM knowledge_documents WHERE project_id = $1 ORDER BY created_at ASC;`, [projectId])
    ]);

    // Build unified chronological timeline of all events
    const timeline = [];

    // Meetings
    meetingsRes.rows.forEach(m => {
      timeline.push({
        type: 'meeting',
        date: new Date(m.meeting_date),
        title: m.title,
        description: m.ai_summary || m.agenda || 'Project discussion & sync',
        createdBy: m.created_by,
        sourceId: m.id,
        sourceType: 'meetings',
        branchId: mainBranch.id, // Meetings anchor main architecture line
        data: m
      });
    });

    // Decisions
    decisionsRes.rows.forEach(d => {
      timeline.push({
        type: 'decision',
        date: new Date(d.created_at),
        title: `Decision: ${d.title}`,
        description: d.reason || 'Adopted decision',
        createdBy: d.created_by,
        sourceId: d.id,
        sourceType: 'decisions',
        branchId: mainBranch.id,
        data: d
      });
    });

    // Tasks
    tasksRes.rows.forEach(t => {
      const branchId = t.owner_id && memberBranchMap.has(t.owner_id)
        ? memberBranchMap.get(t.owner_id).id
        : mainBranch.id;

      timeline.push({
        type: 'task',
        date: new Date(t.completed_at || t.created_at),
        title: t.title,
        description: t.description || 'Task deliverable',
        createdBy: t.owner_id,
        sourceId: t.id,
        sourceType: 'action_items',
        branchId,
        data: t
      });
    });

    // Work Transfers
    transfersRes.rows.forEach(w => {
      const branchId = w.previous_owner_id && memberBranchMap.has(w.previous_owner_id)
        ? memberBranchMap.get(w.previous_owner_id).id
        : mainBranch.id;

      timeline.push({
        type: 'work_transfer',
        date: new Date(w.transfer_date),
        title: `Handoff: ${w.prev_name} ➔ ${w.new_name}`,
        description: w.reason_for_transfer,
        createdBy: w.previous_owner_id,
        sourceId: w.id,
        sourceType: 'work_transfers',
        branchId,
        data: w
      });
    });

    // Project Updates / Milestones
    updatesRes.rows.forEach(u => {
      timeline.push({
        type: 'milestone',
        date: new Date(u.created_at),
        title: u.title,
        description: u.summary,
        createdBy: u.author_id,
        sourceId: u.id,
        sourceType: 'project_updates',
        branchId: mainBranch.id, // Merges back into main release line
        data: u
      });
    });

    // Knowledge Documents
    docsRes.rows.forEach(doc => {
      timeline.push({
        type: 'document',
        date: new Date(doc.created_at),
        title: `Doc: ${doc.title}`,
        description: `Architecture spec in ${doc.category}`,
        createdBy: doc.created_by,
        sourceId: doc.id,
        sourceType: 'knowledge_documents',
        branchId: mainBranch.id,
        data: doc
      });
    });

    // Sort chronologically ascending
    timeline.sort((a, b) => a.date - b.date);

    // Insert events sequentially and build relationships
    const createdEvents = [];
    let previousEvent = null;

    for (const item of timeline) {
      const changes = [];
      if (item.type === 'decision') {
        changes.push({
          entityType: 'decision',
          entityId: item.sourceId,
          entityTitle: item.title,
          changeType: 'added',
          newValue: { title: item.data.title, rationale: item.data.reason, status: item.data.status }
        });
      } else if (item.type === 'task') {
        const changeType = item.data.status === 'Completed' ? 'completed' : 'added';
        changes.push({
          entityType: 'task',
          entityId: item.sourceId,
          entityTitle: item.title,
          changeType,
          newValue: { status: item.data.status, priority: item.data.priority, dueDate: item.data.due_date, outcome: item.data.outcome }
        });
      } else if (item.type === 'work_transfer') {
        changes.push({
          entityType: 'responsibility',
          entityId: item.sourceId,
          entityTitle: item.title,
          changeType: 'reassigned',
          previousValue: { owner: item.data.prev_name },
          newValue: { owner: item.data.new_name, reason: item.data.reason_for_transfer, status: item.data.status }
        });
      } else if (item.type === 'meeting') {
        changes.push({
          entityType: 'meeting_outcome',
          entityId: item.sourceId,
          entityTitle: item.title,
          changeType: 'added',
          newValue: { summary: item.data.ai_summary, blockers: item.data.blockers }
        });
      } else if (item.type === 'milestone') {
        changes.push({
          entityType: 'milestone',
          entityId: item.sourceId,
          entityTitle: item.title,
          changeType: 'added',
          newValue: { summary: item.data.summary, type: item.data.update_type }
        });
      }

      const evt = await recordEvent({
        projectId,
        branchId: item.branchId,
        eventType: item.type,
        title: item.title,
        description: item.description,
        createdBy: item.createdBy,
        timestamp: item.date,
        sourceRecordId: item.sourceId,
        sourceType: item.sourceType,
        prevEventId: previousEvent ? previousEvent.id : null,
        changeSnapshot: item.data,
        changes
      });

      if (evt) {
        createdEvents.push(evt);
        previousEvent = evt;
      }
    }

    // 5. Establish Initial User Context Positions
    // For demonstration of "User who stopped at an older context point":
    // Rahul's last-known context is placed around the middle (e.g. event 4 or 5)
    // Priya & Arjun are more up-to-date
    // Adithya (Lead) is fully up-to-date at the latest event
    const rahulUser = members.find(m => m.user_name?.toLowerCase().includes('rahul'));
    const priyaUser = members.find(m => m.user_name?.toLowerCase().includes('priya'));
    const arjunUser = members.find(m => m.user_name?.toLowerCase().includes('arjun'));
    const adithyaUser = members.find(m => m.user_name?.toLowerCase().includes('adithya'));

    const latestEvent = createdEvents[createdEvents.length - 1];

    if (createdEvents.length >= 6) {
      // Rahul stopped at event index 3 (earlier context node)
      if (rahulUser) {
        const rahulNode = createdEvents[3];
        await query(`
          INSERT INTO user_context_positions (user_id, project_id, last_acknowledged_event_id, last_acknowledged_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (user_id, project_id) DO UPDATE 
          SET last_acknowledged_event_id = EXCLUDED.last_acknowledged_event_id,
              last_acknowledged_at = EXCLUDED.last_acknowledged_at,
              updated_at = NOW();
        `, [rahulUser.user_id, projectId, rahulNode.id, rahulNode.timestamp]);
      }

      // Priya at event index 8
      if (priyaUser) {
        const priyaNode = createdEvents[Math.min(8, createdEvents.length - 2)];
        await query(`
          INSERT INTO user_context_positions (user_id, project_id, last_acknowledged_event_id, last_acknowledged_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (user_id, project_id) DO UPDATE 
          SET last_acknowledged_event_id = EXCLUDED.last_acknowledged_event_id,
              last_acknowledged_at = EXCLUDED.last_acknowledged_at,
              updated_at = NOW();
        `, [priyaUser.user_id, projectId, priyaNode.id, priyaNode.timestamp]);
      }

      // Arjun at event index 10
      if (arjunUser) {
        const arjunNode = createdEvents[Math.min(10, createdEvents.length - 2)];
        await query(`
          INSERT INTO user_context_positions (user_id, project_id, last_acknowledged_event_id, last_acknowledged_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (user_id, project_id) DO UPDATE 
          SET last_acknowledged_event_id = EXCLUDED.last_acknowledged_event_id,
              last_acknowledged_at = EXCLUDED.last_acknowledged_at,
              updated_at = NOW();
        `, [arjunUser.user_id, projectId, arjunNode.id, arjunNode.timestamp]);
      }

      // Adithya is caught up at latest event
      if (adithyaUser && latestEvent) {
        await query(`
          INSERT INTO user_context_positions (user_id, project_id, last_acknowledged_event_id, last_acknowledged_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (user_id, project_id) DO UPDATE 
          SET last_acknowledged_event_id = EXCLUDED.last_acknowledged_event_id,
              last_acknowledged_at = EXCLUDED.last_acknowledged_at,
              updated_at = NOW();
        `, [adithyaUser.user_id, projectId, latestEvent.id, latestEvent.timestamp]);
      }
    }

    logger.info({ projectId, totalEvents: createdEvents.length }, 'Context graph backfill completed successfully');
    return { count: createdEvents.length };
  } catch (err) {
    logger.error({ err: err.message, projectId }, 'Error synchronizing context graph');
    throw err;
  }
}

export default {
  getOrCreateBranch,
  recordEvent,
  syncProjectContextGraph
};

