import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Employee } from '../models/employee.model';
import { map, switchMap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private readonly employeeFields = [
    'name',
    'employee_name',
    'department',
    'designation',
    'company',
    'user_id',
    'personal_email',
    'company_email'
  ];

  constructor(private api: ApiService) {}

  resolveSupervisorEmployee(loggedUser: string): Observable<Employee | null> {
    return this.findByField('user_id', loggedUser).pipe(
      switchMap(found => (found ? of(found) : this.findByField('personal_email', loggedUser))),
      switchMap(found => (found ? of(found) : this.findByField('company_email', loggedUser)))
    );
  }

  listEmployeesForSupervisor(supervisor: Employee): Observable<Employee[]> {
    // Build a list of possible values that could be stored in custom_site_supervisor
    // (doc name, employee_name, user_id, personal_email, company_email).
    const candidates = [
      supervisor.name,
      supervisor.employee_name,
      supervisor.user_id,
      supervisor.personal_email,
      supervisor.company_email
    ].filter(Boolean) as string[];

    // Try each candidate sequentially until we get a non-empty result.
    let result$ = of([] as Employee[]);
    for (const candidate of candidates) {
      result$ = result$.pipe(
        switchMap(list => (list && list.length ? of(list) : this.fetchEmployees([
          ['Employee', 'custom_site_supervisor', '=', candidate]
        ])))
      );
    }

    // If nothing matched, return empty array.
    return result$;
  }

  private findByField(field: string, value: string): Observable<Employee | null> {
    const filters = [[ 'Employee', field, '=', value ]];
    return this.fetchEmployees(filters).pipe(
      map(list => list[0] ?? null)
    );
  }

  private fetchEmployees(filters: unknown[]): Observable<Employee[]> {
    const params = {
      fields: JSON.stringify(this.employeeFields),
      filters: JSON.stringify(filters)
    };

    return this.api.get<unknown>('/api/resource/Employee', { params }).pipe(
      map(res => this.normalizeEmployeeList(res))
    );
  }

  private normalizeEmployeeList(res: any): Employee[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.message)) return res.message;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  }
}
