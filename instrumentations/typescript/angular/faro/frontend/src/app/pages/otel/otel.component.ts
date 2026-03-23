import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { faro } from '@grafana/faro-web-sdk';
import { finalize, timeout } from 'rxjs/operators';
import { setTraceMetaAttributes, setTraceUserId } from '../../trace-user-context';

interface MetaAttributePair {
  key: string;
  value: string;
}

interface FaroApiWithOptionalPushMeta {
  pushMeta?: (meta: { app: Record<string, string> }) => void;
}

@Component({
  selector: 'app-otel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './otel.component.html',
  styleUrls: ['./otel.component.css']
})
export class OtelComponent {
  private readonly requestTimeoutMs = 15000;
  private readonly defaultPlan = 'premium';
  private readonly defaultRegion = 'BR-SP';
  private readonly defaultMetaAppName = 'meu-app';
  private readonly defaultMetaAppVersion = '2.1.0';
  private readonly defaultMetaEnvironment = 'production';

  readonly defaultDebugUrl: string = `${window.location.protocol}//${window.location.hostname}:8000/v1/debug`;
  debugUrl: string = this.defaultDebugUrl;

  id: string = '12345';
  username: string = 'joao';
  metaAttributes: MetaAttributePair[] = [{ key: 'tenant', value: 'loja-a' }];
  jsonData: string = `{
  "event": "debug",
  "message": "payload de exemplo",
  "data": {
    "ok": true
  }
}`;
  response: string = '';
  traceId: string = '';
  loading: boolean = false;
  error: string = '';
  userSetupMessage: string = '';
  metaSetupMessage: string = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.configureGlobalUser(false);
    this.configureGlobalMeta(false);
  }

  sendDebugData(): void {
    if (!this.jsonData.trim()) {
      this.error = 'Por favor, insira dados JSON';
      return;
    }

    const targetUrl = this.debugUrl.trim();
    if (!targetUrl) {
      this.error = 'Informe uma URL de destino válida';
      return;
    }

    if (!this.configureGlobalUser(false)) {
      this.error = 'Informe ID e username para configurar o usuário global';
      this.refreshView();
      return;
    }

    if (!this.configureGlobalMeta(false)) {
      this.error = 'Erro ao configurar meta global';
      this.refreshView();
      return;
    }

    this.loading = true;
    this.error = '';
    this.traceId = 'Aguardando...';
    this.response = 'Aguardando resposta...';
    this.refreshView();

    try {
      const parsedJson = JSON.parse(this.jsonData);
      const userId = this.id.trim();
      const requestOptions: { observe: 'response'; headers?: HttpHeaders } = {
        observe: 'response'
      };

      if (userId) {
        requestOptions.headers = new HttpHeaders({
          'x-user-id': userId
        });
      }

      this.http
        .post(targetUrl, parsedJson, requestOptions)
        .pipe(
          timeout(this.requestTimeoutMs),
          finalize(() => {
            this.loading = false;
            this.refreshView();
          })
        )
        .subscribe({
        next: (res: HttpResponse<unknown>) => {
          const traceIdFromHeaders = this.extractTraceId(res.headers);
          const traceIdFromBody = this.extractTraceIdFromBody(res.body);
          this.traceId = traceIdFromHeaders !== 'não informado' ? traceIdFromHeaders : (traceIdFromBody ?? 'não informado');
          this.response = this.formatForDisplay(res.body ?? null);
          this.refreshView();
        },
        error: (err: any) => {
          const traceIdFromHeaders = this.extractTraceId(err?.headers);
          const traceIdFromBody = this.extractTraceIdFromBody(err?.error);
          this.traceId = traceIdFromHeaders !== 'não informado' ? traceIdFromHeaders : (traceIdFromBody ?? 'não informado');
          this.error = 'Erro ao enviar dados: ' + (err.error?.message || err.message);
          this.response = this.formatForDisplay({
            status: err?.status ?? null,
            message: err?.message ?? 'Erro desconhecido',
            error: err?.error ?? null
          });
          this.refreshView();
        }
      });
    } catch {
      this.error = 'JSON inválido';
      this.loading = false;
      this.refreshView();
    }
  }

  applyGlobalUser(): void {
    this.error = '';
    const configured = this.configureGlobalUser(true);
    if (!configured) {
      this.error = 'Informe ID e username válidos para aplicar no Faro';
      this.userSetupMessage = '';
    }
    this.refreshView();
  }

  addMetaAttributeRow(): void {
    this.metaAttributes = [...this.metaAttributes, { key: '', value: '' }];
    this.metaSetupMessage = '';
    this.refreshView();
  }

  applyGlobalMeta(): void {
    this.error = '';
    const configured = this.configureGlobalMeta(true);
    if (!configured) {
      this.error = 'Erro ao configurar meta global no Faro';
      this.metaSetupMessage = '';
    }
    this.refreshView();
  }

  private formatForDisplay(payload: unknown): string {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  private extractTraceId(headers: HttpHeaders | null | undefined): string {
    const otelTraceId = this.getHeaderCaseInsensitive(headers, 'otel-trace-id');
    if (otelTraceId) {
      return this.normalizeTraceId(otelTraceId);
    }

    const xTraceId = this.getHeaderCaseInsensitive(headers, 'x-trace-id');
    if (xTraceId) {
      return this.normalizeTraceId(xTraceId);
    }

    const traceparent = this.getHeaderCaseInsensitive(headers, 'traceparent');
    if (traceparent) {
      const parsedTraceId = this.extractTraceIdFromTraceparent(traceparent);
      if (parsedTraceId) {
        return parsedTraceId;
      }
      return traceparent.trim();
    }

    return 'não informado';
  }

  private getHeaderCaseInsensitive(
    headers: HttpHeaders | null | undefined,
    headerName: string
  ): string | null {
    if (!headers) {
      return null;
    }

    const expected = this.normalizeHeaderName(headerName);
    const keyByUpperCase = new Map<string, string>();

    for (const key of headers.keys()) {
      keyByUpperCase.set(this.normalizeHeaderName(key), key);
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

  private normalizeHeaderName(headerName: string): string {
    return headerName.trim().toUpperCase();
  }

  private extractTraceIdFromBody(payload: unknown): string | null {
    if (!this.isRecord(payload)) {
      return null;
    }

    const body = payload;
    const directTraceId = body['trace_id'] ?? body['traceId'] ?? body['otel-trace-id'];
    if (typeof directTraceId === 'string' && directTraceId.trim()) {
      return this.normalizeTraceId(directTraceId);
    }

    const bodyHeaders = body['headers'];
    if (!this.isRecord(bodyHeaders)) {
      return null;
    }

    const otelTraceId = this.getCaseInsensitiveValue(bodyHeaders, 'otel-trace-id');
    if (otelTraceId) {
      return this.normalizeTraceId(otelTraceId);
    }

    const xTraceId = this.getCaseInsensitiveValue(bodyHeaders, 'x-trace-id');
    if (xTraceId) {
      return this.normalizeTraceId(xTraceId);
    }

    const traceparent = this.getCaseInsensitiveValue(bodyHeaders, 'traceparent');
    if (!traceparent) {
      return null;
    }

    return this.extractTraceIdFromTraceparent(traceparent);
  }

  private getCaseInsensitiveValue(
    source: Record<string, unknown>,
    targetKey: string
  ): string | null {
    const normalizedTarget = this.normalizeHeaderName(targetKey);
    for (const [key, value] of Object.entries(source)) {
      if (this.normalizeHeaderName(key) !== normalizedTarget) {
        continue;
      }

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private extractTraceIdFromTraceparent(traceparent: string): string | null {
    const parts = traceparent.trim().split('-');
    if (parts.length < 2 || !parts[1]) {
      return null;
    }

    return this.normalizeTraceId(parts[1]);
  }

  private normalizeTraceId(traceId: string): string {
    return traceId.trim().toUpperCase();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object';
  }

  private configureGlobalUser(showMessage: boolean): boolean {
    const userId = this.id.trim();
    const username = this.username.trim();
    if (!userId || !username) {
      return false;
    }

    try {
      faro.api.setUser({
        id: userId,
        username,
        attributes: {
          plano: this.defaultPlan,
          regiao: this.defaultRegion
        }
      });
      setTraceUserId(userId);
      if (showMessage) {
        this.userSetupMessage = `Usuário global configurado: ${userId} (${username})`;
      }
      return true;
    } catch {
      return false;
    }
  }

  private configureGlobalMeta(showMessage: boolean): boolean {
    try {
      const customAttributes = this.buildCustomMetaAttributes();
      setTraceMetaAttributes(customAttributes);
      const appMeta: Record<string, string> = {
        name: this.defaultMetaAppName,
        version: this.defaultMetaAppVersion,
        environment: this.defaultMetaEnvironment,
        ...customAttributes
      };

      const faroApi = faro.api as unknown as FaroApiWithOptionalPushMeta;
      if (typeof faroApi.pushMeta === 'function') {
        faroApi.pushMeta({ app: appMeta });
      } else {
        // Fallback para versões que não expõem pushMeta na API pública.
        faro.api.setView({
          name: 'global-meta',
          attributes: {
            ...Object.fromEntries(
              Object.entries(appMeta).map(([key, value]) => [`app.${key}`, value])
            )
          }
        } as any);
      }

      if (showMessage) {
        const customCount = Object.keys(customAttributes).length;
        this.metaSetupMessage =
          customCount > 0
            ? `Meta global configurada com ${customCount} atributo(s) custom.`
            : 'Meta global configurada sem atributos custom.';
      }

      return true;
    } catch {
      return false;
    }
  }

  private buildCustomMetaAttributes(): Record<string, string> {
    const customAttributes: Record<string, string> = {};

    for (const attribute of this.metaAttributes) {
      const key = attribute.key.trim();
      if (!key) {
        continue;
      }
      customAttributes[key] = attribute.value.trim();
    }

    return customAttributes;
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignora tentativa de render após componente destruído.
    }
  }
}
