const DEBUG_FLAG = "blue-earth-debug-events";

type EventLike = Event | null | undefined;

export function isEventDebugEnabled() {
  return window.localStorage.getItem(DEBUG_FLAG) === "true";
}

export function enableEventDebugLogging() {
  window.localStorage.setItem(DEBUG_FLAG, "true");
  console.info("[blue-earth][debug] Event logging enabled");
}

export function disableEventDebugLogging() {
  window.localStorage.removeItem(DEBUG_FLAG);
  console.info("[blue-earth][debug] Event logging disabled");
}

export function exposeEventDebugControls() {
  Object.assign(window, {
    enableBlueEarthEventDebug: enableEventDebugLogging,
    disableBlueEarthEventDebug: disableEventDebugLogging,
  });
}

export function logEvent(label: string, event: EventLike, details: Record<string, unknown> = {}) {
  if (isEventDebugEnabled() === false || event === null || event === undefined) {
    return;
  }

  const target = describeTarget(event.target);
  const currentTarget =
    event.currentTarget instanceof Element
      ? describeElement(event.currentTarget)
      : describeTarget(event.currentTarget);

  console.log(`[blue-earth][event] ${label}`, {
    type: event.type,
    eventPhase: event.eventPhase,
    defaultPrevented: event.defaultPrevented,
    cancelBubble: event.cancelBubble,
    target,
    currentTarget,
    ...details,
  });
}

export function logDebug(label: string, details: Record<string, unknown> = {}) {
  if (isEventDebugEnabled() === false) {
    return;
  }

  console.log(`[blue-earth][debug] ${label}`, details);
}

function describeElement(element: Element) {
  const id = element.id ? `#${element.id}` : "";
  const className =
    typeof element.className === "string" && element.className.trim()
      ? `.${element.className.trim().split(/\s+/).join(".")}`
      : "";

  return `${element.tagName.toLowerCase()}${id}${className}`;
}

function describeTarget(target: EventTarget | null) {
  if (target === null) {
    return "null";
  }

  if (target instanceof Element) {
    return describeElement(target);
  }

  if (target === window) {
    return "window";
  }

  if (target === document) {
    return "document";
  }

  return Object.prototype.toString.call(target);
}

declare global {
  interface Window {
    enableBlueEarthEventDebug?: () => void;
    disableBlueEarthEventDebug?: () => void;
  }
}
