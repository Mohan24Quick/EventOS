# EventOS API — MVP scaffold

FastAPI modular monolith implementing the core loop:
**Event created → SOP checklist auto-generated → Vendor quoted → Quotation accepted → Vendor's SOP checklist auto-generated → everyone works off the task board.**

That last part — tasks appearing automatically because of a workflow trigger, not because someone manually created them — is the mechanic that's supposed to make this sticky. Everything else (marketplace listing, payments) can be bolted onto this skeleton.

## What's actually implemented

- **Auth**: register/login with JWT, roles (`client`, `organizer`, `vendor`, `admin`)
- **Vendors**: vendor profile + directory listing by category
- **Events**: create/list/update status, assign vendors to an event
- **Quotations**: line-item quotes tied to an event + vendor, status lifecycle
- **Tasks**: a per-event task board with status, assignee, due date
- **SOP templates**: reusable checklists (steps with day-offsets from the event date)
- **Workflow engine**: a `WorkflowTrigger` table + `emit_event()` function. The app emits events like `event.created` and `quotation.accepted`; triggers match on `event_name` and run an action (`create_tasks_from_sop`, `send_notification`, `update_event_status`). This is the extensibility point — add new triggers via the API, no code change needed for new automation rules.

## What's stubbed / not built yet (by design, for a first pass)

- Payments (Razorpay) — model exists in the plan, not wired up yet
- WhatsApp notifications — `Notification.channel` field exists, only `in_app` is implemented
- Redis caching, background job queue (workflow engine runs synchronously for now)
- Alembic migrations (using `create_all` for MVP; add Alembic before your first prod schema change)
- Web/mobile frontends — this is the API only

## Run it locally

Requires Python 3.11+ (this was built and syntax-checked against 3.12).

```bash
cd eventos
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

# Creates tables + demo users/SOPs/triggers
python -m app.seed

# Start the API
uvicorn app.main:app --reload
```

The API is now at `http://localhost:8000`. Interactive docs (try every endpoint from the browser) at **`http://localhost:8000/docs`**.

By default it uses a local `eventos.db` SQLite file — zero setup. To test against Postgres instead:

```bash
docker compose up -d db redis
# then in .env: DATABASE_URL=postgresql://eventos:eventos@localhost:5432/eventos
python -m app.seed
uvicorn app.main:app --reload
```

## Seeded demo accounts (password for all: `password123`)

| Email | Role |
|---|---|
| admin@eventos.dev | admin |
| organizer@eventos.dev | organizer |
| client@eventos.dev | client |
| vendor@eventos.dev | vendor (Sunrise Caterers, category=catering) |

Two SOP templates and three workflow triggers are seeded — see `app/seed.py` to read exactly what they do.

## Test the core loop end-to-end (copy-paste)

**1. Log in as the organizer, grab a token:**
```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=organizer@eventos.dev&password=password123" | python3 -m json.tool
```
Copy the `access_token` value into `TOKEN` below.

```bash
TOKEN="paste-token-here"
```

**2. Create a wedding event for the seeded client (id=3) — watch it auto-generate a 5-step checklist:**
```bash
curl -s -X POST http://localhost:8000/events \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Anand & Meera Wedding","event_type":"wedding","client_id":3,"organizer_id":2,"venue":"ECR Beach Resort","event_date":"2026-12-12","budget":800000}' \
  | python3 -m json.tool
```

**3. Confirm the checklist was created (no manual task entry needed):**
```bash
curl -s "http://localhost:8000/tasks?event_id=1" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
You should see 5 tasks: venue confirmation, vendor shortlist, send quotations, collect advance, headcount — each with a `due_date` computed backward from the event date.

**4. Send a quotation from the seeded vendor (id=4) for that event:**
```bash
curl -s -X POST http://localhost:8000/quotations \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"event_id":1,"vendor_id":4,"notes":"Full catering package","line_items":[{"description":"Buffet - Veg","quantity":150,"unit_price":450},{"description":"Buffet - Non-Veg","quantity":100,"unit_price":600}]}' \
  | python3 -m json.tool
```
Note the returned quotation `id`.

**5. Accept the quotation — this is the trigger moment:**
```bash
curl -s -X PATCH http://localhost:8000/quotations/1/status \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"accepted"}' | python3 -m json.tool
```

**6. Check the task board again — the vendor's catering checklist should now also be there:**
```bash
curl -s "http://localhost:8000/tasks?event_id=1" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
You should now see 8 tasks total (5 event-level + 3 catering-vendor-level), with the new ones assigned to `assignee_id: 4` (the vendor).

**7. Check the client got notified:**
```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=client@eventos.dev&password=password123" > /tmp/client_login.json
CLIENT_TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/client_login.json'))['access_token'])")
curl -s http://localhost:8000/workflow/notifications -H "Authorization: Bearer $CLIENT_TOKEN" | python3 -m json.tool
```

If step 6 shows 8 tasks and step 7 shows a notification, the whole loop — the actual product mechanic — is working.

## Adding a new automation rule (no code required)

Log in as admin and POST a new trigger, e.g. auto-move an event to "confirmed" once its quotation is accepted:
```bash
curl -s -X POST http://localhost:8000/workflow/triggers \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Confirm event on acceptance","event_name":"quotation.accepted","action_type":"update_event_status","action_config":{"status":"confirmed"}}'
```

## Project layout

```
app/
  main.py            # FastAPI app, router registration, table creation
  config.py           # env-driven settings
  database.py          # SQLAlchemy engine/session
  security.py           # JWT + password hashing + role dependency
  seed.py              # demo data
  models/              # SQLAlchemy ORM models, one file per domain concept
  schemas/             # Pydantic request/response models
  routers/              # one router per module: auth, vendors, events, quotations, tasks, sops, workflow
  services/
    workflow_engine.py   # the trigger engine — this is the extensibility point
```

This mirrors the "modular monolith" plan: each domain (events, quotations, tasks, sops, workflow) is its own model/schema/router set, sharing one FastAPI app and one database, so you can later peel a module into its own service without redesigning the domain boundaries.

## Frontend (web UI)

A no-build vanilla JS/HTML/CSS single-page app in `frontend/` — no npm, no bundler, so there's nothing that can fail to install. It talks to the API at `http://localhost:8000` (hardcoded in `frontend/api.js`, change `API_BASE` if you run the backend elsewhere).

**Design concept**: a backstage call-sheet aesthetic — every event, task, quotation, and vendor assignment reads like a cue on a stage manager's run sheet: a mono "cue number" (`EVT-0001`, `TSK-0007`) plus a colour-taped left edge marking its status, the way stage crews colour-tape their sheets. It's a working ops dashboard, not a marketing page — dense, dark, fast to scan.

### Run it

The backend must be running first (`uvicorn app.main:app --reload`), with seed data loaded (`python -m app.seed`). Then, in a second terminal:

```bash
cd frontend
python3 -m http.server 5500
```

Open **`http://localhost:5500`**. (It has to be served over `http://`, not opened directly as a `file://` path — the app uses JS modules, which browsers block from `file://`.)

Log in with any seeded account — the login screen has one-click buttons for admin / organizer / client / vendor, all using password `password123`.

### What's in it

- **Dashboard** — live-event count, open tasks, pending quotations, recent events
- **Events** — list + create form; opening an event shows tabs for **Tasks** (kanban board: todo/in progress/blocked/done, with status dropdowns), **Quotations** (line-item builder, send/accept/reject), **Vendors** (assign + confirm/decline)
- **Vendor directory** — browse registered vendors by category
- **SOP templates** — read-only view of the checklists the workflow engine uses
- **Workflow triggers** (admin) — see and create automation rules without touching backend code
- **Notifications** — what the workflow engine has sent you

### Known gap, honestly

There's no people-picker yet — creating an event or assigning a vendor asks for a raw numeric user ID (the seed data's IDs are noted right in the form: client=3, organizer=2, vendor=4). A `/users?search=` endpoint + autocomplete is the obvious next step once you're past kicking the tyres.

## Realistic next steps, in order

1. Wire Razorpay: add a `Payment` model + webhook endpoint, trigger `payment.captured` events into the same engine
2. Add Alembic migrations before your schema changes again
3. Move `emit_event` calls to a background task (FastAPI `BackgroundTasks` first, Celery/SQS later) once trigger chains get long
4. Add the WhatsApp Business API as a second `channel` in `_send_notification`
5. Build the React organizer dashboard against `/docs` — the OpenAPI schema is already there for codegen if you want typed API clients
