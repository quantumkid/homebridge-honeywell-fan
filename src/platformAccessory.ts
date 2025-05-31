import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { HoneywellFanHomebridgePlatform } from './platform.js';
import { HoneywellFanIRBlaster, HoneywellFanIRBlasterCommand } from './irblaster.js';

enum RotationSpeedSetting {
  LOW,
  MEDIUM,
  HIGH,
}

function modulo(n: number, d: number): number {
  return (((n % d) + d) % d);
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HoneywellFanAccessory {
  private service: Service;
  private ir: HoneywellFanIRBlaster;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    active: false,
    swingMode: false,
    targetRotationSpeed: 0,
    rotationSpeedSetting: RotationSpeedSetting.HIGH,
    timer: 0,
  };

  constructor(
    private readonly platform: HoneywellFanHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Name, 'Fan')
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Honeywell')
      .setCharacteristic(this.platform.Characteristic.Model, 'Fan')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.mac);

    this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getActive.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Swing Mode  Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
      .onSet(this.setSwingMode.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getSwingMode.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Swing Mode  Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onSet(this.setRotationSpeed.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getRotationSpeed.bind(this));               // GET - bind to the `getOn` method below

    // Initialise the IR Blaster interface
    this.ir = new HoneywellFanIRBlaster(this.platform, this.accessory.context);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setActive(value: CharacteristicValue) {
    this.state.active = value as boolean;
    this.platform.log.debug('Set Characteristic On ->', value);
    // If the fan is being turned off we set it to full speed
    if (!this.state.active) {
      this.state.targetRotationSpeed = 100; // Set to 100% speed
      this.state.rotationSpeedSetting = RotationSpeedSetting.HIGH; // Set to high speed setting
    }
    this.ir.sendCommand(HoneywellFanIRBlasterCommand.ONOFF);
  }

  async getActive(): Promise<CharacteristicValue> {
    const isActive = this.state.active;
    this.platform.log.debug('Get Characteristic On ->', isActive);
    return isActive;
  }

  async setSwingMode(value: CharacteristicValue) {
    this.state.swingMode = value as boolean;
    this.platform.log.debug('Set Characteristic SwingMode ->', value);
    this.ir.sendCommand(HoneywellFanIRBlasterCommand.OSCILLATE);
  }

  async getSwingMode(): Promise<CharacteristicValue> {
    const isSwingMode = this.state.swingMode;
    this.platform.log.debug('Get Characteristic SwingMode ->', isSwingMode);
    return isSwingMode;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.state.targetRotationSpeed = value as number;
    this.platform.log.debug('Set Characteristic RotationSpeed ->', value);

    // Convert the target rotation speed into the nearest fan setting
    let newRotationSpeed: RotationSpeedSetting;
    if (this.state.targetRotationSpeed <= 33) {
      newRotationSpeed = RotationSpeedSetting.LOW;
    } else if (this.state.targetRotationSpeed <= 66) {
      newRotationSpeed = RotationSpeedSetting.MEDIUM;
    } else {
      newRotationSpeed = RotationSpeedSetting.HIGH;
    }

    if (newRotationSpeed != this.state.rotationSpeedSetting) {
      this.setRotationSpeedSetting(newRotationSpeed);
    }
  }

  async getRotationSpeed(): Promise<CharacteristicValue> {
    const isRotationSpeed = this.state.targetRotationSpeed;
    this.platform.log.debug('Get Characteristic RotationSpeed ->', isRotationSpeed);
    return isRotationSpeed;
  }

  setRotationSpeedSetting(value: RotationSpeedSetting) {
    const settings = [RotationSpeedSetting.HIGH, RotationSpeedSetting.MEDIUM, RotationSpeedSetting.LOW];
    const fromIndex = settings.indexOf(this.state.rotationSpeedSetting);
    const toIndex = settings.indexOf(value);
    const steps = modulo(toIndex - fromIndex, 3);
    this.ir.sendCommand(HoneywellFanIRBlasterCommand.SPEED, steps);
    this.state.rotationSpeedSetting = value;
  }

}