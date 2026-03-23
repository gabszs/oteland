import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { faro } from '@grafana/faro-web-sdk';
import { finalize, timeout } from 'rxjs/operators';
import { resolveTraceId } from '../../trace-id.utils';
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
          this.traceId = resolveTraceId(res.headers, res.body);
          this.response = this.formatForDisplay(res.body ?? null);
          this.refreshView();
        },
        error: (err: any) => {
          this.traceId = resolveTraceId(err?.headers, err?.error);
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
