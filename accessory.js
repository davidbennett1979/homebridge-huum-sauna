const axios = require('axios');

// Helper functions for conversion between Celsius and Fahrenheit.
function celsiusToFahrenheit(c) {
  return (c * 9) / 5 + 32;
}

function fahrenheitToCelsius(f) {
  return ((f - 32) * 5) / 9;
}

class HuumSaunaAccessory {
  constructor(log, config, api, accessory) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    // Determine the temperature unit from configuration; default is Fahrenheit.
    // "F" means we convert API Celsius values to Fahrenheit for display.
    this.temperatureUnit = this.config.temperatureUnit || "F";

    // Define the valid target temperature range.
    // We assume the API expects a targetTemperature between 40 and 110 in Celsius.
    // In Fahrenheit mode, convert these bounds.
    if (this.temperatureUnit === "C") {
      this.targetTempRange = { min: 40, max: 110 };
    } else {
      this.targetTempRange = { 
        min: celsiusToFahrenheit(40), 
        max: celsiusToFahrenheit(110) 
      };
    }

    // Use the cached accessory if provided; otherwise, create a new one.
    if (accessory) {
      this.accessory = accessory;
    } else {
      const uuid = this.api.hap.uuid.generate('huum-sauna');
      this.accessory = new this.api.platformAccessory('Huum Sauna', uuid);
      this.accessory.category = this.api.hap.Categories.THERMOSTAT;
    }

    // Get or create the Thermostat service.
    this.service = this.accessory.getService(this.Service.Thermostat) ||
                   this.accessory.addService(this.Service.Thermostat, 'Sauna Temperature');

    // Set up characteristics.
    this.service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(this.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this))
      .setProps({
        minValue: this.targetTempRange.min,
        maxValue: this.targetTempRange.max,
        minStep: 1,
      });

    this.service.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingState.bind(this));

    this.service.getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingState.bind(this))
      .onSet(this.setTargetHeatingState.bind(this))
      .setProps({
        validValues: [
          this.Characteristic.TargetHeatingCoolingState.OFF,
          this.Characteristic.TargetHeatingCoolingState.HEAT,
        ],
      });

    // Begin polling for status updates.
    this.startPolling();
  }

  // Retrieve the sauna status from the HUUM API.
  async getSaunaStatus() {
    try {
      const response = await axios.get('https://api.huum.eu/action/home/status', {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
      });
      return response.data;
    } catch (error) {
      this.log.error('Error fetching sauna status: ' + error.message);
      return null;
    }
  }

  // Get the current sauna temperature (API returns Celsius). Convert if needed.
  async getCurrentTemperature() {
    const status = await this.getSaunaStatus();
    if (!status || typeof status.temperature === "undefined") {
      return 0;
    }
    const tempC = parseFloat(status.temperature);
    if (isNaN(tempC)) {
      return 0;
    }
    if (this.temperatureUnit === "F") {
      return celsiusToFahrenheit(tempC);
    }
    return tempC;
  }

  // Get the target temperature from the API, clamp it, and convert if needed.
  async getTargetTemperature() {
    const status = await this.getSaunaStatus();
    if (!status || typeof status.targetTemperature === "undefined") {
      return this.targetTempRange.min;
    }
    let targetC = parseFloat(status.targetTemperature);
    if (isNaN(targetC)) {
      return this.targetTempRange.min;
    }
    // Clamp the value to the API's valid range (in Celsius).
    targetC = Math.max(40, Math.min(targetC, 110));
    if (this.temperatureUnit === "F") {
      return celsiusToFahrenheit(targetC);
    }
    return targetC;
  }

  // Set the target temperature from HomeKit. Convert from the configured unit to Celsius if needed.
  async setTargetTemperature(value) {
    let targetC = value;
    if (this.temperatureUnit === "F") {
      targetC = fahrenheitToCelsius(value);
    }
    // Clamp the value to the API's accepted range.
    targetC = Math.max(40, Math.min(targetC, 110));
    await this.startSauna(targetC);
  }

  // Get the current heating state.
  async getCurrentHeatingState() {
    const status = await this.getSaunaStatus();
    if (status) {
      return status.statusCode === 231
        ? this.Characteristic.CurrentHeatingCoolingState.HEAT
        : this.Characteristic.CurrentHeatingCoolingState.OFF;
    }
    return this.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  // Get the target heating state.
  async getTargetHeatingState() {
    const status = await this.getSaunaStatus();
    if (status) {
      return status.statusCode === 231
        ? this.Characteristic.TargetHeatingCoolingState.HEAT
        : this.Characteristic.TargetHeatingCoolingState.OFF;
    }
    return this.Characteristic.TargetHeatingCoolingState.OFF;
  }

  // Set the target heating state.
  async setTargetHeatingState(value) {
    if (value === this.Characteristic.TargetHeatingCoolingState.HEAT) {
      const targetTemp = await this.getTargetTemperature();
      await this.startSauna(targetTemp);
    } else {
      await this.stopSauna();
    }
  }

  // Call the start endpoint with the target temperature in Celsius.
  async startSauna(targetTemperature) {
    try {
      await axios.post(
        `https://api.huum.eu/action/home/start?targetTemperature=${targetTemperature}`,
        null,
        {
          auth: {
            username: this.config.username,
            password: this.config.password,
          },
        }
      );
      const displayTemp = this.temperatureUnit === "F" 
        ? celsiusToFahrenheit(targetTemperature)
        : targetTemperature;
      this.log.info(`Sauna started with target temperature: ${displayTemp}°${this.temperatureUnit}`);
    } catch (error) {
      this.log.error('Error starting sauna: ' + error.message);
    }
  }

  // Stop the sauna by calling the stop endpoint.
  async stopSauna() {
    try {
      await axios.post('https://api.huum.eu/action/home/stop', null, {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
      });
      this.log.info('Sauna stopped.');
    } catch (error) {
      this.log.error('Error stopping sauna: ' + error.message);
    }
  }

  // Poll the API every pollInterval seconds and update HomeKit characteristics.
  startPolling() {
    const pollInterval = (this.config.pollInterval || 30) * 1000;
    setInterval(async () => {
      const status = await this.getSaunaStatus();
      if (status) {
        // Update CurrentTemperature.
        let currentTemp = parseFloat(status.temperature);
        if (isNaN(currentTemp)) {
          currentTemp = 0;
        }
        if (this.temperatureUnit === "F") {
          currentTemp = celsiusToFahrenheit(currentTemp);
        }
        this.service.updateCharacteristic(this.Characteristic.CurrentTemperature, currentTemp);

        // Update TargetTemperature.
        let targetTemp = parseFloat(status.targetTemperature);
        if (isNaN(targetTemp)) {
          targetTemp = 40;
        }
        targetTemp = Math.max(40, Math.min(targetTemp, 110));
        if (this.temperatureUnit === "F") {
          targetTemp = celsiusToFahrenheit(targetTemp);
        }
        this.service.updateCharacteristic(this.Characteristic.TargetTemperature, targetTemp);

        // Update the current heating state.
        const heatingState = status.statusCode === 231
          ? this.Characteristic.CurrentHeatingCoolingState.HEAT
          : this.Characteristic.CurrentHeatingCoolingState.OFF;
        this.service.updateCharacteristic(this.Characteristic.CurrentHeatingCoolingState, heatingState);
      }
    }, pollInterval);
  }
}

module.exports = HuumSaunaAccessory;

