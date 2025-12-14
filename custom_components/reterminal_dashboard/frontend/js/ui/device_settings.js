class DeviceSettings {
    constructor() {
        this.modal = document.getElementById('deviceSettingsModal');
        this.closeBtn = document.getElementById('deviceSettingsClose');
        this.saveBtn = document.getElementById('deviceSettingsSave');

        // Inputs
        this.nameInput = document.getElementById('deviceName');
        this.modelInput = document.getElementById('deviceModel');
        this.orientationInput = document.getElementById('deviceOrientation');
        this.darkModeInput = document.getElementById('deviceDarkMode');

        // Power Strategy
        this.modeStandard = document.getElementById('mode-standard');
        this.modeSleep = document.getElementById('setting-sleep-enabled');
        this.modeManual = document.getElementById('setting-manual-refresh');
        this.modeDeepSleep = document.getElementById('setting-deep-sleep-enabled');

        // Sub-settings
        this.sleepStart = document.getElementById('setting-sleep-start');
        this.sleepEnd = document.getElementById('setting-sleep-end');
        this.sleepRow = document.getElementById('sleep-times-row');

        this.deepSleepInterval = document.getElementById('setting-deep-sleep-interval');
        this.deepSleepRow = document.getElementById('deep-sleep-interval-row');
    }

    init() {
        if (!this.modal) return;

        // Close button
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        // Save button (hides modal, as auto-save handles the rest)
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.close());
        }

        this.setupAutoSaveListeners();
    }

    open() {
        console.log("DeviceSettings.open() called");
        if (!this.modal) {
            console.error("DeviceSettings modal element not found!");
            return;
        }

        console.log("Opening Device Settings modal...");

        // Populate fields
        if (this.nameInput) this.nameInput.value = AppState.settings.device_name || "My E-Ink Display";
        if (this.modelInput) this.modelInput.value = AppState.settings.device_model || "reterminal_e1001";
        if (this.orientationInput) this.orientationInput.value = AppState.settings.orientation || "landscape";
        if (this.darkModeInput) this.darkModeInput.checked = !!AppState.settings.dark_mode;

        // Determine power mode
        const s = AppState.settings;
        const isSleep = !!s.sleep_enabled;
        const isManual = !!s.manual_refresh_only;
        const isDeepSleep = !!s.deep_sleep_enabled;
        const isStandard = !isSleep && !isManual && !isDeepSleep;

        if (this.modeStandard) this.modeStandard.checked = isStandard;
        if (this.modeSleep) this.modeSleep.checked = isSleep;
        if (this.modeManual) this.modeManual.checked = isManual;
        if (this.modeDeepSleep) this.modeDeepSleep.checked = isDeepSleep;

        // Set time inputs
        if (this.sleepStart) this.sleepStart.value = s.sleep_start_hour ?? 0;
        if (this.sleepEnd) this.sleepEnd.value = s.sleep_end_hour ?? 5;
        if (this.deepSleepInterval) this.deepSleepInterval.value = s.deep_sleep_interval ?? 600;

        // Show/hide sub-settings
        this.updateVisibility();

        this.modal.classList.remove('hidden');
        this.modal.style.display = 'flex';
        console.log("Device Settings modal should be visible now.");
    }

    close() {
        if (this.modal) {
            this.modal.classList.add('hidden');
            this.modal.style.display = 'none';
        }
    }

    updateVisibility() {
        const isSleep = this.modeSleep && this.modeSleep.checked;
        const isDeepSleep = this.modeDeepSleep && this.modeDeepSleep.checked;

        if (this.sleepRow) this.sleepRow.style.display = isSleep ? 'flex' : 'none';
        if (this.deepSleepRow) this.deepSleepRow.style.display = isDeepSleep ? 'flex' : 'none';
    }

    setupAutoSaveListeners() {
        const updateSetting = (key, value) => {
            AppState.settings[key] = value;
            console.log(`Auto-saved ${key}:`, value);
            emit(EVENTS.STATE_CHANGED); // Trigger snippet update
        };

        // Device Name - debounced save to backend
        let nameDebounceTimer = null;
        if (this.nameInput) {
            this.nameInput.addEventListener('input', () => {
                const newName = this.nameInput.value.trim();
                AppState.setDeviceName(newName);
                emit(EVENTS.STATE_CHANGED);

                // Debounced save to backend (500ms after last keystroke)
                if (nameDebounceTimer) clearTimeout(nameDebounceTimer);
                nameDebounceTimer = setTimeout(async () => {
                    if (typeof saveLayoutToBackend === "function") {
                        try {
                            await saveLayoutToBackend();
                            console.log("[DeviceSettings] Device name saved to backend");
                        } catch (err) {
                            console.warn("[DeviceSettings] Failed to save device name:", err);
                        }
                    }
                }, 500);
            });
        }

        // Device Model
        if (this.modelInput) {
            this.modelInput.addEventListener('change', async () => {
                const newModel = this.modelInput.value;
                window.currentDeviceModel = newModel;
                AppState.setDeviceModel(newModel); // Update top-level deviceModel
                updateSetting('device_model', newModel); // Also persist to settings
                console.log("Device model changed to:", newModel);

                // Persist to backend immediately so change survives reload
                if (typeof saveLayoutToBackend === "function") {
                    try {
                        await saveLayoutToBackend();
                        console.log("[DeviceSettings] Device model change saved to backend");
                    } catch (err) {
                        console.warn("[DeviceSettings] Failed to auto-save device model:", err);
                    }
                }
            });
        }

        // Orientation
        if (this.orientationInput) {
            this.orientationInput.addEventListener('change', () => {
                updateSetting('orientation', this.orientationInput.value);
            });
        }

        // Dark Mode
        if (this.darkModeInput) {
            this.darkModeInput.addEventListener('change', () => {
                updateSetting('dark_mode', this.darkModeInput.checked);
            });
        }

        // Power Strategy
        const radios = [this.modeStandard, this.modeSleep, this.modeManual, this.modeDeepSleep];
        radios.forEach(radio => {
            if (radio) {
                radio.addEventListener('change', () => {
                    if (!radio.checked) return;

                    updateSetting('sleep_enabled', this.modeSleep.checked);
                    updateSetting('manual_refresh_only', this.modeManual.checked);
                    updateSetting('deep_sleep_enabled', this.modeDeepSleep.checked);

                    this.updateVisibility();
                });
            }
        });

        // Sleep Times
        if (this.sleepStart) {
            this.sleepStart.addEventListener('input', () => {
                updateSetting('sleep_start_hour', parseInt(this.sleepStart.value) || 0);
            });
        }
        if (this.sleepEnd) {
            this.sleepEnd.addEventListener('input', () => {
                updateSetting('sleep_end_hour', parseInt(this.sleepEnd.value) || 0);
            });
        }

        // Deep Sleep Interval
        if (this.deepSleepInterval) {
            this.deepSleepInterval.addEventListener('input', () => {
                updateSetting('deep_sleep_interval', parseInt(this.deepSleepInterval.value) || 600);
            });
        }
    }
}
