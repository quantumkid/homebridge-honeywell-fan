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
    this.ws = this.openSocket(this.context);
  }

  openSocket(context: UnknownContext, callback: () => void = () => {}): WebSocket {
    let ws = new WebSocket(`ws://${context.ip}:${context.port}`);

    ws.on('open', () => {
      this.platform.log.debug('Web socket open');
      callback();
    });

    ws.on('error', (error) => {
      this.platform.log.error(`Unable to open the web socket: ${error.message}`);
    });

    ws.on('close', () => {
      this.platform.log.debug('Web socket closed');
    });

    return ws;
  }

  sendCommand(command: HoneywellFanIRBlasterCommand, n: number = 1) {
    // Attempt to ping the websocket to ensure it's open
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.ping((error: { message: any }) => {
        if (error) {
          this.platform.log.error(`Web socket ping failed: ${error.message}`);
          this.ws.terminate();
          this.ws = this.openSocket(this.context, this._sendCommand.bind(this, command, n));
        } else {
          this.platform.log.debug('Web socket ping successful');
          this._sendCommand(command, n);
        }
      });
    } else {
      this.platform.log.error(`Web socket is closed, creating a new one`);
      this.ws.terminate();
      this.ws = this.openSocket(this.context, this._sendCommand.bind(this, command, n));
    }
  }

  _sendCommand(command: HoneywellFanIRBlasterCommand, n: number = 1) {
    this.platform.log.debug(`Sending ${command} ${n} times`);
    for (let i = 0; i < n; i++) {
      this.queue.add(async () => {
        this.platform.log.debug(`-> Sending command ${command}`);
        this.ws.send(command.valueOf());
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.platform.log.debug('-> Ready for next command');
      });
    }
  }
}