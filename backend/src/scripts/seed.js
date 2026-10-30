import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, exec, initDb } from '../config/db.js';
import logger from '../utils/logger.js';
import { syncProjectContextGraph } from '../services/contextRecorderService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function seedDatabase() {
  logger.info('Starting database seeding with demonstration data...');
  await initDb();

  // Clear existing demo data to allow clean re-seeding
  await exec(`
    TRUNCATE TABLE 
      context_changes,
      context_relationships,
      user_context_positions,
      context_events,
      context_branches,
      notifications,
      project_updates,
      decision_documents,
      knowledge_documents,
      handoff_acknowledgements,
      work_transfer_tasks,
      work_transfers,
      task_history,
      meeting_action_items,
      action_items,
      decisions,
      meeting_participants,
      meetings,
      project_members,
      projects,
      users
    CASCADE;
  `);

  logger.info('Cleared previous data. Inserting users...');

  // 1. Insert Users
  const userAdithya = (await query(`
    INSERT INTO users (name, email, role, avatar_url)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `, ['Adithya', 'adithya@contextflow.dev', 'Project Manager', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'])).rows[0];

  const userRahul = (await query(`
    INSERT INTO users (name, email, role, avatar_url)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `, ['Rahul', 'rahul@contextflow.dev', 'Backend Developer', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'])).rows[0];

  const userPriya = (await query(`
    INSERT INTO users (name, email, role, avatar_url)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `, ['Priya', 'priya@contextflow.dev', 'QA Engineer', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'])).rows[0];

  const userArjun = (await query(`
    INSERT INTO users (name, email, role, avatar_url)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `, ['Arjun', 'arjun@contextflow.dev', 'Frontend Developer', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'])).rows[0];

  logger.info('Users inserted. Creating projects...');

  // 2. Insert Project
  const project = (await query(`
    INSERT INTO projects (name, description, status, start_date, end_date, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `, [
    'E-Commerce Platform',
    'Next-generation headless e-commerce platform with unified checkout, multi-currency support, resilient payment gateways, and real-time inventory management.',
    'Active',
    '2026-10-01',
    '2026-12-31',
    userAdithya.id
  ])).rows[0];

  // 2b. Add Project Members
  await query(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES 
      ($1, $2, 'Project Lead'),
      ($1, $3, 'Lead Backend Engineer'),
      ($1, $4, 'QA Engineer'),
      ($1, $5, 'Frontend Engineer');
  `, [project.id, userAdithya.id, userRahul.id, userPriya.id, userArjun.id]);

  logger.info('Project and members configured. Inserting Knowledge Documents...');

  // 3. Knowledge Documents
  const docPayment = (await query(`
    INSERT INTO knowledge_documents (project_id, title, content, category, tags, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `, [
    project.id,
    'Payment Gateway Architecture & Razorpay API Guidelines',
    `# Razorpay Integration Specification

## 1. Overview
This document specifies the integration architecture for Razorpay as our primary payment provider across the E-Commerce platform.

## 2. API Endpoints
- POST \`/api/checkout/razorpay/create-order\`: Initiates order on Razorpay server and returns orderId.
- POST \`/api/checkout/razorpay/verify\`: Validates HMAC SHA-256 signature against generated signature.
- POST \`/api/webhooks/razorpay\`: Processes async payment captured, failed, and refund events.

## 3. Failure Handling & Idempotency
- All payment creation calls must supply an \`idempotency_key\` generated from \`cart_id + timestamp_bucket\`.
- In case of network failure before verification, the order enters \`Awaiting_Payment_Confirmation\` status and is re-verified via Razorpay webhook.`,
    'Architecture',
    ['payments', 'razorpay', 'api', 'backend', 'checkout'],
    userRahul.id
  ])).rows[0];

  const docAuth = (await query(`
    INSERT INTO knowledge_documents (project_id, title, content, category, tags, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `, [
    project.id,
    'Authentication & Session Security Specification',
    `# Authentication & Session Security

## 1. Authentication Strategy
ContextFlow and E-Commerce services authenticate via short-lived JWT access tokens (15-minute expiry) paired with HTTP-only, SameSite=Strict refresh cookies (7-day sliding expiry).

## 2. Role-Based Access Control (RBAC)
- **Admin / Project Manager**: Full workspace control, project settings, member management.
- **Engineer / Member**: Create and update meetings, tasks, handoffs, and knowledge base documents.
- **Auditor / Viewer**: Read-only access to audit logs, risk detector, and reports.`,
    'Security',
    ['auth', 'jwt', 'security', 'sessions'],
    userRahul.id
  ])).rows[0];

  logger.info('Knowledge documents inserted. Inserting meetings & tasks...');

  // 4. Meeting 1: Architecture & Tech Stack Alignment (2 weeks ago)
  const meeting1 = (await query(`
    INSERT INTO meetings (project_id, title, meeting_date, agenda, raw_notes, ai_summary, discussion_points, blockers, follow_up_topics, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id;
  `, [
    project.id,
    'Architecture & Tech Stack Alignment',
    '2026-10-15T10:00:00Z',
    'Discuss core tech stack, microservices vs monolith, and initial database design',
    'Discussed system architecture for the e-commerce engine. Rahul proposed using Node.js microservices with PostgreSQL. Adithya noted we need high availability. The team decided to use PostgreSQL on Supabase for the primary datastore. Arjun will create initial wireframes by October 20. Rahul will prepare database ER diagram by October 22. Database migration and backup strategy needs definition.',
    'The team aligned on using Node.js microservices with Supabase PostgreSQL for the e-commerce platform and assigned initial wireframing and database design tasks.',
    JSON.stringify(['Microservices architecture', 'Supabase PostgreSQL database', 'Design system wireframes']),
    JSON.stringify([]),
    JSON.stringify(['Review initial wireframes', 'Finalize ER diagram']),
    userAdithya.id
  ])).rows[0];

  await query(`
    INSERT INTO meeting_participants (meeting_id, user_id, attended)
    VALUES 
      ($1, $2, true),
      ($1, $3, true),
      ($1, $4, true),
      ($1, $5, true);
  `, [meeting1.id, userAdithya.id, userRahul.id, userPriya.id, userArjun.id]);

  // Decision from Meeting 1
  const decision1 = (await query(`
    INSERT INTO decisions (project_id, meeting_id, title, reason, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `, [
    project.id,
    meeting1.id,
    'Adopt PostgreSQL on Supabase as primary database',
    'High availability, relational integrity, foreign key constraints, and instant real-time capabilities.',
    'Adopted',
    userAdithya.id
  ])).rows[0];

  // Tasks from Meeting 1
  const taskArjunWireframes = (await query(`
    INSERT INTO action_items (project_id, source_meeting_id, title, description, owner_id, due_date, status, priority, completed_at, outcome, completion_notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id;
  `, [
    project.id,
    meeting1.id,
    'Create initial wireframes and design system components',
    'Design 12 core screen wireframes and setup Tailwind typography & color tokens.',
    userArjun.id,
    '2026-10-20',
    'Completed',
    'High',
    '2026-10-20T16:30:00Z',
    'Delivered full Figma design kit and exported Tailwind CSS theme configuration.',
    'All wireframes reviewed and signed off by Adithya.'
  ])).rows[0];

  await query(`
    INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward)
    VALUES ($1, $2, false);
  `, [meeting1.id, taskArjunWireframes.id]);

  await query(`
    INSERT INTO task_history (action_item_id, changed_by, change_type, old_value, new_value, notes)
    VALUES 
      ($1, $2, 'CREATED', NULL, 'Pending', 'Created during Architecture & Tech Stack Alignment meeting'),
      ($1, $3, 'STATUS_CHANGED', 'Pending', 'Completed', 'Task completed and signed off');
  `, [taskArjunWireframes.id, userAdithya.id, userArjun.id]);

  // Carried-Forward & Unassigned Task originating in Meeting 1
  const taskMigrationStrategy = (await query(`
    INSERT INTO action_items (project_id, source_meeting_id, title, description, owner_id, due_date, status, priority, carry_forward_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `, [
    project.id,
    meeting1.id,
    'Define Database Migration & Automated Backup Strategy',
    'Establish production backup schedule, automated point-in-time recovery, and zero-downtime migration protocols.',
    null, // Unassigned!
    null, // Missing deadline!
    'Pending',
    'High',
    2 // Carried forward across 2 subsequent meetings!
  ])).rows[0];

  await query(`
    INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward)
    VALUES ($1, $2, false);
  `, [meeting1.id, taskMigrationStrategy.id]);

  await query(`
    INSERT INTO task_history (action_item_id, changed_by, change_type, notes)
    VALUES ($1, $2, 'CREATED', 'Created as pending item in Meeting 1 without assigned owner');
  `, [taskMigrationStrategy.id, userAdithya.id]);

  // 5. Meeting 2: Sprint 1 Review & Checkout Flow Planning (1 week ago)
  const meeting2 = (await query(`
    INSERT INTO meetings (project_id, title, meeting_date, agenda, raw_notes, ai_summary, discussion_points, blockers, follow_up_topics, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id;
  `, [
    project.id,
    'Sprint 1 Review & Checkout Flow Planning',
    '2026-10-22T11:00:00Z',
    'Review design progress and plan checkout & payment integration',
    'Reviewed Arjun wireframes and Rahul schema. Wireframes approved. Discussed payment gateways. Rahul raised concern about Stripe processing fees in India. Team decided to evaluate Razorpay. Rahul will prepare Razorpay comparison matrix by October 25. Carried forward Database Migration Strategy from previous meeting as no one was assigned yet.',
    'Sprint 1 review concluded with wireframe sign-off and initiating payment gateway evaluation against domestic processing fees.',
    JSON.stringify(['Wireframe approval', 'Stripe vs Razorpay fee comparison', 'Unassigned migration strategy review']),
    JSON.stringify(['Awaiting payment gateway selection']),
    JSON.stringify(['Review payment gateway comparison in next meeting']),
    userAdithya.id
  ])).rows[0];

  await query(`
    INSERT INTO meeting_participants (meeting_id, user_id, attended)
    VALUES 
      ($1, $2, true),
      ($1, $3, true),
      ($1, $4, true),
      ($1, $5, true);
  `, [meeting2.id, userAdithya.id, userRahul.id, userPriya.id, userArjun.id]);

  // Link carried forward task to meeting 2
  await query(`
    INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward, discussion_notes)
    VALUES ($1, $2, true, 'Carried forward from Meeting 1; owner still unassigned');
  `, [meeting2.id, taskMigrationStrategy.id]);

  await query(`
    INSERT INTO task_history (action_item_id, changed_by, change_type, notes)
    VALUES ($1, $2, 'CARRIED_FORWARD', 'Carried forward to Meeting 2 (Sprint 1 Review)');
  `, [taskMigrationStrategy.id, userAdithya.id]);

  // Overdue Task created in Meeting 2
  const taskOverdueAuth = (await query(`
    INSERT INTO action_items (project_id, source_meeting_id, title, description, owner_id, due_date, status, priority)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `, [
    project.id,
    meeting2.id,
    'Implement User Authentication & Session Middleware',
    'Setup JWT verification, cookie handling, and route protection guards.',
    userRahul.id,
    '2026-10-26', // Overdue since current date is 2026-10-30!
    'In Progress',
    'High'
  ])).rows[0];

  await query(`
    INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward)
    VALUES ($1, $2, false);
  `, [meeting2.id, taskOverdueAuth.id]);

  await query(`
    INSERT INTO task_history (action_item_id, changed_by, change_type, old_value, new_value, notes)
    VALUES 
      ($1, $2, 'CREATED', NULL, 'Pending', 'Assigned to Rahul with deadline 2026-10-26'),
      ($1, $3, 'STATUS_CHANGED', 'Pending', 'In Progress', 'Began JWT middleware work');
  `, [taskOverdueAuth.id, userAdithya.id, userRahul.id]);

  // 6. Meeting 3: Payment Gateway Integration Discussion (Recent: 2026-10-28)
  const meeting3 = (await query(`
    INSERT INTO meetings (project_id, title, meeting_date, agenda, raw_notes, ai_summary, discussion_points, blockers, follow_up_topics, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id;
  `, [
    project.id,
    'Payment Gateway Integration Discussion',
    '2026-10-28T14:30:00Z',
    'Select payment provider, define failure handling protocols, and assign implementation tasks',
    'Discussed payment gateway integration. Rahul will complete the API integration by November 3. Priya will test payment failures. Arjun will update the payment UI by November 5. The team decided to use Razorpay instead of Stripe. Database changes are still pending. We will discuss testing progress in the next meeting.',
    'The team discussed payment gateway integration and selected Razorpay. Action items were assigned for API development, UI updates, and failure scenario testing.',
    JSON.stringify([
      'Payment gateway integration',
      'Payment failure testing',
      'Database changes',
      'Checkout UI updates'
    ]),
    JSON.stringify(['Database changes still pending']),
    JSON.stringify(['Discuss testing progress in the next meeting']),
    userAdithya.id
  ])).rows[0];

  await query(`
    INSERT INTO meeting_participants (meeting_id, user_id, attended)
    VALUES 
      ($1, $2, true),
      ($1, $3, true),
      ($1, $4, true),
      ($1, $5, true);
  `, [meeting3.id, userAdithya.id, userRahul.id, userPriya.id, userArjun.id]);

  // Link carried forward task to meeting 3!
  await query(`
    INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward, discussion_notes)
    VALUES ($1, $2, true, 'Carried forward second time from Meeting 2; needs urgent assignment');
  `, [meeting3.id, taskMigrationStrategy.id]);

  await query(`
    INSERT INTO task_history (action_item_id, changed_by, change_type, notes)
    VALUES ($1, $2, 'CARRIED_FORWARD', 'Carried forward to Meeting 3 (Payment Gateway Integration Discussion)');
  `, [taskMigrationStrategy.id, userAdithya.id]);

  // Decisions from Meeting 3
  const decisionRazorpay = (await query(`
    INSERT INTO decisions (project_id, meeting_id, title, reason, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `, [
    project.id,
    meeting3.id,
    'Use Razorpay instead of Stripe',
    'Selected during the team discussion due to lower domestic transaction fees (2% vs 3.5%) and native UPI auto-intent integration.',
    'Adopted',
    userAdithya.id
  ])).rows[0];

  const decisionFailureHandling = (await query(`
    INSERT INTO decisions (project_id, meeting_id, title, reason, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `, [
    project.id,
    meeting3.id,
    'Implement payment failure handling & asynchronous webhook recovery',
    'Ensure cart state is retained on payment drops and orders are confirmed reliably via webhooks.',
    'Adopted',
    userAdithya.id
  ])).rows[0];

  // Link Decision to Knowledge Document
  await query(`
    INSERT INTO decision_documents (decision_id, document_id)
    VALUES ($1, $2);
  `, [decisionRazorpay.id, docPayment.id]);

  // Action items from Meeting 3 (As requested in prompt!)
  const taskRahulRazorpay = (await query(`
    INSERT INTO action_items (project_id, source_meeting_id, title, description, owner_id, due_date, status, priority)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `, [
    project.id,
    meeting3.id,
    'Complete Razorpay API integration',
    'Implement server-side order creation endpoint and HMAC SHA-256 webhook signature verification.',
    userRahul.id,
    '2026-11-03',
    'In Progress',
    'High'
  ])).rows[0];

  const taskPriyaTesting = (await query(`
    INSERT INTO action_items (project_id, source_meeting_id, title, description, owner_id, due_date, status, priority)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `, [
    project.id,
    meeting3.id,
    'Test payment failures and webhook edge cases',
    'Validate failure scenarios, payment drops, network timeout recovery, and duplicate webhook idempotency.',
    userPriya.id,
    null, // Due date null as explicitly specified in example structured output!
    'Pending',
    'High'
  ])).rows[0];

  const taskArjunPaymentUI = (await query(`
    INSERT INTO action_items (project_id, source_meeting_id, title, description, owner_id, due_date, status, priority)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `, [
    project.id,
    meeting3.id,
    'Update the payment UI with Razorpay Checkout modal',
    'Integrate Razorpay standard checkout script into React payment review step and display UPI QR options.',
    userArjun.id,
    '2026-11-05',
    'Pending',
    'Medium'
  ])).rows[0];

  await query(`
    INSERT INTO meeting_action_items (meeting_id, action_item_id, is_carried_forward)
    VALUES 
      ($1, $2, false),
      ($1, $3, false),
      ($1, $4, false);
  `, [meeting3.id, taskRahulRazorpay.id, taskPriyaTesting.id, taskArjunPaymentUI.id]);

  await query(`
    INSERT INTO task_history (action_item_id, changed_by, change_type, notes)
    VALUES 
      ($1, $4, 'CREATED', 'Created from Payment Gateway Integration Discussion notes'),
      ($2, $4, 'CREATED', 'Created from Payment Gateway Integration Discussion notes (no due date set)'),
      ($3, $4, 'CREATED', 'Created from Payment Gateway Integration Discussion notes');
  `, [taskRahulRazorpay.id, taskPriyaTesting.id, taskArjunPaymentUI.id, userAdithya.id]);

  logger.info('Meetings, decisions, and tasks inserted. Creating Work Transfer...');

  // 7. Work Transfer / Handoff
  const transfer = (await query(`
    INSERT INTO work_transfers (
      project_id, previous_owner_id, new_owner_id, 
      reason_for_transfer, current_progress, additional_notes, 
      ai_handoff_brief, status, transfer_date
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `, [
    project.id,
    userRahul.id, // Previous owner: Rahul
    userArjun.id, // New owner: Arjun
    'Scheduled medical leave during sprint critical path; transferring API coordination to Arjun.',
    'Razorpay order creation endpoint is 70% complete in branch feat/razorpay-core. Webhook handler skeleton is written; needs signature verification unit tests.',
    'Refer to knowledge doc "Payment Gateway Architecture & Razorpay API Guidelines" for the HMAC verification algorithm. Test credentials are in backend .env.',
    `### AI Handoff Brief: Payment API Implementation
- **What was previously being worked on**: Rahul started the backend endpoints for Razorpay integration under branch \`feat/razorpay-core\`.
- **What has already been completed**: The \`/create-order\` endpoint is working with test keys.
- **What remains unfinished**: Webhook signature verification and the \`Complete Razorpay API integration\` task due on Nov 3.
- **Which decisions should not be forgotten**: Team decided to use Razorpay over Stripe due to lower processing fees and native UPI support.
- **First steps for Arjun**: Pull branch \`feat/razorpay-core\`, verify local tests, and review Document "Payment Gateway Architecture & Razorpay API Guidelines".`,
    'Pending Acknowledgement',
    '2026-10-29T16:00:00Z'
  ])).rows[0];

  // Link transfer to task
  await query(`
    INSERT INTO work_transfer_tasks (work_transfer_id, action_item_id)
    VALUES ($1, $2);
  `, [transfer.id, taskRahulRazorpay.id]);

  // Insert Project Updates / Milestones for Git-style Lineage Graph
  await query(`
    INSERT INTO project_updates (project_id, author_id, title, summary, update_type, created_at)
    VALUES 
      ($1, $2, 'Sprint 1 Architecture Sign-off', 'Core tech stack and Supabase PostgreSQL schema aligned across all leads.', 'milestone', '2026-10-18T14:00:00Z'),
      ($1, $3, 'Frontend Design System & Wireframes Merged', '12 core UI screens approved and Tailwind color tokens pushed to main repository branch.', 'status_update', '2026-10-21T17:00:00Z'),
      ($1, $4, 'Razorpay Test Sandbox Credentials Provisioned', 'Webhook test listeners configured for local testing in feat/razorpay-core branch.', 'milestone', '2026-10-27T12:00:00Z'),
      ($1, $5, 'Checkout Failure Test Matrix Drafted', 'QA matrix drafted covering payment drops, network retries, and duplicate webhook webhooks.', 'status_update', '2026-10-29T10:00:00Z');
  `, [project.id, userAdithya.id, userArjun.id, userRahul.id, userPriya.id]);

  // Insert notification for Arjun
  await query(`
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES ($1, $2, $3, $4, $5);
  `, [
    userArjun.id,
    'New Work Transfer Pending Review',
    'Rahul initiated a work transfer for "Complete Razorpay API integration". Please review and acknowledge.',
    'warning',
    `/work-transfers/${transfer.id}`
  ]);

  // Automatically build and synchronize Git-style Context Lineage Graph
  logger.info('Synchronizing Git-style context events, branches, and user positions...');
  await syncProjectContextGraph(project.id);

  logger.info('Demonstration workspace seeded successfully with real relational records!');
}

// Run if invoked directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error(err, 'Seeding script error');
      process.exit(1);
    });
}

