class LaundryCard extends HTMLElement {
  // Whenever states are updated
  set hass(hass) {
    const entityId = this.config.entity;
    const state = hass.states[entityId];
    // Set data definitions
    const friendlyName = state.attributes["friendly_name"] || state.entity_id;
    const icon = state.attributes["icon"];
    if (!this.content) {
      this.innerHTML = `
        <ha-card header="${friendlyName}">
          <div class="main">
            <ha-icon icon="${icon}"></ha-icon>
            <span></span>
          </div>
        </ha-card>
      `;
      this.querySelector(".main").style.display = "grid";
      this.querySelector(".main").style.gridTemplateColumns = "33% 64%";
      this.querySelector("ha-icon").style.setProperty("--mdc-icon-size", "95%");
    }
    if (state.state == "on") {
      const totalTime = state.attributes["initial_time"];
      const remainTime = state.attributes["remain_time"];
      const totalMinutes = (parseInt(totalTime.split(":")[0]) * 60) + parseInt(totalTime.split(":")[1]);
      const remainMinutes = (parseInt(remainTime.split(":")[0]) * 60) + parseInt(remainTime.split(":")[1]);
      this.querySelector("ha-icon").style.color = "#FDD835";
      this.querySelector("span").innerHTML = `
${friendlyName} is running ${state.attributes["current_course"]}<br>
Currently ${state.attributes["run_state"]}<br>
${state.attributes["initial_time"]} total, ${state.attributes["remain_time"]} to go
<div class="progress-wrapper" style="height: 20px; width: 100%;">
  <div class="progress" style="display: inline-block; height: 20px;">
  </div>
  <span style="color: #FFFFFF; position: absolute; right: 33%;">50%</span>
</div>
`;
      this.querySelector(".progress-wrapper").style.backgroundColor = "#44739E";
      this.querySelector(".progress").style.backgroundColor = "#FDD835";
      this.querySelector(".progress").style.width = (totalMinutes - remainMinutes) / totalMinutes * 100 + "%";
      this.querySelector(".progress-wrapper span").innerHTML = Math.round((totalMinutes - remainMinutes) / totalMinutes * 100) + "%";
    } else {
      this.querySelector("ha-icon").style.color = "#44739E";
      this.querySelector("span").innerHTML = `${friendlyName} is off`;
    }
  }

  // On updated config
  setConfig(config) {
    const states = document.querySelector("home-assistant").hass.states;
    if (!config.entity || !states[config.entity] || !states[config.entity].state) {
      throw new Error("You need to define an valid entity (eg sensor.my_washing_machine)");
    }
    this.config = config;
  }

  // HA card size to distribute cards across columns, 50px
  getCardSize() {
    return 3;
  }

  // Return default config
  static getStubConfig() {
    for (var state of Object.values(document.querySelector("home-assistant").hass.states)) {
      if (state.attributes["run_state"] !== undefined) {
        return { entity: state.entity_id };
      }
    }
    return { entity: "sensor.my_washing_machine" };
  }
}

customElements.define('laundry-card', LaundryCard);
window.customCards.push(
  {
    type: "laundry-card",
    name: "Laundry Card",
    preview: true
  }
);
