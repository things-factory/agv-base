import net from 'net'
import { EventEmitter } from 'events'
import PQueue from 'p-queue'

import { config } from '@things-factory/env'
import { Connections, Connector } from '@things-factory/integration-base'

import { createLogger, format, transports } from 'winston'
const { combine, timestamp, splat, printf } = format

import moment from 'moment-timezone'

const appendTimestamp = format((info, opts) => {
  if (opts.tz) {
    info.timestamp = moment().tz(opts.tz).format()
  }

  return info
})

var logger = createLogger({
  format: combine(
    appendTimestamp({ tz: 'Asia/Seoul' }),
    splat(),
    printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`
    })
  ),
  transports: [
    new (transports as any).DailyRotateFile({
      filename: `logs/agv-server-%DATE%.log`,
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: false,
      maxSize: '5m',
      maxFiles: '15d',
      level: 'info'
    })
  ]
})

export class WellwitAgvServer extends EventEmitter implements Connector {
  socket: any
  robotId: string

  async ready(connectionConfigs) {
    const CONFIG = config.get('agvListener')
    this.robotId = connectionConfigs[0].params.robotId

    await new Promise((resolve, reject) => {
      let server = net.createServer(socket => {
        this.socket = socket
        socket.on('data', async data => {
          // logger.info(`WellwitagvServer - received message: ${message}`)
          let packetType = data.readInt8(3)

          if (packetType == parseInt('10', 16) && data.length == 42) {
            this.emit('agv-message', data)
          }

          socket.write('01', 'hex')
        })

        socket.on('end', () => {
          logger.warn('tcpListener: client disconnected') // FIXME
          this.relaseSocket()
        })

        socket.on('error', ex => {
          logger.error('tcpListener: error: ') // FIXME
          this.relaseSocket()
        })
      })

      server.listen(CONFIG.port, async () => {
        logger.info('tcp-listener server listening on %j', server.address())

        resolve()
      })
    })

    await Promise.all(
      connectionConfigs.map(config => {
        this.connect.call(this, config)
      })
    )
  }

  async connect(connection) {
    Connections.addConnection(connection.name, this)
  }

  async request(message, { logger }, socket) {
    var queue = new PQueue({ concurrency: 1 })
    return await queue.add(async () => {
      try {
        await socket.write(message, 'hex')
        logger && logger.info(`Request : ${message}`)
      } catch (e) {
        logger.error('agv command(write-read) failed.')
        logger.error(e)
        throw new Error(e)
      }
    })
  }

  async relaseSocket() {
    this.emit('interrupt')
    this.socket.destroy()
    this.socket = undefined
  }

  async disconnect(name) {
    Connections.removeConnection(name)
    this.relaseSocket()
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

  get taskPrefixes() {
    return ['wellwit-agv']
  }
}

Connections.registerConnector('wellwit-agv-server', new WellwitAgvServer())
