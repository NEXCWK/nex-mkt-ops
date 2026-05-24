import { google } from 'googleapis'

function getDriveClient() {
  const serviceAccountJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccountJson,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

export async function getOrCreateFolder(
  name: string,
  parentId: string
): Promise<string> {
  const drive = getDriveClient()

  const { data } = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  })

  if (data.files && data.files.length > 0) {
    return data.files[0].id!
  }

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  })
  return folder.data.id!
}

export async function uploadDocumentToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  clientName: string,
  subfolder: 'Contratos' | 'Propostas' | 'Bastões' | 'Emails EV'
): Promise<{ driveUrl: string; fileId: string }> {
  const drive = getDriveClient()
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!

  const nexOpsFolder = await getOrCreateFolder('Nex Ops', rootFolderId)
  const clientesFolder = await getOrCreateFolder('Clientes', nexOpsFolder)
  const clientFolder = await getOrCreateFolder(clientName, clientesFolder)
  const subfolderR = await getOrCreateFolder(subfolder, clientFolder)

  const { Readable } = await import('stream')
  const stream = Readable.from(buffer)

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [subfolderR],
    },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink',
  })

  return {
    fileId: file.data.id!,
    driveUrl: file.data.webViewLink ?? `https://drive.google.com/file/d/${file.data.id}/view`,
  }
}
