// ============================================================
// EventOS frontend — API client
// Talks to the FastAPI backend at API_BASE. Token kept in memory
// only (no localStorage) — refresh the page and you'll need to
// log in again, which is fine for local testing.
// ============================================================

const API_BASE = "http://localhost:8001";

export const state = {
  token: null,
  user: null, // {id, name, email, role}
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, form = false, auth = true } = {}) {
  const headers = {};
  if (auth && state.token) headers["Authorization"] = `Bearer ${state.token}`;

  let payload = undefined;
  if (body !== undefined) {
    if (form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      payload = new URLSearchParams(body).toString();
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch (e) {
    throw new ApiError(
      `Can't reach the API at ${API_BASE}. Is the backend running? (uvicorn app.main:app --reload)`,
      0
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errBody = await res.json();
      detail = errBody.detail || detail;
    } catch (_) {}
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { username: email, password }, form: true, auth: false }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),

  vendors: (category) => request(`/vendors${category ? `?category=${encodeURIComponent(category)}` : ""}`),

  events: () => request("/events"),
  event: (id) => request(`/events/${id}`),
  createEvent: (payload) => request("/events", { method: "POST", body: payload }),
  updateEventStatus: (id, status) => request(`/events/${id}/status`, { method: "PATCH", body: { status } }),
  eventVendors: (id) => request(`/events/${id}/vendors`),
  assignVendor: (id, payload) => request(`/events/${id}/vendors`, { method: "POST", body: payload }),
  updateVendorAssignment: (eventId, assignmentId, status) =>
    request(`/events/${eventId}/vendors/${assignmentId}`, { method: "PATCH", body: { status } }),

  quotations: (eventId) => request(`/quotations${eventId ? `?event_id=${eventId}` : ""}`),
  createQuotation: (payload) => request("/quotations", { method: "POST", body: payload }),
  updateQuotationStatus: (id, status) => request(`/quotations/${id}/status`, { method: "PATCH", body: { status } }),

  tasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? `?${qs}` : ""}`);
  },
  createTask: (payload) => request("/tasks", { method: "POST", body: payload }),
  updateTaskStatus: (id, status) => request(`/tasks/${id}/status`, { method: "PATCH", body: { status } }),

  sops: (category) => request(`/sops${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  createSop: (payload) => request("/sops", { method: "POST", body: payload }),

  triggers: () => request("/workflow/triggers"),
  createTrigger: (payload) => request("/workflow/triggers", { method: "POST", body: payload }),

  notifications: () => request("/workflow/notifications"),
};

export { ApiError, API_BASE };
