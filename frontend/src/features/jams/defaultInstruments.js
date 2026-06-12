export const DEFAULT_JAM_INSTRUMENTS = [
  { id: "vocal", name: "Chant", order: 0, isDefault: true },
  { id: "guitar", name: "Guitare", order: 1, isDefault: true },
  { id: "bass", name: "Basse", order: 2, isDefault: true },
  { id: "drums", name: "Batterie", order: 3, isDefault: true },
  { id: "piano", name: "Piano", order: 4, isDefault: true },
  { id: "other", name: "Autre", order: 5, isDefault: true },
];

export const DEFAULT_JAM_INSTRUMENT_NAMES = DEFAULT_JAM_INSTRUMENTS.map((instrument) => instrument.name);

export function getDefaultJamInstruments() {
  return DEFAULT_JAM_INSTRUMENTS.map((instrument) => ({ ...instrument }));
}
