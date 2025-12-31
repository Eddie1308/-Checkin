import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { AttendanceService } from '../../core/attendance.service';
import { Employee } from '../../models/employee.model';
import { LogType } from '../../models/checkin.model';

type LocationStatus = 'ok' | 'denied' | 'unavailable';

@Component({
  selector: 'app-employee-action',
  templateUrl: './employee-action.component.html',
  styleUrls: ['./employee-action.component.scss']
})
export class EmployeeActionComponent implements OnInit {
  ngOnInit(): void {
    // Automatically attempt to capture location when the action sheet opens
    // (non-blocking; user can still click Get GPS to retry)
    this.captureLocation();
  }
  @Input() employee!: Employee;
  @Input() supervisor!: Employee;
  @Output() close = new EventEmitter<void>();
  @Output() completed = new EventEmitter<{ type: LogType; name: string }>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  photoFile?: File;
  photoPreview?: string;
  location?: { lat?: number; lng?: number; accuracy?: number; status: LocationStatus };
  loading = false;
  error?: string;
  successMessage?: string;

  // Camera capture state
  capturing = false;
  private videoStream?: MediaStream | null = null;
  private pendingLogType?: LogType | null = null;

  // Location capture state
  capturingLocation = false;

  constructor(private attendance: AttendanceService) {}

  ngOnDestroy(): void {
    this.stopCamera();
  }

  onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    this.setPhotoFile(file);
  }

  private setPhotoFile(file: File): void {
    this.photoFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.photoPreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  // Camera helpers
  async startCameraForSubmit(logType: LogType): Promise<void> {
    this.error = undefined;
    // If the browser supports getUserMedia, open an overlay with video
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      this.pendingLogType = logType;
      try {
        this.videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (this.video && this.video.nativeElement) {
          this.video.nativeElement.srcObject = this.videoStream;
          this.video.nativeElement.play().catch(() => {});
        }
        this.capturing = true;
      } catch (err) {
        console.error('Unable to access camera', err);
        // Fall back to file input (mobile browsers will open camera with capture attribute)
        this.openFilePicker();
      }
    } else {
      // No camera API, fall back to file input
      this.openFilePicker();
    }
  }

  cancelCapture(): void {
    this.pendingLogType = null;
    this.stopCamera();
    this.capturing = false;
  }

  private stopCamera(): void {
    try {
      if (this.video && this.video.nativeElement) {
        this.video.nativeElement.pause();
        this.video.nativeElement.srcObject = null;
      }
      this.videoStream?.getTracks().forEach(t => t.stop());
    } catch (e) {
      // ignore
    }
    this.videoStream = null;
  }

  async takePhotoAndSubmit(): Promise<void> {
    if (!this.video || !this.video.nativeElement) return;
    const videoEl = this.video.nativeElement;
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.error = 'Unable to capture photo.';
      return;
    }
    ctx.drawImage(videoEl, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.85));
    if (!blob) {
      this.error = 'Unable to capture photo.';
      return;
    }
    const file = new File([blob], `checkin-${Date.now()}.jpg`, { type: 'image/jpeg' });
    this.setPhotoFile(file);
    this.stopCamera();
    this.capturing = false;

    // Continue with submit using the pending log type
    if (this.pendingLogType) {
      const log = this.pendingLogType;
      this.pendingLogType = null;
      this.submit(log);
    }
  }

  private openFilePicker(): void {
    try {
      this.fileInput?.nativeElement?.click();
    } catch (e) {
      // ignore
    }
  }

  captureLocation(): void {
    if (!('geolocation' in navigator)) {
      this.location = { status: 'unavailable' };
      return;
    }

    this.capturingLocation = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          status: 'ok'
        };
        this.capturingLocation = false;
      },
      err => {
        this.location = { status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' };
        this.capturingLocation = false;
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  submit(logType: LogType): void {
    // If no photo yet, open the camera to capture one and continue submit after capture
    if (!this.photoFile) {
      this.startCameraForSubmit(logType).catch(err => {
        console.error('Failed to start camera for submit', err);
        this.error = 'Unable to access camera. You can try uploading a photo instead.';
      });
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
          this.successMessage = `Check-in recorded (doc ${res.name}). Location: ${res.location ?? (res.latitude && res.longitude ? `${res.latitude},${res.longitude}` : 'not saved')}`;
          // Emit completed so parent can update the list, but keep the sheet open to show success message briefly
          this.completed.emit({ type: logType, name: res.name });
          setTimeout(() => this.close.emit(), 1200);
        },
        error: err => {
          this.loading = false;
          this.error = (err as any)?.error?.message || (err as any)?.message || 'Unable to record check.';
        }
      });
  }
}
