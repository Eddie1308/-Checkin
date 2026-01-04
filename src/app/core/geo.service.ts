import { Injectable } from '@angular/core';

export type GeoLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
};

@Injectable({
  providedIn: 'root'
})
export class GeoService {
  private lastLocation?: GeoLocation;

  getCachedLocation(maxAgeMs = 30000): GeoLocation | null {
    if (!this.lastLocation) {
      return null;
    }
    if (Date.now() - this.lastLocation.timestamp > maxAgeMs) {
      return null;
    }
    return this.lastLocation;
  }

  async getFastLocation(): Promise<GeoLocation> {
    const location = await this.requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    this.lastLocation = location;
    return location;
  }

  async retryLocation(): Promise<GeoLocation> {
    const location = await this.requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    this.lastLocation = location;
    return location;
  }

  requestLocation(options: PositionOptions): Promise<GeoLocation> {
    if (!('geolocation' in navigator)) {
      return Promise.reject({ code: 2, message: 'unavailable' });
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: Date.now()
          };
          this.lastLocation = location;
          resolve(location);
        },
        err => {
          reject(err);
        },
        options
      );
    });
  }
}
