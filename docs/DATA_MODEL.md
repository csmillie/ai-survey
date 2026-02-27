# Data Model

Database: MySQL via Prisma ORM. Schema: `prisma/schema.prisma`.

## Entities

| Model | Purpose |
|-------|---------|
| `User` | Email/password auth, role (USER/ADMIN) |
| `Survey` | Survey container with title, description, soft-delete |
| `SurveyShare` | Share a survey with another user (VIEW/EDIT role) |
| `Variable` | Template variable for prompt substitution (`{{key}}`) |
| `Question` | Prompt template with mode (STATELESS/THREADED) |
| `ModelTarget` | LLM model catalog (provider, model name, cost info) |
| `SurveyRun` | Execution instance with status, settings, limits |
| `RunModel` | Junction: which models are included in a run |
| `ConversationThread` | Message history for threaded questions |
| `Job` | Queue item (type, status, payload, idempotency key) |
| `LlmResponse` | Raw + parsed LLM output, usage stats, cost |
| `AnalysisResult` | NLP analysis (sentiment, entities, flags) |
| `AuditEvent` | Audit log for user actions |

## Enums

- `UserRole`: USER, ADMIN
- `ShareRole`: VIEW, EDIT
- `QuestionMode`: STATELESS, THREADED
- `Provider`: OPENAI, ANTHROPIC, GEMINI, PERPLEXITY, COPILOT
- `RunStatus`: DRAFT, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
- `JobType`: EXECUTE_QUESTION, ANALYZE_RESPONSE, EXPORT_RUN
- `JobStatus`: PENDING, RUNNING, SUCCEEDED, FAILED, RETRYING, CANCELLED
