import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs/operators';

interface PasswordApiResponse {
  data: string[];
}

interface ComplexPasswordPayload {
  additional_length: number;
  quantity: number;
  punctuation: boolean;
  shuffle_string_inject: boolean;
  char_inject: string[];
  string_inject: string[];
}

@Component({
  selector: 'app-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.css']
})
export class PasswordComponent {
  private readonly requestTimeoutMs = 15000;
  readonly defaultApiBaseUrl: string = `${window.location.protocol}//${window.location.hostname}:8000/v1`;
  apiBaseUrl: string = this.defaultApiBaseUrl;

  simpleLength: number = 12;
  simpleQuantity: number = 1;
  simpleHasPunctuation: boolean = true;
  simpleTraceId: string = '';
  simpleResponseRaw: string = '';
  loadingSimple: boolean = false;

  pinLength: number = 4;
  pinQuantity: number = 1;
  pinTraceId: string = '';
  pinResponseRaw: string = '';
  loadingPin: boolean = false;

  complexAdditionalLength: number = 10;
  complexQuantity: number = 1;
  complexPunctuation: boolean = false;
  complexShuffle: boolean = false;
  complexChars: string = '';
  complexStrings: string = '';
  complexTraceId: string = '';
  complexResponseRaw: string = '';
  loadingComplex: boolean = false;

  message: string = '';
  messageType: 'success' | 'error' | '' = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  generateSimplePasswords(): void {
    if (!this.isValidRange(this.simpleLength, 3, 200) || !this.isValidRange(this.simpleQuantity, 1, 100)) {
      this.setMessage('Parâmetros inválidos para geração de senha simples', 'error');
      return;
    }

    this.loadingSimple = true;
    this.simpleTraceId = 'Aguardando...';
    this.simpleResponseRaw = 'Aguardando resposta...';
    this.refreshView();
    const apiBaseUrl = this.getApiBaseUrl();

    const params = new HttpParams()
      .set('password_length', String(this.simpleLength))
      .set('quantity', String(this.simpleQuantity))
      .set('has_punctuation', String(this.simpleHasPunctuation));

    this.http
      .get<PasswordApiResponse>(`${apiBaseUrl}/`, { params, observe: 'response' as const })
      .pipe(
        timeout(this.requestTimeoutMs),
        finalize(() => {
          this.loadingSimple = false;
          this.refreshView();
        })
      )
      .subscribe({
      next: (response: HttpResponse<PasswordApiResponse>) => {
        this.simpleTraceId = this.extractTraceId(response.headers);
        this.simpleResponseRaw = this.formatForDisplay(response.body ?? null);
        this.setMessage('Senhas simples geradas com sucesso', 'success');
        this.refreshView();
      },
      error: (error) => {
        this.simpleTraceId = this.extractTraceId(error?.headers);
        this.simpleResponseRaw = this.formatForDisplay(this.buildErrorPayload(error));
        this.handleRequestError('Erro ao gerar senha simples', error);
        this.refreshView();
      }
    });
  }

  generatePins(): void {
    if (!this.isValidRange(this.pinLength, 3, 200) || !this.isValidRange(this.pinQuantity, 1, 100)) {
      this.setMessage('Parâmetros inválidos para geração de PIN', 'error');
      return;
    }

    this.loadingPin = true;
    this.pinTraceId = 'Aguardando...';
    this.pinResponseRaw = 'Aguardando resposta...';
    this.refreshView();
    const apiBaseUrl = this.getApiBaseUrl();

    const params = new HttpParams()
      .set('password_length', String(this.pinLength))
      .set('quantity', String(this.pinQuantity));

    this.http
      .get<PasswordApiResponse>(`${apiBaseUrl}/pin`, { params, observe: 'response' as const })
      .pipe(
        timeout(this.requestTimeoutMs),
        finalize(() => {
          this.loadingPin = false;
          this.refreshView();
        })
      )
      .subscribe({
      next: (response: HttpResponse<PasswordApiResponse>) => {
        this.pinTraceId = this.extractTraceId(response.headers);
        this.pinResponseRaw = this.formatForDisplay(response.body ?? null);
        this.setMessage('PINs gerados com sucesso', 'success');
        this.refreshView();
      },
      error: (error) => {
        this.pinTraceId = this.extractTraceId(error?.headers);
        this.pinResponseRaw = this.formatForDisplay(this.buildErrorPayload(error));
        this.handleRequestError('Erro ao gerar PIN', error);
        this.refreshView();
      }
    });
  }

  generateComplexPasswords(): void {
    if (!this.isValidRange(this.complexAdditionalLength, 1, 100)) {
      this.setMessage('`additional_length` deve ficar entre 1 e 100', 'error');
      return;
    }

    if (!this.isValidRange(this.complexQuantity, 1, 100)) {
      this.setMessage('`quantity` deve ficar entre 1 e 100', 'error');
      return;
    }

    const charInject = this.parseCsv(this.complexChars).filter((item) => item.length === 1);
    const stringInject = this.parseCsv(this.complexStrings).filter((item) => item.length >= 2);

    const payload: ComplexPasswordPayload = {
      additional_length: this.complexAdditionalLength,
      quantity: this.complexQuantity,
      punctuation: this.complexPunctuation,
      shuffle_string_inject: this.complexShuffle,
      char_inject: charInject,
      string_inject: stringInject
    };

    this.loadingComplex = true;
    this.complexTraceId = 'Aguardando...';
    this.complexResponseRaw = 'Aguardando resposta...';
    this.refreshView();
    const apiBaseUrl = this.getApiBaseUrl();
    this.http
      .post<PasswordApiResponse>(`${apiBaseUrl}/complex_password`, payload, { observe: 'response' as const })
      .pipe(
        timeout(this.requestTimeoutMs),
        finalize(() => {
          this.loadingComplex = false;
          this.refreshView();
        })
      )
      .subscribe({
      next: (response: HttpResponse<PasswordApiResponse>) => {
        this.complexTraceId = this.extractTraceId(response.headers);
        this.complexResponseRaw = this.formatForDisplay(response.body ?? null);
        this.setMessage('Senhas complexas geradas com sucesso', 'success');
        this.refreshView();
      },
      error: (error) => {
        this.complexTraceId = this.extractTraceId(error?.headers);
        this.complexResponseRaw = this.formatForDisplay(this.buildErrorPayload(error));
        this.handleRequestError('Erro ao gerar senha complexa', error);
        this.refreshView();
      }
    });
  }

  private extractTraceId(headers: HttpHeaders | null | undefined): string {
    const otelTraceId = this.getHeaderCaseInsensitive(headers, 'otel-trace-id');
    if (otelTraceId) {
      return otelTraceId.toUpperCase();
    }

    const xTraceId = this.getHeaderCaseInsensitive(headers, 'x-trace-id');
    if (xTraceId) {
      return xTraceId.toUpperCase();
    }

    const traceparent = this.getHeaderCaseInsensitive(headers, 'traceparent');
    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 2 && parts[1]) {
        return parts[1].toUpperCase();
      }
      return traceparent;
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

  private formatForDisplay(payload: unknown): string {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  private buildErrorPayload(error: any): Record<string, unknown> {
    return {
      status: error?.status ?? null,
      message: error?.message ?? 'Erro desconhecido',
      error: error?.error ?? null
    };
  }

  private parseCsv(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private getApiBaseUrl(): string {
    const trimmed = this.apiBaseUrl.trim().replace(/\/+$/, '');
    return trimmed || this.defaultApiBaseUrl;
  }

  private handleRequestError(prefix: string, error: any): void {
    const serverMessage =
      error?.error?.detail || error?.error?.message || error?.message || 'falha ao chamar a API';
    this.setMessage(`${prefix}: ${serverMessage}`, 'error');
  }

  private isValidRange(value: number, min: number, max: number): boolean {
    return Number.isFinite(value) && value >= min && value <= max;
  }

  private setMessage(msg: string, type: 'success' | 'error'): void {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => {
      if (this.message === msg) {
        this.message = '';
        this.messageType = '';
        this.refreshView();
      }
    }, 5000);
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignora tentativa de render após componente destruído.
    }
  }
}
