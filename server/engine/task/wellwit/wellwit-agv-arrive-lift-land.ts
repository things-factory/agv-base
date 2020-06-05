import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'

// unused
async function WellwitAgvArriveLiftLand(step, { logger }) {
  var {
    connection: connectionName,
    params: { packetId: packetId, coordinate: coordinate, pathCount: pathCount, liftOrLand: liftOrLand }
  } = step

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  var { request, robotId, socket } = connection

  // Example: Head to 2010? to lift up the target shelf
  // 7F7F7F 05 1244 00160000 00635d01 00000100 00035BCB 97
  // Example: Ship the shelf to 2010? and put it down
  // 7F7F7F 06 1244 00160000 00635d01 00000100 00035BCB 98

  var backupData = '0000' // FIXME?
  backupData += pathCount.padStart(2, '0')
  backupData += '00'

  var destination = Number(coordinate).toString(16)
  destination = destination.padStart(8, '0')

  var packetType = liftOrLand

  var sendMessage = WellwitAGVConnector.getBaseExtCommand(packetType, robotId, packetId, '00' + backupData, destination)
  await request(sendMessage, { logger }, socket)

  return {}
}

WellwitAgvArriveLiftLand.parameterSpec = [
  {
    type: 'string',
    name: 'packetId',
    placeholder: '00000001',
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
    type: 'select',
    name: 'liftOrLand',
    label: 'lift_or_land',
    property: {
      options: [
        { display: ' ', value: '00' },
        { display: 'LIFT', value: '05' },
        { display: 'LAND', value: '06' }
      ]
    }
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-arrive-lift-land', WellwitAgvArriveLiftLand)
