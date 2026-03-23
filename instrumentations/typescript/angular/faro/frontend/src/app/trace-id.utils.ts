import { HttpHeaders } from '@angular/common/http';

const TRACE_NOT_AVAILABLE = 'não informado';

function normalizeHeaderName(headerName: string): string {
  return headerName.trim().toUpperCase();
}

function normalizeTraceId(traceId: string): string {
  return traceId.trim().toUpperCase();
}

function extractTraceIdFromTraceparent(traceparent: string): string | null {
  const parts = traceparent.trim().split('-');
  if (parts.length < 2 || !parts[1]) {
    return null;
  }

  return normalizeTraceId(parts[1]);
}

function getHeaderCaseInsensitive(
  headers: HttpHeaders | null | undefined,
  headerName: string
): string | null {
  if (!headers) {
    return null;
  }

  const expected = normalizeHeaderName(headerName);
  const keyByUpperCase = new Map<string, string>();

  for (const key of headers.keys()) {
    keyByUpperCase.set(normalizeHeaderName(key), key);
  }

  const matchedKey = keyByUpperCase.get(expected);
  if (matchedKey) {
    return headers.get(matchedKey);
  }

  for (const candidate of [headerName, headerName.toLowerCase(), headerName.toUpperCase()]) {
    const value = headers.get(candidate);
    if (value) {
      return value;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function getCaseInsensitiveValue(source: Record<string, unknown>, targetKey: string): string | null {
  const normalizedTarget = normalizeHeaderName(targetKey);
  for (const [key, value] of Object.entries(source)) {
    if (normalizeHeaderName(key) !== normalizedTarget) {
      continue;
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function extractTraceIdFromHeaders(headers: HttpHeaders | null | undefined): string {
  const otelTraceId = getHeaderCaseInsensitive(headers, 'otel-trace-id');
  if (otelTraceId) {
    return normalizeTraceId(otelTraceId);
  }

  const xTraceId = getHeaderCaseInsensitive(headers, 'x-trace-id');
  if (xTraceId) {
    return normalizeTraceId(xTraceId);
  }

  const traceparent = getHeaderCaseInsensitive(headers, 'traceparent');
  if (traceparent) {
    const parsedTraceId = extractTraceIdFromTraceparent(traceparent);
    if (parsedTraceId) {
      return parsedTraceId;
    }
    return traceparent.trim();
  }

  return TRACE_NOT_AVAILABLE;
}

export function extractTraceIdFromPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const body = payload;
  const directTraceId =
    body['trace_id'] ?? body['traceId'] ?? body['otel-trace-id'] ?? body['x-trace-id'];
  if (typeof directTraceId === 'string' && directTraceId.trim()) {
    return normalizeTraceId(directTraceId);
  }

  const bodyHeaders = body['headers'];
  if (!isRecord(bodyHeaders)) {
    return null;
  }

  const otelTraceId = getCaseInsensitiveValue(bodyHeaders, 'otel-trace-id');
  if (otelTraceId) {
    return normalizeTraceId(otelTraceId);
  }

  const xTraceId = getCaseInsensitiveValue(bodyHeaders, 'x-trace-id');
  if (xTraceId) {
    return normalizeTraceId(xTraceId);
  }

  const traceparent = getCaseInsensitiveValue(bodyHeaders, 'traceparent');
  if (!traceparent) {
    return null;
  }

  return extractTraceIdFromTraceparent(traceparent);
}

export function resolveTraceId(
  headers: HttpHeaders | null | undefined,
  payload: unknown = null
): string {
  const traceFromHeaders = extractTraceIdFromHeaders(headers);
  if (traceFromHeaders !== TRACE_NOT_AVAILABLE) {
    return traceFromHeaders;
  }

  return extractTraceIdFromPayload(payload) ?? TRACE_NOT_AVAILABLE;
}
