# Homebridge Huum Sauna

[![NPM version](https://img.shields.io/npm/v/homebridge-huum-sauna.svg)](https://www.npmjs.com/package/homebridge-huum-sauna)
// [![Downloads](https://img.shields.io/npm/dm/homebridge-huum-sauna.svg)](https://www.npmjs.com/package/homebridge-huum-sauna?activeTab=versions)
// [![License](https://img.shields.io/npm/l/homebridge-huum-sauna.svg)](LICENSE)

**Homebridge Huum Sauna** is a Homebridge platform plugin that lets you control your HUUM sauna directly from Apple HomeKit. It supports turning the sauna on/off, setting target temperatures, and reading the current sauna status. With an added configuration option, the plugin can operate in either Celsius or Fahrenheit—converting values automatically as needed.

## Features

- **Dynamic Platform Plugin**: Automatically registers a single sauna accessory and restores it from cache.
- **Thermostat Service**: Exposes the sauna as a HomeKit Thermostat, with current and target temperature characteristics.
- **HUUM API Integration**: Uses the HUUM API endpoints to retrieve status, start heating, and stop the sauna.
- **Configurable Temperature Units**: Choose between Celsius and Fahrenheit via a simple configuration setting.
- **Polling Mechanism**: Periodically polls the sauna status to keep HomeKit up to date.
- **Simple Setup**: Works with HOOBS or Homebridge (compatible with Homebridge versions ≥ 1.6.0).


