const KEY = "hellokiyo_events_v1";

export function track(eventName, props = {}) {
  const evt = {
    eventName,
    props,
    at: new Date().toISOString(),
  };
  try {
    const cur = load();
    cur.push(evt);
    localStorage.setItem(KEY, JSON.stringify(cur.slice(-500)));
  } catch {
    // ignore storage failures
  }
  // For MVP visibility.
  // eslint-disable-next-line no-console
  console.log("[hk]", eventName, props);
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

