export type LogType = 'IN' | 'OUT';

export interface CheckinPayload {
  employee: string;
  log_type: LogType;
  time?: string;
  custom_site_supervisor?: string;
  custom_lat?: number;
  custom_lng?: number;
  custom_accuracy?: number;
  custom_location_status?: 'ok' | 'denied' | 'unavailable';
  custom_client_uuid?: string;
}

export interface CheckinResponse {
  data: {
    name: string;
  };
}
