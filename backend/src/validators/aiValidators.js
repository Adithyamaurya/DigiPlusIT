import { z } from 'zod';

export const MeetingRecapSchema = z.object({
  summary: z.string().min(1, 'Meeting summary is required'),
  discussion_points: z.array(z.string()).default([]),
  decisions: z.array(
    z.object({
      title: z.string(),
      reason: z.string().nullable().optional()
    })
  ).default([]),
  action_items: z.array(
    z.object({
      title: z.string(),
      owner_name: z.string().nullable().optional(),
      due_date: z.string().nullable().optional(),
      status: z.enum(['Pending', 'In Progress', 'Completed', 'Blocked', 'pending', 'in_progress', 'completed', 'blocked']).default('Pending'),
      description: z.string().nullable().optional(),
      priority: z.enum(['Low', 'Medium', 'High', 'Urgent', 'low', 'medium', 'high', 'urgent']).default('Medium')
    })
  ).default([]),
  unassigned_items: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  follow_up_topics: z.array(z.string()).default([])
});

export const ProjectCatchupSchema = z.object({
  project_overview: z.string().min(1),
  recent_activity: z.string().min(1),
  key_decisions: z.array(
    z.object({
      title: z.string(),
      context: z.string().optional()
    })
  ).default([]),
  outstanding_tasks: z.array(
    z.object({
      title: z.string(),
      owner: z.string().nullable().optional(),
      due_date: z.string().nullable().optional(),
      urgency: z.string().optional()
    })
  ).default([]),
  completed_work: z.array(z.string()).default([]),
  current_blockers: z.array(z.string()).default([]),
  suggested_next_steps: z.array(z.string()).default([]),
  recommended_docs: z.array(z.string()).default([])
});

export const HandoffCatchupSchema = z.object({
  previous_work_summary: z.string().min(1),
  completed_milestones: z.array(z.string()).default([]),
  unfinished_work: z.array(
    z.object({
      task_title: z.string(),
      current_state: z.string().optional(),
      priority: z.string().optional()
    })
  ).default([]),
  critical_decisions_to_remember: z.array(z.string()).default([]),
  immediate_first_actions: z.array(z.string()).default([]),
  key_documents_to_read: z.array(z.string()).default([])
});

export const RiskExplanationSchema = z.object({
  summary: z.string(),
  risk_evaluations: z.array(
    z.object({
      risk_title: z.string(),
      severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
      impact: z.string(),
      recommendation: z.string()
    })
  ).default([])
});

export const KnowledgeQASchema = z.object({
  answer: z.string().min(1),
  confirmed_facts: z.array(z.string()).default([]),
  inferred_points: z.array(z.string()).default([]),
  missing_information: z.array(z.string()).default([]),
  sources: z.array(
    z.object({
      type: z.enum(['meeting', 'decision', 'document', 'task']),
      title: z.string(),
      reference: z.string().optional()
    })
  ).default([])
});

export const OnboardingBriefSchema = z.object({
  project_mission: z.string().min(1),
  role_responsibilities: z.string().min(1),
  confirmed_architecture: z.array(z.string()).default([]),
  key_decisions: z.array(
    z.object({
      title: z.string(),
      context: z.string()
    })
  ).default([]),
  active_team_workstreams: z.array(
    z.object({
      stream: z.string(),
      lead_owner: z.string(),
      status: z.string()
    })
  ).default([]),
  inferred_work_priorities: z.array(z.string()).default([]),
  missing_or_pending_context: z.array(z.string()).default([]),
  prerequisite_documents_to_read: z.array(z.string()).default([])
});

