const client = require('prom-client');
const { farms } = require('./farms');
const { generateFarmData, calculateRevenue } = require('./calculator');

// Créer un registre personnalisé
const register = new client.Registry();

// Ajouter les métriques par défaut (CPU, mémoire, etc.)
client.collectDefaultMetrics({ register });

// === Métriques personnalisées pour les fermes solaires ===

// Production électrique instantanée (W)
const solarPowerWatts = new client.Gauge({
  name: 'solar_power_watts',
  help: 'Production électrique instantanée en watts',
  labelNames: ['farm', 'panel_id'],
  registers: [register],
});

// Production totale par ferme (kW)
const solarPowerKw = new client.Gauge({
  name: 'solar_power_kw',
  help: 'Production électrique totale par ferme en kW',
  labelNames: ['farm'],
  registers: [register],
});

// Irradiance solaire (W/m²)
const solarIrradiance = new client.Gauge({
  name: 'solar_irradiance_wm2',
  help: 'Irradiance solaire mesurée en W/m²',
  labelNames: ['farm'],
  registers: [register],
});

// Température panneau (°C)
const solarPanelTemperature = new client.Gauge({
  name: 'solar_panel_temperature_celsius',
  help: 'Température du panneau en degrés Celsius',
  labelNames: ['farm', 'panel_id'],
  registers: [register],
});

// Température ambiante (°C)
const solarAmbientTemperature = new client.Gauge({
  name: 'solar_ambient_temperature_celsius',
  help: 'Température ambiante en degrés Celsius',
  labelNames: ['farm'],
  registers: [register],
});

// État onduleur (1=OK, 0=KO)
const solarInverterStatus = new client.Gauge({
  name: 'solar_inverter_status',
  help: 'État de l\'onduleur (1=OK, 0=KO)',
  labelNames: ['farm', 'inverter_id'],
  registers: [register],
});

// Tension (V)
const solarVoltage = new client.Gauge({
  name: 'solar_voltage_volts',
  help: 'Tension moyenne des panneaux en volts',
  labelNames: ['farm'],
  registers: [register],
});

// Courant (A)
const solarCurrent = new client.Gauge({
  name: 'solar_current_amps',
  help: 'Courant moyen des panneaux en ampères',
  labelNames: ['farm'],
  registers: [register],
});

// Rendement (%)
const solarEfficiency = new client.Gauge({
  name: 'solar_efficiency_percent',
  help: 'Rendement global de la ferme en pourcentage',
  labelNames: ['farm'],
  registers: [register],
});

// Revenus journaliers (€)
const solarDailyRevenue = new client.Counter({
  name: 'solar_daily_revenue_euros',
  help: 'Revenus journaliers estimés en euros',
  labelNames: ['farm'],
  registers: [register],
});

// Production théorique (kW)
const solarTheoreticalPower = new client.Gauge({
  name: 'solar_theoretical_power_kw',
  help: 'Production théorique en kW',
  labelNames: ['farm'],
  registers: [register],
});

// Compteur d'anomalies
const solarAnomalyCount = new client.Counter({
  name: 'solar_anomaly_total',
  help: 'Nombre total d\'anomalies détectées',
  labelNames: ['farm', 'type', 'severity'],
  registers: [register],
});

// État du capteur (1=OK, 0=KO)
const solarSensorStatus = new client.Gauge({
  name: 'solar_sensor_status',
  help: 'État du capteur (1=OK, 0=KO)',
  labelNames: ['farm'],
  registers: [register],
});

// Disponibilité de la ferme
const solarAvailability = new client.Gauge({
  name: 'solar_availability_ratio',
  help: 'Ratio de disponibilité de la ferme (0-1)',
  labelNames: ['farm'],
  registers: [register],
});

// Stocker les données actuelles pour l'API
let currentData = {};

/**
 * Met à jour toutes les métriques pour toutes les fermes
 */
function updateMetrics() {
  for (const farmKey of Object.keys(farms)) {
    const farm = farms[farmKey];
    const data = generateFarmData(farm);
    currentData[farmKey] = data;

    // Ne pas mettre à jour si capteur en panne (sauf le status)
    if (data.sensorFail) {
      solarSensorStatus.set({ farm: farmKey }, 0);
      solarAnomalyCount.inc({ farm: farmKey, type: data.anomaly.type, severity: data.anomaly.severity });
      continue;
    }

    solarSensorStatus.set({ farm: farmKey }, 1);

    // Production totale par ferme
    solarPowerKw.set({ farm: farmKey }, data.actualPower);

    // Production par panneau (simulation avec quelques panneaux représentatifs)
    const panelCount = 5; // 5 panneaux représentatifs
    const powerPerPanel = (data.actualPower * 1000) / farm.panels;
    for (let i = 1; i <= panelCount; i++) {
      const panelId = `P${i.toString().padStart(3, '0')}`;
      const variation = 0.95 + Math.random() * 0.1; // ±5% variation
      solarPowerWatts.set({ farm: farmKey, panel_id: panelId }, powerPerPanel * variation);
      solarPanelTemperature.set({ farm: farmKey, panel_id: panelId }, data.panelTemp + (Math.random() - 0.5) * 3);
    }

    // Autres métriques
    solarIrradiance.set({ farm: farmKey }, data.irradiance);
    solarAmbientTemperature.set({ farm: farmKey }, data.ambientTemp);
    solarVoltage.set({ farm: farmKey }, data.voltage);
    solarCurrent.set({ farm: farmKey }, data.current);
    solarEfficiency.set({ farm: farmKey }, data.efficiency);
    solarTheoreticalPower.set({ farm: farmKey }, data.theoreticalPower);

    // État des onduleurs
    for (const inv of data.inverterStatus) {
      solarInverterStatus.set({ farm: farmKey, inverter_id: inv.id }, inv.status);
    }

    // Revenus (incrémenter basé sur la production actuelle sur 30 secondes)
    const energyKwh = (data.actualPower * 30) / 3600; // kWh sur 30 secondes
    const revenue = calculateRevenue(energyKwh);
    if (revenue > 0) {
      solarDailyRevenue.inc({ farm: farmKey }, revenue);
    }

    // Disponibilité (basée sur les onduleurs fonctionnels)
    const workingInverters = data.inverterStatus.filter((i) => i.status === 1).length;
    const availability = workingInverters / farm.inverters;
    solarAvailability.set({ farm: farmKey }, availability);

    // Compteur d'anomalies
    if (data.anomaly.type !== 'NORMAL') {
      solarAnomalyCount.inc({ farm: farmKey, type: data.anomaly.type, severity: data.anomaly.severity });
    }
  }

  console.log(`[${new Date().toISOString()}] Métriques mises à jour`);
}

/**
 * Retourne le registre Prometheus
 */
function getRegister() {
  return register;
}

/**
 * Retourne les données actuelles
 */
function getCurrentData() {
  return currentData;
}

module.exports = {
  updateMetrics,
  getRegister,
  getCurrentData,
};
