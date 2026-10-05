export interface City { id: string; en: string; ar: string; lon: number; lat: number }

export const CITIES: Record<string, City> = {
  jeddah: { id: "jeddah", en: "Jeddah", ar: "جدة", lon: 39.17, lat: 21.54 },
  riyadh: { id: "riyadh", en: "Riyadh", ar: "الرياض", lon: 46.68, lat: 24.71 },
  dammam: { id: "dammam", en: "Dammam", ar: "الدمام", lon: 50.1, lat: 26.43 },
  madinah: { id: "madinah", en: "Madinah", ar: "المدينة المنورة", lon: 39.61, lat: 24.47 },
  tabuk: { id: "tabuk", en: "Tabuk", ar: "تبوك", lon: 36.57, lat: 28.38 },
  jizan: { id: "jizan", en: "Jizan", ar: "جازان", lon: 42.55, lat: 16.89 },
  buraydah: { id: "buraydah", en: "Buraydah", ar: "بريدة", lon: 43.97, lat: 26.33 },
};

export interface RouteDef { id: string; from: string; to: string; bend: number; weight: number }

export const ROUTES: RouteDef[] = [
  { id: "jed-ruh", from: "jeddah", to: "riyadh", bend: 0.09, weight: 22 },
  { id: "dmm-ruh", from: "dammam", to: "riyadh", bend: 0.06, weight: 20 },
  { id: "jed-med", from: "jeddah", to: "madinah", bend: 0.05, weight: 12 },
  { id: "jiz-jed", from: "jizan", to: "jeddah", bend: -0.05, weight: 9 },
  { id: "tab-ruh", from: "tabuk", to: "riyadh", bend: 0.05, weight: 9 },
  { id: "ruh-bur", from: "riyadh", to: "buraydah", bend: 0.06, weight: 7 },
  { id: "dmm-jed", from: "dammam", to: "jeddah", bend: 0.12, weight: 16 },
  { id: "med-tab", from: "madinah", to: "tabuk", bend: 0.04, weight: 5 },
];
