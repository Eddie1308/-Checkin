import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { AttendanceService } from '../../core/attendance.service';
import { GeoService, GeoLocation } from '../../core/geo.service';
import { Employee } from '../../models/employee.model';
import { LogType } from '../../models/checkin.model';
import { firstValueFrom } from 'rxjs';

type LocationDiagnostics = {
  code?: number;
  message?: string;
  codeLabel?: string;
  secureContext: boolean;
  origin: string;
};

@Component({
  selector: 'app-employee-action',
  templateUrl: './employee-action.component.html',
  styleUrls: ['./employee-action.component.scss']
})
export class EmployeeActionComponent implements OnDestroy {
  @Input() employee!: Employee;
  @Input() supervisor!: Employee;
  @Output() close = new EventEmitter<void>();
  @Output() completed = new EventEmitter<{ type: LogType; name: string }>();

  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  photoFile?: File;
  photoPreviewUrl?: string;
  location?: { lat?: number; lng?: number; accuracy?: number };
  locationTimestamp?: number;
  locationMessage?: string;
  locationDiagnostics?: LocationDiagnostics;
  openingCamera = false;
  gettingLocation = false;
  submitting = false;
  loading = false;
  error?: string;
  successMessage?: string;
  statusText?: string;

  private pendingAction?: LogType | null = null;
  private lastAction?: LogType | null = null;
  private lastGpsDurationMs = 0;

  constructor(private attendance: AttendanceService, private geo: GeoService) {}

  ngOnDestroy(): void {
    this.revokePreviewUrl();
  }

  async onCameraChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    this.openingCamera = false;
    this.statusText = undefined;
    if (!file) {
      this.pendingAction = null;
      target.value = '';
      this.gettingLocation = false;
      return;
    }
    if (!this.pendingAction) {
      target.value = '';
      return;
    }

    const normalizedFile = await this.normalizePhoto(file);
    this.setPhotoFile(normalizedFile);
    const gpsStart = performance.now();
    if (!this.isLocationFresh(60000)) {
      this.gettingLocation = true;
      this.statusText = 'Getting location...';
      this.locationDiagnostics = undefined;
      try {
        const pos = await this.geo.getFastLocation();
        this.applyLocation(pos);
        this.lastGpsDurationMs = performance.now() - gpsStart;
      } catch (err) {
        this.gettingLocation = false;
        this.statusText = undefined;
        this.pendingAction = null;
        this.location = undefined;
        this.locationTimestamp = undefined;
        this.locationDiagnostics = this.buildDiagnostics(err);
        this.locationMessage = this.describeLocationError(err);
        this.clearPhoto();
        target.value = '';
        return;
      }
      this.gettingLocation = false;
    } else {
      this.lastGpsDurationMs = 0;
    }

    this.statusText = 'Submitting...';
    const logType = this.pendingAction;
    this.pendingAction = null;
    await this.submit(logType, normalizedFile, this.lastGpsDurationMs);
    target.value = '';
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    if (this.openingCamera && !this.submitting) {
      this.openingCamera = false;
      this.statusText = undefined;
    }
  }

  startAction(logType: LogType): void {
    if (this.loading || this.gettingLocation || this.openingCamera || this.submitting || this.pendingAction) {
      return;
    }
    this.error = undefined;
    this.successMessage = undefined;
    this.locationMessage = undefined;
    this.locationDiagnostics = undefined;
    this.pendingAction = logType;
    this.lastAction = logType;
    this.statusText = 'Opening camera...';
    this.openCamera();
  }

  retakePhoto(): void {
    if (this.openingCamera || this.gettingLocation || this.submitting) {
      return;
    }
    this.clearPhoto();
    if (!this.lastAction) {
      return;
    }
    this.pendingAction = this.lastAction;
    this.statusText = 'Opening camera...';
    this.openCamera();
  }

  retryLocation(): void {
    if (this.gettingLocation || this.submitting) {
      return;
    }
    this.requestLocationOnly();
  }

  private requestLocationOnly(): void {
    this.gettingLocation = true;
    this.statusText = 'Getting location...';
    this.locationMessage = undefined;
    this.locationDiagnostics = undefined;
    const started = performance.now();
    this.geo
      .retryLocation()
      .then(pos => {
        this.applyLocation(pos);
        this.locationDiagnostics = undefined;
        this.gettingLocation = false;
        this.statusText = undefined;
        this.lastGpsDurationMs = performance.now() - started;
      })
      .catch(err => {
        this.gettingLocation = false;
        this.statusText = undefined;
        this.location = undefined;
        this.locationTimestamp = undefined;
        this.locationDiagnostics = this.buildDiagnostics(err);
        this.locationMessage = this.describeLocationError(err);
      });
  }

  private openCamera(): void {
    if (!this.pendingAction) {
      this.statusText = undefined;
      return;
    }
    this.openingCamera = true;
    try {
      if (this.cameraInput && this.cameraInput.nativeElement) {
        this.cameraInput.nativeElement.value = '';
        this.cameraInput.nativeElement.click();
      }
    } catch (e) {
      this.openingCamera = false;
      this.statusText = undefined;
      this.error = 'Unable to access camera.';
    }
  }

  private async submit(logType: LogType, photoFile: File, gpsDurationMs: number): Promise<void> {
    this.error = undefined;
    this.loading = true;
    this.submitting = true;
    const totalStart = performance.now();
    let createDuration = 0;
    let uploadDuration = 0;
    const refreshDuration = 0;

    try {
      console.log(`TIMING gps=${Math.round(gpsDurationMs)}ms`);
      const custom_client_uuid = this.attendance.generateClientUuid();
      const payload = {
        employee: this.employee.name,
        log_type: logType,
        custom_site_supervisor: this.supervisor.name,
        custom_lat: this.location?.lat,
        custom_lng: this.location?.lng,
        custom_accuracy: this.location?.accuracy,
        custom_location_status: 'ok',
        custom_client_uuid,
        latitude: typeof this.location?.lat === 'number' ? this.location?.lat : undefined,
        longitude: typeof this.location?.lng === 'number' ? this.location?.lng : undefined,
        location_status: 'ok',
        location:
          typeof this.location?.lat === 'number' && typeof this.location?.lng === 'number'
            ? `${this.location?.lat},${this.location?.lng}`
            : undefined
      } as any;

      const createStart = performance.now();
      const created = await firstValueFrom(this.attendance.createCheckin(payload));
      createDuration = performance.now() - createStart;
      console.log(`TIMING create=${Math.round(createDuration)}ms`);
      const createdName = created?.data?.name;

      const uploadStart = performance.now();
      if (createdName && photoFile) {
        await firstValueFrom(this.attendance.attachFileToCheckin(createdName, photoFile));
      }
      uploadDuration = performance.now() - uploadStart;
      console.log(`TIMING upload=${Math.round(uploadDuration)}ms`);
      console.log(`TIMING refresh=${Math.round(refreshDuration)}ms`);

      const totalDuration = performance.now() - totalStart;
      console.log(
        `TIMINGS gps=${Math.round(gpsDurationMs)}ms create=${Math.round(createDuration)}ms upload=${Math.round(uploadDuration)}ms refresh=${Math.round(refreshDuration)}ms total=${Math.round(totalDuration)}ms`
      );

      this.loading = false;
      this.submitting = false;
      this.statusText = undefined;
      this.successMessage = `Check-in recorded (doc ${createdName}). Location: ${this.location?.lat && this.location?.lng ? `${this.location?.lat},${this.location?.lng}` : 'not saved'}`;
      if (createdName) {
        this.completed.emit({ type: logType, name: createdName });
      }
      setTimeout(() => this.close.emit(), 1200);
    } catch (err) {
      const totalDuration = performance.now() - totalStart;
      console.log(
        `TIMINGS gps=${Math.round(gpsDurationMs)}ms create=${Math.round(createDuration)}ms upload=${Math.round(uploadDuration)}ms refresh=${Math.round(refreshDuration)}ms total=${Math.round(totalDuration)}ms`
      );
      this.loading = false;
      this.submitting = false;
      this.statusText = undefined;
      this.error = (err as any)?.error?.message || (err as any)?.message || 'Unable to record check.';
    }
  }

  private setPhotoFile(file: File): void {
    this.photoFile = file;
    this.revokePreviewUrl();
    this.photoPreviewUrl = URL.createObjectURL(file);
  }

  private async normalizePhoto(file: File): Promise<File> {
    if (typeof createImageBitmap !== 'function') {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return file;
      }
      ctx.drawImage(bitmap, 0, 0);
      const outputType = file.type || 'image/jpeg';
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, outputType, 0.92));
      if (!blob) {
        return file;
      }
      return new File([blob], file.name, { type: outputType });
    } catch {
      return file;
    }
  }

  private clearPhoto(): void {
    this.photoFile = undefined;
    this.revokePreviewUrl();
  }

  private revokePreviewUrl(): void {
    if (this.photoPreviewUrl) {
      URL.revokeObjectURL(this.photoPreviewUrl);
      this.photoPreviewUrl = undefined;
    }
  }

  private applyLocation(pos: GeoLocation): void {
    this.location = { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy };
    this.locationTimestamp = pos.timestamp;
  }

  private isLocationFresh(maxAgeMs: number): boolean {
    if (!this.location || !this.locationTimestamp) {
      return false;
    }
    return Date.now() - this.locationTimestamp <= maxAgeMs;
  }

  private buildDiagnostics(error: unknown): LocationDiagnostics {
    const code = (error as any)?.code;
    const message = (error as any)?.message;
    return {
      code,
      message,
      codeLabel: this.mapCodeLabel(code),
      secureContext: window.isSecureContext,
      origin: window.location.origin
    };
  }

  private mapCodeLabel(code?: number): string | undefined {
    if (code === 1) return 'PERMISSION_DENIED';
    if (code === 2) return 'POSITION_UNAVAILABLE';
    if (code === 3) return 'TIMEOUT';
    return undefined;
  }

  private describeLocationError(error?: unknown): string {
    const code = (error as any)?.code;
    if (code === 1) {
      return 'Location permission denied. iPhone Settings -> Privacy & Security -> Location Services -> enable for this site.';
    }
    if (code === 2) {
      return 'Location unavailable. Please enable Location Services and try again.';
    }
    if (code === 3) {
      return 'Location request timed out. Please try again.';
    }
    return 'Location is required. Please enable location and try again.';
  }
}
