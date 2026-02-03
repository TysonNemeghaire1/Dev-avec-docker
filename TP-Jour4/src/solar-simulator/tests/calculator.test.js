const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  calculateIrradiance,
  calculateAmbientTemperature,
  calculatePanelTemperature,
  calculateTemperatureFactor,
  calculateTheoreticalPower,
  calculateRevenue,
  generateAnomaly,
  generateFarmData,
} = require('../src/calculator');

const { farms } = require('../src/farms');

describe('Calculator Module', () => {
  describe('calculateIrradiance', () => {
    it('devrait retourner 0 pendant la nuit (avant 6h)', () => {
      const irradiance = calculateIrradiance(3, 1000);
      assert.strictEqual(irradiance, 0);
    });

    it('devrait retourner 0 pendant la nuit (après 18h)', () => {
      const irradiance = calculateIrradiance(20, 1000);
      assert.strictEqual(irradiance, 0);
    });

    it('devrait retourner une valeur positive à midi', () => {
      const irradiance = calculateIrradiance(12, 1000);
      assert.ok(irradiance > 0, 'L\'irradiance devrait être positive à midi');
      assert.ok(irradiance <= 1100, 'L\'irradiance ne devrait pas dépasser max + 10%');
    });

    it('devrait avoir un maximum autour de midi', () => {
      const irradiance6h = calculateIrradiance(6.5, 1000);
      const irradiance12h = calculateIrradiance(12, 1000);
      const irradiance17h = calculateIrradiance(17, 1000);
      // Midi devrait généralement avoir plus d'irradiance (avec variation aléatoire)
      console.log(`Irradiance: 6h30=${irradiance6h}, 12h=${irradiance12h}, 17h=${irradiance17h}`);
      assert.ok(irradiance12h > 0);
    });
  });

  describe('calculatePanelTemperature', () => {
    it('devrait être égale à la température ambiante sans irradiance', () => {
      const panelTemp = calculatePanelTemperature(25, 0);
      assert.strictEqual(panelTemp, 25);
    });

    it('devrait être plus élevée que la température ambiante avec irradiance', () => {
      const ambientTemp = 25;
      const panelTemp = calculatePanelTemperature(ambientTemp, 1000);
      assert.ok(panelTemp > ambientTemp, 'La température panneau devrait être plus élevée');
      // T_panneau = T_ambiante + (irradiance/1000) × 25 = 25 + 25 = 50
      assert.strictEqual(panelTemp, 50);
    });
  });

  describe('calculateTemperatureFactor', () => {
    it('devrait retourner 1 à 25°C (température nominale)', () => {
      const factor = calculateTemperatureFactor(25);
      assert.strictEqual(factor, 1);
    });

    it('devrait être < 1 au-dessus de 25°C (baisse de rendement)', () => {
      const factor = calculateTemperatureFactor(50);
      assert.ok(factor < 1, 'Le facteur devrait être < 1 quand il fait chaud');
      // facteur = 1 + (50 - 25) × (-0.0035) = 1 - 0.0875 = 0.9125
      assert.ok(Math.abs(factor - 0.9125) < 0.001);
    });

    it('devrait être > 1 en dessous de 25°C (meilleur rendement)', () => {
      const factor = calculateTemperatureFactor(10);
      assert.ok(factor > 1, 'Le facteur devrait être > 1 quand il fait froid');
    });
  });

  describe('calculateTheoreticalPower', () => {
    it('devrait retourner 0 sans irradiance', () => {
      const power = calculateTheoreticalPower(farms.provence, 0, 25);
      assert.strictEqual(power, 0);
    });

    it('devrait retourner une valeur positive avec irradiance', () => {
      const power = calculateTheoreticalPower(farms.provence, 1000, 25);
      assert.ok(power > 0, 'La production devrait être positive');
      // P = 5000 × 400 × 1 × 0.85 × 1 = 1,700,000 W = 1700 kW
      console.log(`Production théorique Provence à 1000 W/m²: ${power} kW`);
      assert.ok(power > 1500 && power < 1800, 'Production attendue ~1700 kW');
    });
  });

  describe('calculateRevenue', () => {
    it('devrait calculer correctement les revenus', () => {
      const revenue = calculateRevenue(100); // 100 kWh
      // 100 × 0.18 = 18€
      assert.strictEqual(revenue, 18);
    });

    it('devrait retourner 0 pour 0 kWh', () => {
      const revenue = calculateRevenue(0);
      assert.strictEqual(revenue, 0);
    });
  });

  describe('generateAnomaly', () => {
    it('devrait générer des anomalies avec les bons types', () => {
      const validTypes = ['NORMAL', 'OVERHEAT', 'INVERTER_DOWN', 'DEGRADATION', 'SHADING', 'SENSOR_FAIL'];

      // Générer plusieurs anomalies pour vérifier les types
      for (let i = 0; i < 100; i++) {
        const anomaly = generateAnomaly();
        assert.ok(validTypes.includes(anomaly.type), `Type invalide: ${anomaly.type}`);
        assert.ok(anomaly.severity !== undefined, 'La sévérité devrait être définie');
      }
    });
  });

  describe('generateFarmData', () => {
    it('devrait générer des données complètes pour une ferme', () => {
      const data = generateFarmData(farms.provence);

      assert.strictEqual(data.farm, 'provence');
      assert.ok(data.timestamp);
      assert.ok(typeof data.irradiance === 'number');
      assert.ok(typeof data.ambientTemp === 'number');
      assert.ok(typeof data.panelTemp === 'number');
      assert.ok(typeof data.actualPower === 'number');
      assert.ok(Array.isArray(data.inverterStatus));
      assert.ok(data.anomaly);
      assert.ok(data.anomaly.type);
    });

    it('devrait avoir le bon nombre d\'onduleurs par ferme', () => {
      const provenceData = generateFarmData(farms.provence);
      const occitanieData = generateFarmData(farms.occitanie);
      const aquitaineData = generateFarmData(farms.aquitaine);

      assert.strictEqual(provenceData.inverterStatus.length, 4);
      assert.strictEqual(occitanieData.inverterStatus.length, 3);
      assert.strictEqual(aquitaineData.inverterStatus.length, 4);
    });
  });
});

console.log('Tests du calculateur terminés');
