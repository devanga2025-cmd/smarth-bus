export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function isValidCoordinate(
  latitude: number,
  longitude: number,
): boolean {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }

  if (latitude < -90 || latitude > 90) {
    return false;
  }

  if (longitude < -180 || longitude > 180) {
    return false;
  }

  return !(latitude === 0 && longitude === 0);
}