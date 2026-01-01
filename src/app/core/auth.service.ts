import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of, switchMap, tap } from 'rxjs';
import { StorageService } from './storage.service';

export type AuthMode = 'token' | 'session';

export interface AuthState {
  mode: AuthMode;
  apiKey?: string;
  apiSecret?: string;
  user?: string;
  remember?: boolean;
}

export interface LoginResponse {
  message: string;
}

// Use relative paths in dev so requests go through the Angular dev proxy (see proxy.conf.json).
// For production builds, set the full ERP_BASE_URL or use environment files.
export const ERP_BASE_URL = 'http://cya.wkksa.com/';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'erpnext-auth';
  private authState$ = new BehaviorSubject<AuthState | null>(this.storage.getSession<AuthState>(this.STORAGE_KEY));

  constructor(private http: HttpClient, private storage: StorageService) {}

  get state(): AuthState | null {
    return this.authState$.value;
  }

  isAuthenticated(): boolean {
    return !!this.state;
  }

  loginWithApiKey(apiKey: string, apiSecret: string, remember = false): Observable<string> {
    const headers = new HttpHeaders({
      Authorization: `token ${apiKey}:${apiSecret}`
    });

    return this.http
      .get<LoginResponse>(`${ERP_BASE_URL}/api/method/frappe.auth.get_logged_user`, { headers })
      .pipe(
        map(res => res.message),
        tap(user => this.persistState({ mode: 'token', apiKey, apiSecret, user, remember }, remember))
      );
  }

  loginWithPassword(usr: string, pwd: string, remember = false): Observable<string> {
    return this.http
      .post<LoginResponse>(
        `${ERP_BASE_URL}/api/method/login`,
        { usr, pwd },
        { withCredentials: true }
      )
      .pipe(
        switchMap(() =>
          this.http.get<LoginResponse>(`${ERP_BASE_URL}/api/method/frappe.auth.get_logged_user`, {
            withCredentials: true
          })
        ),
        map(res => res.message),
        tap(user => this.persistState({ mode: 'session', user, remember }, remember))
      );
  }

  logout(): Observable<void> {
    this.storage.remove(this.STORAGE_KEY);
    this.authState$.next(null);
    return of(void 0);
  }

  getAuthHeaders(): HttpHeaders {
    if (this.state?.mode === 'token' && this.state.apiKey && this.state.apiSecret) {
      return new HttpHeaders({
        Authorization: `token ${this.state.apiKey}:${this.state.apiSecret}`
      });
    }
    return new HttpHeaders();
  }

  getHttpOptions(): { headers?: HttpHeaders; withCredentials?: boolean } {
    if (this.state?.mode === 'token') {
      return {
        headers: this.getAuthHeaders(),
        withCredentials: false
      };
    }
    if (this.state?.mode === 'session') {
      return {
        withCredentials: true
      };
    }
    return {};
  }

  private persistState(state: AuthState, remember: boolean): void {
    this.storage.remove(this.STORAGE_KEY);
    if (remember) this.storage.setSession(this.STORAGE_KEY, state);
    this.authState$.next(state);
  }
}
