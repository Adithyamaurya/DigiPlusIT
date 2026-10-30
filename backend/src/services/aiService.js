import { GoogleGenerativeAI } from '@google/generative-ai';
import { logAIOperation, logger } from '../utils/logger.js';
import {
  MeetingRecapSchema,
  ProjectCatchupSchema,
  HandoffCatchupSchema,
  RiskExplanationSchema,
  KnowledgeQASchema,
  OnboardingBriefSchema
} from '../validators/aiValidators.js';

let genAI = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    const error = new Error('GEMINI_API_KEY is not configured in backend environment variables. Please add a valid Gemini API key to your .env file to enable live AI features.');
    error.code = 'MISSING_API_KEY';
    throw error;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

/**
 * Intelligent Model Cascading with Fallback
 * Tries the preferred model first; if not found (404) or experiencing capacity spike (503),
 * cascades smoothly to available fallback models.
 */
async function callGeminiWithFallback(client, systemPrompt, userPrompt, temperature = 0.1) {
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const candidates = [
    preferredModel,
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ];
  // Deduplicate preserving order
  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];

  let lastError = null;

  for (const modelName of uniqueCandidates) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature
        }
      });

      const result = await model.generateContent([
        { text: systemPrompt },
        { text: userPrompt }
      ]);

      const responseText = result.response.text();
      return { responseText, usedModel: modelName };
    } catch (err) {
      lastError = err;
      const isRetriable =
        err.status === 404 ||
        err.status === 503 ||
        err.message?.includes('404') ||
        err.message?.includes('503') ||
        err.message?.includes('not found') ||
        err.message?.includes('high demand') ||
        err.message?.includes('no longer available');

      logger.warn(
        { model: modelName, error: err.message, status: err.status },
        `Model ${modelName} encountered an issue (${err.status || err.message}). Attempting next candidate...`
      );

      if (!isRetriable) {
        throw err;
      }
    }
  }

  throw lastError;
}

/**
 * 1. Meeting Note Summarization & Extraction
 */
export async function generateMeetingRecap({ notes, projectContext, availableMembers = [], requestId }) {
  const startTime = Date.now();
  const operation = 'GENERATE_MEETING_RECAP';

  try {
    const client = getGeminiClient();

    const membersListText = availableMembers.length > 0
      ? `Available Project Team Members: ${availableMembers.map(m => `${m.name} (${m.role})`).join(', ')}`
      : 'No explicit team roster provided. Extract names exactly as written or null if unassigned.';

    const systemPrompt = `You are ContextFlow AI Meeting Intelligence Assistant.
Analyze the provided meeting notes and project context.
Extract structured information following these STRICT RULES:
1. Never invent task owners. Only assign if explicitly named in the notes.
2. If an action item mentions someone not in the project team or is unassigned, use null for owner_name and list it in unassigned_items.
3. Never invent due dates. Only extract dates if explicitly stated (e.g. "by November 3" -> "2026-11-03"). If no date is given, use null.
4. Do not invent decisions. Only list clear decisions agreed upon by the team.
5. Clearly distinguish decisions from suggestions.
6. Provide output in pure JSON matching this exact structure:
{
  "summary": "Concise 1-3 sentence summary of the meeting",
  "discussion_points": ["Point 1", "Point 2"],
  "decisions": [
    { "title": "Decision title", "reason": "Reason or context" }
  ],
  "action_items": [
    {
      "title": "Action title",
      "owner_name": "Exact Name or null",
      "due_date": "YYYY-MM-DD or null",
      "status": "Pending",
      "description": "Short description of expected deliverable",
      "priority": "Low|Medium|High|Urgent"
    }
  ],
  "unassigned_items": ["Pending items without assigned owners"],
  "blockers": ["Any mentioned roadblocks"],
  "follow_up_topics": ["Items to review in subsequent meetings"]
}`;

    const userPrompt = `${membersListText}
Project Context: ${projectContext || 'General Project'}

Raw Meeting Notes:
"""
${notes}
"""`;

    const { responseText, usedModel } = await callGeminiWithFallback(client, systemPrompt, userPrompt, 0.1);
    const parsedJson = JSON.parse(cleanJsonResponse(responseText));

    // Validate using Zod
    const validated = MeetingRecapSchema.parse(parsedJson);

    logAIOperation({
      operation,
      requestId,
      startTime,
      success: true,
      metadata: { model: usedModel, decisionsCount: validated.decisions.length, tasksCount: validated.action_items.length }
    });

    return validated;
  } catch (error) {
    logAIOperation({
      operation,
      requestId,
      startTime,
      success: false,
      errorCategory: error.code || error.name || 'AI_ERROR',
      metadata: { errorMessage: error.message }
    });
    throw error;
  }
}

/**
 * 2. Project Catch-Up Brief Generation
 */
export async function generateProjectCatchup({ project, recentMeetings, openTasks, completedTasks, decisions, documents, blockers, requestId }) {
  const startTime = Date.now();
  const operation = 'GENERATE_PROJECT_CATCHUP';

  try {
    const client = getGeminiClient();

    const systemPrompt = `You are ContextFlow AI Continuity Engine.
Generate an executive Project Catch-Up brief for a team member who missed meetings or joined recently.
CRITICAL RULES:
- Source of truth must be ONLY the provided database records.
- Do not make up facts, dates, or decisions.
- If information is missing or empty, explicitly state that it is currently unavailable.
- Reference original meetings, tasks, and documents where applicable.
Return JSON with this structure:
{
  "project_overview": "Summary of project goals and current standing",
  "recent_activity": "Narrative of what happened in recent meetings",
  "key_decisions": [
    { "title": "Decision title", "context": "Why it was decided and meeting reference" }
  ],
  "outstanding_tasks": [
    { "title": "Task title", "owner": "Owner name or Unassigned", "due_date": "Date or null", "urgency": "High/Med/Low" }
  ],
  "completed_work": ["Key milestones recently achieved"],
  "current_blockers": ["Active blockers"],
  "suggested_next_steps": ["Actionable guidance for the returning employee"],
  "recommended_docs": ["Relevant knowledge documents to read"]
}`;

    const contextPayload = {
      project: { name: project.name, description: project.description, status: project.status },
      meetings: recentMeetings.map(m => ({ title: m.title, date: m.meeting_date, summary: m.ai_summary })),
      decisions: decisions.map(d => ({ title: d.title, reason: d.reason })),
      openTasks: openTasks.map(t => ({ title: t.title, owner: t.owner_name || 'Unassigned', due_date: t.due_date, priority: t.priority })),
      completedTasks: completedTasks.map(t => ({ title: t.title, outcome: t.outcome })),
      documents: documents.map(doc => ({ title: doc.title, category: doc.category })),
      blockers: blockers || []
    };

    const userPrompt = `Real Database Context for Project "${project.name}":
${JSON.stringify(contextPayload, null, 2)}`;

    const { responseText, usedModel } = await callGeminiWithFallback(client, systemPrompt, userPrompt, 0.2);
    const parsedJson = JSON.parse(cleanJsonResponse(responseText));
    const validated = ProjectCatchupSchema.parse(parsedJson);

    logAIOperation({
      operation,
      requestId,
      startTime,
      success: true,
      metadata: { model: usedModel, projectName: project.name }
    });

    return validated;
  } catch (error) {
    logAIOperation({
      operation,
      requestId,
      startTime,
      success: false,
      errorCategory: error.code || error.name || 'AI_ERROR',
      metadata: { errorMessage: error.message }
    });
    throw error;
  }
}

/**
 * 3. Work Transfer / Handoff Brief Generation
 */
export async function generateHandoffBrief({ transfer, previousOwner, newOwner, project, tasks, documents, requestId }) {
  const startTime = Date.now();
  const operation = 'GENERATE_HANDOFF_BRIEF';

  try {
    const client = getGeminiClient();

    const systemPrompt = `You are ContextFlow AI Work Transfer Specialist.
Generate an actionable handoff brief for ${newOwner.name} taking over responsibilities from ${previousOwner.name} in project "${project.name}".
Use the provided real database records only.
Return JSON with this structure:
{
  "previous_work_summary": "Detailed synthesis of what was being worked on and current progress",
  "completed_milestones": ["Items completed before handoff"],
  "unfinished_work": [
    { "task_title": "Title", "current_state": "Status & notes", "priority": "Priority" }
  ],
  "critical_decisions_to_remember": ["Decisions affecting this scope"],
  "immediate_first_actions": ["What ${newOwner.name} should do in day 1-2"],
  "key_documents_to_read": ["Documents essential to review"]
}`;

    const contextPayload = {
      project: project.name,
      previousOwner: { name: previousOwner.name, role: previousOwner.role },
      newOwner: { name: newOwner.name, role: newOwner.role },
      reason: transfer.reason_for_transfer,
      currentProgress: transfer.current_progress,
      additionalNotes: transfer.additional_notes,
      tasks: tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, due_date: t.due_date })),
      documents: documents.map(d => ({ title: d.title, category: d.category }))
    };

    const userPrompt = `Handoff Data:
${JSON.stringify(contextPayload, null, 2)}`;

    const { responseText, usedModel } = await callGeminiWithFallback(client, systemPrompt, userPrompt, 0.2);
    const parsedJson = JSON.parse(cleanJsonResponse(responseText));
    const validated = HandoffCatchupSchema.parse(parsedJson);

    logAIOperation({
      operation,
      requestId,
      startTime,
      success: true,
      metadata: { model: usedModel, transferId: transfer.id }
    });

    return validated;
  } catch (error) {
    logAIOperation({
      operation,
      requestId,
      startTime,
      success: false,
      errorCategory: error.code || error.name || 'AI_ERROR',
      metadata: { errorMessage: error.message }
    });
    throw error;
  }
}

/**
 * 4. Context Risk Explanation & Recommendations
 */
export async function explainContextRisks({ project, detectedRisks, healthScore, requestId }) {
  const startTime = Date.now();
  const operation = 'EXPLAIN_CONTEXT_RISKS';

  try {
    const client = getGeminiClient();

    const systemPrompt = `You are ContextFlow AI Risk Advisor.
Evaluate the deterministically detected operational risks in project "${project.name}" (Health Score: ${healthScore}/100).
Provide realistic, actionable recommendations for project leads and engineers to prevent knowledge loss and delivery blockers.
Return JSON with this structure:
{
  "summary": "1-2 sentence overall risk posture evaluation",
  "risk_evaluations": [
    {
      "risk_title": "Matches detected risk name",
      "severity": "Critical|High|Medium|Low",
      "impact": "Why this causes information loss or sprint delay",
      "recommendation": "Concrete mitigation step"
    }
  ]
}`;

    const userPrompt = `Detected Risks:
${JSON.stringify(detectedRisks, null, 2)}`;

    const { responseText, usedModel } = await callGeminiWithFallback(client, systemPrompt, userPrompt, 0.2);
    const parsedJson = JSON.parse(cleanJsonResponse(responseText));
    const validated = RiskExplanationSchema.parse(parsedJson);

    logAIOperation({
      operation,
      requestId,
      startTime,
      success: true,
      metadata: { model: usedModel, projectId: project.id, healthScore }
    });

    return validated;
  } catch (error) {
    logAIOperation({
      operation,
      requestId,
      startTime,
      success: false,
      errorCategory: error.code || error.name || 'AI_ERROR',
      metadata: { errorMessage: error.message }
    });
    // For risk explanation, fallback to deterministic recommendations so UI remains 100% operational
    return {
      summary: `Project currently has a health score of ${healthScore}/100 with ${detectedRisks.length} active risk factor(s).`,
      risk_evaluations: detectedRisks.map(r => ({
        risk_title: r.title,
        severity: r.severity,
        impact: r.description,
        recommendation: r.defaultRecommendation || 'Review and take prompt team action.'
      }))
    };
  }
}

/**
 * 5. Ask Project Memory (Interactive Knowledge Base Q&A with Source References)
 */
export async function askProjectMemory({ project, question, retrievedContext, requestId }) {
  const startTime = Date.now();
  const operation = 'ASK_PROJECT_MEMORY';

  try {
    const client = getGeminiClient();

    const systemPrompt = `You are WorkTrace Project Memory Intelligence.
Answer the user's question regarding project "${project.name}" strictly using the provided database records (meetings, decisions, documents, tasks).
RULES:
1. Provide a direct, authoritative, and helpful answer.
2. Separate confirmed facts, inferred points, and missing information.
3. List explicit source references (e.g. Meeting title, Decision title, Document name).
4. If the database records do not contain the answer, explicitly state that the information is missing from project memory.
Return JSON structure:
{
  "answer": "Clear, comprehensive synthesized answer",
  "confirmed_facts": ["Fact verified in records 1", "Fact 2"],
  "inferred_points": ["Reasonable deduction based on context"],
  "missing_information": ["Information not found or pending"],
  "sources": [
    { "type": "meeting|decision|document|task", "title": "Exact source title", "reference": "Context excerpt" }
  ]
}`;

    const userPrompt = `User Question: "${question}"

Project Context Records:
${JSON.stringify(retrievedContext, null, 2)}`;

    const { responseText, usedModel } = await callGeminiWithFallback(client, systemPrompt, userPrompt, 0.2);
    const parsedJson = JSON.parse(cleanJsonResponse(responseText));
    const validated = KnowledgeQASchema.parse(parsedJson);

    logAIOperation({
      operation,
      requestId,
      startTime,
      success: true,
      metadata: { model: usedModel, question }
    });

    return validated;
  } catch (error) {
    logAIOperation({
      operation,
      requestId,
      startTime,
      success: false,
      errorCategory: error.code || error.name || 'AI_ERROR',
      metadata: { errorMessage: error.message }
    });
    throw error;
  }
}

/**
 * 6. Team Member Onboarding Brief Generation
 */
export async function generateOnboardingBrief({ project, member, recentMeetings, decisions, tasks, documents, requestId }) {
  const startTime = Date.now();
  const operation = 'GENERATE_ONBOARDING_BRIEF';

  try {
    const client = getGeminiClient();

    const systemPrompt = `You are WorkTrace Onboarding Engine.
Generate an onboarding brief for ${member.name} (${member.role}) joining project "${project.name}".
Use the provided real database records to give them instant contextual immersion.
Return JSON structure:
{
  "project_mission": "Executive summary of project goals and scope",
  "role_responsibilities": "Clear expectations tailored to their role (${member.role})",
  "confirmed_architecture": ["Confirmed architectural foundations"],
  "key_decisions": [
    { "title": "Decision name", "context": "Why it was chosen and what it entails" }
  ],
  "active_team_workstreams": [
    { "stream": "Area of work", "lead_owner": "Name", "status": "In Progress/Pending" }
  ],
  "inferred_work_priorities": ["Where they should focus first"],
  "missing_or_pending_context": ["Open items or unassigned areas needing attention"],
  "prerequisite_documents_to_read": ["Knowledge documents to read on day 1"]
}`;

    const contextPayload = {
      project: { name: project.name, description: project.description },
      member: { name: member.name, role: member.role },
      meetings: recentMeetings.map(m => ({ title: m.title, date: m.meeting_date, summary: m.ai_summary })),
      decisions: decisions.map(d => ({ title: d.title, reason: d.reason })),
      tasks: tasks.map(t => ({ title: t.title, owner: t.owner_name, status: t.status, priority: t.priority })),
      documents: documents.map(d => ({ title: d.title, category: d.category }))
    };

    const userPrompt = `Project Context:
${JSON.stringify(contextPayload, null, 2)}`;

    const { responseText, usedModel } = await callGeminiWithFallback(client, systemPrompt, userPrompt, 0.2);
    const parsedJson = JSON.parse(cleanJsonResponse(responseText));
    const validated = OnboardingBriefSchema.parse(parsedJson);

    logAIOperation({
      operation,
      requestId,
      startTime,
      success: true,
      metadata: { model: usedModel, memberName: member.name }
    });

    return validated;
  } catch (error) {
    logAIOperation({
      operation,
      requestId,
      startTime,
      success: false,
      errorCategory: error.code || error.name || 'AI_ERROR',
      metadata: { errorMessage: error.message }
    });
    throw error;
  }
}

export default {
  generateMeetingRecap,
  generateProjectCatchup,
  generateHandoffBrief,
  explainContextRisks,
  askProjectMemory,
  generateOnboardingBrief
};
