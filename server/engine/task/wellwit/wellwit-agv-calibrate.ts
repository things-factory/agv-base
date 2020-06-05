import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'
import { sleep } from '@things-factory/utils'

async function WellwitAgvCalibrate(step, context) {
  var { logger } = context
  var {
    connection: connectionName,
    params: {
      packetId,
      // rotation,
      mode,
      isWait: isWait = true
    }
  } = step

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  var { request, robotId, socket } = connection

  // Example: coordinate calibration
  // 0x0a (coordinate calibration) and 0x0b (shelf calibration) are two calibration modes.
  // 7F7F7F 0b 0e44 00130000 00444a00 000a0000 0000 00 29

  var backupData = mode
  // backupData = backupData.padStart(8, '0')
  backupData = backupData.padEnd(8, '0')

  // TODO test
  // var sendMessage = WellwitAGVConnector.getBaseCommand(PACKET_TYPE.CALIBRATION, robotId, packetId)
  var sendMessage = WellwitAGVConnector.getBaseExtCommand(
    PACKET_TYPE.CALIBRATION,
    robotId,
    packetId,
    '00' + backupData,
    '00000000'
  )
  // sendMessage += ('00' + backupData)
  // sendMessage += WellwitAGVConnector.chk8xor(sendMessage);
  await request(sendMessage, { logger }, socket)

  if (isWait) {
    await sleep(50)
    var handler = TaskRegistry.getTaskHandler('wellwit-agv-execute-wait')
    if (!handler) {
      throw new Error(`no task handler(agv-execute-wait)`)
    } else {
      var retval: any = await handler({ connectionName }, context)
      logger.info('finish agv-arrive')
    }
  }

  return retval
}

WellwitAgvCalibrate.parameterSpec = [
  {
    type: 'string',
    name: 'packetId',
    placeholder: '00000001',
    label: 'packet_id'
  },
  // {
  //   type: 'select',
  //   name: 'rotation',
  //   label: 'rotation',
  //   property: {
  //     options: [
  //       { display: ' ', value: '00' },
  //       { display: '0°', value: '00' },
  //       { display: '90°', value: '01' },
  //       { display: '180°', value: '02' },
  //       { display: '270°', value: '03' },
  //       { display: '360°', value: '04' }
  //     ]
  //   }
  // },
  {
    type: 'select',
    name: 'mode',
    label: 'mode',
    property: {
      options: [
        { display: ' ', value: '00' },
        { display: 'coordinate', value: '0a' },
        { display: 'shelf', value: '0b' }
      ]
    }
  },
  {
    type: 'checkbox',
    name: 'isWait',
    label: 'is_wait'
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-calibrate', WellwitAgvCalibrate)
