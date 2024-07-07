"""Support for power & energy sensors for VeSync outlets."""

import logging

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    CONCENTRATION_MICROGRAMS_PER_CUBIC_METER,
    DEGREE,
    PERCENTAGE,
    UnitOfEnergy,
    UnitOfPower,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .common import VeSyncBaseEntity, has_feature
from .const import (
    DEV_TYPE_TO_HA,
    DOMAIN,
    SENSOR_TYPES_AIRFRYER,
    VS_DISCOVERY,
    VS_SENSORS,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up switches."""

    coordinator = hass.data[DOMAIN][config_entry.entry_id]["coordinator"]

    @callback
    def discover(devices):
        """Add new devices to platform."""
        _setup_entities(devices, async_add_entities, coordinator)

    config_entry.async_on_unload(
        async_dispatcher_connect(hass, VS_DISCOVERY.format(VS_SENSORS), discover)
    )

    _setup_entities(
        hass.data[DOMAIN][config_entry.entry_id][VS_SENSORS],
        async_add_entities,
        coordinator,
    )


@callback
def _setup_entities(devices, async_add_entities, coordinator):
    """Check if device is online and add entity."""
    entities = []
    for dev in devices:
        if hasattr(dev, "fryer_status"):
            for stype in SENSOR_TYPES_AIRFRYER.values():
                entities.append(  # noqa: PERF401
                    VeSyncairfryerSensor(
                        dev,
                        coordinator,
                        stype,
                    )
                )

        if DEV_TYPE_TO_HA.get(dev.device_type) == "outlet":
            entities.extend(
                (
                    VeSyncPowerSensor(dev, coordinator),
                    VeSyncEnergySensor(dev, coordinator),
                )
            )
        if has_feature(dev, "details", "humidity"):
            entities.append(VeSyncHumiditySensor(dev, coordinator))
        if has_feature(dev, "details", "air_quality"):
            entities.append(VeSyncAirQualitySensor(dev, coordinator))
        if has_feature(dev, "details", "aq_percent"):
            entities.append(VeSyncAirQualityPercSensor(dev, coordinator))
        if has_feature(dev, "details", "air_quality_value"):
            entities.append(VeSyncAirQualityValueSensor(dev, coordinator))
        if has_feature(dev, "details", "pm1"):
            entities.append(VeSyncPM1Sensor(dev, coordinator))
        if has_feature(dev, "details", "pm10"):
            entities.append(VeSyncPM10Sensor(dev, coordinator))
        if has_feature(dev, "details", "filter_life"):
            entities.append(VeSyncFilterLifeSensor(dev, coordinator))
        if has_feature(dev, "details", "fan_rotate_angle"):
            entities.append(VeSyncFanRotateAngleSensor(dev, coordinator))

    async_add_entities(entities, update_before_add=True)


class VeSyncairfryerSensor(VeSyncBaseEntity, SensorEntity):
    """Class representing a VeSyncairfryerSensor."""

    def __init__(self, airfryer, coordinator, stype) -> None:
        """Initialize the VeSync airfryer."""
        super().__init__(airfryer, coordinator)
        self.airfryer = airfryer
        self.stype = stype

    @property
    def unique_id(self):
        """Return unique ID for power sensor on device."""
        return f"{super().unique_id}-" + self.stype[0]

    @property
    def name(self):
        """Return sensor name."""
        return self.stype[1]

    @property
    def device_class(self):
        """Return the class."""
        return self.stype[4]

    @property
    def native_value(self):
        """Return the value."""
        return getattr(self.airfryer, self.stype[5], None)

    @property
    def native_unit_of_measurement(self):
        """Return the unit of measurement."""
        # return self.airfryer.temp_unit
        return self.stype[2]

    @property
    def icon(self):
        """Return the icon to use in the frontend, if any."""
        return self.stype[3]


class VeSyncOutletSensorEntity(VeSyncBaseEntity, SensorEntity):
    """Representation of a sensor describing diagnostics of a VeSync outlet."""

    def __init__(self, plug, coordinator) -> None:
        """Initialize the VeSync outlet device."""
        super().__init__(plug, coordinator)
        self.smartplug = plug

    @property
    def entity_category(self):
        """Return the diagnostic entity category."""
        return EntityCategory.DIAGNOSTIC


class VeSyncPowerSensor(VeSyncOutletSensorEntity):
    """Representation of current power use for a VeSync outlet."""

    def __init__(self, plug, coordinator) -> None:
        """Initialize the VeSync outlet device."""
        super().__init__(plug, coordinator)

    @property
    def unique_id(self):
        """Return unique ID for power sensor on device."""
        return f"{super().unique_id}-power"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} current power"

    @property
    def device_class(self):
        """Return the power device class."""
        return SensorDeviceClass.POWER

    @property
    def native_value(self):
        """Return the current power usage in W."""
        return self.smartplug.power

    @property
    def native_unit_of_measurement(self):
        """Return the Watt unit of measurement."""
        return UnitOfPower.WATT

    @property
    def state_class(self):
        """Return the measurement state class."""
        return SensorStateClass.MEASUREMENT

    def update(self):
        """Update outlet details and energy usage."""
        self.smartplug.update()
        self.smartplug.update_energy()


class VeSyncEnergySensor(VeSyncOutletSensorEntity):
    """Representation of current day's energy use for a VeSync outlet."""

    def __init__(self, plug, coordinator) -> None:
        """Initialize the VeSync outlet device."""
        super().__init__(plug, coordinator)
        self.smartplug = plug

    @property
    def unique_id(self):
        """Return unique ID for power sensor on device."""
        return f"{super().unique_id}-energy"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} energy use today"

    @property
    def device_class(self):
        """Return the energy device class."""
        return SensorDeviceClass.ENERGY

    @property
    def native_value(self):
        """Return the today total energy usage in kWh."""
        return self.smartplug.energy_today

    @property
    def native_unit_of_measurement(self):
        """Return the kWh unit of measurement."""
        return UnitOfEnergy.KILO_WATT_HOUR

    @property
    def state_class(self):
        """Return the total_increasing state class."""
        return SensorStateClass.TOTAL_INCREASING

    def update(self):
        """Update outlet details and energy usage."""
        self.smartplug.update()
        self.smartplug.update_energy()


class VeSyncHumidifierSensorEntity(VeSyncBaseEntity, SensorEntity):
    """Representation of a sensor describing diagnostics of a VeSync humidifier."""

    def __init__(self, humidifier, coordinator) -> None:
        """Initialize the VeSync humidifier device."""
        super().__init__(humidifier, coordinator)
        self.smarthumidifier = humidifier

    @property
    def entity_category(self):
        """Return the diagnostic entity category."""
        return None


class VeSyncAirQualitySensor(VeSyncHumidifierSensorEntity):
    """Representation of an air quality sensor."""

    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, device, coordinator) -> None:
        """Initialize the VeSync device."""
        super().__init__(device, coordinator)
        self._numeric_quality = None
        if self.native_value is not None:
            self._numeric_quality = isinstance(self.native_value, (int, float))

    @property
    def device_class(self):
        """Return the air quality device class."""
        return SensorDeviceClass.AQI if self._numeric_quality else None

    @property
    def unique_id(self):
        """Return unique ID for air quality sensor on device."""
        return f"{super().unique_id}-air-quality"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} air quality"

    @property
    def native_value(self):
        """Return the air quality index."""
        if has_feature(self.smarthumidifier, "details", "air_quality"):
            quality = self.smarthumidifier.details["air_quality"]
            if isinstance(quality, (int, float)):
                return quality
            _LOGGER.warning(
                "Got non numeric value for AQI sensor from 'air_quality' for %s: %s",
                self.name,
                quality,
            )
        _LOGGER.warning("No air quality index found in '%s'", self.name)
        return None


class VeSyncAirQualityPercSensor(VeSyncHumidifierSensorEntity):
    """Representation of an air quality percentage sensor."""

    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, device, coordinator) -> None:
        """Initialize the VeSync device."""
        super().__init__(device, coordinator)
        self._numeric_quality = None
        if self.native_value is not None:
            self._numeric_quality = isinstance(self.native_value, (int, float))

    @property
    def unique_id(self):
        """Return unique ID for air quality sensor on device."""
        return f"{super().unique_id}-air-quality-perc"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} air quality percentage"

    @property
    def native_unit_of_measurement(self):
        """Return the % unit of measurement."""
        return PERCENTAGE

    @property
    def native_value(self):
        """Return the air quality percentage."""
        if has_feature(self.smarthumidifier, "details", "aq_percent"):
            quality = self.smarthumidifier.details["aq_percent"]
            if isinstance(quality, (int, float)):
                return quality
            _LOGGER.warning(
                "Got non numeric value for AQI sensor from 'aq_percent' for %s: %s",
                self.name,
                quality,
            )
        _LOGGER.warning("No air quality percentage found in '%s'", self.name)
        return None


class VeSyncAirQualityValueSensor(VeSyncHumidifierSensorEntity):
    """Representation of an air quality sensor."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_device_class = SensorDeviceClass.PM25
    _attr_native_unit_of_measurement = CONCENTRATION_MICROGRAMS_PER_CUBIC_METER

    def __init__(self, device, coordinator) -> None:
        """Initialize the VeSync device."""
        super().__init__(device, coordinator)

    @property
    def unique_id(self):
        """Return unique ID for air quality sensor on device."""
        return f"{super().unique_id}-air-quality-value"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} air quality value"

    @property
    def native_value(self):
        """Return the air quality index."""
        if has_feature(self.smarthumidifier, "details", "air_quality_value"):
            quality_value = self.smarthumidifier.details["air_quality_value"]
            if isinstance(quality_value, (int, float)):
                return quality_value
            _LOGGER.warning(
                "Got non numeric value for AQI sensor from 'air_quality_value' for %s: %s",
                self.name,
                quality_value,
            )
        _LOGGER.warning("No air quality value found in '%s'", self.name)
        return None


class VeSyncPM1Sensor(VeSyncHumidifierSensorEntity):
    """Representation of a PM1 sensor."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_device_class = SensorDeviceClass.PM1
    _attr_native_unit_of_measurement = CONCENTRATION_MICROGRAMS_PER_CUBIC_METER

    def __init__(self, device, coordinator) -> None:
        """Initialize the VeSync device."""
        super().__init__(device, coordinator)

    @property
    def unique_id(self):
        """Return unique ID for PM1 sensor on device."""
        return f"{super().unique_id}-pm1"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} PM1"

    @property
    def native_value(self):
        """Return the PM1."""
        if has_feature(self.smarthumidifier, "details", "pm1"):
            quality_value = self.smarthumidifier.details["pm1"]
            if isinstance(quality_value, (int, float)):
                return quality_value
            _LOGGER.warning(
                "Got non numeric value for PM1 sensor from 'pm1' for %s: %s",
                self.name,
                quality_value,
            )
        _LOGGER.warning("No PM1 value found in '%s'", self.name)
        return None


class VeSyncPM10Sensor(VeSyncHumidifierSensorEntity):
    """Representation of a PM10 sensor."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_device_class = SensorDeviceClass.PM10
    _attr_native_unit_of_measurement = CONCENTRATION_MICROGRAMS_PER_CUBIC_METER

    def __init__(self, device, coordinator) -> None:
        """Initialize the VeSync device."""
        super().__init__(device, coordinator)

    @property
    def unique_id(self):
        """Return unique ID for PM10 sensor on device."""
        return f"{super().unique_id}-pm10"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} PM10"

    @property
    def native_value(self):
        """Return the PM10."""
        if has_feature(self.smarthumidifier, "details", "pm10"):
            quality_value = self.smarthumidifier.details["pm10"]
            if isinstance(quality_value, (int, float)):
                return quality_value
            _LOGGER.warning(
                "Got non numeric value for PM10 sensor from 'pm10' for %s: %s",
                self.name,
                quality_value,
            )
        _LOGGER.warning("No PM10 value found in '%s'", self.name)
        return None


class VeSyncFilterLifeSensor(VeSyncHumidifierSensorEntity):
    """Representation of a filter life sensor."""

    def __init__(self, plug, coordinator) -> None:
        """Initialize the VeSync device."""
        super().__init__(plug, coordinator)

    @property
    def entity_category(self):
        """Return the diagnostic entity category."""
        return EntityCategory.DIAGNOSTIC

    @property
    def unique_id(self):
        """Return unique ID for filter life sensor on device."""
        return f"{super().unique_id}-filter-life"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} filter life"

    @property
    def device_class(self):
        """Return the filter life device class."""
        return None

    @property
    def native_value(self):
        """Return the filter life index."""
        return (
            self.smarthumidifier.filter_life
            if hasattr(self.smarthumidifier, "filter_life")
            else self.smarthumidifier.details["filter_life"]
        )

    @property
    def native_unit_of_measurement(self):
        """Return the % unit of measurement."""
        return PERCENTAGE

    @property
    def state_class(self):
        """Return the measurement state class."""
        return SensorStateClass.MEASUREMENT

    @property
    def state_attributes(self):
        """Return the state attributes."""
        return (
            self.smarthumidifier.details["filter_life"]
            if isinstance(self.smarthumidifier.details["filter_life"], dict)
            else {}
        )

    @property
    def icon(self):
        """Return the icon to use in the frontend, if any."""
        return "mdi:air-filter"


class VeSyncFanRotateAngleSensor(VeSyncHumidifierSensorEntity):
    """Representation of a fan rotate angle sensor."""

    def __init__(self, plug, coordinator) -> None:
        """Initialize the VeSync device."""
        super().__init__(plug, coordinator)

    @property
    def entity_category(self):
        """Return the diagnostic entity category."""
        return EntityCategory.DIAGNOSTIC

    @property
    def unique_id(self):
        """Return unique ID for filter life sensor on device."""
        return f"{super().unique_id}-fan-rotate-angle"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} fan rotate angle"

    @property
    def device_class(self):
        """Return the fan rotate angle device class."""
        return None

    @property
    def native_value(self):
        """Return the fan rotate angle index."""
        return (
            self.smarthumidifier.fan_rotate_angle
            if hasattr(self.smarthumidifier, "fan_rotate_angle")
            else self.smarthumidifier.details["fan_rotate_angle"]
        )

    @property
    def native_unit_of_measurement(self):
        """Return the % unit of measurement."""
        return DEGREE

    @property
    def state_class(self):
        """Return the measurement state class."""
        return SensorStateClass.MEASUREMENT

    @property
    def icon(self):
        """Return the icon to use in the frontend, if any."""
        return "mdi:rotate-3d-variant"


class VeSyncHumiditySensor(VeSyncHumidifierSensorEntity):
    """Representation of current humidity for a VeSync humidifier."""

    def __init__(self, humidity, coordinator) -> None:
        """Initialize the VeSync outlet device."""
        super().__init__(humidity, coordinator)

    @property
    def unique_id(self):
        """Return unique ID for humidity sensor on device."""
        return f"{super().unique_id}-humidity"

    @property
    def name(self):
        """Return sensor name."""
        return f"{super().name} current humidity"

    @property
    def device_class(self):
        """Return the humidity device class."""
        return SensorDeviceClass.HUMIDITY

    @property
    def native_value(self):
        """Return the current humidity in percent."""
        return self.smarthumidifier.details["humidity"]

    @property
    def native_unit_of_measurement(self):
        """Return the % unit of measurement."""
        return PERCENTAGE

    @property
    def state_class(self):
        """Return the measurement state class."""
        return SensorStateClass.MEASUREMENT
