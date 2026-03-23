type AppRuntimeWindow = Window & {
  __APP_TRACE_USER_ID__?: string;
  __APP_TRACE_META_ATTRIBUTES__?: Record<string, string>;
};

export function setTraceUserId(userId: string): void {
  const runtimeWindow = window as AppRuntimeWindow;
  runtimeWindow.__APP_TRACE_USER_ID__ = userId.trim();
}

export function getTraceUserId(): string {
  const runtimeWindow = window as AppRuntimeWindow;
  return (runtimeWindow.__APP_TRACE_USER_ID__ ?? '').trim();
}

export function setTraceMetaAttributes(attributes: Record<string, string>): void {
  const runtimeWindow = window as AppRuntimeWindow;
  runtimeWindow.__APP_TRACE_META_ATTRIBUTES__ = { ...attributes };
}

export function getTraceMetaAttributes(): Record<string, string> {
  const runtimeWindow = window as AppRuntimeWindow;
  return runtimeWindow.__APP_TRACE_META_ATTRIBUTES__ ?? {};
}
