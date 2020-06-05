import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'
import { sleep } from '@things-factory/utils'

async function WellwitAgvRotate(step, context) {
  var { logger } = context
  var {
    connection: connectionName,
    params: { packetId: packetId, type: type = '01', rotation: rotation, isWait: isWait }
  } = step

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  var { request, robotId, socket } = connection

  // Example: Shelf turning left
  // doc: 7F7F7F 08 0e44 00110000 00A44D01 06000000 00 C2
  //

  var backupData = rotation
  backupData = backupData + '000000'

  var sendMessage = WellwitAGVConnector.getBaseExtCommand(
    PACKET_TYPE.ROBOT_ROTATE,
    robotId,
    packetId,
    '00' + backupData,
    '00000000'
  )
  await request(sendMessage, { logger }, socket)

  if (isWait) {
    await sleep(50)
    var handler = TaskRegistry.getTaskHandler('wellwit-agv-execute-wait')
    if (!handler) {
      throw new Error(`no task handler(agv-execute-wait)`)
    } else {
      var retval: any = await handler({ connectionName }, context)
      logger.info('finish agv-rotate')
    }
  }

  return retval
}

WellwitAgvRotate.parameterSpec = [
  {
    type: 'string',
    name: 'packetId',
    placeholder: '00000001',
    label: 'packet_id'
  },
  {
    type: 'select',
    name: 'rotation',
    label: 'rotation',
    property: {
      options: [
        { display: '0°', value: '00' },
        { display: 'y좌표가 증가하는 방향', value: '01' }, // y좌표가 증가하는 방향, 기준이되는 방향임,
        { display: 'x좌표가 증가하는 방향', value: '02' }, // x좌표가 증가하는 방향
        { display: 'x좌표가 작아지는 방향', value: '03' }, // x좌표가 작아지는 방향
        { display: 'y좌표가 작아지는 방향', value: '04' }, // y좌표가 작아지는 방향
        { display: '180°', value: '05' }, // 로봇 180°
        { display: '역시침90°', value: '06' }, // 로봇 역시침 90°
        { display: '순시침90°', value: '07' } // 로봇 순시침 90°
      ]
    }
  },
  {
    type: 'checkbox',
    name: 'isWait',
    label: 'is_wait'
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-rotate', WellwitAgvRotate)
