import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthTokenInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const authHeader = this.auth.getAuthHeaders().get('Authorization');
    if (!authHeader || req.headers.has('Authorization')) {
      return next.handle(req);
    }
    if (!this.isErpRequest(req.url)) {
      return next.handle(req);
    }
    return next.handle(req.clone({ setHeaders: { Authorization: authHeader } }));
  }

  private isErpRequest(url: string): boolean {
    const base = environment.ERP_BASE_URL?.trim();
    if (!base) {
      return !/^https?:\/\//i.test(url);
    }
    return url.startsWith(base);
  }
}
