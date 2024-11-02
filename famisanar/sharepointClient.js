const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');
const { obtenerCredenciales } = require('./credenciales');

// Configuración de las credenciales de Azure
let tenantId = ""; // ID del inquilino (tenant)
let clientId = ""; // ID de la aplicación
let clientSecret = ""; // Secreto de cliente
let siteUrl = ""; // URL del sitio de SharePoint
let SHARE_SITE = "";
let SHARE_LIST_VALIDACION_GUID = "";
let credential = null;
let graphClient = null;


async function iniciar(){
// Inicializar las credenciales
    const datos = await obtenerCredenciales(1, "1"); 
    siteUrl = datos.find(dato => dato.etiqueta === 'SHARE_SITE_URL').valor_descifrado;
    tenantId = datos.find(dato => dato.etiqueta === 'SHARE_TENANT_ID').valor_descifrado;
    clientId = datos.find(dato => dato.etiqueta === 'SHARE_CLIENT_ID').valor_descifrado;
    clientSecret = datos.find(dato => dato.etiqueta === 'SHARE_CLIENT_SECRET').valor_descifrado;
    SHARE_SITE = datos.find(dato => dato.etiqueta === 'SHARE_SITE').valor_descifrado;
    //SHARE_LIST_VALIDACION_GUID = datos.find(dato => dato.etiqueta === 'SHARE_LIST_VALIDACION_GUID').valor_descifrado;
    console.log(SHARE_SITE)
    console.log(siteUrl)
    credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

    // Crear el cliente de Microsoft Graph
    graphClient = Client.initWithMiddleware({
        authProvider: {
            getAccessToken: async () => {
                const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
                return tokenResponse.token;
            },
        },
    });

     if (!graphClient) {
        throw new Error("graphClient no se ha inicializado correctamente.");
    }
}



// Función para obtener el Site ID
async function getSiteId() {
    await iniciar();
    try {
        const response = await graphClient.api(SHARE_SITE).get();
        console.log("Site ID obtenido:", response.id);
        return response.id;
    } catch (error) {
        console.error("Error al obtener el Site ID:", error);
        throw error;
    }
}

// Función para obtener el Drive ID
async function getDriveId(siteId) {
    try {
        const response = await graphClient.api(`/sites/${siteId}/drives`).get();
        const drive_carpeta = response.value.find(item => item.name === 'Archivos');
        if (drive_carpeta) {
            console.log("el id es")
            console.log(drive_carpeta);
            console.log(drive_carpeta.id);
            return drive_carpeta.id;
        }else{
            console.log("el id es")
            console.log(response.value[0]);
            return response.value[0].id;
        }        
    } catch (error) {
        console.error("Error al obtener el Drive ID:", error);
        throw error;
    }
}

// Función para manejar la subida por fragmentos en bloques
async function uploadFileInChunks(uploadUrl, localFilePath, fileSize) {
    const CHUNK_SIZE = 5 * 1024 * 1024; // Tamaño del fragmento (5 MB)
    const fileStream = fs.createReadStream(localFilePath, { highWaterMark: CHUNK_SIZE });
    let start = 0;
    let counter = 0;

    for await (const chunk of fileStream) {
        const end = Math.min(start + chunk.length, fileSize) - 1;
        const contentRange = `bytes ${start}-${end}/${fileSize}`;

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Length': chunk.length,
                'Content-Range': contentRange
            },
            body: chunk
        });

        if (!response.ok) {
            throw new Error(`Error al subir fragmento: ${response.statusText}`);
        }

        start = end + 1;
        counter++;
        console.log(`Fragmento ${counter} subido: ${contentRange}`);
    }

    console.log('Subida por fragmentos completada');
}

/**
 * Asegura que una ruta de carpeta exista en SharePoint, creando las carpetas necesarias si no existen.
 * @param {Client} graphClient - Instancia del cliente de Microsoft Graph.
 * @param {string} driveId - ID del drive de SharePoint.
 * @param {string} folderPath - Ruta relativa de la carpeta (ej. 'Agendamiento/Subcarpeta').
 */
// Función sleep para agregar un retraso entre las operaciones
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureFolderPathExists(graphClient, driveId, folderPath) {
    // Dividir la ruta de la carpeta en una matriz de nombres de carpetas y filtrar cadenas vacías
    const folders = folderPath.split('/').filter(folder => folder.trim() !== '');
    console.log(`Folders to verify/create: ${folders.join(', ')}`);

    let currentPath = '';
    for (const folder of folders) {
        const parentPath = currentPath; // Ruta del padre
        currentPath = currentPath ? `${currentPath}/${folder}` : folder;
        console.log(`Verificando la carpeta: ${currentPath}`);
        while(true)
        {            
            try {
                // Intentar obtener la carpeta
                await graphClient
                    .api(`/drives/${driveId}/root:/${currentPath}`)
                    .get();
                console.log(`Carpeta existe: ${currentPath}`);
                break;
            } catch (error) {
                if (error.statusCode === 404) {
                    // Si la carpeta no existe, crearla en el padre
                    console.log(`Carpeta no encontrada, creando: ${currentPath}`);
                    try {
                        await graphClient
                            .api(`/drives/${driveId}/root:/${parentPath}:/children`)
                            .post({
                                name: folder,
                                folder: {},
                                "@microsoft.graph.conflictBehavior": "fail" // Evita reemplazos inesperados
                            });
                        console.log(`Carpeta creada: ${currentPath}`);
                        // Esperar un poco para asegurar la sincronización antes de proceder
                        await sleep(500); // Retraso de 500 ms
                        break;
                    } catch (createError) {
                        console.error(`Error al crear la carpeta ${currentPath}: `, createError);
                        throw createError;
                    }
                } else {
                    // Manejar otros tipos de errores
                    console.error(`Error al verificar la carpeta ${currentPath}: `, error);
                    throw error;
                    await sleep(500);
                }
            }
        }
    }
}


async function addItemToList(item, siteId, listId) {
    //await iniciar(); // Asegúrate de que las credenciales estén inicializadas
    while(true)
    {        
        try {
            console.log(`/sites/${siteId}/lists/${listId}/items`)
            const response = await graphClient.api(`/sites/${siteId}/lists/${listId}/items`).post({
                fields: item,
            });
            console.log('Elemento agregado:', response);
            break;
        } catch (error) {
            if (error.response) {
                console.error('Detalle del error:', JSON.stringify(error.response));
            }
            console.error('Error al agregar el elemento:', error);
            await sleep(500);
        }
    }
}




// Función para crear la sesión de subida y manejar archivos grandes
async function uploadFileToSharePoint(driveId, folderPath, localFilePath) {
    while(true)
    {        
        try {
            console.log("folderPath |"+folderPath+"|");
            console.log("localFilePath |"+localFilePath+"|");
            console.log("driveId")
            console.log(driveId)
            const fileName = path.basename(localFilePath);
            const fileSize = fs.statSync(localFilePath).size;

            await ensureFolderPathExists(graphClient, driveId, folderPath);

            // Crear una sesión de subida para archivos grandes
            const uploadSession = await graphClient
                .api(`/drives/${driveId}/root:/${folderPath}/${fileName}:/createUploadSession`)
                .post({
                    item: {
                        "@microsoft.graph.conflictBehavior": "replace", // Reemplazar si ya existe
                    }
                });

            console.log("Sesión de subida creada. Subiendo en fragmentos...");

            // Subir el archivo en fragmentos
            await uploadFileInChunks(uploadSession.uploadUrl, localFilePath, fileSize);
            console.log(`Archivo grande subido exitosamente: ${folderPath}/${fileName}`);
            break;            
        } catch (error) {
            console.error(`Error al subir el archivo: ${error.message}`);
            await sleep(1000);
        }
    }
}

// Exportar las funciones
module.exports = {
    getSiteId,
    getDriveId,
    uploadFileToSharePoint,
    addItemToList
};
