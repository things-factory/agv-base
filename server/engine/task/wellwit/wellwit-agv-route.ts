import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'
import { sleep } from '@things-factory/utils'

const STATUS_WAIT = 'WAIT'
const STATUS_FINISH = 'FINISH'

async function WellwitAgvArrive(step, { logger, variables }) {
  var {
    connection: connectionName,
    params: { packetId: packetId, coordinate: coordinate, pathCount: pathCount, interval: interval }
  } = step

  var lastPosition = undefined
  if (variables) {
    if (variables.lastPosition) {
      lastPosition = variables.lastPosition.toString()
    }

    if (variables.toPosition) {
      coordinate = variables.toPosition
    }
  }

  if (!coordinate) {
    throw new Error('To Position is empty!!!')
  }

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  // Example: Go to coordinates 20010
  // 7F7F7F 04 1244 00160000 00635d01 00 00000100 00035BCB 96 //
  // 7f7f7f 04 1244 00000001 081a4685 00 00000100 00002714 cf // arrive to 10004

  if (lastPosition) {
    var lastPositionX = parseInt(lastPosition.substring(0, 2))
    var lastPositionY = parseInt(lastPosition.substring(3))
    var toPosX = parseInt(coordinate.substring(0, 2))
    var toPosY = parseInt(coordinate.substring(3))
    var gapX = toPosX - lastPositionX
    // var gapX = parseInt(toPosX.toString().split('').reverse().join('')) - parseInt(lastPositionX.toString().split('').reverse().join(''))  // 첫번째 자리는 0이 될수 없음.
    var gapY = toPosY - lastPositionY
    if (gapX != 0 && gapY != 0) {
      let tempCoordinate = toPosX.toString().padStart(2, '0') + '0' + lastPositionY.toString().padStart(2, '0')
      var data = await move(connection, { packetId, coordinate: tempCoordinate, pathCount }, logger)

      lastPosition = data && data.currentPosition
    }

    await sleep(interval)
  }

  var data = await move(connection, { packetId, coordinate: coordinate, pathCount }, logger)

  return { data }
}

async function move(connection, params, logger) {
  var { packetId, coordinate, pathCount } = params
  var { request, robotId, socket } = connection

  var backupData = '0000'
  backupData += pathCount.padStart(2, '0')
  backupData += '00'

  var destination = Number(coordinate).toString(16)
  destination = destination.padStart(8, '0')

  // var sendMessage = WellwitAGVConnector.getArriveCommand(PACKET_TYPE.ARRIVE, '1244', packetId, '00' + backupData, destination)
  var sendMessage = WellwitAGVConnector.getBaseExtCommand(
    PACKET_TYPE.ARRIVE,
    robotId,
    packetId,
    '00' + backupData,
    destination
  )
  await request(sendMessage, { logger }, socket)

  var status = STATUS_WAIT
  var data = undefined
  var waitHandler = messageData => {
    // Example:
    // 7f7f7f 10 2444 007b0000 00cc0d00 00 5e 01(idle) 00000000 439c0000(current position) 00000000 00000000 00(Shelf status: 0x00, 0x01) 00 00000000 01 01 35

    let agvId = parseInt(messageData.substring(4, 6), 16)
    let batteryStatus = parseInt(messageData.substring(24, 26), 16)
    let agvStatus = messageData.substring(26, 28)

    let position = messageData.substring(40, 42) + messageData.substring(38, 40) + messageData.substring(36, 38)
    let currentPosition = parseInt(position, 16)

    let shelfStatus = messageData.substring(60, 62)

    if (coordinate == currentPosition) {
      logger.info(
        `robotId: ${agvId}, batteryStatus: ${batteryStatus}, agvStatus: ${agvStatus}, currPos: ${currentPosition}, shelfStatus: ${shelfStatus}`
      )
      data = { agvId, batteryStatus, agvStatus, currentPosition, shelfStatus }

      status = STATUS_FINISH
    }
  }

  var interruptHandler = () => {
    connection.removeListener('agv-message', waitHandler)
    throw new Error(`Step agvArrive is interrupted!`)
  }

  connection.addListener('agv-message', waitHandler)
  connection.addListener('agv-interrupt', interruptHandler)

  while (true) {
    if (status == STATUS_FINISH || !socket) {
      connection.removeListener('agv-message', waitHandler)
      connection.removeListener('agv-interrupt', interruptHandler)
      break
    }

    await sleep(5)
  }

  return data
}

WellwitAgvArrive.parameterSpec = [
  {
    type: 'string',
    name: 'packetId',
    placeholder: 'hex(4byte): 00000001',
    label: 'packet_id'
  },
  {
    type: 'string',
    name: 'coordinate',
    placeholder: '10001',
    label: 'coordinate'
  },
  {
    type: 'number',
    name: 'pathCount',
    label: 'path_count'
  },
  {
    type: 'number',
    name: 'interval',
    placeholder: 'milli-seconds',
    label: 'interval'
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-arrive', WellwitAgvArrive)

// step = {
//   "id":"a401d44a-2f68-47fa-8ec2-143a079f509d",
//   "name":"AGV-MOVE#1",
//   "description":null,
//   "sequence":0,
//   "task":"agv-move",
//   "skip":null,
//   "connection":"agv@192.168.1.47",
//   "params":{
//       "coordinate":"20001"
//   },
//   "createdAt":"2020-04-20T06:39:19.000Z",
//   "updatedAt":"2020-04-20T06:39:19.000Z"
// }
