import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface ApiOptions {
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  get<T>(path: string, options?: ApiOptions): Observable<T> {
    return this.http.get<T>(`${environment.ERP_BASE_URL}${path}`, {
      ...this.authService.getHttpOptions(),
      ...options
    });
  }

  post<T>(path: string, body: unknown, options?: ApiOptions): Observable<T> {
    return this.http.post<T>(`${environment.ERP_BASE_URL}${path}`, body, {
      ...this.authService.getHttpOptions(),
      ...options
    });
  }

  postForm<T>(path: string, formData: FormData, withCredentialsOverride?: boolean): Observable<T> {
    const base = this.authService.getHttpOptions();
    const headers = (base.headers || new HttpHeaders()).delete('Content-Type');
    return this.http.post<T>(`${environment.ERP_BASE_URL}${path}`, formData, {
      ...base,
      headers,
      withCredentials: withCredentialsOverride ?? base.withCredentials
    });
  }
}
