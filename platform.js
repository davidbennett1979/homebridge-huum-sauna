const HuumSaunaAccessory = require('./accessory');

class HuumSaunaPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    // Store the single accessory (if restored from cache)
    this.accessory = null;

    if (!this.config.username || !this.config.password) {
      this.log.error('Username and password are required in the configuration.');
      return;
    }

    // Homebridge will call configureAccessory() for any cached accessories.
    // Then, once Homebridge finishes launching, we initialize our one sauna.
    this.api.on('didFinishLaunching', () => {
      this.log.info('Homebridge finished launching. Initializing sauna accessory...');
      if (this.accessory) {
        // Cached accessory found – reinitialize it.
        new HuumSaunaAccessory(this.log, this.config, this.api, this.accessory);
      } else {
        // No cached accessory – create a new one.
        const saunaAccessory = new HuumSaunaAccessory(this.log, this.config, this.api);
        this.accessory = saunaAccessory.accessory;
        this.api.registerPlatformAccessories('homebridge-huum-sauna', 'HuumSauna', [this.accessory]);
      }
    });
  }

  // This method is called by Homebridge to load cached accessories.
  configureAccessory(accessory) {
    this.log.info('Restoring cached accessory: ' + accessory.displayName);
    this.accessory = accessory;
  }
}

module.exports = HuumSaunaPlatform;

