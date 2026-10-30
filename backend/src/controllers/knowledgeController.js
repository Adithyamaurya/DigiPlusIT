import { query } from '../config/db.js';
import { logEvent, logError } from '../utils/logger.js';
import { askProjectMemory } from '../services/aiService.js';
import { recordEvent } from '../services/contextRecorderService.js';

export async function getAllDocuments(req, res) {
  const { project_id, category, search, tag } = req.query;

  try {
    let sql = `
      SELECT 
        kd.*,
        p.name as project_name,
        u.name as creator_name,
        (SELECT COUNT(*) FROM decision_documents dd WHERE dd.document_id = kd.id) as linked_decisions_count
      FROM knowledge_documents kd
      JOIN projects p ON kd.project_id = p.id
      LEFT JOIN users u ON kd.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      params.push(project_id);
      sql += ` AND kd.project_id = $${params.length}`;
    }

    if (category) {
      params.push(category);
      sql += ` AND kd.category ILIKE $${params.length}`;
    }

    if (tag) {
      params.push(tag);
      sql += ` AND $${params.length} = ANY(kd.tags)`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (kd.title ILIKE $${params.length} OR kd.content ILIKE $${params.length})`;
    }

    sql += ` ORDER BY kd.created_at DESC;`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'DOCS_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve documents' });
  }
}

export async function getDocumentById(req, res) {
  const { id } = req.params;

  try {
    const docRes = await query(`
      SELECT 
        kd.*,
        p.name as project_name,
        u.name as creator_name,
        u.email as creator_email
      FROM knowledge_documents kd
      JOIN projects p ON kd.project_id = p.id
      LEFT JOIN users u ON kd.created_by = u.id
      WHERE kd.id = $1;
    `, [id]);

    if (docRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const doc = docRes.rows[0];

    // Linked Decisions
    const decisionsRes = await query(`
      SELECT d.*, m.title as meeting_title
      FROM decision_documents dd
      JOIN decisions d ON dd.decision_id = d.id
      LEFT JOIN meetings m ON d.meeting_id = m.id
      WHERE dd.document_id = $1;
    `, [id]);

    res.json({
      success: true,
      data: {
        ...doc,
        linked_decisions: decisionsRes.rows
      }
    });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'DOC_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve document details' });
  }
}

export async function createDocument(req, res) {
  const { project_id, title, content, category = 'General', tags = [], created_by } = req.body;

  if (!project_id || !title || !content) {
    return res.status(400).json({ success: false, error: 'Project, title, and content are required' });
  }

  try {
    const cleanTags = Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [];

    const insertRes = await query(`
      INSERT INTO knowledge_documents (project_id, title, content, category, tags, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `, [project_id, title.trim(), content.trim(), category, cleanTags, created_by || null]);

    const newDoc = insertRes.rows[0];
    logEvent('DOCUMENT_CREATED', { docId: newDoc.id, title: newDoc.title, requestId: req.id });

    // Record in Context Graph
    try {
      await recordEvent({
        projectId: newDoc.project_id,
        eventType: 'document',
        title: `Knowledge Doc: ${newDoc.title}`,
        description: `Category: ${newDoc.category}`,
        createdBy: newDoc.created_by,
        sourceRecordId: newDoc.id,
        sourceType: 'document',
        changes: [{
          entityType: 'document',
          entityId: newDoc.id,
          entityTitle: newDoc.title,
          changeType: 'added',
          newValue: { title: newDoc.title, category: newDoc.category }
        }]
      });
    } catch (graphErr) {
      logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'CONTEXT_EVENT_WARN', message: graphErr.message });
    }

    res.status(201).json({ success: true, data: newDoc });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'DOC_CREATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to create document' });
  }
}

export async function updateDocument(req, res) {
  const { id } = req.params;
  const { title, content, category, tags } = req.body;

  try {
    const cleanTags = Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : undefined;

    const updateRes = await query(`
      UPDATE knowledge_documents
      SET 
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        category = COALESCE($3, category),
        tags = COALESCE($4, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `, [title, content, category, cleanTags, id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    logEvent('DOCUMENT_UPDATED', { docId: id, requestId: req.id });
    res.json({ success: true, data: updateRes.rows[0] });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'DOC_UPDATE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to update document' });
  }
}

export async function deleteDocument(req, res) {
  const { id } = req.params;
  try {
    const deleteRes = await query(`DELETE FROM knowledge_documents WHERE id = $1 RETURNING id;`, [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    logEvent('DOCUMENT_DELETED', { docId: id, requestId: req.id });
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'DOC_DELETE_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
}

/**
 * AI Knowledge Linking Helper
 * Searches documents by keywords to match relevant docs to decisions/action items
 */
export async function matchDocuments(req, res) {
  const { projectId, query: searchQuery } = req.query;

  if (!projectId || !searchQuery) {
    return res.status(400).json({ success: false, error: 'projectId and query are required' });
  }

  try {
    const words = searchQuery.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Keyword matching using ILIKE
    const likeClauses = words.map((_, idx) => `(title ILIKE $${idx + 2} OR content ILIKE $${idx + 2} OR $${idx + 2} = ANY(tags))`).join(' OR ');

    const sql = `
      SELECT id, title, category, tags,
        (CASE WHEN title ILIKE $${words.length + 2} THEN 10 ELSE 0 END) as relevance
      FROM knowledge_documents
      WHERE project_id = $1 AND (${likeClauses})
      ORDER BY relevance DESC, created_at DESC
      LIMIT 5;
    `;

    const params = [projectId, ...words.map(w => `%${w}%`), `%${searchQuery}%`];
    const matchRes = await query(sql, params);

    res.json({ success: true, data: matchRes.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'DOC_MATCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to match documents' });
  }
}

export async function linkDocumentToDecision(req, res) {
  const { decision_id, document_id } = req.body;

  if (!decision_id || !document_id) {
    return res.status(400).json({ success: false, error: 'decision_id and document_id are required' });
  }

  try {
    await query(`
      INSERT INTO decision_documents (decision_id, document_id)
      VALUES ($1, $2)
      ON CONFLICT (decision_id, document_id) DO NOTHING;
    `, [decision_id, document_id]);

    logEvent('DECISION_DOC_LINKED', { decisionId: decision_id, documentId: document_id, requestId: req.id });
    res.json({ success: true, message: 'Document linked to decision successfully' });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'DOC_LINK_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to link document to decision' });
  }
}

/**
 * AI Project Memory Q&A
 * Answers user questions with source-linked citations
 */
export async function askQuestionAboutMemory(req, res) {
  const { projectId, question } = req.body;

  if (!projectId || !question || !question.trim()) {
    return res.status(400).json({ success: false, error: 'projectId and question are required' });
  }

  try {
    const [projectRes, docsRes, decisionsRes, meetingsRes, tasksRes] = await Promise.all([
      query(`SELECT id, name, description FROM projects WHERE id = $1`, [projectId]),
      query(`SELECT id, title, content, category, tags FROM knowledge_documents WHERE project_id = $1`, [projectId]),
      query(`
        SELECT d.id, d.title, d.reason, d.status, m.title as meeting_title, m.meeting_date
        FROM decisions d
        LEFT JOIN meetings m ON d.meeting_id = m.id
        WHERE d.project_id = $1
      `, [projectId]),
      query(`
        SELECT id, title, meeting_date, agenda, ai_summary, discussion_points
        FROM meetings
        WHERE project_id = $1
        ORDER BY meeting_date DESC
        LIMIT 5
      `, [projectId]),
      query(`
        SELECT id, title, description, status, outcome, completion_notes
        FROM action_items
        WHERE project_id = $1 AND (status = 'Completed' OR outcome IS NOT NULL)
      `, [projectId])
    ]);

    if (projectRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const retrievedContext = {
      project: projectRes.rows[0],
      documents: docsRes.rows,
      decisions: decisionsRes.rows,
      meetings: meetingsRes.rows,
      completedTaskOutcomes: tasksRes.rows
    };

    const answer = await askProjectMemory({
      project: projectRes.rows[0],
      question: question.trim(),
      retrievedContext,
      requestId: req.id
    });

    res.json({ success: true, data: answer });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'MEMORY_QA_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      code: err.code || 'QA_FAILED',
      error: err.message || 'Failed to answer question about project memory'
    });
  }
}

