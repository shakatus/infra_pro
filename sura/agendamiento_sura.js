const puppeteer = require('puppeteer');
const getID = require('./iplocal');
const pool = require('./db');
const fs = require('fs');
const fse = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');
const { obtenerCredenciales } = require('./credenciales');
const { getSiteId, getDriveId, uploadFileToSharePoint, addItemToList } = require('./sharepointClient');
const URL_LOGIN = "https://login.sura.com/sso/servicelogin.aspx?continueTo=https%3A%2F%2Fsaludweb-proc.suramericana.com%2Fsaludweb-mas%2F&service=salud";
const ELEMENTO_LOGIN = "#session-enterprise";
const config = require('/home/devbots/supervisor/.env/config');

const redVPC = "10.20.30.0";
const eps_id = "1";
const bot_id = "7"
const eps = "SURA"
let id_bot = isNaN(parseInt(process.argv[2])) ? 1 : parseInt(process.argv[2]);
let identificador = "";
let USER ="";
let PASSWORD =""
let driveId = null;
let isDialogHandlerEnabled = true;
let browser = null;
let page = null;
let siteId = null;
let listId = "";

/////////////////////////////////////////////////////////////////////limpiar/////////////////////////////////////////////////////////////////////////////////
let tmpProfilePath="";
let tmpProfilePathChrome="";
const cleanUp = () => {
  
  try{
    browser.close();    
  }catch(err){
    console.log(err);
  }   
  console.log(`Intentando eliminar el perfil temporal: ${tmpProfilePath}`);
  exec(`rm -rf ${tmpProfilePath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al eliminar el perfil temporal: ${stderr}`);
    } else {
      console.log(`Perfil temporal eliminado: ${tmpProfilePath}`);
    }
  });
  
};
// Registrar manejadores para diferentes señales del sistema
process.on('SIGINT', async () => {
  console.log("sigint");
  await cleanUp();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  console.log("sigterm");
  await cleanUp();
  process.exit(0);
});
process.on('exit', async () => {
  console.log("exit");
  await cleanUp();
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function main()
{
  identificador = await getID(redVPC,bot_id,id_bot);
  console.log(identificador);
  tmpProfilePath = `/tmp/${id_bot}`;
  tmpProfilePathChrome = `/tmp/${id_bot}/chrome-profile-${process.pid}`;
  await credenciales();
  siteId = await getSiteId();
  driveId = await getDriveId(siteId);
  await iniciarNavegador();
  while(true)
  {   
    let datos = await obtenerDatos();
    if(datos)
    {
      const [dia, mes, año] = String(datos.fecha_agendamiento).split('/');
      const fechaFormateada = `${año}/${mes}/${dia}`;
      const filePath = `/home/devbots/Downloads/Validacion Derechos/${fechaFormateada}/${datos.p_sede}`;
      const fileName = `${datos.p_tipo_documento}_${String(datos.p_numero_documento)}.png`;
      datos.fileName = fileName
      datos.rutaSharePoint = `Validacion Derechos/${fechaFormateada}/${datos.p_sede}`
      datos.screenshot = `${filePath}/${fileName}`
      datos.filePath= filePath;
      await crearCarpeta(filePath);
      await iniciarSession();
      await buscarUsuario(datos);
    }
    await delay(500);
  }
}

async function crearCarpeta(filePath)
{
  console.log(filePath)
  try {
    fs.mkdirSync(filePath, { recursive: true });
  } catch (err) {
    console.error('Error al crear la carpeta:', err);
  }
}

async function buscarUsuario(datos)
{

  await page.waitForSelector("body > form > table:nth-child(9) > tbody > tr:nth-child(1) > td:nth-child(2) > select");

  await page.evaluate((text) => {
    const selectElement = document.querySelector("body > form > table:nth-child(9) > tbody > tr:nth-child(1) > td:nth-child(2) > select"); // Cambia el selector según tu caso
    const options = Array.from(selectElement.options); // Obtener todas las opciones
    const optionToSelect = options.find(option => option.text === text); // Encontrar la opción por el texto
    if (optionToSelect) {
      selectElement.value = optionToSelect.value; // Establecer el valor de la opción seleccionada
      selectElement.dispatchEvent(new Event('change')); // Desencadenar el evento de cambio
    }
  }, datos.p_tipo_documento);

  console.log(datos.p_numero_documento);
  
  try{
    console.log("deshabilitamos dialog");
    isDialogHandlerEnabled = false;
    const dialogPromise = new Promise((resolve, reject) => {
        page.once('dialog', async (dialog) => {
            try {
                const dialogMessage = dialog.message();
                console.log('Diálogo detectado por promesa específica:', dialogMessage);
                await dialog.dismiss(); // Puedes usar dialog.accept() si es necesario
                resolve(dialogMessage);
            } catch (err) {
                reject(new Error(`Error handling dialog: ${err.message}`));
            }
        });

        // Rechazar la promesa si el diálogo no aparece en el tiempo límite
        setTimeout(() => reject(new Error('Timeout: No dialog appeared')), 5000);
    });
    //String(datos.p_numero_documento)
    await page.type('body > form > table:nth-child(9) > tbody > tr:nth-child(1) > td:nth-child(4) > input[type=text]', String(datos.p_numero_documento));
    await page.click("body > form > table:nth-child(9) > tbody > tr:nth-child(1) > td:nth-child(4) > a");
    const result = await dialogPromise;
    console.log(`Dialog message: ${result}`);
    if(result.includes("ERROR: AFILIADO NO TIENE CONTRATO CON EPS Y MEDICINA PREPAGADA SURAMERICANA S.A"))
    {
      await cargar_prueba(datos);
      await finalizar(datos.id, "AFILIADO NO TIENE CONTRATO CON EPS", 3, datos);
    }
  } catch (error) {
      console.error(error.message);
  } finally {
      console.log("habilitamos dialog");
      isDialogHandlerEnabled = true;
  }

  await page.waitForSelector('body > form > table:nth-child(9) > tbody');

  // Evaluar el DOM y recorrer los <tr> para encontrar el título "Estado de Suspensión"
  const resultado = await page.evaluate(() => {
    const filas = document.querySelectorAll('body > form > table:nth-child(9) > tbody > tr');
    for (const fila of filas) {
      const titulo = fila.querySelector('td:nth-child(1)').textContent.trim();
      const valor = fila.querySelector('td:nth-child(2)').textContent.trim();

      if (titulo === 'Estado de Suspensión') {
        return { titulo, valor };
      }
    }
    return null; // Si no se encuentra el título
  });

  // Imprimir el resultado
  if (resultado) {
    console.log('Título:', resultado.titulo);
    console.log('Valor:', resultado.valor);
    const estado_paciente = resultado.valor.includes("0 - TIENE DERECHO A COBERTURA INTEGRAL") ? 1 : 2;
    await cargar_prueba(datos);
    await finalizar(datos.id, resultado.valor, estado_paciente, datos);
  } else {
    console.log('No se encontró "Estado de Suspensión".');
  }
  page.goto("https://saludweb-proc.suramericana.com/saludweb-mas/aut/accion-consultarDerechos.do");
}

function convertirFechaDDMMYYYYaISO(fechaOriginal) {
    // Dividir la fecha en día, mes y año
    var partesFecha = fechaOriginal.split("/"); // ["04", "10", "2024"]
    
    // Crear una nueva instancia de fecha (restando 1 al mes porque JavaScript usa meses indexados desde 0)
    var fechaISO = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);

    // Obtener día, mes y año de la fecha
    var dia = String(fechaISO.getDate()).padStart(2, '0');
    var mes = String(fechaISO.getMonth() + 1).padStart(2, '0'); // Los meses en JavaScript son indexados desde 0
    var anio = fechaISO.getFullYear();

    // Devolver la fecha en el formato "DD/MM/YYYY"
    return String(`${anio}-${mes}-${dia}`);
}

async function agregar_item_lista(resultado, estado, datos){
  //console.log("https://profamiliaorg.sharepoint.com/:i:/r/sites/NacionalCuentasMedicas/Archivos/"+datos.rutaSharePoint+"/"+datos.fileName)
  const itemFields = {
    "Title":"",
    "Documento": String(datos.p_numero_documento),
    "Estado": estado,
    "Resultado": resultado,
    "Sede": datos.p_sede,
    "Fecha": convertirFechaDDMMYYYYaISO(datos.fecha_consulta),
    "TipoDocumento1": datos.p_texto_tipo_documento,
    "Imagen": "https://profamiliaorg.sharepoint.com/:i:/r/sites/NacionalCuentasMedicas/Archivos/"+datos.rutaSharePoint+"/"+datos.fileName
  };
  console.log(itemFields);
  try {

    await addItemToList(itemFields, siteId, listId); // Llama a la función para agregar el elemento
    console.log("Elemento agregado a la lista con éxito.");
  } catch (error) {
    console.error("Error al agregar el elemento a la lista:", error);
  }
}

async function finalizar(id, resultado, estado, datos) {
  await agregar_item_lista(resultado, estado, datos)
  try {
    // La consulta con placeholders de PostgreSQL ($1, $2, $3)
    const sql = `
            UPDATE agendamientos_citas 
            SET estado = $1, 
                    respuesta_estado = $2, 
                    fecha_fin_ejecucion = CURRENT_TIMESTAMP 
            WHERE id = $3`;
    
    console.log('Consulta SQL:', sql);
    console.log('Valores:', [estado, resultado, id]);

    // Ejecutar la consulta usando el pool (no es necesario obtener y liberar la conexión)
    const result = await pool.query(sql, [estado, resultado, id]);

    console.log(result);
    return result;
    
  } catch (error) {
    console.error('Error al actualizar el estado:', error);
    throw error; // Re-lanza el error para que pueda ser manejado por el llamador
  }
} 

async function cargar_prueba(datos){
    await page.screenshot({ path: String(datos.screenshot), fullPage: true });
    await uploadFileToSharePoint(driveId, datos.rutaSharePoint, datos.screenshot);
}

async function credenciales()
{
  const datos = await obtenerCredenciales(1, eps_id); 
  USER = datos.find(dato => dato.etiqueta === 'usuario').valor_descifrado;
  PASSWORD = datos.find(dato => dato.etiqueta === 'password').valor_descifrado;
  listId = datos.find(dato => dato.etiqueta === 'SHARE_LIST_VALIDACION_GUID').valor_descifrado;
}

async function iniciarNavegador()
{
  try
  {
    browser = await puppeteer.launch({
      headless: false, // Show the Chrome browser window
      executablePath: '/usr/bin/google-chrome', // Optional: Specify Chrome path
      userDataDir: tmpProfilePathChrome,  
      args: [
        '--window-size=400,300', // Set Chrome window size to 400x300
        '--no-sandbox'//, // Disable sandbox for compatibility (use with caution)
        //'--display=:0' // Show Chrome on the default X11 display (if using VNC)
      ],
      handleSIGINT: false // Prevent termination on Ctrl+C (if desired)
    });
    page = await browser.newPage(); 
    const dialogHandler = async (dialog) => {
        if (isDialogHandlerEnabled) {
            console.log('Diálogo detectado por manejador global:', dialog.message());
            try {
                await dialog.accept(); // Aceptar automáticamente el diálogo
            } catch (err) {
                console.error('Error aceptando el diálogo:', err.message);
            }
        } else {
            console.log('Diálogo detectado, pero el manejador global está deshabilitado.');
        }
    };
    page.on('dialog', dialogHandler);
    browser.on('targetcreated', async (target) => {
      const newPage = await target.page();

      // Si hay una nueva pestaña (popup), ciérrala
      if (newPage) {
        console.log('Popup detectado. Cerrando...');
        await newPage.close();
      }
    });

    await page.goto(URL_LOGIN, { waitUntil: 'load', timeout: 50000 });
  } catch (err) {
    console.error('Error launching Puppeteer browser:', err);
  }
}

async function delay(tiempo) {
  return new Promise(resolve => setTimeout(resolve, tiempo));
}

async function obtenerDatos()
{
  console.log("obtenerDatos")
  while(true)
  {
    let cita =await pedirAtencion();
    if(cita){
      return cita;
    }
    await delay(1000);
  }
}

async function iniciarSession(){
  const url = await page.url();
  if(!url.includes("https://login.sura.com/"))
  {
    return;
  }
  await page.waitForSelector(ELEMENTO_LOGIN);
  console.log("colocamos el user");
  while(true)
  {
    await overwriteField(page,'#suranetName',USER);
    const suraname = await page.$eval('#suranetName', element => element.value);
    if(suraname == USER)
    {
      break;
    }
  }
  console.log("digitar PASSWORD");
  while(true)
  {
    await overwriteField(page,'#suranetPassword',PASSWORD);
    const surapassword = await page.$eval('#suranetPassword', element => element.value);
    if(surapassword == PASSWORD)
    {
      break;
    }
  }
  await page.click('#session-enterprise'); 
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  const url_check_login = await page.url();    
  if(url_check_login.includes("mfa/process"))
  {
    await colocar2FA();
  }

  page.goto("https://saludweb-proc.suramericana.com/saludweb-mas/aut/accion-consultarDerechos.do");
}

//https://saludweb-proc.suramericana.com/saludweb-mas/aut/accion-consultarDerechos.do?firstload=true

async function pedirAtencion() {

    let client;

    try {
        // Obtener una conexión del pool
        client = await pool.connect();

        // Iniciar la transacción
        await client.query('BEGIN');

        // Seleccionar y bloquear la fila con FOR UPDATE
        const sqlSelect = `
            SELECT c.*, a.fecha_agendamiento 
            ,(select descripcion from datos_profamilia WHERE codigo_identificacion=c.p_tipo_documento limit 1) p_texto_tipo_documento
            FROM agendamientos_citas c
            JOIN agendamientos a on a.id = c.agendamiento_id
            WHERE c.p_numero_documento != '-100' 
            AND c.eps_id = $1 
            AND c.ebot_id in (0, $2) 
            AND c.estado = 0
            ORDER BY updated_at
            LIMIT 1
            FOR UPDATE;
        `;
        console.log(sqlSelect);
        console.log(bot_id,identificador)
        const selectResult = await client.query(sqlSelect, [bot_id, identificador]);

        if (selectResult.rows.length === 0) {
            // Si no hay filas, simplemente hacemos COMMIT para finalizar la transacción
            await client.query('COMMIT');
            return null;
        }

        const idAtencion = selectResult.rows[0].id;

        // Actualizar la tarea seleccionada
        const sqlUpdate = `
            UPDATE agendamientos_citas
            SET ebot_id = CASE WHEN id = $2 THEN $1 ELSE 0 END, 
                fecha_inicio_ejecucion = CASE WHEN id = $2 THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP,
                linode_id = '${config.LINODE_ID}'
            WHERE (ebot_id = $1 OR id = $2)
            AND estado IN (0, 2);
        `;
        await client.query(sqlUpdate, [identificador, idAtencion]);

        // Confirmar la transacción (libera los bloqueos)
        await client.query('COMMIT');

        // Retornar el resultado de la selección
        return selectResult.rows[0];

    } catch (error) {
        console.error('Error:', error);
        try {
            // Hacer rollback en caso de error (libera los bloqueos)
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error al hacer rollback:', rollbackError);
        }
        throw error;

    } finally {
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                console.error('Error al liberar la conexión:', releaseError);
            }
        }
    }
}

////////////utilidades

async function obtenerCodigo2FA() {
  try {
      // Definir la consulta SQL con placeholders de PostgreSQL
      const query = `
          SELECT codigo2fa 
          FROM flujos 
          WHERE codigo_id = $1 
          AND fecha >= NOW() - INTERVAL '60 seconds'
          AND tiempo_restante >= 10
          LIMIT 1;
      `;
      console.log('Consulta SQL:', query);

      // Ejecutar la consulta
      const result = await pool.query(query, [2]);

      // Procesar el resultado
      return result.rows[0] ? result.rows[0].codigo2fa : null;

  } catch (error) {
      console.error('Error en obtenerCodigo2FA:', error);
      throw error; // Re-lanza el error para que pueda ser manejado por el llamador
  }
}


async function tieneAfter(selector)
{
  const tieneAfter = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      const style = window.getComputedStyle(element, '::after');
      return style.content !== 'none';
    } else {
      return false;
    }
  }, selector);

  return tieneAfter;
};


async function colocar2FA()
{
  let codigo2FA = null
  while(codigo2FA === null){
    codigo2FA = await obtenerCodigo2FA();
    await delay(100);
  }
  console.log(codigo2FA);
  while(true)
  {
    await overwriteField(page, '#loginForm > input[type=text]:nth-child(4)',codigo2FA);     
    const valueCodigo2FA = await page.$eval('#loginForm > input[type=text]:nth-child(4)', element => element.value);    
    if(valueCodigo2FA == codigo2FA)
    {
      break;
    }
  }
  try{
    while(true){
      await page.click('#loginForm > div.trustedDevice > label > span');
      const resultado = await tieneAfter('#loginForm > div.trustedDevice > label > span');
      console.log(resultado);
      if(resultado)
      {
        break;
      }
    }
    //while(true){};
    await page.click("#loginForm > div:nth-child(9) > input");
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('La página se ha cargado completamente después de hacer clic en el enlace.');
  }catch(err){
    console.log(err);
  }
  
}

async function overwriteField(page, selector, value) {
    // Limpiar el contenido existente en el campo
    await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.value = '';
            console.log("cambio");
        }else{
            console.log("error ");
        }
    }, selector);

    // Escribir el nuevo valor en el campo
    await page.type(selector, value);
}

main();