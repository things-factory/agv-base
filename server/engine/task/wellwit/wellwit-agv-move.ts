import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'

// unused
async function WellwitAgvMove(step, { logger }) {
  var {
    connection: connectionName,
    params: { packetId: packetId, rotation: rotation, distance: distance }
  } = step

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  var { request, robotId, socket } = connection

  // Example: Move 1000 mm in 90 degree direction
  // 7F7F7F 0A 1244 00190000 0058CC00 0100 000003E8 44 ?
  var backupData = rotation
  backupData += '000000'

  var destination = Number(distance).toString(16)
  destination = destination.padStart(8, '0')

  // var sendMessage = WellwitAGVConnector.getArriveCommand(PACKET_TYPE.MOVE, '1244', packetId, backupData, destination)
  var sendMessage = WellwitAGVConnector.getBaseExtCommand(
    PACKET_TYPE.MOVE,
    robotId,
    packetId,
    '00' + backupData,
    destination
  )
  await request(sendMessage, { logger }, socket)

  return {}
}

WellwitAgvMove.parameterSpec = [
  {
    type: 'string',
    name: 'packetId',
    placeholder: 'hex(4byte): 00000001',
    label: 'packet_id'
  },
  {
    type: 'select',
    name: 'rotation',
    label: 'rotation',
    property: {
      options: [
        { display: ' ', value: '00' },
        { display: '0°', value: '00' },
        { display: '90°', value: '01' },
        { display: '180°', value: '02' },
        { display: '270°', value: '03' },
        { display: '360°', value: '04' }
      ]
    }
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-move', WellwitAgvMove)
