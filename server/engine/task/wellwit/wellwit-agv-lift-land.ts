import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'
import { sleep } from '@things-factory/utils'

async function WellwitAgvLiftLand(step, context) {
  var { logger } = context
  var {
    connection: connectionName,
    params: { packetId: packetId, liftOrLand: liftOrLand, isWait: isWait = true }
  } = step

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  var { request, robotId, socket } = connection

  // Example: shelf lifting
  // 7F7F7F 07 0e44 000e0000 004b9E00 01000000 E8 // doc
  // 7f7f7f 07 1244 00000001 00 bc2d4b00 01000000 00000000 f4 // lift
  // 7f7f7f 07 1244 00000001 00 bc2d4b00 02000000 00000000 f7 // land

  var backupData = liftOrLand // 0x01 (lifting) and 0x02 (dropping)
  backupData = backupData.padEnd(8, '0')

  var sendMessage = WellwitAGVConnector.getBaseExtCommand(
    PACKET_TYPE.LIFT_MODULE_LL,
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
      logger.info('finish agv-lift-land')
    }
  }

  return retval
}

WellwitAgvLiftLand.parameterSpec = [
  {
    type: 'string',
    name: 'packetId',
    placeholder: '00000001',
    label: 'packet_id'
  },
  {
    type: 'select',
    name: 'liftOrLand',
    label: 'lift_or_land',
    property: {
      options: [
        { display: ' ', value: '00' },
        { display: 'LIFT', value: '01' },
        { display: 'LAND', value: '02' }
      ]
    }
  },
  {
    type: 'checkbox',
    name: 'isWait',
    label: 'is_wait'
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-lift-land', WellwitAgvLiftLand)
