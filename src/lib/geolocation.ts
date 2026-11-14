export interface GeoResult {
  lat: number;
  lng: number;
}

export function requestBrowserLocation(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser. Please enter city and locality manually.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new Error(
                'Location permission was denied. Allow location access in your browser or enter city and locality manually.'
              )
            );
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Current location is unavailable. Please enter your city and locality manually.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out. Please retry or enter your city and locality manually.'));
            break;
          default:
            reject(new Error('Could not determine your location. Please enter city and locality manually.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
