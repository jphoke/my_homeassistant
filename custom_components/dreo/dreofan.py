"""Support for Dreo fans."""
from __future__ import annotations

import logging
import math
from typing import Any

from .haimports import * # pylint: disable=W0401,W0614

from .dreobasedevice import DreoBaseDeviceHA
from .pydreo.constant import DreoDeviceType # pylint: disable=C0415

from .const import (
    LOGGER
)

from .pydreo.pydreofanbase import PyDreoFanBase

_LOGGER = logging.getLogger(LOGGER)

class DreoFanHA(DreoBaseDeviceHA, FanEntity):
    """Representation of a Dreo fan."""

    def __init__(self, pyDreoFan: PyDreoFanBase):
        """Initialize the Dreo fan device."""
        super().__init__(pyDreoFan)
        self.device = pyDreoFan
        if self.device.type is DreoDeviceType.CEILING_FAN:
            self._attr_icon = "mdi:ceiling-fan"

    @property
    def percentage(self) -> int | None:
        """Return the current speed."""
        return ranged_value_to_percentage(
            self.device.speed_range, self.device.fan_speed
        )

    @property
    def is_on(self) -> bool:
        """Return True if device is on."""
        return self.device.is_on

    @property
    def oscillating(self) -> bool:
        """This represents horizontal oscillation only"""
        return self.device.oscillating

    @property
    def speed_count(self) -> int:
        """Return the number of speeds the fan supports."""
        return int_states_in_range(self.device.speed_range)

    @property
    def preset_modes(self) -> list[str]:
        """Get the list of available preset modes."""
        return self.device.preset_modes

    @property
    def preset_mode(self) -> str | None:
        """Get the current preset mode."""
        return self.device.preset_mode

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the state attributes of the fan."""
        attr = {"temperature": self.device.temperature,
            'model': self.device.model,
            'sn': self.device.serial_number}
        return attr

    @property
    def supported_features(self) -> int:
        """Return the list of supported features."""
        supported_features = FanEntityFeature.SET_SPEED | FanEntityFeature.TURN_ON | FanEntityFeature.TURN_OFF
        if (self.device.preset_modes is not None):
            supported_features = supported_features | FanEntityFeature.PRESET_MODE
        if (self.device.oscillating is not None):
            supported_features = supported_features | FanEntityFeature.OSCILLATE

        return supported_features

    def turn_on(
        self,
        percentage: int | None = None,
        preset_mode: str | None = None,
        **kwargs: Any,
    ) -> None:
        """Turn the device on."""
        _LOGGER.debug("DreoFanHA:turn_on")
        self.device.is_on = True

    def turn_off(self, **kwargs: Any) -> None:
        """Turn the device off."""
        _LOGGER.debug("DreoFanHA:turn_off")
        self.device.is_on = False

    def set_percentage(self, percentage: int) -> None:
        """Set the speed of the device."""
        if percentage == 0:
            self.device.is_on = False
            return

        if not self.device.is_on:
            self.device.is_on = True

        self.device.fan_speed = math.ceil(percentage_to_ranged_value(self.device.speed_range, percentage))
        
        self.schedule_update_ha_state()

    def set_preset_mode(self, preset_mode: str) -> None:
        """Set the preset mode of device."""
        if preset_mode not in self.preset_modes:
            raise ValueError(
                f"{preset_mode} is not one of the valid preset modes: "
                f"{self.preset_modes}"
            )

        if not self.device.is_on:
            self.device.is_on = True

        self.device.preset_mode = preset_mode

        self.schedule_update_ha_state()

    def oscillate(self, oscillating: bool) -> None:
        """Oscillate the fan."""
        self.device.oscillating = oscillating
        self.schedule_update_ha_state()

    def set_direction(self, direction: str) -> None:
        """Set the direction of the fan."""
        raise NotImplementedError
