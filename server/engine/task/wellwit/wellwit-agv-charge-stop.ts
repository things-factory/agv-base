import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'

async function WellwitAgvChargeStop(step, { logger }) {
  var {
    connection: connectionName,
    params: { packetId: packetId }
  } = step

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  var { request, robotId, socket } = connection

  // Example: stop charging
  // 7F7F7F 0C 0e44 00140000 00FA8200 00000000 00000000 0000 00 55 // doc
  // 7f7f7f 0c 1244 00140000 00FA8200 00 00000000 00000000 49 // stop charge

  var sendMessage = WellwitAGVConnector.getBaseExtCommand(
    PACKET_TYPE.CHARGE_STOP,
    robotId,
    packetId,
    '00' + '00000000',
    '00000000'
  )
  await request(sendMessage, { logger }, socket)

  return {}
}

WellwitAgvChargeStop.parameterSpec = [
  {
    type: 'string',
    name: 'packetId',
    placeholder: '00000001',
    label: 'packet_id'
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-charge-stop', WellwitAgvChargeStop)
