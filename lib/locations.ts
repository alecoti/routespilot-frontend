import type { GeoLocation } from "@/lib/types";

export function getLocationAddress(location?: GeoLocation) {
  return location?.address;
}

export function formatLocationAddress(location?: GeoLocation) {
  return location?.address?.trim() || "Not set";
}

export function hasCoordinates(location?: GeoLocation) {
  return (
    typeof location?.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude)
  );
}

export function createLocation(address: string): GeoLocation {
  return {
    address,
  };
}
