# Welcome to "Sussex House"!

This is my Home Assistant installation and the insanity that runs my life

Home Assistant is now running in a VM on a ProxMox VE server. 
ProxMox is running on a Dell R630 with 128GB RAM, 2 Virtual Disks (ProxMox OS on 2 1TB SSD Raid 1, LXCs and VMs on 6 1TB SSDs in RAID 6)
(and NO Home Assistant isnt the only thing running on the box hah!)

## Some statistics about my installation:

Description | value
-- | --
Number of entities | 1859
Number of sensors | 837
Number of automations | 12
Number of scripts | 0
Number of scenes | 1
Number of zones | 3
Number of binary sensors | 191

## My installed extensions:

### Add-ons
- **Advanced SSH & Web Terminal** (Version 20.0.2)
- **Duck DNS** (Version 1.18.0)
- **Ecowitt HTTP Proxy** (Version 1.1.1)
- **ESPHome Device Builder** (Version 2025.3.3)
- **eufy-security-ws** (Version 1.9.1)
- **File editor** (Version 5.8.0)
- **Govee to MQTT Bridge** (Version 2025.01.04-2c39a50f)
- **Home Assistant Google Drive Backup** (Version 0.112.1)
- **Matter Server** (Version 7.0.0)
- **OpenThread Border Router** (Version 2.13.0)
- **openWakeWord** (Version 1.10.0)
- **Piper** (Version 1.5.2)
- **SQLite Web** (Version 4.3.1)
- **Whisper** (Version 2.4.0)
- **Zigbee2MQTT Proxy** (Version 0.2.0)


### Built-in Integrations
- **alarm_control_panel** (4 entities)
- **assist_satellite** (1 entities)
- **binary_sensor** (191 entities)
- **button** (137 entities)
- **camera** (7 entities)
- **conversation** (5 entities)
- **device_tracker** (12 entities)
- **event** (2 entities)
- **fan** (9 entities)
- **image** (7 entities)
- **input_boolean** (1 entities)
- **input_number** (1 entities)
- **input_text** (1 entities)
- **light** (86 entities)
- **lock** (2 entities)
- **media_player** (11 entities)
- **number** (147 entities)
- **openplantbook** (1 entities)
- **person** (2 entities)
- **plant** (2 entities)
- **remote** (7 entities)
- **scene** (1 entities)
- **select** (87 entities)
- **sensor** (837 entities)
- **stt** (2 entities)
- **sun** (1 entities)
- **switch** (154 entities)
- **todo** (1 entities)
- **tts** (3 entities)
- **update** (119 entities)
- **wake_word** (1 entities)
- **weather** (2 entities)
- **zone** (3 entities)



### Custom integrations
- [**Adaptive Lighting**](https://github.com/basnijholt/adaptive-lighting):<br /> *Adaptive Lighting custom component for Home Assistant*
- [**Dreo Smart Device Integration**](https://github.com/JeffSteinbok/hass-dreo):<br /> *Dreo Smart Device Integration for Home Assistant*
- [**Eufy Security**](https://github.com/fuatakgun/eufy_security):<br /> *Home Assistant integration to manage Eufy Security devices as cameras, home base stations, doorbells, motion and contact sensors.*
- [**Fontawesome**](https://github.com/thomasloven/hass-fontawesome):<br /> *🔹 Use icons from fontawesome in home-assistant*
- [**Generate Readme**](https://github.com/custom-components/readme):<br /> *Use Jinja and data from Home Assistant to generate your README.md file*
- [**HACS**](https://github.com/hacs/integration):<br /> *HACS gives you a powerful UI to handle downloads of all your custom needs.*
- [**Home Assistant Plant**](https://github.com/Olen/homeassistant-plant):<br /> *Alternative Plant component of home assistant*
- [**Openplantbook**](https://github.com/Olen/home-assistant-openplantbook):<br /> *Integration to search and fetch data from Openplantbook.io*
- [**Pirate Weather**](https://github.com/Pirate-Weather/pirate-weather-ha):<br /> *Replacement for the default Dark Sky Home Assistant integration using Pirate Weather *
- [**Proxmox Ve**](https://github.com/dougiteixeira/proxmoxve):<br /> *Proxmox VE Custom Integration Home Assistant*
- [**Samsungtv Smart**](https://github.com/ollo69/ha-samsungtv-smart):<br /> *📺 Home Assistant SamsungTV Smart Component with simplified SmartThings API Support configurable from User Interface.*
- [**Smartthinq Lge Sensors**](https://github.com/ollo69/ha-smartthinq-sensors):<br /> *HomeAssistant custom integration for SmartThinQ LG devices*
- [**Spook 👻 Your Homie**](https://github.com/frenck/spook):<br /> *A scary 👻 powerful toolbox 🧰 for Home Assistant 🏡*
- [**Uptime Kuma**](https://github.com/meichthys/uptime_kuma):<br /> *Uptime Kuma HACS integration*
- [**Watchman**](https://github.com/dummylabs/thewatchman):<br /> *Home Assistant custom integration to keep track of missing entities and actions in your config files*
- [**Webrtc Camera**](https://github.com/AlexxIT/WebRTC):<br /> *Home Assistant custom component for real-time viewing of almost any camera stream using WebRTC and other technologies.*
- [**Xsense**](https://github.com/Jarnsen/ha-xsense-component_test):<br /> *HACS Integration for X-Sense devices*

### Lovelace plugins
- [**Apexcharts Card**](https://github.com/RomRider/apexcharts-card):<br /> *📈 A Lovelace card to display advanced graphs and charts based on ApexChartsJS for Home Assistant*
- [**Auto Entities**](https://github.com/thomasloven/lovelace-auto-entities):<br /> *🔹Automatically populate the entities-list of lovelace cards*
- [**Bar Card**](https://github.com/custom-cards/bar-card):<br /> *Customizable Animated Bar card for Home Assistant Lovelace*
- [**Battery State Card / Entity Row**](https://github.com/maxwroc/battery-state-card):<br /> *Battery state card for Home Assistant*
- [**Bubble Card**](https://github.com/Clooos/Bubble-Card):<br /> *Bubble Card is a minimalist card collection for Home Assistant with a nice pop-up touch.*
- [**Button Card**](https://github.com/custom-cards/button-card):<br /> *❇️ Lovelace button-card for home assistant*
- [**Card Mod**](https://github.com/thomasloven/lovelace-card-mod):<br /> *🔹 Add CSS styles to (almost) any lovelace card*
- [**Config Template Card**](https://github.com/iantrich/config-template-card):<br /> *📝 Templatable Lovelace Configurations*
- [**Custom Brand Icons**](https://github.com/elax46/custom-brand-icons):<br /> *Custom brand icons for Home Assistant*
- [**Custom More Info**](https://github.com/Mariusthvdb/custom-more-info):<br /> *Customize More-info dialogs for Home Assistant*
- [**Custom Ui**](https://github.com/Mariusthvdb/custom-ui):<br /> *Add templates and icon_color to Home Assistant UI*
- [**Flex Table   Highly Customizable, Data Visualization**](https://github.com/custom-cards/flex-table-card):<br /> *Highly Flexible Lovelace Card - arbitrary contents/columns/rows, regex matched, perfect to show appdaemon created content and anything breaking out of the entity_id + attributes concept*
- [**Flower Card**](https://github.com/Olen/lovelace-flower-card):<br /> *Lovelace Flower Card to match the custom plant integration*
- [**Horizon Card**](https://github.com/rejuvenate/lovelace-horizon-card):<br /> *Sun Card successor: Visualize the position of the Sun over the horizon.*
- [**Hourly Weather Card**](https://github.com/decompil3d/lovelace-hourly-weather):<br /> *Hourly weather card for Home Assistant. Visualize upcoming weather conditions as a colored horizontal bar.*
- [**Hui Element**](https://github.com/thomasloven/lovelace-hui-element):<br /> *🔹 Use built-in elements in the wrong place*
- [**Layout Card**](https://github.com/thomasloven/lovelace-layout-card):<br /> *🔹 Get more control over the placement of lovelace cards.*
- [**Mini Graph Card**](https://github.com/kalkih/mini-graph-card):<br /> *Minimalistic graph card for Home Assistant Lovelace UI*
- [**Mushroom**](https://github.com/piitaya/lovelace-mushroom):<br /> *Build a beautiful Home Assistant dashboard easily*
- [**Purifier Card**](https://github.com/denysdovhan/purifier-card):<br /> *Air Purifier card for Home Assistant Lovelace UI*
- [**Rgb Light Card**](https://github.com/bokub/rgb-light-card):<br /> *💡 A Home Assistant card for RGB lights*
- [**Weather Card**](https://github.com/bramkragten/weather-card):<br /> *Weather Card with animated icons for Home Assistant Lovelace*
- [**Weather Chart Card**](https://github.com/mlamberts78/weather-chart-card):<br /> *Custom weather card with charts.*
- [**Weather Radar Card**](https://github.com/Makin-Things/weather-radar-card):<br /> *A rain radar card using the tiled images from RainViewer*
- [**Wind Rose Card**](https://github.com/aukedejong/lovelace-windrose-card):<br /> *Home Assistant Lovelace Windrose Card*

### Themes
- [**Caule Themes Pack 1   By Caule.Studio**](https://github.com/ricardoquecria/caule-themes-pack-1):<br /> *10 modern colors  |  4 categories of styles (Black Glass, Black, Dark, Light)  |  40 themes in total  |  Animated icons for the weather forecast card  |  And a bonus automatic theme selector for your interface.*
- [**Metrology   Metro + Fluent + Windows Themes   By Mmak.Es**](https://github.com/Madelena/Metrology-for-Hass):<br /> *🎨 Give your Home Assistant a modern and clean facelift. 🟥🟧🟩🟦🟪 24 Variations with 2 Styles + 6 Colors (Magenta Red / Orange / Green / Blue / Purple) + 🌞 Light and 🌚 Dark modes included. Based on Metro and Fluent UI Design Systems from Microsoft Windows.*
- [**Waves**](https://github.com/tgcowell/waves):<br /> *This is a blend of 2 themes found within the Home Assistant community. Inspired mostly by Noctis, I've adjust colours slightly and have also opted to pull some features from Caule Theme packs to build my own 'ultimate' theme. I will continue to update overtime and do my best to credit those whom I have 'referenced' *


***

Generated by the [custom readme integration](https://github.com/custom-components/readme)