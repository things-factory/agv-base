import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'
import { sleep } from '@things-factory/utils'

// 한번만 꺽을수 있음.
async function WellwitAgvArrive(step, context) {
  var { logger, variables } = context
  var {
    connection: connectionName,
    params: { packetId, coordinate, pathCount, redirectPriority }
  } = step

  var lastPosition = undefined
  if (variables) {
    if (variables.lastPosition) {
      lastPosition = variables.lastPosition.toString()
    }

    if (!coordinate || coordinate == '0') {
      coordinate = variables.toPosition
    }

    if (!redirectPriority) {
      redirectPriority = variables.redirectPriority
    }
  } else {
    // if do monitoring?
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
    var lastPositionX = parseInt(lastPosition.substring(3))
    var lastPositionY = parseInt(lastPosition.substring(0, 2))
    var toPosX = parseInt(coordinate.substring(3))
    var toPosY = parseInt(coordinate.substring(0, 2))
    var gapX = toPosX - lastPositionX
    // var gapX = parseInt(toPosX.toString().split('').reverse().join('')) - parseInt(lastPositionX.toString().split('').reverse().join(''))  // 첫번째 자리는 0이 될수 없음.
    var gapY = toPosY - lastPositionY
    if (gapX != 0 && gapY != 0) {
      var tempCoordinate
      if (redirectPriority == 'X') {
        tempCoordinate = lastPositionY.toString().padStart(2, '0') + '0' + toPosX.toString().padStart(2, '0') // x우선 이동
      } else {
        tempCoordinate = toPosY.toString().padStart(2, '0') + '0' + lastPositionX.toString().padStart(2, '0') // y우선 이동
      }
      var data = await move(connection, connectionName, { packetId, coordinate: tempCoordinate, pathCount }, context)
    }
  }

  var data = await move(connection, connectionName, { packetId, coordinate: coordinate, pathCount }, context)

  return data
}

async function move(connection, connectionName, params, context) {
  var { packetId, coordinate, pathCount, isWait = true } = params
  var { request, robotId, socket } = connection
  var { logger } = context

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

  var i = 0
  while (isWait) {
    await sleep(50)
    var handler = TaskRegistry.getTaskHandler('wellwit-agv-execute-wait')
    if (!handler) {
      throw new Error(`no task handler(agv-execute-wait)`)
    } else {
      var retval: any = await handler({ connectionName }, context)
      if (i > 20) {
        break
      }

      if (retval.data.currentPosition == coordinate) {
        // logger.info('finish agv-arrive')
        break
      }

      i++
    }
  }

  return retval
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
    type: 'string',
    name: 'redirectPriority',
    placeholder: 'X, Y',
    label: 'redirect_priority'
  },
  {
    type: 'checkbox',
    name: 'isWait',
    label: 'is_wait'
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
