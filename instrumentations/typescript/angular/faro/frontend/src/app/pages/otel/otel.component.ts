import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-otel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './otel.component.html',
  styleUrls: ['./otel.component.css']
})
export class OtelComponent {
  private readonly requestTimeoutMs = 15000;
  private readonly backendBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;

  id: string = '';
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

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  sendDebugData(): void {
    if (!this.jsonData.trim()) {
      this.error = 'Por favor, insira dados JSON';
      return;
    }

    this.loading = true;
    this.error = '';
    this.traceId = 'Aguardando...';
    this.response = 'Aguardando resposta...';
    this.refreshView();

    try {
      const parsedJson = JSON.parse(this.jsonData);

      this.http
        .post(`${this.backendBaseUrl}/v1/debug`, parsedJson, { observe: 'response' as const })
        .pipe(
          timeout(this.requestTimeoutMs),
          finalize(() => {
            this.loading = false;
            this.refreshView();
          })
        )
        .subscribe({
        next: (res: HttpResponse<unknown>) => {
          this.traceId = this.extractTraceId(res.headers);
          this.response = this.formatForDisplay(res.body ?? null);
          this.refreshView();
        },
        error: (err: any) => {
          this.traceId = this.extractTraceId(err?.headers);
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

  private formatForDisplay(payload: unknown): string {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  private extractTraceId(headers: HttpHeaders | null | undefined): string {
    const otelTraceId = headers?.get('otel-trace-id');
    if (otelTraceId) {
      return otelTraceId;
    }

    const xTraceId = headers?.get('x-trace-id');
    if (xTraceId) {
      return xTraceId;
    }

    const traceparent = headers?.get('traceparent');
    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 2 && parts[1]) {
        return parts[1];
      }
      return traceparent;
    }

    return 'não informado';
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignora tentativa de render após componente destruído.
    }
  }
}
