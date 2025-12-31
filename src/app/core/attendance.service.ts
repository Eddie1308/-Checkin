import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { CheckinPayload, CheckinResponse, LogType } from '../models/checkin.model';
import { map, switchMap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  constructor(private api: ApiService) {}

  generateClientUuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return 'client-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  createCheckin(payload: CheckinPayload): Observable<CheckinResponse> {
    return this.api.post<CheckinResponse>('/api/resource/Employee Checkin', payload);
  }

  findCheckinByClientUuid(employee: string, uuid: string): Observable<string | null> {
    const params = {
      fields: JSON.stringify(['name']),
      filters: JSON.stringify([
        ['Employee Checkin', 'employee', '=', employee],
        ['Employee Checkin', 'custom_client_uuid', '=', uuid]
      ]),
      limit_page_length: '1'
    };

    return this.api.get<{ data: Array<{ name: string }> }>('/api/resource/Employee Checkin', { params }).pipe(
      map(res => (res.data && res.data.length ? res.data[0].name : null))
    );
  }

  attachFileToCheckin(docname: string, file: File): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_private', '1');
    formData.append('doctype', 'Employee Checkin');
    formData.append('docname', docname);
    return this.api.postForm('/api/method/upload_file', formData);
  }

  submitCheckinWithAttachment(
    employee: string,
    supervisorEmployeeId: string,
    logType: LogType,
    location: { lat?: number; lng?: number; accuracy?: number; status: 'ok' | 'denied' | 'unavailable' },
    file?: File
  ): Observable<{ name: string; clientUuid: string }> {
    const custom_client_uuid = this.generateClientUuid();
    const payload: CheckinPayload = {
      employee,
      log_type: logType,
      custom_site_supervisor: supervisorEmployeeId,
      custom_lat: location.lat,
      custom_lng: location.lng,
      custom_accuracy: location.accuracy,
      custom_location_status: location.status,
      custom_client_uuid
    };

    return this.findCheckinByClientUuid(employee, custom_client_uuid).pipe(
      switchMap(existingName => {
        if (existingName) {
          return of({ name: existingName, clientUuid: custom_client_uuid });
        }
        return this.createCheckin(payload).pipe(
          switchMap(res => {
            if (file) {
              return this.attachFileToCheckin(res.data.name, file).pipe(
                map(() => ({ name: res.data.name, clientUuid: custom_client_uuid }))
              );
            }
            return of({ name: res.data.name, clientUuid: custom_client_uuid });
          })
        );
      })
    );
  }
}
