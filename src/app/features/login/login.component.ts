import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  apiKeyForm = this.fb.group({
    apiKey: ['', Validators.required],
    apiSecret: ['', Validators.required],
    remember: [false]
  });

  passwordForm = this.fb.group({
    usr: ['', [Validators.required]],
    pwd: ['', Validators.required],
    remember: [false]
  });

  error?: string;
  loading = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  loginWithApiKey(): void {
    if (this.apiKeyForm.invalid) {
      return;
    }
    this.loading = true;
    this.error = undefined;
    const { apiKey, apiSecret, remember } = this.apiKeyForm.value;
    this.auth
      .loginWithApiKey(apiKey!, apiSecret!, !!remember)
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: err => {
          this.error = this.parseError(err);
          this.loading = false;
        }
      });
  }

  loginWithPassword(): void {
    if (this.passwordForm.invalid) {
      return;
    }
    this.loading = true;
    this.error = undefined;
    const { usr, pwd, remember } = this.passwordForm.value;
    this.auth
      .loginWithPassword(usr!, pwd!, !!remember)
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: err => {
          this.error = this.parseError(err);
          this.loading = false;
        }
      });
  }

  private parseError(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }
    const message = (error as any)?.error?.message || (error as any)?.message;
    return message || 'Unable to sign in. Please verify credentials and network/CORS settings.';
  }
}
