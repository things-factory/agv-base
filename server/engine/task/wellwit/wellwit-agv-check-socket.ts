import { Connections, TaskRegistry } from '@things-factory/integration-base'

async function WellwitAgvCheckSocket(step, context) {
  var { logger } = context
  var { connection: connectionName } = step

  var connection = Connections.getConnection(connectionName)
  if (!connection) {
    throw new Error(`connection '${connectionName}' is not established.`)
  }

  var { socket } = connection

  if (socket) {
    return { data: 1 }
  } else {
    return { data: 0 }
  }
}

TaskRegistry.registerTaskHandler('wellwit-agv-check-socket', WellwitAgvCheckSocket)
