const { PANEL_SPECS, TARIFF_EUR_KWH } = require('./farms');

/**
 * Calcule l'irradiance selon l'heure (modèle sinusoïdal simplifié)
 * @param {number} hour - Heure de la journée (0-23)
 * @param {number} maxIrradiance - Irradiance maximale de la ferme
 * @returns {number} Irradiance en W/m²
 */
function calculateIrradiance(hour, maxIrradiance) {
  // Production solaire entre 6h et 18h
  if (hour < 6 || hour >= 18) {
    return 0;
  }
  // Modèle sinusoïdal : sin(π × (h - 6) / 12)
  const irradiance = maxIrradiance * Math.sin((Math.PI * (hour - 6)) / 12);
  // Ajout d'une variation aléatoire de ±10% (nuages)
  const variation = 1 + (Math.random() - 0.5) * 0.2;
  return Math.max(0, irradiance * variation);
}

/**
 * Calcule la température ambiante selon l'heure
 * @param {number} hour - Heure de la journée
 * @param {number} baseTemp - Température de base (varie selon saison/région)
 * @returns {number} Température en °C
 */
function calculateAmbientTemperature(hour, baseTemp = 22) {
  // Variation jour/nuit de ~10°C
  const hourOffset = hour - 14; // Maximum à 14h
  const tempVariation = -5 * Math.cos((Math.PI * hourOffset) / 12);
  return baseTemp + tempVariation + (Math.random() - 0.5) * 2;
}

/**
 * Calcule la température du panneau
 * @param {number} ambientTemp - Température ambiante en °C
 * @param {number} irradiance - Irradiance en W/m²
 * @returns {number} Température panneau en °C
 */
function calculatePanelTemperature(ambientTemp, irradiance) {
  // T_panneau = T_ambiante + (irradiance/1000) × 25
  return ambientTemp + (irradiance / 1000) * 25;
}

/**
 * Calcule le facteur de correction de température
 * @param {number} panelTemp - Température du panneau en °C
 * @returns {number} Facteur de correction (< 1 si chaud, > 1 si froid)
 */
function calculateTemperatureFactor(panelTemp) {
  // facteur_temp = 1 + (T_panneau - 25) × (-0.0035)
  return 1 + (panelTemp - PANEL_SPECS.nominalTemperature) * PANEL_SPECS.temperatureCoefficient;
}

/**
 * Calcule la production théorique instantanée
 * @param {Object} farm - Configuration de la ferme
 * @param {number} irradiance - Irradiance en W/m²
 * @param {number} panelTemp - Température du panneau en °C
 * @returns {number} Production en kW
 */
function calculateTheoreticalPower(farm, irradiance, panelTemp) {
  // P(t) = Nb_panneaux × Puissance_crête × (Irradiance/1000) × η_système × Facteur_temp
  const tempFactor = calculateTemperatureFactor(panelTemp);
  const powerWatts =
    farm.panels *
    PANEL_SPECS.peakPower *
    (irradiance / 1000) *
    PANEL_SPECS.systemEfficiency *
    tempFactor;
  return Math.max(0, powerWatts / 1000); // Convertir en kW
}

/**
 * Calcule les revenus journaliers
 * @param {number} energyKwh - Énergie produite en kWh
 * @returns {number} Revenus en euros
 */
function calculateRevenue(energyKwh) {
  return energyKwh * TARIFF_EUR_KWH;
}

/**
 * Génère une anomalie aléatoire (10% de chance)
 * @returns {Object} Type d'anomalie et ses effets
 */
function generateAnomaly() {
  const rand = Math.random();

  if (rand > 0.10) {
    return { type: 'NORMAL', severity: 'none', effects: {} };
  }

  const anomalyRand = Math.random();

  if (anomalyRand < 0.33) {
    // Surchauffe (> 65°C)
    return {
      type: 'OVERHEAT',
      severity: 'high',
      effects: { tempBoost: 25, productionFactor: 0.88 },
    };
  } else if (anomalyRand < 0.55) {
    // Panne onduleur
    const failedInverter = Math.floor(Math.random() * 4) + 1;
    return {
      type: 'INVERTER_DOWN',
      severity: 'critical',
      effects: { failedInverter, productionFactor: 0.67 },
    };
  } else if (anomalyRand < 0.75) {
    // Dégradation
    return {
      type: 'DEGRADATION',
      severity: 'medium',
      effects: { productionFactor: 0.85 },
    };
  } else if (anomalyRand < 0.90) {
    // Ombrage
    return {
      type: 'SHADING',
      severity: 'low',
      effects: { productionFactor: 0.60 },
    };
  } else {
    // Capteur défaillant
    return {
      type: 'SENSOR_FAIL',
      severity: 'medium',
      effects: { sensorFail: true },
    };
  }
}

/**
 * Génère les données complètes pour une ferme
 * @param {Object} farm - Configuration de la ferme
 * @returns {Object} Données de la ferme
 */
function generateFarmData(farm) {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  // Calculs de base
  const irradiance = calculateIrradiance(hour, farm.maxIrradiance);
  const ambientTemp = calculateAmbientTemperature(hour);
  let panelTemp = calculatePanelTemperature(ambientTemp, irradiance);
  let theoreticalPower = calculateTheoreticalPower(farm, irradiance, panelTemp);
  let actualPower = theoreticalPower;

  // Génération d'anomalie
  const anomaly = generateAnomaly();

  // Application des effets d'anomalie
  if (anomaly.effects.tempBoost) {
    panelTemp += anomaly.effects.tempBoost;
  }
  if (anomaly.effects.productionFactor) {
    actualPower *= anomaly.effects.productionFactor;
  }

  // État des onduleurs
  const inverterStatus = [];
  for (let i = 1; i <= farm.inverters; i++) {
    if (anomaly.effects.failedInverter === i) {
      inverterStatus.push({ id: `INV${i.toString().padStart(2, '0')}`, status: 0 });
    } else {
      inverterStatus.push({ id: `INV${i.toString().padStart(2, '0')}`, status: 1 });
    }
  }

  // Calcul du rendement
  const efficiency = theoreticalPower > 0 ? (actualPower / theoreticalPower) * 100 : 0;

  // Tension et courant (valeurs moyennes par panneau)
  const voltage = irradiance > 0 ? PANEL_SPECS.optimalVoltage * (0.9 + Math.random() * 0.15) : 0;
  const current = irradiance > 0 ? PANEL_SPECS.optimalCurrent * (irradiance / 1000) : 0;

  return {
    farm: farm.name,
    timestamp: now.toISOString(),
    irradiance: Math.round(irradiance * 10) / 10,
    ambientTemp: Math.round(ambientTemp * 10) / 10,
    panelTemp: Math.round(panelTemp * 10) / 10,
    theoreticalPower: Math.round(theoreticalPower * 10) / 10,
    actualPower: Math.round(actualPower * 10) / 10,
    efficiency: Math.round(efficiency * 10) / 10,
    voltage: Math.round(voltage * 10) / 10,
    current: Math.round(current * 100) / 100,
    inverterStatus,
    anomaly: {
      type: anomaly.type,
      severity: anomaly.severity,
    },
    sensorFail: anomaly.effects.sensorFail || false,
  };
}

module.exports = {
  calculateIrradiance,
  calculateAmbientTemperature,
  calculatePanelTemperature,
  calculateTemperatureFactor,
  calculateTheoreticalPower,
  calculateRevenue,
  generateAnomaly,
  generateFarmData,
};
