export interface PlanetStats {
  radiusKm: string;
  distanceAU: string;
  periodDays: string;
  moons: string;
  type: string;
}

export interface PlanetConfig {
  name: string;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  selfRotSpeed: number;
  shininess: number;
  color: [number, number, number];
  secondaryColor: [number, number, number];
  patternType: number;   // 0=rocky  1=gas bands  2=ice  3=earth
  startAngle: number;
  bumpIntensity: number;
  atmosphereStrength: number;
  atmosphereColor: [number, number, number];
  dotColor: string;      // CSS color for sidebar dot
  stats: PlanetStats;
}

export const SUN_RADIUS = 2.5;
export const SUN_COLOR: [number, number, number] = [1.0, 0.95, 0.4];

export const planets: PlanetConfig[] = [
  {
    name: "Mercury",
    radius: 0.30, orbitRadius:  4.5, orbitSpeed: 1.61, selfRotSpeed: 0.02,
    shininess: 12, bumpIntensity: 1.2,
    color:          [0.68, 0.64, 0.60],
    secondaryColor: [0.42, 0.40, 0.38],
    patternType: 0, startAngle: 0.0,
    atmosphereStrength: 0.0,
    atmosphereColor: [0.68, 0.64, 0.60],
    dotColor: "#b3a89a",
    stats: {
      radiusKm:   "2,439 km",
      distanceAU: "0.39 AU",
      periodDays: "88 days",
      moons:      "0",
      type:       "Terrestrial",
    },
  },
  {
    name: "Venus",
    radius: 0.58, orbitRadius:  7.0, orbitSpeed: 1.18, selfRotSpeed: 0.015,
    shininess: 18, bumpIntensity: 0.5,
    color:          [0.92, 0.76, 0.40],
    secondaryColor: [0.75, 0.58, 0.25],
    patternType: 0, startAngle: 1.0,
    atmosphereStrength: 0.42,
    atmosphereColor: [0.95, 0.82, 0.45],
    dotColor: "#e8c060",
    stats: {
      radiusKm:   "6,051 km",
      distanceAU: "0.72 AU",
      periodDays: "225 days",
      moons:      "0",
      type:       "Terrestrial",
    },
  },
  {
    name: "Earth",
    radius: 0.62, orbitRadius:  9.5, orbitSpeed: 1.00, selfRotSpeed: 0.50,
    shininess: 52, bumpIntensity: 0.6,
    color:          [0.18, 0.42, 0.88],
    secondaryColor: [0.22, 0.52, 0.18],
    patternType: 3, startAngle: 2.0,
    atmosphereStrength: 0.38,
    atmosphereColor: [0.30, 0.55, 1.00],
    dotColor: "#3a7adf",
    stats: {
      radiusKm:   "6,371 km",
      distanceAU: "1.00 AU",
      periodDays: "365.25 days",
      moons:      "1",
      type:       "Terrestrial",
    },
  },
  {
    name: "Mars",
    radius: 0.42, orbitRadius: 12.0, orbitSpeed: 0.80, selfRotSpeed: 0.48,
    shininess: 14, bumpIntensity: 1.0,
    color:          [0.82, 0.30, 0.12],
    secondaryColor: [0.52, 0.18, 0.08],
    patternType: 0, startAngle: 0.5,
    atmosphereStrength: 0.16,
    atmosphereColor: [0.90, 0.40, 0.18],
    dotColor: "#c44d1f",
    stats: {
      radiusKm:   "3,389 km",
      distanceAU: "1.52 AU",
      periodDays: "687 days",
      moons:      "2",
      type:       "Terrestrial",
    },
  },
  {
    name: "Jupiter",
    radius: 2.20, orbitRadius: 17.0, orbitSpeed: 0.43, selfRotSpeed: 1.20,
    shininess:  8, bumpIntensity: 0.05,
    color:          [0.80, 0.64, 0.44],
    secondaryColor: [0.60, 0.36, 0.22],
    patternType: 1, startAngle: 1.2,
    atmosphereStrength: 0.28,
    atmosphereColor: [0.88, 0.72, 0.50],
    dotColor: "#c8a060",
    stats: {
      radiusKm:   "69,911 km",
      distanceAU: "5.20 AU",
      periodDays: "4,333 days",
      moons:      "95",
      type:       "Gas Giant",
    },
  },
  {
    name: "Saturn",
    radius: 1.75, orbitRadius: 22.0, orbitSpeed: 0.32, selfRotSpeed: 1.10,
    shininess: 10, bumpIntensity: 0.05,
    color:          [0.90, 0.84, 0.58],
    secondaryColor: [0.72, 0.60, 0.35],
    patternType: 1, startAngle: 3.0,
    atmosphereStrength: 0.22,
    atmosphereColor: [0.95, 0.88, 0.58],
    dotColor: "#ddd070",
    stats: {
      radiusKm:   "58,232 km",
      distanceAU: "9.58 AU",
      periodDays: "10,759 days",
      moons:      "146",
      type:       "Gas Giant",
    },
  },
  {
    name: "Uranus",
    radius: 1.05, orbitRadius: 27.0, orbitSpeed: 0.22, selfRotSpeed: 0.70,
    shininess: 28, bumpIntensity: 0.1,
    color:          [0.50, 0.86, 0.90],
    secondaryColor: [0.32, 0.68, 0.78],
    patternType: 2, startAngle: 0.8,
    atmosphereStrength: 0.26,
    atmosphereColor: [0.45, 0.88, 0.95],
    dotColor: "#70d8e8",
    stats: {
      radiusKm:   "25,362 km",
      distanceAU: "19.2 AU",
      periodDays: "30,589 days",
      moons:      "28",
      type:       "Ice Giant",
    },
  },
  {
    name: "Neptune",
    radius: 0.98, orbitRadius: 32.0, orbitSpeed: 0.14, selfRotSpeed: 0.65,
    shininess: 32, bumpIntensity: 0.1,
    color:          [0.18, 0.28, 0.92],
    secondaryColor: [0.08, 0.12, 0.65],
    patternType: 2, startAngle: 2.5,
    atmosphereStrength: 0.26,
    atmosphereColor: [0.22, 0.38, 1.00],
    dotColor: "#2e47eb",
    stats: {
      radiusKm:   "24,622 km",
      distanceAU: "30.1 AU",
      periodDays: "59,800 days",
      moons:      "16",
      type:       "Ice Giant",
    },
  },
];
