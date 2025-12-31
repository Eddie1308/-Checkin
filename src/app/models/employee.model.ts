export interface Employee {
  name: string;
  employee_name?: string;
  department?: string;
  designation?: string;
  company?: string;
  user_id?: string;
  personal_email?: string;
  company_email?: string;
}

export interface EmployeeListResponse {
  data: Employee[];
}
