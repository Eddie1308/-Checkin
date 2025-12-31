export type LogType = 'IN' | 'OUT';

export interface CheckinPayload {
  employee: string;
  log_type: LogType;
  time?: string;
  custom_site_supervisor?: string;
  // Legacy/custom fields
  custom_lat?: number;
  custom_lng?: number;
  custom_accuracy?: number;
  custom_location_status?: 'ok' | 'denied' | 'unavailable';
  custom_client_uuid?: string;
  // ERPNext standard fields — include these so coordinates are stored in the expected place
  latitude?: number;
  longitude?: number;
  location_status?: 'ok' | 'denied' | 'unavailable';
}

export interface CheckinResponse {
  data: {
    name: string;
  };
}
