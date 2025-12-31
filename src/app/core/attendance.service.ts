import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { CheckinPayload, CheckinResponse, LogType } from '../models/checkin.model';
import { map, switchMap, catchError } from 'rxjs/operators';
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
      map(res => (res.data && res.data.length ? res.data[0].name : null)),
      catchError(err => {
        console.warn('GET /api/resource/Employee Checkin failed, falling back to frappe.client.get_list', err && (err as any).status);
        // Use the server-side method which accepts JSON body to avoid query-string related failures
        const body = {
          doctype: 'Employee Checkin',
          fields: ['name'],
          filters: [
            ['Employee Checkin', 'employee', '=', employee],
            ['Employee Checkin', 'custom_client_uuid', '=', uuid]
          ],
          limit_page_length: 1
        };
        return this.api.post<{ message: Array<{ name: string }> }>('/api/method/frappe.client.get_list', body).pipe(
          map(res => (res && (res as any).message && (res as any).message.length ? (res as any).message[0].name : null)),
          catchError(err2 => {
            console.error('Fallback get_list also failed', err2);
            return of(null);
          })
        );
      })
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
  ): Observable<{ name: string; clientUuid: string; latitude?: number; longitude?: number; location?: string }> {
    const custom_client_uuid = this.generateClientUuid();
    const payload: CheckinPayload = {
      employee,
      log_type: logType,
      custom_site_supervisor: supervisorEmployeeId,
      custom_lat: location.lat,
      custom_lng: location.lng,
      custom_accuracy: location.accuracy,
      custom_location_status: location.status,
      custom_client_uuid,
      // Also include ERPNext-standard fields so lat/lng are saved where the server expects them
      latitude: typeof location.lat === 'number' ? location.lat : undefined,
      longitude: typeof location.lng === 'number' ? location.lng : undefined,
      location_status: location.status,
      // Also include a string version so the 'Location' UI field is populated
      location: typeof location.lat === 'number' && typeof location.lng === 'number' ? `${location.lat},${location.lng}` : undefined
    } as any;

    return this.findCheckinByClientUuid(employee, custom_client_uuid).pipe(
      switchMap(existingName => {
        if (existingName) {
          // If exists, fetch stored doc to return coordinates
          return this.api.get<any>(`/api/resource/Employee Checkin/${encodeURIComponent(existingName)}?fields=${JSON.stringify([
            'name',
            'latitude',
            'longitude',
            'location'
          ])}`).pipe(
            map(doc => ({ name: existingName, clientUuid: custom_client_uuid, latitude: doc?.data?.latitude, longitude: doc?.data?.longitude, location: doc?.data?.location })),
            catchError(() => of({ name: existingName, clientUuid: custom_client_uuid }))
          );
        }
        return this.createCheckin(payload).pipe(
          switchMap(res => {
            const createdName = res.data.name;
            // Fetch created doc to return stored coords/location
            const fetchCreated$ = this.api.get<any>(`/api/resource/Employee Checkin/${encodeURIComponent(createdName)}?fields=${JSON.stringify([
              'name',
              'latitude',
              'longitude',
              'location'
            ])}`).pipe(
              map(doc => ({ name: createdName, clientUuid: custom_client_uuid, latitude: doc?.data?.latitude, longitude: doc?.data?.longitude, location: doc?.data?.location })),
              catchError(() => of({ name: createdName, clientUuid: custom_client_uuid }))
            );

            if (file) {
              return this.attachFileToCheckin(createdName, file).pipe(
                switchMap(() => fetchCreated$)
              );
            }
            return fetchCreated$;
          })
        );
      })
    );
  }
}
