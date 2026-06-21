// Wails Runtime replacement for web mode
// Translates Wails EventsEmit/EventsOn/EventsOff to HTTP/SSE

const API_BASE = '';  // Same origin

// SSE connection
let eventSource: EventSource | null = null;
const listeners = new Map<string, Set<(...args: any[]) => void>>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnected = false;

function connectSSE() {
  if (eventSource?.readyState === EventSource.OPEN || eventSource?.readyState === EventSource.CONNECTING) {
    return;
  }

  eventSource = new EventSource(`${API_BASE}/api/events`);

  eventSource.onopen = () => {
    isConnected = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  eventSource.onmessage = (event) => {
    // Handle unnamed events
    dispatchEvent('message', event.data);
  };

  eventSource.onerror = () => {
    isConnected = false;
    eventSource?.close();
    // Reconnect after delay
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSSE();
      }, 3000);
    }
  };

  // Handle named events
  eventSource.addEventListener('backend:allRequests', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:requestDetails', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:scopeLists', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:fetchSettings', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:updateSettings', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:domains', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:Sitemap', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:requestsByEndpoint', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:allRules', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:ruleAdded', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:ruleDeleted', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:allMatchReplaceRules', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:matchReplaceRuleAdded', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:matchReplaceRuleDeleted', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:matchReplaceRuleUpdated', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:chatContexts', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:chatMessages', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:receiveMessage', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:chatContextCreated', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:chatContextDeleted', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:chatContextNameUpdated', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:error', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:interceptionToggled', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:interceptionState', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:newInteraction', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:domain', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:registrationStatus', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:registrationError', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:listProjects', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:switchProject', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:clearState', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:trafficData', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:logs', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:currentVersion', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('pluginsLoaded', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('pluginSaved', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('pluginUpdated', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('pluginDeleted', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:FuzzerTabs', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:FuzzerResult', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:FuzzerFinished', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:FuzzerProgress', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:resenderTabs', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:resenderRequest', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:resenderResponse', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('backend:requestTimeout', (e: MessageEvent) => dispatchEvent(e.type, e.data));
  eventSource.addEventListener('app:requestApproval', (e: MessageEvent) => dispatchEvent(e.type, e.data));
}

function dispatchEvent(eventName: string, rawData: string) {
  let data: any;
  try {
    data = JSON.parse(rawData);
  } catch {
    data = rawData;
  }

  const handlers = listeners.get(eventName);
  if (handlers) {
    handlers.forEach(fn => {
      try {
        fn(data);
      } catch (err) {
        console.error(`Error in handler for ${eventName}:`, err);
      }
    });
  }
}

export function EventsEmit(eventName: string, ...args: any[]) {
  const data = args.length <= 1 ? args[0] : args;

  // Map frontend events to HTTP API calls
  switch (eventName) {
    case 'frontend:getAllRequests': {
      const params = data || {};
      const qs = new URLSearchParams({
        page: String(params.page || 1),
        limit: String(params.limit || 50),
        sortKey: params.sortKey || 'id',
        sortDirection: params.sortDirection || 'descending',
        search: params.searchQuery || '',
      }).toString();
      fetch(`${API_BASE}/api/requests?${qs}`)
        .then(r => r.json())
        .then(result => {
          // Emit back through the same channel
          const event = new CustomEvent('backend:allRequests', { detail: result });
          window.dispatchEvent(event);
          // Also dispatch to SSE listeners
          const handlers = listeners.get('backend:allRequests');
          if (handlers) {
            handlers.forEach(fn => fn(result));
          }
        })
        .catch(err => console.error('Failed to fetch requests:', err));
      break;
    }

    case 'frontend:getRequestByID': {
      const id = typeof data === 'object' ? String(data) : String(data);
      fetch(`${API_BASE}/api/requests/${id}`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:requestDetails');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to fetch request details:', err));
      break;
    }

    case 'frontend:getScopeLists': {
      fetch(`${API_BASE}/api/scope`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:scopeLists');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to fetch scope:', err));
      break;
    }

    case 'frontend:updateInScopeList': {
      const list = Array.isArray(data) ? data : [];
      fetch(`${API_BASE}/api/scope`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inScope: list }),
      })
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:scopeLists');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to update scope:', err));
      break;
    }

    case 'frontend:updateOutOfScopeList': {
      const list = Array.isArray(data) ? data : [];
      fetch(`${API_BASE}/api/scope`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outOfScope: list }),
      })
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:scopeLists');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to update scope:', err));
      break;
    }

    case 'frontend:fetchSettings': {
      fetch(`${API_BASE}/api/settings`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:fetchSettings');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to fetch settings:', err));
      break;
    }

    case 'frontend:updateSettings': {
      fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      })
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:updateSettings');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to update settings:', err));
      break;
    }

    case 'frontend:getDomains': {
      fetch(`${API_BASE}/api/sitemap/domains`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:domains');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to fetch domains:', err));
      break;
    }

    case 'frontend:getSiteMap': {
      const domain = typeof data === 'string' ? data : '';
      fetch(`${API_BASE}/api/sitemap/${encodeURIComponent(domain)}`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:Sitemap');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to fetch sitemap:', err));
      break;
    }

    case 'frontend:getRequestsByEndpoint': {
      const [domain, path] = Array.isArray(data) ? data : ['', ''];
      fetch(`${API_BASE}/api/sitemap/${encodeURIComponent(domain)}?path=${encodeURIComponent(path)}`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:requestsByEndpoint');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to fetch requests by endpoint:', err));
      break;
    }

    case 'frontend:getAllRules': {
      fetch(`${API_BASE}/api/rules`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:allRules');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to fetch rules:', err));
      break;
    }

    case 'frontend:getAllMatchReplaceRules': {
      fetch(`${API_BASE}/api/match-replace`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:allMatchReplaceRules');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to fetch MR rules:', err));
      break;
    }

    case 'frontend:addRule': {
      fetch(`${API_BASE}/api/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      })
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:ruleAdded');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to add rule:', err));
      break;
    }

    case 'frontend:deleteRule': {
      const id = typeof data === 'number' ? data : 0;
      fetch(`${API_BASE}/api/rules?id=${id}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:ruleDeleted');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to delete rule:', err));
      break;
    }

    case 'frontend:addMatchReplaceRule': {
      fetch(`${API_BASE}/api/match-replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      })
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:matchReplaceRuleAdded');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to add MR rule:', err));
      break;
    }

    case 'frontend:deleteMatchReplaceRule': {
      const id = typeof data === 'number' ? data : 0;
      fetch(`${API_BASE}/api/match-replace?id=${id}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:matchReplaceRuleDeleted');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to delete MR rule:', err));
      break;
    }

    case 'frontend:updateMatchReplaceRule': {
      fetch(`${API_BASE}/api/match-replace`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      })
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('backend:matchReplaceRuleUpdated');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to update MR rule:', err));
      break;
    }

    case 'frontend:loadPlugins': {
      fetch(`${API_BASE}/api/plugins`)
        .then(r => r.json())
        .then(result => {
          const handlers = listeners.get('pluginsLoaded');
          if (handlers) handlers.forEach(fn => fn(result));
        })
        .catch(err => console.error('Failed to load plugins:', err));
      break;
    }

    // For events that don't have dedicated endpoints yet,
    // post to a generic event bridge
    default: {
      fetch(`${API_BASE}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventName, data }),
      }).catch(err => console.error(`Event ${eventName} failed:`, err));
      break;
    }
  }
}

export function EventsOn(eventName: string, callback: (...args: any[]) => void) {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName)!.add(callback);

  // Connect SSE on first listener
  if (!eventSource) {
    connectSSE();
  }
}

export function EventsOff(eventName: string, ...callbacks: any[]) {
  if (callbacks.length > 0) {
    const handlers = listeners.get(eventName);
    if (handlers) {
      callbacks.forEach(cb => handlers.delete(cb));
    }
  } else {
    listeners.delete(eventName);
  }
}

export function EventsOnce(eventName: string, callback: (...args: any[]) => void) {
  const wrapper = (...args: any[]) => {
    callback(...args);
    EventsOff(eventName, wrapper);
  };
  EventsOn(eventName, wrapper);
}

export function BrowserOpenURL(url: string) {
  window.open(url, '_blank');
}

export function WindowExecJS(_js: string) {
  // No-op in web mode
}
