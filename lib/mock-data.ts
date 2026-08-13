import type { RoutingProblem, RoutingResult } from "@/lib/types";
import { createPresetStrategy } from "@/lib/optimization-strategy";

export const recentOptimizations = [
  {
    name: "Milan deliveries",
    status: "Active",
    date: "Today, 08:30 AM",
    stops: "24 stops",
    vehicles: "3 vehicles",
  },
  {
    name: "Brianza morning",
    status: "Completed",
    date: "Yesterday, 07:15 AM",
    stops: "17 stops",
    vehicles: "2 vehicles",
  },
];

export const setupItems = [
  { label: "Route", value: "Depot: Bologna", complete: true },
  { label: "Deliveries", value: "Stops: 25", complete: true },
  {
    label: "Vehicles",
    value: "Vehicles: 3",
    complete: true,
    detail: "Capacity: Set",
  },
  { label: "Constraints", value: "Time windows", complete: false },
  { label: "Goal", value: "Minimize travel time", complete: true },
];

export const summaryMetrics = [
  { label: "Deliveries", value: "24" },
  { label: "Vehicles", value: "3" },
  { label: "Time Windows", value: "5" },
  { label: "Depot", value: "Bologna" },
];

export const resultMetrics = [
  { label: "Total Distance", value: "138", suffix: "km" },
  { label: "Estimated Time", value: "5h 48m" },
  { label: "Vehicles Used", value: "3", suffix: "/ 5" },
  { label: "Total Stops", value: "25" },
];

export const vehicleRoutes = [
  {
    color: "bg-primary-accent",
    distance: "42 km",
    duration: "1h 52m",
    load: "720/800 kg",
    loadNote: "90% Load",
    name: "Van 1",
    selected: true,
    stops: "9 stops",
  },
  {
    color: "bg-violet-500",
    distance: "51 km",
    duration: "2h 10m",
    load: "610/800 kg",
    loadNote: "76% Load",
    name: "Van 2",
    selected: false,
    stops: "8 stops",
  },
  {
    color: "bg-amber-500",
    distance: "45 km",
    duration: "1h 46m",
    load: "780/800 kg",
    loadNote: "98% Load",
    name: "Van 3",
    selected: false,
    stops: "8 stops",
    warning: true,
  },
];

export const mockRoutingProblem: RoutingProblem = {
  id: "problem-bologna-001",
  name: "Bologna delivery plan",
  depot: { address: "Bologna" },
  returnToDepot: true,
  optimizationStrategy: createPresetStrategy("fastest"),
  objective: "minimize_time",
  status: "ready",
  vehicles: [
    { id: "vehicle-1", name: "Van 1", capacity: 800 },
    { id: "vehicle-2", name: "Van 2", capacity: 1200 },
    { id: "vehicle-3", name: "Van 3", capacity: 1000 },
  ],
  stops: [
    {
      id: "stop-rossi-srl",
      name: "Rossi SRL",
      address: "Via Roma 45, Milano",
      demand: 120,
      timeWindow: { start: "09:00", end: "09:15" },
    },
    {
      id: "stop-bianchi-spa",
      name: "Bianchi Spa",
      address: "Corso Como 2, Milano",
      demand: 50,
    },
    {
      id: "stop-verdi-tech",
      name: "Verdi Tech",
      address: "Viale Monza 100, Milano",
      demand: 300,
      timeWindow: { start: "14:00", end: "18:00" },
    },
    {
      id: "stop-giallo-snc",
      name: "Giallo Snc",
      address: "Via Verdi 10, Monza",
      demand: 15,
    },
    {
      id: "stop-ipodromo",
      name: "Ippodromo San Siro",
      address: "Piazzale dello Sport 16, Milano",
      demand: 90,
    },
    {
      id: "stop-novate",
      name: "Novate Milanese Depot Store",
      address: "Via Repubblica 8, Novate Milanese",
      demand: 70,
      timeWindow: { start: "10:00", end: "12:00" },
    },
    {
      id: "stop-bresso",
      name: "Bresso Components",
      address: "Via Roma 22, Bresso",
      demand: 45,
    },
    {
      id: "stop-cinisello",
      name: "Cinisello Market",
      address: "Viale Fulvio Testi 101, Cinisello Balsamo",
      demand: 80,
    },
    {
      id: "stop-sesto",
      name: "Sesto Service Point",
      address: "Piazza Primo Maggio 3, Sesto San Giovanni",
      demand: 55,
      timeWindow: { start: "11:00", end: "13:00" },
    },
    {
      id: "stop-lambrate",
      name: "Lambrate Lab",
      address: "Via Conte Rosso 12, Milano",
      demand: 110,
    },
    {
      id: "stop-porta-romana",
      name: "Porta Romana Retail",
      address: "Corso Lodi 18, Milano",
      demand: 65,
    },
    {
      id: "stop-navigli",
      name: "Navigli Design",
      address: "Ripa di Porta Ticinese 43, Milano",
      demand: 95,
      timeWindow: { start: "13:30", end: "15:30" },
    },
    {
      id: "stop-corsico",
      name: "Corsico Food Hub",
      address: "Via Caboto 9, Corsico",
      demand: 140,
    },
    {
      id: "stop-assago",
      name: "Assago Office Park",
      address: "Strada 4 Palazzo A, Assago",
      demand: 75,
    },
    {
      id: "stop-buccinasco",
      name: "Buccinasco Tools",
      address: "Via Emilia 31, Buccinasco",
      demand: 60,
    },
    {
      id: "stop-chiaravalle",
      name: "Chiaravalle Clinic",
      address: "Via San Bernardo 14, Milano",
      demand: 40,
      timeWindow: { start: "15:00", end: "17:00" },
    },
    {
      id: "stop-san-donato",
      name: "San Donato Pharma",
      address: "Via Emilia 57, San Donato Milanese",
      demand: 130,
    },
    {
      id: "stop-aeroporto",
      name: "Linate Cargo Desk",
      address: "Viale Enrico Forlanini, Milano",
      demand: 85,
    },
    {
      id: "stop-novegro",
      name: "Novegro Expo",
      address: "Via Novegro 12, Segrate",
      demand: 35,
    },
    {
      id: "stop-segrate",
      name: "Segrate Logistics",
      address: "Via Cassanese 224, Segrate",
      demand: 105,
    },
    {
      id: "stop-cologno",
      name: "Cologno Studio",
      address: "Via Milano 43, Cologno Monzese",
      demand: 45,
    },
    {
      id: "stop-san-siro",
      name: "San Siro Hospitality",
      address: "Via Harar 7, Milano",
      demand: 50,
    },
    {
      id: "stop-baggio",
      name: "Baggio Wholesale",
      address: "Via delle Forze Armate 340, Milano",
      demand: 115,
    },
  ],
};

export const mockConversationProblem: RoutingProblem = {
  id: "draft-routing-problem",
  name: "Untitled optimization",
  status: "collecting",
  vehicles: [],
  stops: mockRoutingProblem.stops.map((stop) => ({
    id: stop.id,
    name: stop.name,
    address: stop.address,
    timeWindow: stop.timeWindow,
  })),
};

export const mockRoutingResult: RoutingResult = {
  problemId: mockRoutingProblem.id,
  totalDistanceKm: 138,
  totalDurationMinutes: 348,
  routes: [
    {
      vehicleId: "vehicle-1",
      distanceKm: 42,
      durationMinutes: 112,
      totalLoad: 720,
      stops: [
        {
          stopId: "stop-rossi-srl",
          order: 1,
          eta: "08:21",
          distanceFromPreviousKm: 14,
          durationFromPreviousMinutes: 21,
        },
        {
          stopId: "stop-bianchi-spa",
          order: 2,
          eta: "08:47",
          distanceFromPreviousKm: 8,
          durationFromPreviousMinutes: 26,
        },
        {
          stopId: "stop-novate",
          order: 3,
          eta: "09:35",
          distanceFromPreviousKm: 7,
          durationFromPreviousMinutes: 18,
        },
        {
          stopId: "stop-bresso",
          order: 4,
          eta: "10:05",
          distanceFromPreviousKm: 6,
          durationFromPreviousMinutes: 16,
        },
        {
          stopId: "stop-cinisello",
          order: 5,
          eta: "10:28",
          distanceFromPreviousKm: 5,
          durationFromPreviousMinutes: 14,
        },
        {
          stopId: "stop-sesto",
          order: 6,
          eta: "10:52",
          distanceFromPreviousKm: 4,
          durationFromPreviousMinutes: 12,
        },
        {
          stopId: "stop-cologno",
          order: 7,
          eta: "11:18",
          distanceFromPreviousKm: 6,
          durationFromPreviousMinutes: 15,
        },
        {
          stopId: "stop-segrate",
          order: 8,
          eta: "11:43",
          distanceFromPreviousKm: 5,
          durationFromPreviousMinutes: 14,
        },
        {
          stopId: "stop-lambrate",
          order: 9,
          eta: "12:06",
          distanceFromPreviousKm: 4,
          durationFromPreviousMinutes: 12,
        },
      ],
    },
    {
      vehicleId: "vehicle-2",
      distanceKm: 51,
      durationMinutes: 130,
      totalLoad: 610,
      stops: [
        { stopId: "stop-verdi-tech", order: 1, eta: "10:15" },
        { stopId: "stop-ipodromo", order: 2, eta: "11:05" },
        { stopId: "stop-san-siro", order: 3, eta: "11:22" },
        { stopId: "stop-baggio", order: 4, eta: "11:58" },
        { stopId: "stop-corsico", order: 5, eta: "12:26" },
        { stopId: "stop-buccinasco", order: 6, eta: "12:48" },
        { stopId: "stop-assago", order: 7, eta: "13:17" },
        { stopId: "stop-navigli", order: 8, eta: "13:51" },
      ],
    },
    {
      vehicleId: "vehicle-3",
      distanceKm: 45,
      durationMinutes: 106,
      totalLoad: 780,
      stops: [
        { stopId: "stop-giallo-snc", order: 1, eta: "09:30" },
        { stopId: "stop-porta-romana", order: 2, eta: "09:54" },
        { stopId: "stop-chiaravalle", order: 3, eta: "10:24" },
        { stopId: "stop-san-donato", order: 4, eta: "10:58" },
        { stopId: "stop-aeroporto", order: 5, eta: "11:31" },
        { stopId: "stop-novegro", order: 6, eta: "11:49" },
      ],
    },
  ],
  vehiclesUsed: 3,
  feasible: true,
  warnings: ["Van 3 is near capacity at 98% load."],
  solverStatus: "feasible",
  solveTimeMs: 42,
  droppedStops: [],
  servedStops: 23,
  droppedStopsCount: 0,
  optimizationStrategySummary: "Fastest",
  objectiveMetrics: {
    totalTravelTimeSeconds: 20880,
    totalDistanceMeters: 138000,
    vehiclesUsed: 3,
    workloadSpanSeconds: 1440,
  },
  objectiveScore: 1840,
  objectivePasses: [
    {
      objective: "minimize_time",
      status: "completed",
      durationMs: 42,
      metricValue: 20880,
    },
    {
      objective: "minimize_distance",
      status: "completed",
      durationMs: 0,
      metricValue: 138000,
    },
  ],
};
