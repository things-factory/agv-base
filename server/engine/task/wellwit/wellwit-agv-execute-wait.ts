import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { sleep } from '@things-factory/utils'

async function WellwitAgvExecuteWait(step, { logger }) {
  const STATUS_WAIT = 'WAIT'
  const STATUS_FINISH = 'FINISH'

  var connection = Connections.getConnection(step.connectionName)
  if (!connection) {
    throw new Error(`connector '${step.connectionName}' is not established.`)
  }

  var { socket } = connection
  if (!connection.socket) {
    throw new Error('socket does not established')
  }

  // Example:
  // 문서: 7F7F 10 2844 00030000 00000000 00 00 00 00000000 50010000 00 00 00 00 00 00 00 00 00 00 00 00 42 00 00 42 00 78 00 00 00 00 01 02 00 00 00 01 68
  // 실제: 7f7f7f 10 2444 007b0000 00cc0d00 00 5e 01(idle) 00000000 439c0000(current position) 00000000 00000000 00(Shelf status: 0x00, 0x01) 00 00000000 01 01 35
  // 0x00 busy, 0x01 idle and 0x02 abnormal

  var data = {}
  var status = STATUS_WAIT

  var waitHandler = messageData => {
    // Example: The instruction "AGV reaches the specified target point task" was successfully executed
    // 7f7f7f 04 0b44 00010000 00000000 00 f1 e3

    let agvId = messageData.readUInt16LE(4)
    let batteryStatus = messageData.readUInt8(15)
    let agvStatus = messageData.readUInt8(16)

    let currentPosition = messageData.readUInt32LE(21)

    let shelfStatus = messageData.readUInt8(30) // 0X00 means no lifted shelf, and 0X01 means lifted shelf.
    let shelfPosture = messageData.readUInt8(31) // 0x01 (90 degrees), 0x02 (180 degrees), 0x03 (270 degrees), 0x04 (360 degrees)
    let shelfCode = messageData.readUInt32BE(32)

    logger.info(`robotId: ${agvId}, batteryStatus: ${batteryStatus}, agvStatus: ${agvStatus}, currentPosition: ${currentPosition}, 
      shelfStatus: ${shelfStatus}, shelfPosture: ${shelfPosture}, shelfCode: ${shelfCode}`)

    if (agvStatus == '1') {
      data = { agvId, batteryStatus, agvStatus, currentPosition, shelfStatus, shelfPosture, shelfCode }
      status = STATUS_FINISH
    }
  }

  var interruptHandler = () => {
    connection.removeListener('agv-message', waitHandler)
  }

  connection.addListener('agv-message', waitHandler)
  connection.once('agv-interrupt', interruptHandler)

  while (true) {
    if (status === STATUS_FINISH || !socket) {
      connection.removeListener('agv-message', waitHandler)
      connection.removeListener('agv-interrupt', interruptHandler)
      break
    }

    await sleep(5)
  }

  return { data }
}

TaskRegistry.registerTaskHandler('wellwit-agv-execute-wait', WellwitAgvExecuteWait)
