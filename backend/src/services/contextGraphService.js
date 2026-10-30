import { query } from '../config/db.js';
import logger from '../utils/logger.js';
import { syncProjectContextGraph } from './contextRecorderService.js';

/**
 * Generate full Git-style Context Lineage Graph for a project,
 * personalized to the requested user's position and optional member filter.
 */
export async function generateProjectContextGraph(projectId, options = {}) {
  // Support both legacy signature (projectId, memberIdFilter) and object options
  let memberIdFilter = null;
  let activeUserId = null;

  if (typeof options === 'string') {
    memberIdFilter = options;
  } else if (options && typeof options === 'object') {
    memberIdFilter = options.memberId || null;
    activeUserId = options.userId || null;
  }

  // 1. Ensure project context data is synchronized in context graph tables
  await syncProjectContextGraph(projectId);

  // 2. Fetch Project & Members
  const [projectRes, membersRes] = await Promise.all([
    query(`SELECT * FROM projects WHERE id = $1;`, [projectId]),
    query(`
      SELECT u.id, u.name, u.role, u.avatar_url, pm.role as project_role
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY u.name ASC;
    `, [projectId])
  ]);

  if (projectRes.rows.length === 0) {
    throw new Error('Project not found');
  }

  const project = projectRes.rows[0];
  const members = membersRes.rows;
  const memberMap = new Map();
  members.forEach(m => memberMap.set(m.id, m));

  // Determine active user (default to first member or project lead if not provided)
  const resolvedActiveUserId = activeUserId || members[0]?.id || project.created_by;
  const activeUser = memberMap.get(resolvedActiveUserId) || members[0];

  // 3. Fetch Branches
  const branchesRes = await query(`
    SELECT cb.*, u.name as member_name, u.avatar_url as member_avatar
    FROM context_branches cb
    LEFT JOIN users u ON cb.member_id = u.id
    WHERE cb.project_id = $1
    ORDER BY cb.is_main DESC, cb.created_at ASC;
  `, [projectId]);

  const branches = branchesRes.rows;
  const branchMap = new Map();
  branches.forEach(b => branchMap.set(b.id, b));

  // Build lanes array for UI visualization: Main branch first, then member workstreams
  const lanes = branches.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color || '#4f46e5',
    isMain: b.is_main,
    memberId: b.member_id,
    memberName: b.member_name || (b.is_main ? 'Main Timeline' : 'Team'),
    avatarUrl: b.member_avatar
  }));

  // 4. Fetch All Context Events for Project
  const eventsRes = await query(`
    SELECT 
      ce.*,
      cb.name as branch_name,
      cb.color as branch_color,
      cb.is_main as branch_is_main,
      u.name as creator_name,
      u.role as creator_role,
      u.avatar_url as creator_avatar,
      (SELECT COUNT(*) FROM context_changes cc WHERE cc.event_id = ce.id) as changes_count
    FROM context_events ce
    LEFT JOIN context_branches cb ON ce.branch_id = cb.id
    LEFT JOIN users u ON ce.created_by = u.id
    WHERE ce.project_id = $1
    ORDER BY ce.timestamp ASC;
  `, [projectId]);

  const rawEvents = eventsRes.rows;

  // 5. Fetch All Relationships
  const relationshipsRes = await query(`
    SELECT cr.*
    FROM context_relationships cr
    JOIN context_events src ON cr.source_event_id = src.id
    WHERE src.project_id = $1;
  `, [projectId]);

  const relationships = relationshipsRes.rows;

  // 6. Fetch All Changes
  const changesRes = await query(`
    SELECT cc.*
    FROM context_changes cc
    JOIN context_events ce ON cc.event_id = ce.id
    WHERE ce.project_id = $1
    ORDER BY cc.timestamp ASC;
  `, [projectId]);

  const changesByEvent = new Map();
  changesRes.rows.forEach(ch => {
    if (!changesByEvent.has(ch.event_id)) {
      changesByEvent.set(ch.event_id, []);
    }
    changesByEvent.get(ch.event_id).push(ch);
  });

  // 7. Retrieve Active User's Context Position
  let userPositionRow = null;
  if (resolvedActiveUserId) {
    const posRes = await query(`
      SELECT * FROM user_context_positions 
      WHERE user_id = $1 AND project_id = $2 LIMIT 1;
    `, [resolvedActiveUserId, projectId]);

    if (posRes.rows.length > 0) {
      userPositionRow = posRes.rows[0];
    } else if (rawEvents.length > 0) {
      // Default to first event or latest if newly joining
      const defaultEvent = rawEvents[0];
      const newPos = await query(`
        INSERT INTO user_context_positions (user_id, project_id, last_acknowledged_event_id, last_acknowledged_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (user_id, project_id) DO UPDATE SET updated_at = NOW()
        RETURNING *;
      `, [resolvedActiveUserId, projectId, defaultEvent.id]);
      userPositionRow = newPos.rows[0];
    }
  }

  const lastAckEventId = userPositionRow?.last_acknowledged_event_id || null;
  const lastAckIndex = rawEvents.findIndex(e => e.id === lastAckEventId);
  const latestEvent = rawEvents.length > 0 ? rawEvents[rawEvents.length - 1] : null;

  // Context gap: events that occurred after user's last acknowledged event
  const gapEvents = lastAckIndex >= 0 ? rawEvents.slice(lastAckIndex + 1) : rawEvents;
  const gapEventIdSet = new Set(gapEvents.map(e => e.id));

  // 8. Assemble Graph Nodes
  const nodes = rawEvents.map((evt, idx) => {
    const isLastAck = evt.id === lastAckEventId;
    const isLatest = evt.id === latestEvent?.id;
    const isGap = gapEventIdSet.has(evt.id);
    const isCreatedByCurrentUser = evt.created_by === resolvedActiveUserId;

    // Node badge text
    let badge = evt.event_type.toUpperCase();
    if (evt.event_type === 'meeting') badge = 'Sync';
    else if (evt.event_type === 'decision') badge = 'Decision';
    else if (evt.event_type === 'task') badge = 'Task';
    else if (evt.event_type === 'work_transfer') badge = 'Handoff';
    else if (evt.event_type === 'milestone') badge = 'Milestone';

    return {
      id: evt.id,
      type: evt.event_type,
      eventType: evt.event_type,
      title: evt.title,
      summary: evt.description || '',
      description: evt.description || '',
      timestamp: evt.timestamp,
      date: new Date(evt.timestamp).toISOString().slice(0, 10),
      time: new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      
      // Lane & Branch
      branchId: evt.branch_id,
      branchName: evt.branch_name || 'Main Timeline',
      laneId: evt.branch_id || 'main',
      laneName: evt.branch_name || 'Main Architecture & Decisions',
      color: evt.branch_color || '#4f46e5',
      
      // Author / Member
      memberId: evt.created_by,
      memberName: evt.creator_name || 'Team Member',
      memberRole: evt.creator_role || 'Contributor',
      memberAvatar: evt.creator_avatar,
      
      // Source & Status
      sourceRecordId: evt.source_record_id,
      sourceType: evt.source_type,
      status: evt.change_snapshot?.status || 'Active',
      badge,
      
      // Granular changes
      changesCount: parseInt(evt.changes_count || '0', 10),
      changes: changesByEvent.get(evt.id) || [],
      details: evt.change_snapshot || {},

      // Position markers
      isLastAcknowledged: isLastAck,
      isLatest,
      isGap,
      isCreatedByCurrentUser
    };
  });

  // 9. Assemble Graph Edges
  const edges = [];

  // Add explicit relationships from context_relationships table
  relationships.forEach(rel => {
    edges.push({
      id: `rel_${rel.id}`,
      source: rel.source_event_id,
      target: rel.target_event_id,
      type: rel.relationship_type,
      label: rel.label || rel.relationship_type,
      animated: rel.relationship_type === 'handoff' || rel.relationship_type === 'merge',
      color: rel.relationship_type === 'handoff' ? '#8b5cf6' : rel.relationship_type === 'merge' ? '#059669' : '#64748b'
    });
  });

  // Ensure sequential continuation edges within each lane
  const laneNodesMap = new Map();
  nodes.forEach(n => {
    const lId = n.laneId || 'main';
    if (!laneNodesMap.has(lId)) laneNodesMap.set(lId, []);
    laneNodesMap.get(lId).push(n);
  });

  laneNodesMap.forEach((lNodes, lId) => {
    for (let i = 0; i < lNodes.length - 1; i++) {
      const src = lNodes[i];
      const tgt = lNodes[i + 1];
      const existing = edges.find(e => e.source === src.id && e.target === tgt.id);
      if (!existing) {
        edges.push({
          id: `seq_${src.id}_${tgt.id}`,
          source: src.id,
          target: tgt.id,
          type: 'continuation',
          label: '',
          animated: false,
          color: '#cbd5e1'
        });
      }
    }
  });

  // If work transfers exist, create handoff transition bridge edges between previous and new owner nodes
  nodes.filter(n => n.eventType === 'work_transfer').forEach(wtNode => {
    const details = wtNode.details || {};
    const newOwnerId = details.new_owner_id;
    if (newOwnerId) {
      // Find the next node in the new owner's lane
      const newOwnerBranch = branches.find(b => b.member_id === newOwnerId);
      if (newOwnerBranch) {
        const nextTarget = nodes.find(n => n.laneId === newOwnerBranch.id && new Date(n.timestamp) >= new Date(wtNode.timestamp));
        if (nextTarget) {
          edges.push({
            id: `handoff_bridge_${wtNode.id}_${nextTarget.id}`,
            source: wtNode.id,
            target: nextTarget.id,
            type: 'handoff',
            label: `Handoff Bridge to ${details.new_name || 'New Owner'}`,
            animated: true,
            color: '#8b5cf6'
          });
        }
      }
    }
  });

  // 10. Generate Member Context Journey Profile if requested
  let memberJourney = null;
  if (memberIdFilter) {
    const targetMember = memberMap.get(memberIdFilter);
    if (targetMember) {
      const memberNodes = nodes.filter(n => n.memberId === memberIdFilter);
      const memberEvents = memberNodes.map(n => ({
        id: n.id,
        title: n.title,
        type: n.eventType,
        date: n.date,
        summary: n.summary
      }));

      memberJourney = {
        member: targetMember,
        joinedAt: memberNodes.length > 0 ? memberNodes[0].date : project.start_date,
        totalContributions: memberNodes.length,
        events: memberEvents,
        lastKnownContribution: memberNodes.length > 0 ? memberNodes[memberNodes.length - 1] : null
      };
    }
  }

  // 11. User Context Position Object
  const lastAckNode = nodes.find(n => n.id === lastAckEventId) || null;
  const latestNode = latestEvent ? nodes.find(n => n.id === latestEvent.id) : null;
  const isCaughtUp = gapEvents.length === 0;

  const userPosition = {
    userId: resolvedActiveUserId,
    userName: activeUser?.name || 'Current User',
    lastAcknowledgedEventId: lastAckEventId,
    lastAcknowledgedAt: userPositionRow?.last_acknowledged_at || null,
    lastAcknowledgedNode: lastAckNode ? {
      id: lastAckNode.id,
      title: lastAckNode.title,
      type: lastAckNode.eventType,
      date: lastAckNode.date,
      time: lastAckNode.time,
      author: lastAckNode.memberName
    } : null,
    latestNode: latestNode ? {
      id: latestNode.id,
      title: latestNode.title,
      type: latestNode.eventType,
      date: latestNode.date,
      time: latestNode.time,
      author: latestNode.memberName
    } : null,
    contextGapCount: gapEvents.length,
    gapEventIds: gapEvents.map(e => e.id),
    isCaughtUp
  };

  return {
    projectId: project.id,
    projectName: project.name,
    projectDescription: project.description,
    lanes,
    branches,
    nodes,
    edges,
    userPosition,
    memberJourney,
    stats: {
      totalNodes: nodes.length,
      meetingsCount: nodes.filter(n => n.eventType === 'meeting').length,
      decisionsCount: nodes.filter(n => n.eventType === 'decision').length,
      tasksCount: nodes.filter(n => n.eventType === 'task').length,
      transfersCount: nodes.filter(n => n.eventType === 'work_transfer').length,
      milestonesCount: nodes.filter(n => n.eventType === 'milestone').length,
      gapCount: gapEvents.length
    }
  };
}

/**
 * Compare two context positions / nodes and return structured granular differences.
 * Identifies:
 * - New decisions & modified decisions
 * - New, completed, or reassigned tasks
 * - Task status and deadline changes
 * - Meeting outcomes and blockers
 * - New documents & architectural guidelines
 * - Work transfers & responsibility changes
 */
export async function compareProjectContext(projectId, fromEventId, toEventId) {
  // 1. Fetch boundary events
  const [fromRes, toRes] = await Promise.all([
    query(`SELECT ce.*, u.name as author_name FROM context_events ce LEFT JOIN users u ON ce.created_by = u.id WHERE ce.id = $1;`, [fromEventId]),
    query(`SELECT ce.*, u.name as author_name FROM context_events ce LEFT JOIN users u ON ce.created_by = u.id WHERE ce.id = $1;`, [toEventId])
  ]);

  if (fromRes.rows.length === 0 || toRes.rows.length === 0) {
    throw new Error('From or To context event not found');
  }

  const fromEvent = fromRes.rows[0];
  const toEvent = toRes.rows[0];

  const startTime = new Date(fromEvent.timestamp) <= new Date(toEvent.timestamp)
    ? fromEvent.timestamp
    : toEvent.timestamp;
  const endTime = new Date(fromEvent.timestamp) <= new Date(toEvent.timestamp)
    ? toEvent.timestamp
    : fromEvent.timestamp;

  // 2. Fetch all intermediate events (excluding the fromEvent itself)
  const intermediateEventsRes = await query(`
    SELECT ce.*, u.name as author_name, cb.name as branch_name
    FROM context_events ce
    LEFT JOIN users u ON ce.created_by = u.id
    LEFT JOIN context_branches cb ON ce.branch_id = cb.id
    WHERE ce.project_id = $1 
      AND ce.timestamp > $2 
      AND ce.timestamp <= $3
    ORDER BY ce.timestamp ASC;
  `, [projectId, startTime, endTime]);

  const gapEvents = intermediateEventsRes.rows;
  const eventIds = gapEvents.map(e => e.id);

  // 3. Fetch all granular changes linked to these events
  let changes = [];
  if (eventIds.length > 0) {
    const changesRes = await query(`
      SELECT cc.*, u.name as author_name
      FROM context_changes cc
      LEFT JOIN users u ON cc.changed_by = u.id
      WHERE cc.event_id = ANY($1)
      ORDER BY cc.timestamp ASC;
    `, [eventIds]);
    changes = changesRes.rows;
  }

  // 4. Categorize Differences
  const newDecisions = [];
  const modifiedDecisions = [];
  const newTasks = [];
  const completedTasks = [];
  const reassignedTasks = [];
  const taskStatusChanges = [];
  const newMeetings = [];
  const newDocuments = [];
  const handoffs = [];
  const milestones = [];
  const blockers = [];

  // Categorize from events
  gapEvents.forEach(evt => {
    const details = evt.change_snapshot || {};
    const dateStr = new Date(evt.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    if (evt.event_type === 'decision') {
      newDecisions.push({
        id: evt.id,
        title: evt.title.replace(/^Decision:\s*/i, ''),
        rationale: details.reason || details.rationale || evt.description,
        status: details.status || 'Adopted',
        author: evt.author_name || 'Team',
        date: dateStr
      });
    } else if (evt.event_type === 'task') {
      if (details.status === 'Completed') {
        completedTasks.push({
          id: evt.id,
          title: evt.title,
          owner: details.owner_name || evt.author_name || 'Assigned Owner',
          outcome: details.outcome || 'Completed successfully',
          completedAt: dateStr
        });
      } else {
        newTasks.push({
          id: evt.id,
          title: evt.title,
          owner: details.owner_name || evt.author_name || 'Unassigned',
          status: details.status || 'Pending',
          priority: details.priority || 'Medium',
          dueDate: details.due_date || 'TBD'
        });
      }
    } else if (evt.event_type === 'meeting') {
      newMeetings.push({
        id: evt.id,
        title: evt.title,
        date: dateStr,
        summary: details.ai_summary || details.agenda || evt.description,
        blockersCount: (details.blockers || []).length
      });
      if (details.blockers && details.blockers.length > 0) {
        details.blockers.forEach(b => {
          blockers.push({
            title: typeof b === 'string' ? b : b.title || 'Unresolved blocker',
            meeting: evt.title,
            date: dateStr
          });
        });
      }
    } else if (evt.event_type === 'work_transfer') {
      handoffs.push({
        id: evt.id,
        title: evt.title,
        reason: details.reason_for_transfer || evt.description,
        fromOwner: details.prev_name || 'Previous Owner',
        toOwner: details.new_name || 'New Owner',
        status: details.status || 'Pending Acknowledgement',
        date: dateStr
      });
    } else if (evt.event_type === 'milestone') {
      milestones.push({
        id: evt.id,
        title: evt.title,
        summary: details.summary || evt.description,
        type: details.update_type || 'Milestone',
        author: evt.author_name,
        date: dateStr
      });
    } else if (evt.event_type === 'document') {
      newDocuments.push({
        id: evt.id,
        title: evt.title.replace(/^Doc:\s*/i, ''),
        category: details.category || 'Architecture',
        author: evt.author_name,
        date: dateStr
      });
    }
  });

  // Categorize from granular changes table
  changes.forEach(ch => {
    if (ch.change_type === 'reassigned') {
      const prev = ch.previous_value || {};
      const next = ch.new_value || {};
      reassignedTasks.push({
        title: ch.entity_title,
        fromOwner: prev.owner || 'Previous',
        toOwner: next.owner || 'New Owner',
        date: new Date(ch.timestamp).toLocaleDateString()
      });
    } else if (ch.change_type === 'modified' && ch.entity_type === 'task') {
      taskStatusChanges.push({
        title: ch.entity_title,
        oldStatus: ch.previous_value?.status,
        newStatus: ch.new_value?.status,
        date: new Date(ch.timestamp).toLocaleDateString()
      });
    }
  });

  return {
    projectId,
    fromEvent: {
      id: fromEvent.id,
      title: fromEvent.title,
      type: fromEvent.event_type,
      author: fromEvent.author_name,
      timestamp: fromEvent.timestamp,
      date: new Date(fromEvent.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    },
    toEvent: {
      id: toEvent.id,
      title: toEvent.title,
      type: toEvent.event_type,
      author: toEvent.author_name,
      timestamp: toEvent.timestamp,
      date: new Date(toEvent.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    },
    totalEventsDifference: gapEvents.length,
    totalGranularChanges: changes.length,
    differences: {
      newDecisions,
      modifiedDecisions,
      newTasks,
      completedTasks,
      reassignedTasks,
      taskStatusChanges,
      newMeetings,
      newDocuments,
      handoffs,
      blockers,
      milestones
    },
    rawChanges: changes
  };
}

/**
 * Acknowledge user's context position in a project.
 * Updates user_context_positions table persistently.
 */
export async function acknowledgeUserContext(projectId, userId, targetEventId = null) {
  // If targetEventId not supplied, advance to latest project event
  let resolvedEventId = targetEventId;
  if (!resolvedEventId) {
    const latestRes = await query(`
      SELECT id FROM context_events 
      WHERE project_id = $1 
      ORDER BY timestamp DESC LIMIT 1;
    `, [projectId]);
    if (latestRes.rows.length === 0) {
      throw new Error('No context events found for project');
    }
    resolvedEventId = latestRes.rows[0].id;
  }

  const upsertRes = await query(`
    INSERT INTO user_context_positions (
      user_id, project_id, last_acknowledged_event_id, 
      last_acknowledged_at, updated_at
    )
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (user_id, project_id) DO UPDATE 
    SET last_acknowledged_event_id = EXCLUDED.last_acknowledged_event_id,
        last_acknowledged_at = NOW(),
        updated_at = NOW()
    RETURNING *;
  `, [userId, projectId, resolvedEventId]);

  logger.info({ projectId, userId, eventId: resolvedEventId }, 'User acknowledged context position');
  return upsertRes.rows[0];
}

export default {
  generateProjectContextGraph,
  compareProjectContext,
  acknowledgeUserContext
};
