import net from 'net'
import PromiseSocket from 'promise-socket'
import PQueue from 'p-queue'
import { sleep } from '@things-factory/utils'

import { Connections, Connector } from '@things-factory/integration-base'

const FIXED_HEADER = '7f7f7f'

export const PACKET_TYPE = Object.freeze({
  TF_CTL: '01',
  CHARGE: '03',
  ARRIVE: '04',
  ARRIVE_LIFT: '05',
  ARRIVE_LAND: '06',
  LIFT_MODULE_LL: '07', // ROBOT Lifting module Lift/Land
  SHELF_ROTATE: '08',
  ROBOT_ROTATE: '09',
  MOVE: '0a',
  CALIBRATION: '0b',
  CHARGE_STOP: '0c'
})

export class WellwitAGVConnector implements Connector {
  static getBaseCommand(packetType, robotId, packetId) {
    const dt = new Date()
    const hms = Number(dt.getHours().toString() + dt.getMinutes() + dt.getSeconds() + dt.getMilliseconds()).toString(16)
    var message = FIXED_HEADER +
      packetType +  // 1 bytes
      robotId +     // 2 bytes
      packetId +    // 4 bytes
      hms.padStart(8, '0')  // 4 bytes

    return message
  }

  static getBaseExtCommand(packetType, robotId, packetId, backupData: string, coordinate: string) {
    var message = this.getBaseCommand(packetType, robotId, packetId) + backupData + coordinate
    var xorcheck = WellwitAGVConnector.chk8xor(Buffer.from(message, 'hex'))
    message += xorcheck
    
    return message
  }
  
  static chk8xor(byteArray) {
    var checksum = 0;
    for(var i = 0; i <  byteArray.length; i++) {
        checksum ^= byteArray[i];
    }

    return checksum.toString(16).padStart(2, '0');
  }

  async ready(connectionConfigs) {
    await Promise.all(connectionConfigs.map(this.connect))

    Connections.logger.info('wellwit-agv connections are ready')
  }

  async connect(config: any) {
    if (Connections.getConnection(config.name)) {
      return
    }

    var [host, port] = config.endpoint.split(':')

    var socket = new PromiseSocket(new net.Socket())

    await socket.connect(port, host)

    var queue = new PQueue({ concurrency: 1 })
    var keepalive = true

    Connections.addConnection(config.name, {
      request: async function(message, { logger }) {
        return await queue.add(async () => {
          while (keepalive) {
            try {
              await socket.write(message, 'hex')
              logger && logger.info(`Request : ${message}`)

              var response = await socket.read()
              if (!response) {
                // socket ended or closed
                throw new Error('socket closed')
              }

              logger && logger.info(`Response : ${response.toString()}`)
              logger && logger.info(`Response : ${response.toString('hex')}`)
              return response.toString()
            } catch (e) {
              logger.error('agv command(write-read) failed.')
              logger.error(e)

              if (keepalive) {
                socket && socket.destroy()

                socket = new PromiseSocket(new net.Socket())
                await socket.connect(port, host)

                await sleep(1000)
              } else {
                throw e
              }
            }
          }
        })
      },
      close: function() {
        queue.clear()
        keepalive = false
        socket.destroy()
      },
      params: config.params
    })

    Connections.logger.info(`wellwit-agv connection(${config.name}:${config.endpoint}) is connected`)
  }

  async disconnect(name) {
    var { close } = Connections.removeConnection(name)
    close()

    Connections.logger.info(`wellwit-agv connection(${name}) is disconnected`)
  }

  get parameterSpec() {
    return [
      {
        type: 'number',
        label: 'Robot ID',
        placeholder: 'Robot ID',
        name: 'robotId'
      }
    ]
  }
}

// Connections.registerConnector('wellwit-agv', new WellwitAGVConnector())
