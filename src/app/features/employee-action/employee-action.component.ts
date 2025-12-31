import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AttendanceService } from '../../core/attendance.service';
import { Employee } from '../../models/employee.model';
import { LogType } from '../../models/checkin.model';

type LocationStatus = 'ok' | 'denied' | 'unavailable';

@Component({
  selector: 'app-employee-action',
  templateUrl: './employee-action.component.html',
  styleUrls: ['./employee-action.component.scss']
})
export class EmployeeActionComponent {
  @Input() employee!: Employee;
  @Input() supervisor!: Employee;
  @Output() close = new EventEmitter<void>();
  @Output() completed = new EventEmitter<{ type: LogType; name: string }>();

  photoFile?: File;
  photoPreview?: string;
  location?: { lat?: number; lng?: number; accuracy?: number; status: LocationStatus };
  loading = false;
  error?: string;

  constructor(private attendance: AttendanceService) {}

  onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    this.photoFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.photoPreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  captureLocation(): void {
    if (!('geolocation' in navigator)) {
      this.location = { status: 'unavailable' };
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          status: 'ok'
        };
      },
      err => {
        this.location = { status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' };
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  submit(logType: LogType): void {
    if (!this.photoFile) {
      this.error = 'Photo is required for check-in/out.';
      return;
    }
    this.error = undefined;
    this.loading = true;
    const location = this.location || { status: 'unavailable' as LocationStatus };
    this.attendance
      .submitCheckinWithAttachment(this.employee.name, this.supervisor.name, logType, location, this.photoFile)
      .subscribe({
        next: res => {
          this.loading = false;
          this.completed.emit({ type: logType, name: res.name });
        },
        error: err => {
          this.loading = false;
          this.error = (err as any)?.error?.message || (err as any)?.message || 'Unable to record check.';
        }
      });
  }
}
