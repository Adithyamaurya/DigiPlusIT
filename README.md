# WorkTrace
> *"Organizational Memory & Knowledge Transfer — Never lose the context behind your team's work."*

WorkTrace is an enterprise-grade AI-powered organizational memory and knowledge continuity platform. It captures meeting discussions and decisions, provides a **Git-style visual context lineage graph**, transfers context between team members with an automated **pre-handoff Knowledge Gap Detector**, carries forward action items without identity loss, and enables source-linked project memory interrogation.

---

## 1. Problem Statement & Mission

Modern software teams frequently lose critical context and momentum when:
1. **Employees miss meetings** and rely on scattered, incomplete, or verbal hearsay.
2. **Team members change responsibilities or go on leave**, abandoning in-flight tasks without operational background.
3. **Decisions are scattered** across Slack, meeting notes, or personal memories without explicit architectural rationales.
4. **Action items are forgotten** after meetings because pending items are not systematically carried forward.
5. **Handoffs occur prematurely** without auditing whether prerequisites, blockers, or credentials have been documented.
6. **New hires join the team** lacking historical knowledge on why previous design choices were made.

### The Five Core Continuity Questions WorkTrace Answers:
1. **What happened?** (Verbatim meeting transcripts and AI executive synthesis)
2. **What was decided?** (Adopted decisions with explicit rationale and linked architectural specifications)
3. **Who is responsible?** (Unambiguous individual ownership without assumed assignments)
4. **What is still pending?** (Carry-forward of unfinished work across meetings with zero row duplication)
5. **What does the next person need to know?** (Pre-handoff Knowledge Gap Audit and role-tailored onboarding briefs)

---

## 2. Git-Style Context Lineage Graph

WorkTrace introduces a visual **Context Lineage Graph** inspired by the Git commit tree:
- **Visual Branching & Merging**: Every project has a visual graph showing its chronological history of meetings, updates, decisions, tasks, and work transfers.
- **Member Swimlanes**: Parallel lanes represent team members' active workstreams, with a `main` timeline anchoring release milestones and architectural consensus.
- **Handoff Transition Bridges**: Direct connected lines between member lanes represent responsibilities transferring from one owner to another.
- **"My Context Journey" Filter**: Any team member can isolate their personal context timeline: where they joined, which information they received, what tasks they completed, and what state they left behind.
- **Interactive Node Drawer**: Clicking any node opens a slide-over panel displaying the full record, associated decisions, linked action items, and source documents.

```mermaid
flowchart LR
    subgraph MainBranch["Main Architecture & Consensus (main)"]
        M1["Meeting: Sprint Kickoff"]
        D1["Decision: PostgreSQL + Stripe v3"]
        M2["Meeting: API Review"]
        U1["Milestone: v1.0 Backend Released"]
    end

    subgraph RahulLane["Rahul (Backend Lead)"]
        T1["Task: Auth Middleware"]
        WT1["Handoff Initiated: API Gateway"]
    end

    subgraph ArjunLane["Arjun (Frontend Engineer)"]
        T2["Task: Checkout UI"]
        WT2["Handoff Accepted: API Gateway"]
        T3["Task: Stripe Webhooks"]
    end

    M1 --> D1
    D1 --> M2
    M2 --> U1

    M1 -.->|Assigned| T1
    M1 -.->|Assigned| T2

    T1 --> WT1
    WT1 ==>|Handoff Bridge| WT2
    WT2 --> T3
    T3 -.->|Merges Context| U1
```

---

## 3. Pre-Handoff Knowledge Gap Detector

Before a work transfer is finalized, the **Knowledge Gap Detector** runs a deterministic 6-point audit on the project context:

| # | Knowledge Audit Criterion | Verified Conditions | Penalty |
|---|---|---|:---:|
| 1 | **Active Responsibilities Documented** | Progress statement contains substantive explanation (>20 chars) | -20 pts |
| 2 | **Tasks Have Assigned Owners & Deadlines** | 100% of transferred deliverables have explicit target completion dates | -20 pts |
| 3 | **Decisions Have Sufficient Context** | All project decisions record explicit rationales | -15 pts |
| 4 | **Blockers & Dependencies Explained** | Unresolved blockers from recent meetings are addressed in handoff notes | -15 pts |
| 5 | **Relevant Documents Linked & Available** | At least 1 architectural specification or API guide is attached | -15 pts |
| 6 | **Recent Project Updates Available** | Meeting records or project updates exist within the last 14 days | -15 pts |

- **Completeness Score (0 - 100%)**:
  - `80% - 100%`: **Ready for Acceptance** (Green badge)
  - `50% - 79%`: **Attention Required** (Amber warning with actionable recommendations)
  - `0% - 49%`: **Critical Knowledge Gap** (Red alert preventing blind sign-offs)

```mermaid
sequenceDiagram
    autonumber
    actor PreviousOwner as Previous Owner (Rahul)
    participant WT as Work Transfers API
    participant GapDetector as Knowledge Gap Detector
    actor NewOwner as New Owner (Arjun)

    PreviousOwner->>WT: Initiate Handoff (Tasks + Notes)
    WT->>GapDetector: Run 6-Point Deterministic Audit
    GapDetector-->>WT: Completeness Score: 80% (1 Blocker Warning)
    WT-->>NewOwner: Notify Pending Transfer + Audit Gate
    NewOwner->>WT: Inspect Knowledge Gap Audit & Recommendations
    Note over NewOwner: Reviews missing blocker notes & linked docs
    NewOwner->>WT: Sign Off & Acknowledge Transfer
    WT->>WT: Reassign Action Items & Append Task History
```

---

## 4. Interactive AI Project Memory (Q&A)

WorkTrace enables team members to ask questions about previous project discussions, architecture constraints, and ownership:
- **Source Attribution**: Every synthesized answer links to the specific meeting, decision, task outcome, or knowledge document.
- **Three-Tier Semantic Transparency**:
  1. **Confirmed Facts**: Explicitly verified database statements.
  2. **Inferred Points**: Deductions made by the model based on documented context.
  3. **Missing / Unknown**: Explicitly states when requested information is absent from team records.

---

## 5. System Architecture

WorkTrace is structured as a decoupled, production-grade web application following clean architecture:

```mermaid
flowchart TD
    subgraph Frontend["Frontend (React 18 + Vite + Tailwind CSS)"]
        DashboardUI[SaaS Dashboard]
        GraphView[Interactive Context Lineage Graph]
        GapAuditUI[Knowledge Gap Detector Panel]
        MemoryQAUI[Ask Project Memory Q&A]
        OnboardingUI[New Member Onboarding Kit]
        AxiosClient[Axios Client + X-Request-ID Header]
    end

    subgraph Backend["Backend (Node.js + Express.js REST API)"]
        Middleware[Correlation ID + Pino HTTP Structured Logger]
        Routes[API Routes: Projects, Meetings, Transfers, Tasks, Docs, AI]
        
        subgraph Services["Core Domain Services"]
            GraphEngine[Context Graph Engine]
            GapEngine[Knowledge Gap Detector]
            AISvc[Gemini AI Service with Cascading Model Fallback]
            RiskEngine[Context Risk Evaluator]
        end

        subgraph Validation["Validation Layer"]
            ZodValidators[Zod Schemas: Q&A, Onboarding, Handoff, Meeting]
        end
    end

    subgraph Persistence["Persistence Layer (PostgreSQL)"]
        Supabase[(Supabase / PGlite Local Engine)]
        AuditLog[(Immutable Task History & Carry-Forward Relations)]
        FileLog[(Structured JSON File Logs: backend/logs/app.log)]
    end

    subgraph AIProvider["Google Gemini Cloud"]
        Gemini[Gemini 3.5 Flash / 3.8 Flash / Flash Latest]
    end

    Frontend -->|HTTP / REST| Middleware
    Middleware --> Routes
    Routes --> Validation
    Validation --> Services
    Services --> Supabase
    Services --> AuditLog
    AISvc -->|JSON Mode Prompts| Gemini
    Middleware --> FileLog
```

---

## 6. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite | High-performance SPA with fast client routing |
| **Styling** | Tailwind CSS | Clean SaaS design system inspired by Linear and Notion |
| **Icons** | Lucide React | Consistent, lightweight iconography |
| **Visual Graph** | Custom SVG + Tailwind CSS | Interactive Git-style context lineage graph with swimlanes |
| **Charts** | Recharts | Real-time task distribution and health metrics |
| **HTTP Client** | Axios | Request interceptors, error handling, correlation ID tracking |
| **Backend** | Node.js, Express.js | Scalable REST API architecture |
| **Database** | PostgreSQL (Supabase compatible) | Relational integrity, foreign keys, UUIDs, transactions |
| **Local DB Engine** | PGlite (Wasm Postgres) | Zero-configuration local disk persistence when remote DB is unset |
| **AI Integration** | Google Gemini API (`@google/generative-ai`) | Multi-model fallback across `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-flash-latest` |
| **Schema Validation**| Zod | Strict runtime validation of AI JSON responses and request payloads |
| **Logging** | Pino & Pino-HTTP | Structured JSON logs written to file with unique correlation IDs |

---

## 7. Database Migrations

Database migrations are located in `backend/migrations/` and run sequentially:
1. `001_initial_schema.sql`: Core 15 relational tables (`users`, `projects`, `project_members`, `meetings`, `meeting_participants`, `decisions`, `action_items`, `meeting_action_items`, `task_history`, `work_transfers`, `work_transfer_tasks`, `handoff_acknowledgements`, `knowledge_documents`, `decision_documents`, `notifications`).
2. `002_project_updates.sql`: `project_updates` table for project milestones, release tags, and team status announcements.
3. `003_context_graph_tables.sql`: Dedicated user-wise Git-style context graph tables (`context_branches`, `context_events`, `user_context_positions`, `context_relationships`, `context_changes`) with Supabase Row Level Security (RLS) policies.

---

## 8. User-Wise Git-Style Context Position & Diff Engine

WorkTrace provides every authenticated member with an individualized view of the same underlying project timeline:
- **Personalized Context Position**: Highlighted with a distinct **"📍 YOUR LAST-KNOWN CONTEXT"** marker on the graph.
- **Context Gap Banner**: When team updates occur while a member is away, WorkTrace detects the gap, highlights all missed nodes with an amber **"⚡ MISSED CONTEXT UPDATE"** tag, and surfaces:
  - 🔍 **"Review What Changed (Diff View)"**: Compares baseline context with latest project state across decisions, deliverables, handoffs, and blockers.
  - ✓ **"Mark as Acknowledged / Sync Position"**: Updates `user_context_positions` persistently in Supabase.
- **One-Click Persona Switcher**: In the header, test and demonstrate how Rahul (who stopped at an older context point) sees 15 missed updates, while Adithya and Arjun are fully caught up.

---

## 9. Structured Application Logging & Correlation IDs

Structured JSON logging is implemented with **Pino** and **Pino-HTTP**:
1. Every incoming HTTP request is assigned a unique UUID `x-request-id` correlation ID.
2. The correlation ID is propagated across all log lines and returned in response headers (`X-Request-ID`).
3. Logs are streamed to `backend/logs/app.log` (JSON format) and pretty-printed to the console during development.
4. AI operations log request ID, operation name, latency in milliseconds, success/failure status, and sanitized error categories.
5. Sensitive secrets (API keys, passwords, cookies) are automatically redacted.

---

## 9. Setup & Installation Instructions

### Prerequisites
- Node.js **v18+** (Tested on v24)
- npm **v9+**

### Step 1: Clone Repository & Configure Environment
```bash
git clone <repo-url>
cd contextflow
```

Configure backend environment variables:
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development
LOG_LEVEL=info

# Supabase PostgreSQL (Optional; defaults to persistent local PGlite PostgreSQL if unset)
DATABASE_URL=postgres://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DB_SSL=true

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

### Step 2: Install Dependencies
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
cd ..
```

### Step 3: Run Database Migrations
Runs all SQL migration scripts in `backend/migrations/`:
```bash
node backend/src/scripts/migrate.js
```

### Step 4: Populate Demonstration Workspace (Seed Data)
Seeds the **E-Commerce Platform** workspace with team members (Adithya, Rahul, Priya, Arjun), historical meetings, Razorpay decisions, overdue tasks, unassigned items, milestone updates, and an active work transfer:
```bash
node backend/src/scripts/seed.js
```

### Step 5: Verify All Capabilities
Run the automated system test suite and context graph engine tests:
```bash
node backend/src/scripts/testWorkTrace.js
node backend/src/scripts/testContextGraph.js
```

### Step 6: Start Backend and Frontend
In terminal 1 (Backend):
```bash
cd backend
npm run dev
```
*Backend runs on `http://localhost:5000`.*

In terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 10. Assumptions & Known Limitations

### Assumptions
- AI model outputs follow structured JSON syntax requested via Google Gen AI system instructions and JSON mode.
- Users authenticate via workplace identity; persona switching is exposed in the top navigation bar for effortless testing of handoff sign-offs across multiple employees.

### Known Limitations
- Knowledge Base initially supports text and Markdown entry; binary PDF attachment parsing can be enabled via multer.
- Gemini API availability is subject to Google Cloud quotas; cascading fallback across `gemini-3.5-flash`, `gemini-3.5-flash-lite`, and deterministic rules ensure the UI remains fully operational even during network or quota failures.

---

## 11. License

MIT License. Built for seamless team continuity and organizational memory.
