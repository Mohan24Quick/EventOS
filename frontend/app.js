import { api, state, ApiError } from "./api.js";

const root = document.getElementById("app");

// ---------------- helpers ----------------

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

function cue(prefix, id) {
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

function statusPill(status) {
  return `<span class="status-pill s-${status}"><span class="dot"></span>${esc(status).replace(/_/g, " ")}</span>`;
}

function toast(message, isError = false) {
  const el = document.createElement("div");
  el.className = "toast";
  if (isError) el.style.borderColor = "var(--status-blocked)";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function go(hash) {
  window.location.hash = hash;
}

async function guarded(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      state.token = null;
      state.user = null;
      go("#/login");
      toast("Session expired — please log in again.", true);
      return null;
    }
    toast(e.message || "Something went wrong", true);
    throw e;
  }
}

// ---------------- shell ----------------

const NAV = [
  { group: "Overview", items: [{ hash: "#/dashboard", label: "Dashboard" }] },
  {
    group: "Operations",
    items: [
      { hash: "#/events", label: "Events" },
      { hash: "#/vendors", label: "Vendor directory" },
    ],
  },
  {
    group: "Playbook",
    items: [
      { hash: "#/sops", label: "SOP templates" },
      { hash: "#/triggers", label: "Workflow triggers", roles: ["admin"] },
    ],
  },
];

async function renderShell(activeHash, contentHtml, afterMount) {
  let notifCount = 0;
  try {
    const n = await api.notifications();
    notifCount = n.filter((x) => !x.is_read).length;
  } catch (_) {}

  const navHtml = NAV.map((group) => {
    const items = group.items.filter((i) => !i.roles || i.roles.includes(state.user.role));
    if (!items.length) return "";
    return `
      <div class="nav-group">
        <div class="nav-label">${esc(group.group)}</div>
        ${items
          .map(
            (i) => `<button class="nav-item ${activeHash.startsWith(i.hash) ? "active" : ""}" data-nav="${i.hash}">
              <span class="dot"></span>${esc(i.label)}
            </button>`
          )
          .join("")}
      </div>`;
  }).join("");

  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="mark"></span><span class="name">Bro'sEvent</span></div>
        <div style="display:flex;flex-direction:column;gap:20px;">${navHtml}</div>
        <div class="sidebar-foot">
          <div class="who">${esc(state.user.name)}</div>
          <div class="role-chip">${esc(state.user.role)}</div>
          <div><button class="logout-btn" id="logoutBtn">LOG OUT</button></div>
        </div>
      </aside>
      <div class="main">
        <div class="topbar">
          <h1 id="pageTitle"></h1>
          <button class="bell-btn" data-nav="#/notifications" title="Notifications">
            ●
            ${notifCount ? `<span class="bell-badge">${notifCount}</span>` : ""}
          </button>
        </div>
        <div class="content" id="content">${contentHtml}</div>
      </div>
    </div>
  `;

  root.querySelectorAll("[data-nav]").forEach((el) =>
    el.addEventListener("click", () => go(el.dataset.nav))
  );
  document.getElementById("logoutBtn").addEventListener("click", () => {
    state.token = null;
    state.user = null;
    go("#/login");
  });

  if (afterMount) afterMount();
}

function setTitle(t) {
  const el = document.getElementById("pageTitle");
  if (el) el.textContent = t;
}

// ---------------- login view ----------------

const QUICK_LOGINS = [
  { label: "Admin", email: "admin@eventos.dev" },
  { label: "Organizer", email: "organizer@eventos.dev" },
  { label: "Client", email: "client@eventos.dev" },
  { label: "Vendor", email: "vendor@eventos.dev" },
];

function renderLogin(errorMsg) {
  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand"><span class="mark"></span><span class="name">Bro'sEvent</span></div>
        <div class="login-tag">Run sheet for your event business.</div>
        ${errorMsg ? `<div class="error-banner">${esc(errorMsg)}</div>` : ""}
        <form id="loginForm">
          <div class="field">
            <label>Email</label>
            <input type="email" name="email" required value="organizer@eventos.dev" />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" required value="password123" />
          </div>
          <button class="btn btn-accent" type="submit" style="width:100%;" id="loginBtn">Log in</button>
        </form>
        <div class="quick-logins">
          ${QUICK_LOGINS.map((q) => `<button class="quick-chip" data-email="${q.email}">${q.label}</button>`).join("")}
        </div>
        <div style="margin-top:16px;font-size:11.5px;" class="dim">
          Seeded demo accounts, password <span class="mono">password123</span> for all. Run <span class="mono">python -m app.seed</span> on the backend first.
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll(".quick-chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      root.querySelector('input[name="email"]').value = btn.dataset.email;
      root.querySelector('input[name="password"]').value = "password123";
    })
  );

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "Logging in…";
    const fd = new FormData(e.target);
    try {
      const data = await api.login(fd.get("email"), fd.get("password"));
      state.token = data.access_token;
      state.user = data.user;
      go("#/dashboard");
      render();
    } catch (err) {
      renderLogin(err.message || "Login failed");
    }
  });
}

// ---------------- dashboard ----------------

async function viewDashboard() {
  setTitle("Dashboard");
  const content = document.getElementById("content");
  content.innerHTML = `<div class="loading">Loading run sheet…</div>`;

  const [events, tasks, quotations] = await Promise.all([
    guarded(() => api.events()),
    guarded(() => api.tasks()),
    guarded(() => api.quotations()),
  ]);
  if (!events) return;

  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const pendingQuotes = quotations.filter((q) => q.status === "sent" || q.status === "draft").length;
  const liveEvents = events.filter((e) => !["completed", "cancelled"].includes(e.status)).length;

  const recentEvents = [...events].sort((a, b) => b.id - a.id).slice(0, 5);

  content.innerHTML = `
    <div class="grid-stats">
      <div class="stat-card"><div class="num">${liveEvents}</div><div class="label">Live events</div></div>
      <div class="stat-card"><div class="num">${openTasks}</div><div class="label">Open tasks</div></div>
      <div class="stat-card"><div class="num">${pendingQuotes}</div><div class="label">Quotations pending</div></div>
      <div class="stat-card"><div class="num">${events.length}</div><div class="label">Total events</div></div>
    </div>
    <h2 class="section-title">Recent events</h2>
    <div class="list" id="recentEvents"></div>
  `;

  const list = document.getElementById("recentEvents");
  if (!recentEvents.length) {
    list.innerHTML = emptyState("No events yet", "Create your first event to see the checklist engine kick in.");
  } else {
    list.innerHTML = recentEvents.map(eventCardHtml).join("");
    wireEventCards(list);
  }
}

function emptyState(big, small) {
  return `<div class="empty-state"><div class="big">${esc(big)}</div>${esc(small)}</div>`;
}

const TAPE = {
  todo: "var(--status-todo)", draft: "var(--status-todo)", invited: "var(--status-todo)",
  planning: "var(--status-progress)", sent: "var(--status-progress)", in_progress: "var(--status-progress)",
  blocked: "var(--status-blocked)", cancelled: "var(--status-blocked)", declined: "var(--status-blocked)", rejected: "var(--status-blocked)", expired: "var(--status-blocked)",
  done: "var(--status-done)", completed: "var(--status-done)", confirmed: "var(--status-done)", accepted: "var(--status-done)",
};

function eventCardHtml(ev) {
  return `
    <div class="tape-card" style="--tape:${TAPE[ev.status] || TAPE.todo}" data-event-id="${ev.id}">
      <div class="spread">
        <div>
          <div class="cue">${cue("EVT", ev.id)}</div>
          <div style="font-weight:600;font-size:14.5px;margin-top:2px;">${esc(ev.title)}</div>
          <div class="muted" style="font-size:12.5px;margin-top:3px;">${esc(ev.event_type)} · ${fmtDate(ev.event_date)} · ${esc(ev.venue || "venue TBC")}</div>
        </div>
        <div style="text-align:right;">
          ${statusPill(ev.status)}
          <div class="mono muted" style="font-size:11.5px;margin-top:8px;">${money(ev.budget)}</div>
        </div>
      </div>
    </div>`;
}

function wireEventCards(container) {
  container.querySelectorAll("[data-event-id]").forEach((el) =>
    el.addEventListener("click", () => go(`#/events/${el.dataset.eventId}`))
  );
}

// ---------------- events list ----------------

async function viewEvents() {
  setTitle("Events");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="spread" style="margin-bottom:16px;">
      <div class="muted" style="font-size:13px;">Every event auto-generates its checklist the moment it's created.</div>
      <button class="btn btn-accent btn-sm" id="newEventBtn">+ New event</button>
    </div>
    <div class="panel" id="newEventPanel" style="display:none;margin-bottom:20px;"></div>
    <div class="list" id="eventsList"><div class="loading">Loading…</div></div>
  `;

  document.getElementById("newEventBtn").addEventListener("click", () => {
    const panel = document.getElementById("newEventPanel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    panel.innerHTML = newEventFormHtml();
    wireNewEventForm(panel);
  });

  const events = await guarded(() => api.events());
  if (!events) return;
  const listEl = document.getElementById("eventsList");
  if (!events.length) {
    listEl.innerHTML = emptyState("No events yet", "Use \u201c+ New event\u201d to create one.");
    return;
  }
  listEl.innerHTML = [...events].sort((a, b) => b.id - a.id).map(eventCardHtml).join("");
  wireEventCards(listEl);
}

function newEventFormHtml() {
  return `
    <div class="section-title" style="font-size:13px;">New event</div>
    <form id="newEventForm">
      <div class="field-row">
        <div class="field"><label>Title</label><input name="title" required placeholder="Anand &amp; Meera Wedding" /></div>
        <div class="field"><label>Event type</label><input name="event_type" required placeholder="wedding / corporate / birthday" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Client user ID</label><input name="client_id" type="number" required placeholder="e.g. 3" /></div>
        <div class="field"><label>Organizer user ID</label><input name="organizer_id" type="number" placeholder="e.g. 2" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Event date</label><input name="event_date" type="date" required /></div>
        <div class="field"><label>Budget (₹)</label><input name="budget" type="number" min="0" placeholder="800000" /></div>
      </div>
      <div class="field"><label>Venue</label><input name="venue" placeholder="ECR Beach Resort" /></div>
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:6px;">
        <button type="submit" class="btn btn-accent btn-sm">Create event</button>
      </div>
      <div class="dim" style="font-size:11px;margin-top:10px;">
        User IDs come from the seed data for now (client=3, organizer=2, vendor=4) — a proper people-picker is the next thing to wire up.
      </div>
    </form>
  `;
}

function wireNewEventForm(panel) {
  panel.querySelector("#newEventForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      title: fd.get("title"),
      event_type: fd.get("event_type"),
      client_id: Number(fd.get("client_id")),
      organizer_id: fd.get("organizer_id") ? Number(fd.get("organizer_id")) : null,
      event_date: fd.get("event_date"),
      venue: fd.get("venue") || "",
      budget: fd.get("budget") ? Number(fd.get("budget")) : 0,
    };
    const created = await guarded(() => api.createEvent(payload));
    if (!created) return;
    toast(`Event ${cue("EVT", created.id)} created — checklist generated.`);
    go(`#/events/${created.id}`);
    render();
  });
}

// ---------------- event detail ----------------

async function viewEventDetail(id, tab = "tasks") {
  const content = document.getElementById("content");
  content.innerHTML = `<div class="loading">Loading event…</div>`;

  const ev = await guarded(() => api.event(id));
  if (!ev) return;
  setTitle(ev.title);

  content.innerHTML = `
    <div class="panel" style="margin-bottom:20px;">
      <div class="spread">
        <div>
          <div class="cue">${cue("EVT", ev.id)}</div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:20px;margin-top:2px;">${esc(ev.title)}</div>
          <div class="muted" style="font-size:13px;margin-top:4px;">${esc(ev.event_type)} · ${fmtDate(ev.event_date)} · ${esc(ev.venue || "venue TBC")} · ${money(ev.budget)}</div>
        </div>
        <div class="row">
          ${statusPill(ev.status)}
          <select id="statusSelect" class="mono" style="width:auto;">
            ${["draft", "planning", "confirmed", "in_progress", "completed", "cancelled"]
              .map((s) => `<option value="${s}" ${s === ev.status ? "selected" : ""}>${s.replace("_", " ")}</option>`)
              .join("")}
          </select>
        </div>
      </div>
    </div>
    <div class="tabs">
      <button class="tab ${tab === "tasks" ? "active" : ""}" data-tab="tasks">Tasks</button>
      <button class="tab ${tab === "quotations" ? "active" : ""}" data-tab="quotations">Quotations</button>
      <button class="tab ${tab === "vendors" ? "active" : ""}" data-tab="vendors">Vendors</button>
    </div>
    <div id="tabContent"><div class="loading">Loading…</div></div>
  `;

  document.getElementById("statusSelect").addEventListener("change", async (e) => {
    const updated = await guarded(() => api.updateEventStatus(ev.id, e.target.value));
    if (updated) toast(`Event status → ${e.target.value}`);
  });

  content.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      window.location.hash = `#/events/${id}/${t.dataset.tab}`;
    })
  );

  if (tab === "tasks") await renderEventTasks(ev);
  else if (tab === "quotations") await renderEventQuotations(ev);
  else await renderEventVendors(ev);
}

async function renderEventTasks(ev) {
  const tabContent = document.getElementById("tabContent");
  const tasks = await guarded(() => api.tasks({ event_id: ev.id }));
  if (!tasks) return;

  const columns = [
    { key: "todo", label: "To do" },
    { key: "in_progress", label: "In progress" },
    { key: "blocked", label: "Blocked" },
    { key: "done", label: "Done" },
  ];

  tabContent.innerHTML = `
    <div class="spread" style="margin-bottom:14px;">
      <div class="muted" style="font-size:13px;">${tasks.length} task${tasks.length === 1 ? "" : "s"} — generated by SOP triggers and added manually.</div>
      <button class="btn btn-sm" id="addTaskBtn">+ Add task</button>
    </div>
    <div class="panel" id="addTaskPanel" style="display:none;margin-bottom:16px;">
      <form id="addTaskForm">
        <div class="field"><label>Title</label><input name="title" required /></div>
        <div class="field-row">
          <div class="field"><label>Assignee user ID</label><input name="assignee_id" type="number" /></div>
          <div class="field"><label>Due date</label><input name="due_date" type="date" /></div>
        </div>
        <button class="btn btn-accent btn-sm" type="submit">Add task</button>
      </form>
    </div>
    <div class="kanban">
      ${columns
        .map(
          (c) => `
        <div class="kanban-col">
          <h4>${c.label}<span>${tasks.filter((t) => t.status === c.key).length}</span></h4>
          <div data-col="${c.key}"></div>
        </div>`
        )
        .join("")}
    </div>
  `;

  document.getElementById("addTaskBtn").addEventListener("click", () => {
    const p = document.getElementById("addTaskPanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
  });
  document.getElementById("addTaskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      event_id: ev.id,
      title: fd.get("title"),
      assignee_id: fd.get("assignee_id") ? Number(fd.get("assignee_id")) : null,
      due_date: fd.get("due_date") || null,
    };
    const t = await guarded(() => api.createTask(payload));
    if (t) { toast("Task added"); await renderEventTasks(ev); }
  });

  for (const c of columns) {
    const colEl = tabContent.querySelector(`[data-col="${c.key}"]`);
    const colTasks = tasks.filter((t) => t.status === c.key).sort((a, b) => a.order - b.order);
    if (!colTasks.length) {
      colEl.innerHTML = `<div class="dim" style="font-size:11.5px;">Nothing here</div>`;
      continue;
    }
    colEl.innerHTML = colTasks
      .map(
        (t) => `
      <div class="kanban-card" style="--tape:${TAPE[t.status]}">
        <div class="cue" style="font-size:10px;">${cue("TSK", t.id)}</div>
        <div class="t">${esc(t.title)}</div>
        <div class="dim" style="font-size:11px;">
          ${t.assignee_id ? `assignee #${t.assignee_id}` : "unassigned"} ${t.due_date ? "· due " + fmtDate(t.due_date) : ""}
        </div>
        <select data-task-id="${t.id}">
          ${columns.map((cc) => `<option value="${cc.key}" ${cc.key === t.status ? "selected" : ""}>${cc.label}</option>`).join("")}
        </select>
      </div>`
      )
      .join("");
  }

  tabContent.querySelectorAll("select[data-task-id]").forEach((sel) =>
    sel.addEventListener("change", async () => {
      const updated = await guarded(() => api.updateTaskStatus(sel.dataset.taskId, sel.value));
      if (updated) { toast(`${cue("TSK", updated.id)} → ${sel.value}`); await renderEventTasks(ev); }
    })
  );
}

async function renderEventQuotations(ev) {
  const tabContent = document.getElementById("tabContent");
  const quotations = await guarded(() => api.quotations(ev.id));
  if (!quotations) return;

  tabContent.innerHTML = `
    <div class="spread" style="margin-bottom:14px;">
      <div class="muted" style="font-size:13px;">${quotations.length} quotation${quotations.length === 1 ? "" : "s"}</div>
      <button class="btn btn-sm" id="addQuoteBtn">+ New quotation</button>
    </div>
    <div class="panel" id="addQuotePanel" style="display:none;margin-bottom:16px;"></div>
    <div class="list" id="quoteList"></div>
  `;

  document.getElementById("addQuoteBtn").addEventListener("click", () => {
    const p = document.getElementById("addQuotePanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
    p.innerHTML = quoteFormHtml();
    wireQuoteForm(p, ev);
  });

  const listEl = document.getElementById("quoteList");
  if (!quotations.length) {
    listEl.innerHTML = emptyState("No quotations yet", "Create one to send pricing to a vendor for this event.");
    return;
  }
  listEl.innerHTML = quotations
    .map(
      (q) => `
    <div class="tape-card" style="--tape:${TAPE[q.status]};cursor:default;">
      <div class="spread">
        <div>
          <div class="cue">${cue("QUO", q.id)}</div>
          <div style="font-weight:600;font-size:14px;margin-top:2px;">Vendor #${q.vendor_id} · ${money(q.total_amount)}</div>
          <div class="muted" style="font-size:12px;margin-top:3px;">${q.line_items.length} line item${q.line_items.length === 1 ? "" : "s"} ${q.notes ? "· " + esc(q.notes) : ""}</div>
        </div>
        <div style="text-align:right;">
          ${statusPill(q.status)}
          ${
            q.status === "draft" || q.status === "sent"
              ? `<div class="row" style="justify-content:flex-end;margin-top:8px;gap:6px;">
                  ${q.status === "draft" ? `<button class="btn btn-sm" data-q-action="sent" data-q-id="${q.id}">Mark sent</button>` : ""}
                  <button class="btn btn-accent btn-sm" data-q-action="accepted" data-q-id="${q.id}">Accept</button>
                  <button class="btn btn-sm" data-q-action="rejected" data-q-id="${q.id}">Reject</button>
                </div>`
              : ""
          }
        </div>
      </div>
    </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-q-action]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const updated = await guarded(() => api.updateQuotationStatus(btn.dataset.qId, btn.dataset.qAction));
      if (updated) {
        toast(`${cue("QUO", updated.id)} → ${btn.dataset.qAction}` + (btn.dataset.qAction === "accepted" ? " — vendor checklist generated." : ""));
        await renderEventQuotations(ev);
      }
    })
  );
}

function quoteFormHtml() {
  return `
    <div class="section-title" style="font-size:13px;">New quotation</div>
    <form id="quoteForm">
      <div class="field"><label>Vendor user ID</label><input name="vendor_id" type="number" required placeholder="e.g. 4" /></div>
      <div id="lineItems"></div>
      <button type="button" class="btn btn-ghost btn-sm" id="addLineBtn">+ Add line item</button>
      <div class="field" style="margin-top:14px;"><label>Notes</label><input name="notes" placeholder="Full catering package" /></div>
      <div class="row" style="justify-content:flex-end;margin-top:6px;">
        <button type="submit" class="btn btn-accent btn-sm">Save quotation</button>
      </div>
    </form>
  `;
}

function lineItemRowHtml() {
  return `
    <div class="line-item-row">
      <div><label>Description</label><input name="desc" required placeholder="Buffet - Veg" /></div>
      <div><label>Qty</label><input name="qty" type="number" min="1" value="1" required /></div>
      <div><label>Unit ₹</label><input name="price" type="number" min="0" required /></div>
      <button type="button" class="btn btn-ghost btn-sm" data-remove-line style="height:37px;">×</button>
    </div>`;
}

function wireQuoteForm(panel, ev) {
  const lineItemsEl = panel.querySelector("#lineItems");
  const addLine = () => {
    const wrap = document.createElement("div");
    wrap.innerHTML = lineItemRowHtml();
    const rowEl = wrap.firstElementChild;
    rowEl.querySelector("[data-remove-line]").addEventListener("click", () => rowEl.remove());
    lineItemsEl.appendChild(rowEl);
  };
  addLine();
  panel.querySelector("#addLineBtn").addEventListener("click", addLine);

  panel.querySelector("#quoteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rows = [...lineItemsEl.querySelectorAll(".line-item-row")];
    const line_items = rows.map((r) => ({
      description: r.querySelector('[name="desc"]').value,
      quantity: Number(r.querySelector('[name="qty"]').value),
      unit_price: Number(r.querySelector('[name="price"]').value),
    }));
    if (!line_items.length) { toast("Add at least one line item", true); return; }
    const payload = { event_id: ev.id, vendor_id: Number(fd.get("vendor_id")), notes: fd.get("notes") || "", line_items };
    const created = await guarded(() => api.createQuotation(payload));
    if (created) { toast(`${cue("QUO", created.id)} created`); await renderEventQuotations(ev); }
  });
}

async function renderEventVendors(ev) {
  const tabContent = document.getElementById("tabContent");
  const assignments = await guarded(() => api.eventVendors(ev.id));
  if (!assignments) return;

  tabContent.innerHTML = `
    <div class="spread" style="margin-bottom:14px;">
      <div class="muted" style="font-size:13px;">${assignments.length} vendor${assignments.length === 1 ? "" : "s"} on this event</div>
      <button class="btn btn-sm" id="assignVendorBtn">+ Assign vendor</button>
    </div>
    <div class="panel" id="assignVendorPanel" style="display:none;margin-bottom:16px;">
      <form id="assignVendorForm">
        <div class="field-row">
          <div class="field"><label>Vendor user ID</label><input name="vendor_id" type="number" required placeholder="e.g. 4" /></div>
          <div class="field"><label>Category</label><input name="category" required placeholder="catering" /></div>
        </div>
        <button class="btn btn-accent btn-sm" type="submit">Assign</button>
      </form>
    </div>
    <div class="list" id="assignList"></div>
  `;

  document.getElementById("assignVendorBtn").addEventListener("click", () => {
    const p = document.getElementById("assignVendorPanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
  });
  document.getElementById("assignVendorForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const created = await guarded(() =>
      api.assignVendor(ev.id, { vendor_id: Number(fd.get("vendor_id")), category: fd.get("category") })
    );
    if (created) { toast("Vendor assigned"); await renderEventVendors(ev); }
  });

  const listEl = document.getElementById("assignList");
  if (!assignments.length) {
    listEl.innerHTML = emptyState("No vendors assigned", "Assign a vendor and send them a quotation next.");
    return;
  }
  listEl.innerHTML = assignments
    .map(
      (a) => `
    <div class="tape-card" style="--tape:${TAPE[a.status]};cursor:default;">
      <div class="spread">
        <div>
          <div class="cue">${cue("ASG", a.id)}</div>
          <div style="font-weight:600;font-size:14px;margin-top:2px;">Vendor #${a.vendor_id} · ${esc(a.category)}</div>
        </div>
        <div style="text-align:right;">
          ${statusPill(a.status)}
          <select data-asg-id="${a.id}" class="mono" style="width:auto;margin-top:8px;">
            ${["invited", "confirmed", "declined", "removed"].map((s) => `<option value="${s}" ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-asg-id]").forEach((sel) =>
    sel.addEventListener("change", async () => {
      const updated = await guarded(() => api.updateVendorAssignment(ev.id, sel.dataset.asgId, sel.value));
      if (updated) { toast("Vendor status updated"); await renderEventVendors(ev); }
    })
  );
}

// ---------------- vendor directory ----------------

async function viewVendors() {
  setTitle("Vendor directory");
  const content = document.getElementById("content");
  content.innerHTML = `<div class="loading">Loading vendors…</div>`;
  const vendors = await guarded(() => api.vendors());
  if (!vendors) return;

  if (!vendors.length) {
    content.innerHTML = emptyState("No vendors yet", "Vendors appear here once they register with the vendor role.");
    return;
  }

  content.innerHTML = `<div class="list">${vendors
    .map(
      (v) => `
    <div class="tape-card" style="--tape:${v.is_verified ? "var(--status-done)" : "var(--status-todo)"};cursor:default;">
      <div class="spread">
        <div>
          <div class="cue">USR-${String(v.user_id).padStart(4, "0")}</div>
          <div style="font-weight:600;font-size:14.5px;margin-top:2px;">${esc(v.business_name)}</div>
          <div class="muted" style="font-size:12.5px;margin-top:3px;">${esc(v.category)} · ${esc(v.service_areas || "service area not set")} · ${esc(v.email)}</div>
        </div>
        <div style="text-align:right;">
          <span class="status-pill ${v.is_verified ? "s-confirmed" : "s-todo"}"><span class="dot"></span>${v.is_verified ? "verified" : "unverified"}</span>
          <div class="mono muted" style="font-size:11.5px;margin-top:8px;">★ ${v.rating.toFixed(1)}</div>
        </div>
      </div>
    </div>`
    )
    .join("")}</div>`;
}

// ---------------- SOP templates ----------------

async function viewSops() {
  setTitle("SOP templates");
  const content = document.getElementById("content");
  content.innerHTML = `<div class="loading">Loading SOP templates…</div>`;
  const sops = await guarded(() => api.sops());
  if (!sops) return;

  if (!sops.length) {
    content.innerHTML = emptyState("No SOP templates yet", "These are the checklists the workflow engine uses to auto-generate tasks.");
    return;
  }

  content.innerHTML = `
    <div class="muted" style="font-size:13px;margin-bottom:16px;">
      These checklists get copied into an event's task board automatically when a workflow trigger fires — see Workflow triggers.
    </div>
    <div class="list">
      ${sops
        .map(
          (s) => `
      <div class="panel">
        <div class="spread" style="margin-bottom:10px;">
          <div>
            <div class="cue">SOP-${String(s.id).padStart(4, "0")}</div>
            <div style="font-weight:600;font-size:15px;margin-top:2px;">${esc(s.name)}</div>
            <div class="muted" style="font-size:12.5px;">category: <span class="mono">${esc(s.category)}</span> ${s.description ? "· " + esc(s.description) : ""}</div>
          </div>
        </div>
        <div class="hairline"></div>
        <div class="list">
          ${s.steps
            .map(
              (step) => `
            <div class="row" style="font-size:13px;">
              <span class="mono dim" style="width:26px;">${step.order}.</span>
              <span style="flex:1;">${esc(step.title)}</span>
              <span class="dim mono" style="font-size:11px;">T-${step.days_before_event}d</span>
              <span class="role-chip" style="margin-top:0;">${esc(step.default_assignee_role)}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>`
        )
        .join("")}
    </div>
  `;
}

// ---------------- workflow triggers (admin) ----------------

async function viewTriggers() {
  setTitle("Workflow triggers");
  const content = document.getElementById("content");
  content.innerHTML = `<div class="loading">Loading triggers…</div>`;
  const triggers = await guarded(() => api.triggers());
  if (!triggers) return;

  content.innerHTML = `
    <div class="spread" style="margin-bottom:16px;">
      <div class="muted" style="font-size:13px;max-width:520px;">
        Rules the engine checks whenever something happens (event created, quotation accepted, task status changed). Add one without touching backend code.
      </div>
      <button class="btn btn-accent btn-sm" id="newTriggerBtn">+ New trigger</button>
    </div>
    <div class="panel" id="newTriggerPanel" style="display:none;margin-bottom:20px;">${newTriggerFormHtml()}</div>
    <div class="list">${triggers.map(triggerRowHtml).join("")}</div>
  `;

  document.getElementById("newTriggerBtn").addEventListener("click", () => {
    const p = document.getElementById("newTriggerPanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
  });
  wireTriggerForm();
}

function triggerRowHtml(t) {
  return `
    <div class="tape-card" style="--tape:${t.is_active ? "var(--status-done)" : "var(--status-todo)"};cursor:default;">
      <div class="spread">
        <div>
          <div class="cue">${cue("WFT", t.id)}</div>
          <div style="font-weight:600;font-size:14px;margin-top:2px;">${esc(t.name)}</div>
          <div class="muted mono" style="font-size:12px;margin-top:4px;">on <b>${esc(t.event_name)}</b> → ${esc(t.action_type)}</div>
          <div class="dim mono" style="font-size:11px;margin-top:4px;">${esc(JSON.stringify(t.action_config))}</div>
        </div>
        <span class="status-pill ${t.is_active ? "s-confirmed" : "s-todo"}"><span class="dot"></span>${t.is_active ? "active" : "inactive"}</span>
      </div>
    </div>`;
}

function newTriggerFormHtml() {
  return `
    <div class="section-title" style="font-size:13px;">New workflow trigger</div>
    <form id="triggerForm">
      <div class="field"><label>Name</label><input name="name" required placeholder="Confirm event on acceptance" /></div>
      <div class="field-row">
        <div class="field">
          <label>Fires on event</label>
          <select name="event_name">
            <option value="event.created">event.created</option>
            <option value="quotation.accepted">quotation.accepted</option>
            <option value="task.status_changed">task.status_changed</option>
          </select>
        </div>
        <div class="field">
          <label>Action</label>
          <select name="action_type" id="actionTypeSelect">
            <option value="create_tasks_from_sop">create_tasks_from_sop</option>
            <option value="send_notification">send_notification</option>
            <option value="update_event_status">update_event_status</option>
          </select>
        </div>
      </div>
      <div class="field" id="configField">
        <label>SOP category</label>
        <input name="config_value" placeholder="catering" />
      </div>
      <button type="submit" class="btn btn-accent btn-sm">Create trigger</button>
    </form>
  `;
}

function wireTriggerForm() {
  const form = document.getElementById("triggerForm");
  if (!form) return;
  const actionSelect = document.getElementById("actionTypeSelect");
  const configField = document.getElementById("configField");

  const configHints = {
    create_tasks_from_sop: { label: "SOP category", placeholder: "catering", key: "sop_category" },
    send_notification: { label: "Message", placeholder: "Your vendor has been confirmed.", key: "message" },
    update_event_status: { label: "New event status", placeholder: "confirmed", key: "status" },
  };

  const applyHint = () => {
    const hint = configHints[actionSelect.value];
    configField.innerHTML = `<label>${hint.label}</label><input name="config_value" placeholder="${hint.placeholder}" />`;
  };
  applyHint();
  actionSelect.addEventListener("change", applyHint);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const hint = configHints[fd.get("action_type")];
    const payload = {
      name: fd.get("name"),
      event_name: fd.get("event_name"),
      action_type: fd.get("action_type"),
      action_config: { [hint.key]: fd.get("config_value") },
    };
    const created = await guarded(() => api.createTrigger(payload));
    if (created) { toast("Trigger created"); await viewTriggers(); }
  });
}

// ---------------- notifications ----------------

async function viewNotifications() {
  setTitle("Notifications");
  const content = document.getElementById("content");
  content.innerHTML = `<div class="loading">Loading…</div>`;
  const notifs = await guarded(() => api.notifications());
  if (!notifs) return;

  if (!notifs.length) {
    content.innerHTML = emptyState("No notifications", "The workflow engine posts here — e.g. when a vendor confirms a booking.");
    return;
  }

  content.innerHTML = `<div class="list">${notifs
    .map(
      (n) => `
    <div class="tape-card" style="--tape:${n.is_read ? "var(--status-todo)" : "var(--status-progress)"};cursor:default;">
      <div class="spread">
        <div style="font-size:13.5px;">${esc(n.message)}</div>
        <span class="role-chip" style="margin-top:0;">${esc(n.channel)}</span>
      </div>
    </div>`
    )
    .join("")}</div>`;
}

// ---------------- router ----------------

async function render() {
  const hash = window.location.hash || "#/dashboard";

  if (!state.token) {
    if (hash !== "#/login") { window.location.hash = "#/login"; return; }
    renderLogin();
    return;
  }
  if (hash === "#/login") { window.location.hash = "#/dashboard"; return; }

  const parts = hash.replace(/^#\//, "").split("/");

  await renderShell(hash, `<div class="loading">Loading…</div>`);

  if (parts[0] === "dashboard") await viewDashboard();
  else if (parts[0] === "events" && parts[1]) await viewEventDetail(parts[1], parts[2] || "tasks");
  else if (parts[0] === "events") await viewEvents();
  else if (parts[0] === "vendors") await viewVendors();
  else if (parts[0] === "sops") await viewSops();
  else if (parts[0] === "triggers") await viewTriggers();
  else if (parts[0] === "notifications") await viewNotifications();
  else await viewDashboard();
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", render);
