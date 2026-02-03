// Configuration des 3 fermes solaires
const farms = {
  provence: {
    name: 'provence',
    location: 'Marseille',
    latitude: 43.3,
    panels: 5000,
    capacityMW: 2.0,
    inverters: 4,
    maxIrradiance: 1000, // W/m² en été
  },
  occitanie: {
    name: 'occitanie',
    location: 'Montpellier',
    latitude: 43.6,
    panels: 3500,
    capacityMW: 1.4,
    inverters: 3,
    maxIrradiance: 980,
  },
  aquitaine: {
    name: 'aquitaine',
    location: 'Bordeaux',
    latitude: 44.8,
    panels: 4200,
    capacityMW: 1.68,
    inverters: 4,
    maxIrradiance: 950,
  },
};

// Constantes panneaux solaires (standard industriel)
const PANEL_SPECS = {
  peakPower: 400, // W
  optimalVoltage: 41.5, // V
  optimalCurrent: 9.65, // A
  temperatureCoefficient: -0.0035, // -0.35%/°C
  systemEfficiency: 0.85, // pertes câblage, onduleur, poussière
  nominalTemperature: 25, // °C (STC)
};

// Tarif rachat EDF OA
const TARIFF_EUR_KWH = 0.18;

module.exports = { farms, PANEL_SPECS, TARIFF_EUR_KWH };
