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

  listEmployeesForSupervisor(supervisorEmployeeId: string): Observable<Employee[]> {
    return this.fetchEmployees([
      ['Employee', 'custom_site_supervisor', '=', supervisorEmployeeId]
    ]);
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

    return this.api.get<{ data: Employee[] }>('/api/resource/Employee', { params }).pipe(
      map(res => res.data || [])
    );
  }
}
