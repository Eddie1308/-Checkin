import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { EmployeeService } from '../../core/employee.service';
import { Employee } from '../../models/employee.model';
import { EmployeeActionComponent } from '../employee-action/employee-action.component';
import { finalize, map, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [CommonModule, FormsModule, EmployeeActionComponent]
})
export class DashboardComponent implements OnInit {
  supervisor?: Employee;
  employees: Employee[] = [];
  searchTerm = '';
  selected?: Employee;
  error?: string;
  loading = false;
  infoMessage?: string;

  constructor(
    private auth: AuthService,
    private employeeService: EmployeeService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  get displayEmployees(): Employee[] {
    const list: Employee[] = this.supervisor ? [this.supervisor, ...this.employees] : [...this.employees];
    return this.deduplicateById(list);
  }

  get filteredEmployees(): Employee[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.displayEmployees;
    }
    return this.displayEmployees.filter(e =>
      e.employee_name?.toLowerCase().includes(term) ||
      e.name.toLowerCase().includes(term) ||
      e.department?.toLowerCase().includes(term) ||
      e.designation?.toLowerCase().includes(term)
    );
  }

  loadData(): void {
    const user = this.auth.state?.user;
    if (!user) {
      this.error = 'Logged-in user not available. Please sign in again.';
      return;
    }
    this.loading = true;
    this.error = undefined;
    this.infoMessage = undefined;

    this.employeeService
      .resolveSupervisorEmployee(user)
      .pipe(
        switchMap(supervisor => {
          if (!supervisor) {
            this.error = 'Unable to map the current user to an Employee. Check user_id/personal_email/company_email.';
            this.supervisor = undefined;
            this.employees = [];
            return of({ supervisor: undefined, list: [] as Employee[] });
          }
          this.supervisor = supervisor;
          return this.employeeService.listEmployeesForSupervisor(supervisor).pipe(
            map(list => ({ supervisor, list }))
          );
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: ({ supervisor, list }) => {
          if (!supervisor) {
            return;
          }
          // If no other employees are assigned to this supervisor, show a helpful message
          const otherEmployees = list.filter(e => e.name !== supervisor.name);
          if (otherEmployees.length === 0) {
            this.infoMessage = `No employees found under ${supervisor.name}. Confirm you have assigned employees in ERPNext and that your role can read Employee records.`;
          } else {
            this.infoMessage = 'Live data comes directly from ERPNext. Ensure your ERPNext role can read Employee and create Employee Checkin.';
          }

          this.employees = list;
        },
        error: err => {
          this.error = this.describeError(err);
        }
      });
  }

  openAction(employee: Employee): void {
    this.selected = employee;
  }

  closeAction(): void {
    this.selected = undefined;
  }

  onComplete(event: { type: string; name: string }): void {
    this.infoMessage = `${event.type} recorded for ${this.selected?.employee_name || this.selected?.name} (doc ${event.name}).`;
    this.selected = undefined;
  }

  private deduplicateById(list: Employee[]): Employee[] {
    const seen = new Set<string>();
    const unique: Employee[] = [];
    for (const emp of list) {
      if (!emp?.name || seen.has(emp.name)) {
        continue;
      }
      seen.add(emp.name);
      unique.push(emp);
    }
    return unique;
  }

  private describeError(error: unknown): string {
    const message = (error as any)?.error?.message || (error as any)?.message;
    return message || 'Unexpected error. Check authentication, permissions, or CORS.';
  }
}
