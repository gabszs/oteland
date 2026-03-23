import { HttpInterceptorFn } from '@angular/common/http';
import { faro } from '@grafana/faro-web-sdk';

export const faroTraceInterceptor: HttpInterceptorFn = (req, next) => {
  // Tenta obter o trace context do Faro através da API interna
  try {
    // Acessa o tracer do Faro para obter o trace context atual
    const tracer = (faro as any).api?.tracer;
    
    if (tracer) {
      const activeSpan = tracer.extract?.() || tracer.getCurrentSpan?.();
      
      if (activeSpan) {
        const spanContext = activeSpan.spanContext?.();
        
        if (spanContext && spanContext.traceId && spanContext.spanId) {
          // Cria o header traceparent no formato W3C
          const traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-01`;
          
          // Clona a requisição e adiciona o header
          const tracedReq = req.clone({
            setHeaders: {
              traceparent
            }
          });
          
          return next(tracedReq);
        }
      }
    }
  } catch (e) {
    console.warn('Failed to get trace context from Faro:', e);
  }

  // Se não conseguir obter o trace context, passa a requisição normalmente
  return next(req);
};
