import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class LoginComponent {
  passwordForm = this.fb.group({
    usr: ['', [Validators.required]],
    pwd: ['', Validators.required],
    remember: [false]
  });

  error?: string;
  loading = false;
  showPassword = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
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
    const httpError = error as any;
    const status = httpError?.status;
    const message = httpError?.error?.message || httpError?.message;

    if (status === 401) {
      return 'Invalid username or password. Please check your credentials and try again.';
    } else if (status === 403) {
      return 'Access denied. You do not have permission to log in.';
    } else if (status === 429) {
      return 'Too many login attempts. Please wait a few minutes before trying again.';
    } else if (status >= 500) {
      return 'Server error. Please try again later or contact support if the issue persists.';
    } else if (!navigator.onLine) {
      return 'No internet connection. Please check your network and try again.';
    } else if (message) {
      return message;
    } else {
      return 'Unable to sign in. Please verify your credentials and network settings.';
    }
  }
}
