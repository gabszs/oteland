import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { getTraceMetaAttributes, getTraceUserId } from './trace-user-context';

type RuntimeEnv = {
  FARO_WEB_URL?: string;
};

function getRuntimeEnv(): RuntimeEnv {
  const runtimeWindow = window as Window & { __APP_ENV__?: RuntimeEnv };
  return runtimeWindow.__APP_ENV__ ?? {};
}

function stripQuotes(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(/^['"]|['"]$/g, '');
}

function buildFaroUrl(env: RuntimeEnv): string {
  const faroWebUrl = stripQuotes(env.FARO_WEB_URL ?? '').trim();
  if (faroWebUrl) {
    return faroWebUrl;
  }

  return 'https://faro-collector-prod-sa-east-1.grafana.net/collect/06c03d529077426a29c0136a4e846970';
}

function buildTraceCorsMatchers(): RegExp[] {
  return [/^https?:\/\//];
}

function applySpanAttributes(span: any): void {
  if (typeof span?.setAttribute !== 'function') {
    return;
  }

  const userId = getTraceUserId();
  if (userId) {
    span.setAttribute('user.id', userId);
  }

  const metaAttributes = getTraceMetaAttributes();
  for (const [key, value] of Object.entries(metaAttributes)) {
    const attributeKey = key.trim();
    const attributeValue = value.trim();
    if (!attributeKey || !attributeValue) {
      continue;
    }
    span.setAttribute(attributeKey, attributeValue);
  }
}

export function faroInitializer(): () => void {
  return () => {
    const runtimeEnv = getRuntimeEnv();
    const faroUrl = buildFaroUrl(runtimeEnv);
    const traceCorsMatchers = buildTraceCorsMatchers();
    const tracingOptions = {
      propagateTraceHeaderCorsUrls: traceCorsMatchers,
      fetchInstrumentationOptions: {
        applyCustomAttributesOnSpan: (span: any) => applySpanAttributes(span)
      },
      xhrInstrumentationOptions: {
        applyCustomAttributesOnSpan: (span: any) => applySpanAttributes(span)
      }
    };

    initializeFaro({
      url: faroUrl,
      app: {
        name: 'frontend-angular-labs-test',
        version: '1.0.0',
        environment: 'production'
      },
      sessionTracking: {
        samplingRate: 1,
        persistent: true
      },
      instrumentations: [
        ...getWebInstrumentations({
          captureConsole: true,
          captureConsoleDisabledLevels: []
        }),
        new TracingInstrumentation({
          // Support both config shapes used in Faro docs versions.
          ...tracingOptions,
          instrumentationOptions: tracingOptions
        } as any)
      ]
    });
  };
}
