import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { EmployeeService } from '../../core/employee.service';
import { Employee } from '../../models/employee.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  supervisor?: Employee;
  employees: Employee[] = [];
  searchTerm = '';
  selected?: Employee;
  error?: string;
  loading = false;
  infoMessage?: string;

  constructor(private auth: AuthService, private employeeService: EmployeeService) {}

  ngOnInit(): void {
    this.loadData();
  }

  get filtered(): Employee[] {
    const term = this.searchTerm.toLowerCase();
    return this.employees.filter(e =>
      e.employee_name?.toLowerCase().includes(term) ||
      e.name.toLowerCase().includes(term) ||
      e.department?.toLowerCase().includes(term) ||
      e.designation?.toLowerCase().includes(term)
    );
  }

  loadData(): void {
    if (!this.auth.state?.user) {
      this.error = 'Logged-in user not available. Please sign in again.';
      return;
    }
    this.loading = true;
    this.error = undefined;
    this.infoMessage = undefined;
    this.employeeService
      .resolveSupervisorEmployee(this.auth.state.user)
      .subscribe({
        next: supervisor => {
          if (!supervisor) {
            this.error = 'Unable to map the current user to an Employee. Check user_id/personal_email/company_email.';
            this.loading = false;
            return;
          }
          this.supervisor = supervisor;
          this.employeeService.listEmployeesForSupervisor(supervisor).subscribe({
            next: list => {
              // Debugging: log the supervisor and the raw list returned from ERPNext
              console.log('Dashboard: supervisor=', supervisor);
              console.log('Dashboard: employee list response=', list);

              // If no other employees are assigned to this supervisor, show a helpful message
              const otherEmployees = list.filter(e => e.name !== supervisor.name);
              if (otherEmployees.length === 0) {
                this.infoMessage = `No employees found with custom_site_supervisor set to ${supervisor.name}. Confirm the field is populated in ERPNext and that your role can read Employee records.`;
              } else {
                this.infoMessage = 'Live data comes directly from ERPNext. Ensure your ERPNext role can read Employee and create Employee Checkin.';
              }

              this.employees = this.mergeSupervisor(supervisor, list);
              this.loading = false;
            },
            error: err => {
              this.loading = false;
              this.error = this.describeError(err);
            }
          });
        },
        error: err => {
          this.error = this.describeError(err);
          this.loading = false;
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

  private mergeSupervisor(supervisor: Employee, list: Employee[]): Employee[] {
    const withoutSupervisor = list.filter(e => e.name !== supervisor.name);
    return [supervisor, ...withoutSupervisor];
  }

  private describeError(error: unknown): string {
    const message = (error as any)?.error?.message || (error as any)?.message;
    return message || 'Unexpected error. Check authentication, permissions, or CORS.';
  }
}
