const CACHE_NAME = "gitmesh-agents-v2";
const API_BASE = "/api";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and API calls (API calls handled below)
  if (request.method !== "GET" && !url.pathname.startsWith(API_BASE)) {
    return;
  }

  // Handle API calls
  if (url.pathname.startsWith(API_BASE)) {
    // For approval mutation endpoints, queue when offline
    if (
      request.method === "POST" &&
      (url.pathname.includes("/approvals/") &&
        (url.pathname.endsWith("/approve") ||
          url.pathname.endsWith("/reject") ||
          url.pathname.endsWith("/request-revision")))
    ) {
      event.respondWith(handleApprovalAction(request));
      return;
    }

    // For read-only API calls, use network-first
    if (request.method === "GET") {
      event.respondWith(
        fetch(request).catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/") || new Response("Offline", { status: 503 });
          }
          return new Response(JSON.stringify({ error: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        })
      );
      return;
    }

    return;
  }

  // Network-first for static assets
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        if (request.mode === "navigate") {
          return caches.match("/") || new Response("Offline", { status: 503 });
        }
        return caches.match(request);
      })
  );
});

async function handleApprovalAction(request) {
  try {
    // Try to make the request
    const response = await fetch(request.clone());
    return response;
  } catch {
    // Network failed - check if we're truly offline or just API unreachable
    if (!navigator.onLine) {
      // Queue the action in IndexedDB via message to client
      const body = await request.clone().json();

      // Open IndexedDB and queue the action
      const db = await openOfflineDB();
      const tx = db.transaction("pending-actions", "readwrite");
      const store = tx.objectStore("pending-actions");

      const queuedAction = {
        id: crypto.randomUUID(),
        action: extractActionType(request.url),
        approvalId: extractApprovalId(request.url),
        decisionNote: body.decisionNote,
        queuedAt: Date.now(),
        retryCount: 0,
      };

      await new Promise((resolve, reject) => {
        const req = store.add(queuedAction);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      return new Response(
        JSON.stringify({ ok: true, queued: true, message: "Approval queued for sync when online" }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      );
    }

    // Online but request failed - propagate error
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

function extractActionType(url) {
  if (url.includes("/approve")) return "approve";
  if (url.includes("/reject")) return "reject";
  if (url.includes("/request-revision")) return "requestRevision";
  return "unknown";
}

function extractApprovalId(url) {
  // Extract approval ID from URL like /approvals/uuid/approve
  const parts = url.split("/");
  const approveIdx = parts.findIndex((p) => p === "approve" || p === "reject" || p === "request-revision");
  return approveIdx > 0 ? parts[approveIdx - 1] : null;
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("gitmesh-offline", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pending-actions")) {
        db.createObjectStore("pending-actions", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Listen for sync messages from the client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SYNC_APPROVALS") {
    // Client is asking to sync pending approvals
    event.waitUntil(syncPendingApprovals());
  }
});

async function syncPendingApprovals() {
  const db = await openOfflineDB();
  const tx = db.transaction("pending-actions", "readwrite");
  const store = tx.objectStore("pending-actions");

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = async () => {
      const actions = req.result;
      let synced = 0;
      let failed = 0;

      for (const action of actions) {
        try {
          const baseUrl = self.location.origin;
          let url = `${baseUrl}/api/approvals/${action.approvalId}/${action.action}`;
          const body = { decisionNote: action.decisionNote };

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            await store.delete(action.id);
            synced++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      // Notify all clients about sync completion
      const clients = await self.clients.matchAll();
      for (const client of clients) {
        client.postMessage({ type: "SYNC_COMPLETE", synced, failed });
      }

      resolve({ synced, failed });
    };
    req.onerror = () => reject(req.error);
  });
}