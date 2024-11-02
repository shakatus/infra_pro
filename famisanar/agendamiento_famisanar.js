const puppeteer = require('puppeteer');
const getID = require('./iplocal');
const pool = require('./dbConnection');
const fs = require('fs');
const fse = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');
const { obtenerCredenciales } = require('./credenciales');
const { getSiteId, getDriveId, uploadFileToSharePoint, addItemToList } = require('./sharepointClient');
const config = require('/home/devbots/supervisor/.env/config');
const redVPC = "10.20.30.0";
const eps_id = "5";
const bot_id = "5";
const eps = "Famisanar"
let id_bot = isNaN(parseInt(process.argv[2])) ? 1 : parseInt(process.argv[2]);
let identificador = "";

let browser = null;
let page = null;
let driveId = null;

let Usuario ="";
let Contraseña ="";  
let siteId = null;
let listId = "";

const URL_LOGIN = "https://enlinea.famisanar.com.co/Portal/home.jspx";
const ELEMENTO_LOGIN = "#loginForm\\:id";
const LINK_SERVICIOS_EN_LINEA = "#j_id99";
const LINK_IPS = "#j_id76 > table > tbody > tr:nth-child(2) > td > a";
const BOTON_CAMBIO_SUCURSAL = "#j_id114\\:acceptButton"
const SELECT_IPS = "#j_id114\\:ips";
const SELECT_SUCURSAL ="#j_id114\\:sucIps";

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
	await inicarNavegador();
	while(true)
	//if(1==1)
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
			datos.screenshot = `${filePath}/${fileName}`; 
			datos.filePath= filePath;
			await crearCarpeta(filePath);
			await iniciarSession();
			await buscarUsuario(datos);
		}
		await delay(500);
	}
}

async function credenciales()
{
    const datos = await obtenerCredenciales(1, eps_id); 
    Usuario = datos.find(dato => dato.etiqueta === 'usuario').valor_descifrado;
    Contraseña = datos.find(dato => dato.etiqueta === 'contraseña').valor_descifrado;
    listId = datos.find(dato => dato.etiqueta === 'SHARE_LIST_VALIDACION_GUID').valor_descifrado;
}

async function inicarNavegador()
{
	try
	{
		browser = await puppeteer.launch({
		    headless: false, // Show the Chrome browser window
		    executablePath: '/usr/bin/google-chrome',
            userDataDir: tmpProfilePathChrome, 
            //executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		    args: [
		        '--window-size=1280,800', // Set Chrome window size to 400x300
		        '--no-sandbox'//, // Disable sandbox for compatibility (use with caution)
		        //'--display=:0' // Show Chrome on the default X11 display (if using VNC)
		    ],
		    handleSIGINT: false // Prevent termination on Ctrl+C (if desired)
		});

		page = await browser.newPage(); 
        await page.setViewport({ width: 1280, height: 800 });

		/*
		page.on('dialog', async dialog => {
			console.log('Diálogo detectado:', dialog.message());
			await dialog.accept(); // Aceptar automáticamente el diálogo
		});

		browser.on('targetcreated', async (target) => {
		    const newPage = await target.page();

		    // Si hay una nueva pestaña (popup), ciérrala
		    if (newPage) {
		      console.log('Popup detectado. Cerrando...');
		      await newPage.close();
		    }
		  });
		*/
		await page.goto("https://www.google.com.co/", { waitUntil: "networkidle0" });
		await page.goto(URL_LOGIN, { waitUntil: 'load', timeout: 70000 });
		await page.waitForSelector(ELEMENTO_LOGIN);
	} catch (err) {
		console.error('Error launching Puppeteer browser:', err);
	}
}

async function delay(tiempo) {
  return new Promise(resolve => setTimeout(resolve, tiempo));
}

async function obtenerDatos()
{
	while(true)
	{
		let cita =await pedirAtencion();
		if(cita){
      console.log(cita);
			return cita;
		}else{
      console.log("sin datos")
    }
		await delay(1000);
	}
}

async function pedirAtencion() {
    let client;

    try {
        // Obtener una conexión del pool
        client = await pool.connect();

        // Iniciar la transacción
        await client.query('BEGIN');

        // Seleccionar y bloquear la fila con FOR UPDATE
        const sqlSelect = `
            SELECT c.*, a.fecha_agendamiento, 
              (select descripcion_famisanar from datos_profamilia where codigo_identificacion=c.p_tipo_documento) descripcion_nueva_eps
              ,(select descripcion from datos_profamilia WHERE codigo_identificacion=c.p_tipo_documento limit 1) p_texto_tipo_documento
            FROM agendamientos_citas c
            JOIN agendamientos a on a.id = c.agendamiento_id
            WHERE c.p_numero_documento != '-100' 
            AND c.eps_id = $1 
            AND c.ebot_id in (0,$2) 
            AND c.estado = 0
            ORDER BY updated_at
            LIMIT 1
            FOR UPDATE;
        `;
        const selectResult = await client.query(sqlSelect, [eps_id,identificador]);

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

async function crearCarpeta(filePath)
{
	console.log(filePath)
	try {
	  fs.mkdirSync(filePath, { recursive: true });
	} catch (err) {
	  console.error('Error al crear la carpeta:', err);
	}
}

async function iniciarSession() {
    const url = page.url();
    console.log(url);
    if(!url.includes("home.jspx"))
    {
        return;
    }
    while(true)
    {
        await page.$eval('#loginForm\\:id', (input, value) => input.value = value, Usuario);
        // Verificar que el valor del input sea "10"
        const inputValue = await page.$eval('#loginForm\\:id', input => input.value);
        if (inputValue === Usuario) {          
            break;
        } 
    }

    while(true)
    {
        await page.$eval('#loginForm\\:clave', (input, value) => input.value = value, Contraseña);
        // Verificar que el valor del input sea "10"
        const inputValue = await page.$eval('#loginForm\\:clave', input => input.value);
        if (inputValue === Contraseña) {          
            break;
        } 
    }
    await page.click('#loginForm\\:loginButton')
    
    await delay(500);

    await navegacion();
    
    //#j_id99
    //#j_id76 > table > tbody > tr:nth-child(2) > td > a
    //#j_id114\:ips
    //#j_id79 > table > tbody > tr:nth-child(1) > td > div
    //#option101 > table > tbody > tr:nth-child(1) > td:nth-child(2) > p > a
}

async function navegacion() {
    console.log("navegacion");
    await page.waitForSelector(LINK_SERVICIOS_EN_LINEA);
    console.log("tier 1")
    while(true){
      await page.click(LINK_SERVICIOS_EN_LINEA);
      try{
        await page.waitForSelector(LINK_IPS);
        break;
      }catch(err){
        console.log(err)
      }
      await delay(500);
    }
    await delay(500);
    console.log("tier 2")
    while(true)
    {
      await page.click(LINK_IPS);
      try{
        await page.waitForSelector(SELECT_IPS);
        break;
      }catch(err){
        console.log(err)
      }
      await delay(500);
    }
  
    console.log("llegamos")
    await seleccionarSede();    
}

async function seleccionarSede() {
    
    while(true){
        await page.select(SELECT_IPS, '4;860013779;2264');//acaError
        const selectValue = await page.$eval(SELECT_IPS, select => select.value);
        if (selectValue === '4;860013779;2264') {          
            break;
        } 
    }
  
    while(true){
        await page.select(SELECT_SUCURSAL, "4;860013779;7940;8600137791;39");
        const selectValue = await page.$eval(SELECT_SUCURSAL, select => select.value);
        if (selectValue === "4;860013779;7940;8600137791;39") {          
            break;
        } 
    }
    console.log("click en cambio de sucursal");
    await page.click(BOTON_CAMBIO_SUCURSAL);
    try{
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
    }catch(err){};


    await page.waitForSelector("#j_id79 > table > tbody > tr:nth-child(1) > td > div");
    while(true){    
      await page.click("#j_id79 > table > tbody > tr:nth-child(1) > td > div");
      const displayStatus = await page.$eval('#option101', element => {
          const style = window.getComputedStyle(element);
          return style.display; // Esto devolverá el valor de display, por ejemplo "none" o "block"
      });
      console.log(displayStatus);
      if(displayStatus == "block"){
        break;
      }
    }
    await page.click("#option101 > table > tbody > tr:nth-child(1) > td:nth-child(2) > p > a");
    
    
}

async function cargar_prueba(datos, element){
  console.log("subir screenshot");
  await page.screenshot({ path: String(datos.screenshot) });
  await uploadFileToSharePoint(driveId, datos.rutaSharePoint, datos.screenshot);
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
  console.log("----------------------------------------------");
  console.log(datos.fecha_consulta);
  console.log(convertirFechaDDMMYYYYaISO(datos.fecha_consulta));
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

async function buscarUsuario(datos) {

    try{
      console.log("esperamos ...");
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
    }catch(err){
        console.log(err);
    };

    // Espera a que el iframe esté disponible
    console.log("buscamos el usuario");
    await page.waitForSelector('#ifAuto');
    const elementHandle = await page.$('#ifAuto');
  
    // Accede al contenido del iframe
    const iframeContent = await elementHandle.contentFrame();

    // Espera que el select esté disponible dentro del iframe
    await iframeContent.waitForSelector('#ConsultarEstadoAfiliacionFORM\\:tipoIdCmb', { timeout: 60000});
    await iframeContent.waitForSelector('#ConsultarEstadoAfiliacionFORM\\:cmdautorizar', { timeout: 60000});
    console.log("Seleccionar tipo de documento");
    console.log(datos.descripcion_nueva_eps)
    await iframeContent.select('#ConsultarEstadoAfiliacionFORM\\:tipoIdCmb', String(datos.descripcion_nueva_eps));
  
    
    while(true)
    {
        await iframeContent.$eval('#ConsultarEstadoAfiliacionFORM\\:idTxt', (input, value) => input.value = value, String(datos.p_numero_documento));
        // Verificar que el valor del input sea "10"
        const    inputValue = await iframeContent.$eval('#ConsultarEstadoAfiliacionFORM\\:idTxt', input => input.value);
        if (inputValue === String(datos.p_numero_documento)) {          
            break;
        } 
    }
    await iframeContent.click('#ConsultarEstadoAfiliacionFORM\\:cmdautorizar');

    try{
      await iframeContent.waitForSelector("#glbmsg > li > span");
      const contenido = await iframeContent.$eval('#glbmsg > li > span', (element) => element.textContent);
      console.log("contenido");
      console.log(contenido);
      if (contenido.toLowerCase().includes("afiliado no existe".toLowerCase())) {
        console.log("entra")
        //const screenshotElement = await iframeContent.$('#contenido');
        //await screenshotElement.evaluate(el => el.scrollIntoView());
        await cargar_prueba(datos, page);
        await finalizar(datos.id, contenido, 3, datos);
        await page.reload();
        return;
      }else{
        console.log("no entra")
      }
    }catch(err)
    {
      console.log(err);
    }


  
    //await delay(1000);

    await iframeContent.waitForSelector("#_id32\\:estadoTxt")
    const value = await iframeContent.$eval("#_id32\\:estadoTxt", el => el.value);
    console.log(value);
    //const screenshotElement = await iframeContent.$('#contenido');
    //await screenshotElement.evaluate(el => el.scrollIntoView());
    await cargar_prueba(datos, page);
    if(value.includes("ACTIVO"))
    {
      await finalizar(datos.id, value, 1, datos)
    }else{
      await finalizar(datos.id, value, 2, datos)
    } 
    await page.reload();

    //#appForm > table
    //#appForm\:j_id79 > table
    /*
    #_id32\:estadoTxt
    const estadoAfiliacion = await iframeContent.evaluate(() => {
      // Seleccionar todas las filas del tbody
      const rows = document.querySelectorAll('#appForm\\:j_id79 > table > tbody > tr');
      
      // Recorrer las filas
      for (let row of rows) {
        const label = row.querySelector('td:first-child label'); // Obtener el label del primer td
        
        // Verificar que el label exista antes de acceder a innerText
        if (label && label.innerText) {
          console.log(label.innerText);
          if (label.innerText.includes('Estado Afiliación Usuario:')) {
            // Si se encuentra el label con el texto, obtener el valor del input del segundo td
            const input = row.querySelector('td:nth-child(2) input');
            return input ? input.value : null;
          }
        }
      }
      return null; // Devolver null si no se encuentra el título
    });
    
  
    console.log('Estado Afiliación Usuario:', estadoAfiliacion);
    await iframeContent.$eval("#appForm\\:j_id175", element => element.click());

    */
    
  }


  async function waitForAnySelector(page, selectors) {
    const waitForSelectors = selectors.map(selector => 
      page.waitForSelector(selector, { timeout: 10000 }).then(() => selector).catch(() => null)
    );
    
    const result = await Promise.race(waitForSelectors);
    return result;
  }
main();