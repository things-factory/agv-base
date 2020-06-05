import { Connections, TaskRegistry } from '@things-factory/integration-base'
import { WellwitAGVConnector, PACKET_TYPE } from '../../connector/wellwit/wellwit-agv'

async function WellwitAgvCharge(step, { logger }) {
  var {
    connection: connectionName,
    params: { packetId: packetId, coordinate: coordinate, pathCount: pathCount, rotation: rotation, distance: distance }
  } = step

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  var { request, robotId, socket } = connection

  // Example: Charging at coordinate 20010, 90 degree, distance 110mm
  // 7f7f7f 03 1244 00000001 0894628c 00 0102(degree)0101(distance) 00004e24 30

  // The first and second bytes represent the distance of charging pile in mm.
  // The 3rd byte is used to transfer the number of moving path coordinate.
  // the 4th byte is used to indicate the orientation of the charging pile, 0x01:90, 0x02:180, 0x03:270, 0x04:360

  var backupData = Number(distance).toString(16).padStart(4, '0')
  backupData += Number(pathCount).toString(16).padStart(2, '0')
  backupData += rotation

  var destination = Number(coordinate).toString(16)
  destination = destination.padStart(8, '0')

  var sendMessage = WellwitAGVConnector.getBaseExtCommand(
    PACKET_TYPE.CHARGE,
    robotId,
    packetId,
    '00' + backupData,
    destination
  )
  await request(sendMessage, { logger }, socket)

  return {}
}

WellwitAgvCharge.parameterSpec = [
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
  },
  {
    type: 'number',
    name: 'distance',
    placeholder: 'uom(mm)',
    label: 'distance'
  }
]

TaskRegistry.registerTaskHandler('wellwit-agv-charge', WellwitAgvCharge)
