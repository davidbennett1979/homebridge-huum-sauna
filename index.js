module.exports = (api) => {
  api.registerPlatform('homebridge-huum-sauna', 'HuumSauna', require('./platform'));
};

