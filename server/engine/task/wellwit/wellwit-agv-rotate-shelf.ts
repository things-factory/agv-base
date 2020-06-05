import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'
import { sleep } from '@things-factory/utils'

async function WellwitAgvRotateShelf(step, context) {
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
    PACKET_TYPE.SHELF_ROTATE,
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
      var rtnval = await handler({ connectionName } as any, context)
      logger.info('finish agv-rotate-shelf')
    }
  }

  return rtnval
}

WellwitAgvRotateShelf.parameterSpec = [
  {
    type: 'string',
    name: 'packetId',
    placeholder: '00000001',
    label: 'packet_id'
  },
  // {
  //   type: 'select',
  //   name: 'type',
  //   label: 'type',
  //   property: {
  //     options: [
  //       { display: ' ', value: '00' },
  //       { display: 'ROBOT', value: '00' },
  //       { display: 'SHELF', value: '01' }
  //     ]
  //   }
  // },
  {
    type: 'select',
    name: 'rotation',
    label: 'rotation',
    property: {
      options: [
        { display: '0°', value: '00' },
        { display: '기준위치°', value: '01' }, // shelfPosture: 01 위치로 이동, 기준위치.
        { display: '기준위치에서 90°', value: '02' }, // shelfPosture: 02 위치로 이동
        { display: '기준위치에서 180°', value: '03' }, // shelfPosture: 03 위치로 이동
        { display: '기준위치에서 270°', value: '04' }, // shelfPosture: 04 위치로 이동
        { display: '현위치에서 180°', value: '05' }, // 순시침, 역시침 180°
        { display: '역시침방향 90°', value: '06' }, // 역시침 90° 회전
        { display: '순시침방향 90°', value: '07' } // 순시침 90° 회전
      ]
    }
  },
  {
    type: 'checkbox',
    name: 'isWait',
    label: 'is_wait'
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-rotate-shelf', WellwitAgvRotateShelf)
