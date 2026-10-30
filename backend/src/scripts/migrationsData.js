// Embedded migrations for serverless compatibility
export const MIGRATIONS = [
  {
    name: '001_initial_schema.sql',
    sql: `
-- ContextFlow Database Schema (Supabase PostgreSQL Compatible)

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'Member',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'On Hold', 'Completed', 'Archived')),
    start_date DATE,
    end_date DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. PROJECT MEMBERS
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100) DEFAULT 'Member',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, user_id)
);

-- 4. MEETINGS
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    meeting_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    agenda TEXT,
    raw_notes TEXT NOT NULL,
    ai_summary TEXT,
    discussion_points JSONB DEFAULT '[]'::jsonb,
    blockers JSONB DEFAULT '[]'::jsonb,
    follow_up_topics JSONB DEFAULT '[]'::jsonb,
    ai_generated_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. MEETING PARTICIPANTS
CREATE TABLE IF NOT EXISTS meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attended BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meeting_id, user_id)
);

-- 6. DECISIONS
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    meeting_id REFERENCES meetings(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Adopted' CHECK (status IN ('Adopted', 'Under Review', 'Deprecated', 'Superseded')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. ACTION ITEMS (TASKS)
CREATE TABLE IF NOT EXISTS action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Blocked')),
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    carry_forward_count INT NOT NULL DEFAULT 0,
    completion_notes TEXT,
    outcome TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. MEETING ACTION ITEMS
CREATE TABLE IF NOT EXISTS meeting_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    is_carried_forward BOOLEAN DEFAULT FALSE,
    discussion_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meeting_id, action_item_id)
);

-- 9. TASK HISTORY
CREATE TABLE IF NOT EXISTS task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    change_type VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. WORK TRANSFERS
CREATE TABLE IF NOT EXISTS work_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    previous_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    new_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason_for_transfer TEXT NOT NULL,
    current_progress TEXT NOT NULL,
    additional_notes TEXT,
    ai_handoff_brief TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending Acknowledgement' CHECK (status IN ('Draft', 'Pending Acknowledgement', 'Acknowledged', 'Completed')),
    transfer_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. WORK TRANSFER TASKS
CREATE TABLE IF NOT EXISTS work_transfer_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_transfer_id UUID NOT NULL REFERENCES work_transfers(id) ON DELETE CASCADE,
    action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (work_transfer_id, action_item_id)
);

-- 12. HANDOFF ACKNOWLEDGEMENTS
CREATE TABLE IF NOT EXISTS handoff_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_transfer_id UUID NOT NULL REFERENCES work_transfers(id) ON DELETE CASCADE,
    acknowledged_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comments TEXT,
    acknowledged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. KNOWLEDGE DOCUMENTS
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. DECISION DOCUMENTS
CREATE TABLE IF NOT EXISTS decision_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (decision_id, document_id)
);

-- 15. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_action_items_project ON action_items(project_id);
CREATE INDEX IF NOT EXISTS idx_action_items_owner ON action_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_work_transfers_project ON work_transfers(project_id);
CREATE INDEX IF NOT EXISTS idx_work_transfers_new_owner ON work_transfers(new_owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_task_history_action_item ON task_history(action_item_id);
CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
`
  },
  {
    name: '002_project_updates.sql',
    sql: `
-- Migration 002: Add project_updates table for standalone milestone and status updates
CREATE TABLE IF NOT EXISTS project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    update_type VARCHAR(50) DEFAULT 'milestone' CHECK (update_type IN ('milestone', 'blocker', 'release', 'status_update')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id);
`
  },
  {
    name: '003_context_graph_tables.sql',
    sql: `
-- Migration 003: User-Wise Git-Style Context History Graph Engine
-- Supports branches, merge points, individual user context positions, and granular diff tracking.

-- 1. CONTEXT BRANCHES
CREATE TABLE IF NOT EXISTS context_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_event_id UUID,
    member_id UUID REFERENCES users(id) ON DELETE SET NULL,
    color VARCHAR(30) DEFAULT '#4f46e5',
    is_main BOOLEAN DEFAULT FALSE,
    latest_event_id UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE context_branches ADD COLUMN IF NOT EXISTS latest_event_id UUID;

CREATE INDEX IF NOT EXISTS idx_context_branches_project ON context_branches(project_id);
CREATE INDEX IF NOT EXISTS idx_context_branches_member ON context_branches(member_id);

-- 2. CONTEXT EVENTS
CREATE TABLE IF NOT EXISTS context_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES context_branches(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('meeting', 'decision', 'task', 'work_transfer', 'document', 'milestone', 'blocker')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_record_id UUID,
    source_type VARCHAR(50),
    prev_event_id UUID REFERENCES context_events(id) ON DELETE SET NULL,
    change_snapshot JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_context_events_project ON context_events(project_id);
CREATE INDEX IF NOT EXISTS idx_context_events_timestamp ON context_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_context_events_type ON context_events(event_type);
CREATE INDEX IF NOT EXISTS idx_context_events_created_by ON context_events(created_by);
CREATE INDEX IF NOT EXISTS idx_context_events_branch ON context_events(branch_id);

-- Add foreign key constraint to context_branches.parent_event_id
ALTER TABLE context_branches 
    DROP CONSTRAINT IF EXISTS fk_context_branches_parent,
    ADD CONSTRAINT fk_context_branches_parent FOREIGN KEY (parent_event_id) REFERENCES context_events(id) ON DELETE SET NULL;

-- 3. USER CONTEXT POSITIONS
CREATE TABLE IF NOT EXISTS user_context_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    last_acknowledged_event_id UUID REFERENCES context_events(id) ON DELETE SET NULL,
    last_acknowledged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_viewed_event_id UUID REFERENCES context_events(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_user_context_positions_lookup ON user_context_positions(user_id, project_id);

-- 4. CONTEXT RELATIONSHIPS
CREATE TABLE IF NOT EXISTS context_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_event_id UUID NOT NULL REFERENCES context_events(id) ON DELETE CASCADE,
    target_event_id UUID NOT NULL REFERENCES context_events(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('continuation', 'branch', 'merge', 'handoff', 'dependency', 'decision_adopted')),
    label VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_event_id, target_event_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_context_relationships_source ON context_relationships(source_event_id);
CREATE INDEX IF NOT EXISTS idx_context_relationships_target ON context_relationships(target_event_id);

-- 5. CONTEXT CHANGES
CREATE TABLE IF NOT EXISTS context_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES context_events(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('decision', 'task', 'meeting_outcome', 'document', 'blocker', 'responsibility', 'milestone')),
    entity_id UUID,
    entity_title VARCHAR(255) NOT NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('added', 'modified', 'removed', 'completed', 'reassigned')),
    previous_value JSONB DEFAULT '{}'::jsonb,
    new_value JSONB DEFAULT '{}'::jsonb,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_context_changes_event ON context_changes(event_id);
CREATE INDEX IF NOT EXISTS idx_context_changes_entity ON context_changes(entity_type, entity_id);

-- Row Level Security (RLS) Configuration for Supabase
ALTER TABLE context_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_changes ENABLE ROW LEVEL SECURITY;

-- Clean recreate policies for idempotency
DROP POLICY IF EXISTS context_branches_select ON context_branches;
DROP POLICY IF EXISTS context_branches_insert ON context_branches;
DROP POLICY IF EXISTS context_branches_update ON context_branches;

DROP POLICY IF EXISTS context_events_select ON context_events;
DROP POLICY IF EXISTS context_events_insert ON context_events;
DROP POLICY IF EXISTS context_events_update ON context_events;

DROP POLICY IF EXISTS user_context_positions_select ON user_context_positions;
DROP POLICY IF EXISTS user_context_positions_insert ON user_context_positions;
DROP POLICY IF EXISTS user_context_positions_update ON user_context_positions;

DROP POLICY IF EXISTS context_relationships_select ON context_relationships;
DROP POLICY IF EXISTS context_relationships_insert ON context_relationships;

DROP POLICY IF EXISTS context_changes_select ON context_changes;
DROP POLICY IF EXISTS context_changes_insert ON context_changes;

-- Policies for authorized application access
CREATE POLICY context_branches_select ON context_branches FOR SELECT USING (true);
CREATE POLICY context_branches_insert ON context_branches FOR INSERT WITH CHECK (true);
CREATE POLICY context_branches_update ON context_branches FOR UPDATE USING (true);

CREATE POLICY context_events_select ON context_events FOR SELECT USING (true);
CREATE POLICY context_events_insert ON context_events FOR INSERT WITH CHECK (true);
CREATE POLICY context_events_update ON context_events FOR UPDATE USING (true);

CREATE POLICY user_context_positions_select ON user_context_positions FOR SELECT USING (true);
CREATE POLICY user_context_positions_insert ON user_context_positions FOR INSERT WITH CHECK (true);
CREATE POLICY user_context_positions_update ON user_context_positions FOR UPDATE USING (true);

CREATE POLICY context_relationships_select ON context_relationships FOR SELECT USING (true);
CREATE POLICY context_relationships_insert ON context_relationships FOR INSERT WITH CHECK (true);

CREATE POLICY context_changes_select ON context_changes FOR SELECT USING (true);
CREATE POLICY context_changes_insert ON context_changes FOR INSERT WITH CHECK (true);
`
  }
];

