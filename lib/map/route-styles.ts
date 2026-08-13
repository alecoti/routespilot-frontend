const routeColors = [
  "#0f766e",
  "#7c3aed",
  "#d97706",
  "#2563eb",
  "#be123c",
  "#15803d",
];

export function getVehicleRouteColor(vehicleId: string) {
  const hash = [...vehicleId].reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );

  return routeColors[hash % routeColors.length];
}
