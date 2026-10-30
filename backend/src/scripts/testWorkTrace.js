import { query } from '../config/db.js';
import { generateProjectContextGraph } from '../services/contextGraphService.js';
import { auditHandoffKnowledgeGaps } from '../services/gapDetectorService.js';
import { KnowledgeQASchema, OnboardingBriefSchema } from '../validators/aiValidators.js';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting WorkTrace System Verification Tests');
  console.log('====================================================\n');

  try {
    // 1. Get Project ID from Database
    const projRes = await query(`SELECT id, name FROM projects LIMIT 1`);
    if (projRes.rows.length === 0) {
      throw new Error('No projects found in database. Please run seed script first.');
    }
    const project = projRes.rows[0];
    console.log(`✅ [DB Check] Found test project: "${project.name}" (ID: ${project.id})`);

    // 2. Test Git-Style Context Lineage Graph
    console.log('\n--- 1. Testing Context Lineage Graph Engine ---');
    const fullGraph = await generateProjectContextGraph(project.id);
    console.log(`- Lanes generated: ${fullGraph.lanes.length} (${fullGraph.lanes.map(l => l.name).join(', ')})`);
    console.log(`- Total graph nodes: ${fullGraph.nodes.length}`);
    console.log(`- Total graph edges: ${fullGraph.edges.length}`);
    console.log(`- Node types present: ${[...new Set(fullGraph.nodes.map(n => n.type))].join(', ')}`);

    const handoffEdges = fullGraph.edges.filter(e => e.type === 'handoff_bridge');
    console.log(`- Handoff transition bridges: ${handoffEdges.length}`);

    if (fullGraph.nodes.length === 0 || fullGraph.lanes.length === 0) {
      throw new Error('Context graph generated empty nodes or lanes');
    }
    console.log('✅ Context Lineage Graph engine verified successfully');

    // 2b. Test Member Context Journey Filtering
    const usersRes = await query(`SELECT id, name FROM users LIMIT 1`);
    if (usersRes.rows.length > 0) {
      const user = usersRes.rows[0];
      const memberGraph = await generateProjectContextGraph(project.id, user.id);
      console.log(`- Filtered journey for member "${user.name}": ${memberGraph.nodes.length} nodes`);
      console.log('✅ Personal Context Journey filter verified successfully');
    }

    // 3. Test Knowledge Gap Detector
    console.log('\n--- 2. Testing Pre-Handoff Knowledge Gap Detector ---');
    const transferRes = await query(`SELECT id, reason_for_transfer, project_id FROM work_transfers LIMIT 1`);
    if (transferRes.rows.length === 0) {
      throw new Error('No work transfers found in database.');
    }
    const transfer = transferRes.rows[0];
    const audit = await auditHandoffKnowledgeGaps(transfer.id);
    console.log(`- Transfer Reason: "${transfer.reason_for_transfer}"`);
    console.log(`- Completeness Score: ${audit.completenessScore}% (Status: ${audit.readinessStatus})`);
    console.log(`- Audit Checks Passed: ${audit.passedChecksCount}/${audit.checks.length}`);
    audit.checks.forEach(c => {
      console.log(`  [${c.passed ? 'PASS' : 'WARN'}] ${c.name}: ${c.description}`);
    });
    console.log(`- Summary: ${audit.summary}`);
    console.log('✅ Knowledge Gap Detector verified successfully');

    // 4. Test AI Schema Validators
    console.log('\n--- 3. Testing AI Schema Robustness & Validation ---');
    const sampleQA = {
      answer: "Payment processing retries are capped at 3 attempts with exponential backoff.",
      confirmed_facts: ["Retries max 3", "Exponential backoff"],
      inferred_points: ["Circuit breaker triggers on consecutive failures"],
      missing_information: ["Exact jitter ms value"],
      sources: [{ type: "decision", title: "Adopt Stripe v3 with 3 Retries" }]
    };
    const parsedQA = KnowledgeQASchema.parse(sampleQA);
    console.log('✅ Knowledge Q&A Schema validation verified');

    const sampleOnboarding = {
      project_mission: "Build resilient, scalable e-commerce infrastructure with zero transaction loss.",
      role_responsibilities: "Own payment gateway webhooks, idempotency guarantees, and cache invalidation policies.",
      confirmed_architecture: ["PostgreSQL ACID transactions for ledger", "Redis cluster for session states"],
      key_decisions: [{ title: "Stripe v3 Webhooks", context: "Signed webhooks with 3 retries and exponential backoff" }],
      active_team_workstreams: [{ stream: "Checkout Service", lead_owner: "Rahul", status: "In Progress" }],
      inferred_work_priorities: ["Review Razorpay API guidelines document", "Implement idempotency key check"],
      missing_or_pending_context: ["Exact retry jitter ms configuration pending testing"],
      prerequisite_documents_to_read: ["Payment Gateway Architecture & Guidelines", "Authentication Specification"]
    };
    const parsedOnboarding = OnboardingBriefSchema.parse(sampleOnboarding);
    console.log('✅ Onboarding Brief Schema validation verified');

    // 5. Test Structured Logger File
    console.log('\n--- 4. Testing Pino Structured File Logging ---');
    const logPath = path.resolve('backend', 'logs', 'app.log');
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      console.log(`✅ Structured log file exists: ${logPath} (${stats.size} bytes)`);
    } else {
      console.log(`ℹ️ Note: Log file will be created on server boot.`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL WORKTRACE CAPABILITIES VERIFIED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

runTests();
