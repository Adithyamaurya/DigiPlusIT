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
