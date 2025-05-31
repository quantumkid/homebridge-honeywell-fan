import { HoneywellFanHomebridgePlatform } from './platform.js';
import Axios, { AxiosInstance } from 'axios';
import { UnknownContext } from 'homebridge';
import Queue from 'p-queue';
import WebSocket from 'ws';

export enum HoneywellFanIRBlasterCommand {
    ONOFF = 'ONOFF',
    SPEED = 'SPEED',
    TIMER = 'TIMER',
    OSCILLATE = 'OSCILLATE'
}

export class HoneywellFanIRBlaster {

  private queue = new Queue({ concurrency: 1, autoStart: true });
  private axios: AxiosInstance;
  private ws: WebSocket;

  constructor(
    private readonly platform: HoneywellFanHomebridgePlatform,
    private readonly context: UnknownContext,
  ) {
    this.axios = Axios.create({
      baseURL: `http://${this.context.host}`,
    });
    this.platform.log.debug(`Web socket url: ${this.context.ip}:${this.context.port}`);
    this.ws = new WebSocket(`ws://${this.context.ip}:${this.context.port}`);

    this.ws.on('open', () => {
      this.platform.log.debug('Web socket open');
    });

    this.ws.on('error', (error) => {
      this.platform.log.error(`Unable to open the web socket: ${error.message}`);
    });
  }

  sendCommand(command: HoneywellFanIRBlasterCommand, n: number = 1) {
    this.platform.log.debug(`Sending ${command} ${n} times`);
    for(let i = 0; i < n; i++) {
      this.queue.add(async () => {
        this.platform.log.debug(`-> Sending command ${command}`);
        this.ws.send(command.valueOf());
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.platform.log.debug('-> Ready for next command');
      });
    }
  }

}