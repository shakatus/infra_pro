const puppeteer = require('puppeteer');
const getID = require('./iplocal');
const pool = require('./dbConnection');
const { exec } = require('child_process');
const { getSiteId, getDriveId, uploadFileToSharePoint, addItemToList } = require('./sharepointClient');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const { obtenerCredenciales } = require('./credenciales');
const { timeout } = require('puppeteer');
const config = require('/home/devbots/supervisor/.env/config');

const redVPC = "10.20.30.0";
const eps_id = "3";
const bot_id = "9";
const eps = "SaludTotal"
let id_bot = isNaN(parseInt(process.argv[2])) ? 1 : parseInt(process.argv[2]);
let identificador = "";

let browser = null;
let page = null;
let driveId = null;

const URL_LOGIN = "https://transaccional.saludtotal.com.co/OficinaVirtual";
let TAB_IPS = "#k-tabstrip-tab-1";
const ESTADO_ACTIVO_TAB = "k-state-active";
const INPUT_DOCUMENTO_IPS = "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(2) > input";
const INPUT_TIPODOCUMENTO_IPS = "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input";
const INPUT_TIPODOCUMENTO_USUARIO = "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(3) > kendo-combobox > span > kendo-searchbar > input";
const INPUT_DOCUMENTO_USUARIO = "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(4) > input";
const INPUT_PASSWORD = "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(5) > input";
const BUTTON_INGRESAR = "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div:nth-child(9) > div > div:nth-child(2) > button";
const SELECTOR_SUCURSAL_LOGIN = "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input"
const SELECTOR_SEDE_LOGIN = "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(2) > kendo-combobox > span > kendo-searchbar > input";
const SELECTOR_ACEPTAR_LOGIN = "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > div:nth-child(6) > div > button";


let TIPO_DOCUMENTO_IPS = "";
let DOCUMENTO_IPS = "";
let TIPO_DOCUMENTO_USUARIO = "";
let DOCUMENTO_USUARIO = "";
let PASSWORD = "";
let siteId = null;
let listId = "";

const URL_SALUDTOTAL = "https://saludtotal.com.co/opciones-oficina-virtual/";
const ELEMENTO_LOGIN = "body > app-root > div > div > app-login";

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
    DOCUMENTO_USUARIO = datos.find(dato => dato.etiqueta === 'DOCUMENTO_USUARIO').valor_descifrado;
    PASSWORD = datos.find(dato => dato.etiqueta === 'PASSWORD').valor_descifrado;
    TIPO_DOCUMENTO_IPS = datos.find(dato => dato.etiqueta === 'TIPO_DOCUMENTO_IPS').valor_descifrado;
    DOCUMENTO_IPS = datos.find(dato => dato.etiqueta === 'DOCUMENTO_IPS').valor_descifrado;
    TIPO_DOCUMENTO_USUARIO = datos.find(dato => dato.etiqueta === 'TIPO_DOCUMENTO_USUARIO').valor_descifrado;
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
                '--window-size=400,300', // Set Chrome window size to 400x300
                '--no-sandbox', // Disable sandbox for compatibility (use with caution)
                '--disable-setuid-sandbox'
                //'--display=:0' // Show Chrome on the default X11 display (if using VNC)
            ],
            handleSIGINT: false // Prevent termination on Ctrl+C (if desired)
        });

        page = await browser.newPage(); 
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
        
        await page.goto(URL_SALUDTOTAL, { waitUntil: "networkidle0" });
        const client = await page.target().createCDPSession();
        await page.goto(URL_LOGIN, { waitUntil: 'load', timeout: 70000 });
        await page.waitForSelector(ELEMENTO_LOGIN);
    } catch (err) {
        console.error('Error launching Puppeteer browser:', err);
    }
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
            SELECT c.*, a.fecha_agendamiento, (select descripcion_salud_total from datos_profamilia WHERE codigo_identificacion=c.p_tipo_documento) descripcion_documento
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
        const selectResult = await client.query(sqlSelect, [bot_id,identificador]);

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



async function iniciarSession() 
{
    console.log("login");
    const urlActual = await page.url();
    console.log(urlActual);    
    if (!urlActual.includes("OficinaVirtual")) {
        //await page.reload();
        return;
    }
    
    console.log("entramoas al login");
   
    while(true){
        try{
            await page.waitForSelector(ELEMENTO_LOGIN);
            break;
        }catch(err){
            console.log("elemento no aparece");
        }
    }

    try{
        const elemento = await page.$(ELEMENTO_LOGIN);
        if (elemento) {
            console.log('El selector existe en la página.');
        } else {
            console.log("elemento no exita");
            return
        }
    }catch(err){}


    await page.waitForSelector('li[role="tab"]');

    console.log("seleccionar IPS");
    let selector = null;
    while(true){
        selector = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('li[role="tab"]'));
          for (const element of elements) {
            if (element.innerText.includes('IPS')) {
              return '#' + element.id;
            }
          }
          return null; // Retorna null si no se encuentra el elemento
        });
        if(selector === null)
        {
          await delay(500);
        }else{
          break;
        }
    }

    console.log('Selector encontrado:', selector);
    TAB_IPS = selector
    while(true)
    {
        try{
            await hacerClickEnElemento(page,TAB_IPS);
        }catch(err){}
        const clases = await obtenerClasesDeElemento(page,TAB_IPS);
        if(clases){
            console.log(clases);
            if(clases.includes(ESTADO_ACTIVO_TAB))
            {
                break;
            }
        }
    }

    await page.waitForSelector(INPUT_TIPODOCUMENTO_IPS);            
    console.log("colocando tipo documento ips");
    while(true)
    {    
        await delay(500);
        await page.click(INPUT_TIPODOCUMENTO_IPS);
        await page.keyboard.type(TIPO_DOCUMENTO_IPS);        
        const inputValue = await page.$eval(INPUT_TIPODOCUMENTO_IPS, input => input.value);
        console.log(inputValue);
        if(inputValue === TIPO_DOCUMENTO_IPS)
        {
            break;
        }
    }   
    console.log("colocando documento de ips");
    while(true)
    {
        await page.click(INPUT_DOCUMENTO_IPS);
        await page.keyboard.type(DOCUMENTO_IPS);
        const inputValue = await page.$eval(INPUT_DOCUMENTO_IPS, input => input.value);
        console.log(inputValue);
        if(inputValue === DOCUMENTO_IPS)
        {
            break;
        }
    }
    console.log("colocando tipo documento usuario");
    while(true)
    {    
        
        await page.click(INPUT_TIPODOCUMENTO_USUARIO);
        await page.keyboard.type(TIPO_DOCUMENTO_USUARIO);
        await delay(500);
        await page.click(INPUT_TIPODOCUMENTO_USUARIO);
        await page.keyboard.press('Enter');
        const inputValue = await page.$eval(INPUT_TIPODOCUMENTO_USUARIO, input => input.value);
        console.log(inputValue);
        if(inputValue === TIPO_DOCUMENTO_USUARIO)
        {
            break;
        }
    }

    console.log("colocando documento usuario");
    while(true)
    {
      await page.click(INPUT_DOCUMENTO_USUARIO);
      await page.keyboard.type(DOCUMENTO_USUARIO); 
      const inputValue = await page.$eval(INPUT_DOCUMENTO_USUARIO, input => input.value);
      console.log(inputValue);
      if(inputValue === DOCUMENTO_USUARIO)
      {
        break;
      }     
    }
    

    console.log("colocar PASSWORD");
    while(true)
    {
        await page.click(INPUT_PASSWORD);
        await page.keyboard.type(PASSWORD);
        const inputValue = await page.$eval(INPUT_PASSWORD, input => input.value);
        console.log(inputValue);
        if(inputValue === PASSWORD)
        {
            break;
        }  
    }

    await page.click(BUTTON_INGRESAR);
    //await page.waitForSelector('body > app-root > div > div > app-home > div > button:nth-child(10)', { timeout: 0 });    
    console.log("logeado correctamente");
    
}

async function buscarUsuario(datos) {
  console.log("buscar usuario");

  const selector_1 ="body > app-root > div > div > app-home > div > button:nth-child(3)";
  const selector_2 ="body > app-root > div > div > app-consulta > div > button";
  const selector_3 ="body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div > div > form > div > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input";      

  const selectors = [selector_1, selector_2, selector_3];
  while(true){
    const presentSelector = await waitForAnySelector(page, selectors);
    if(presentSelector == selector_1)
    {
      await page.click("body > app-root > div > div > app-home > div > button:nth-child(3)");
    }
    if(presentSelector == selector_2)
    {
      await page.click("body > app-root > div > div > app-consulta > div > button");
    }
    if(presentSelector == selector_3)
    {
      break;
    }
    await delay(500);
  }
  
  console.log("buscar persona");  
  await page.waitForSelector("body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div > div > form > div > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input");            
  console.log("colocando tipo documento ");
  while(true)
  {    
      await delay(500);
      await page.click("body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div > div > form > div > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input");
      await page.keyboard.type(String(datos.descripcion_documento));        
      const inputValue = await page.$eval("body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div > div > form > div > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input", input => input.value);

      console.log(inputValue);
      if(inputValue === String(datos.descripcion_documento))
      {
          await page.click("body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div > div > form > div > div:nth-child(2) > input");
          break;
      }
  } 
  /*
  const comboBoxValue = await page.evaluate(() => {
    const comboBoxInput = document.querySelector('input[aria-haspopup="listbox"]');
    return comboBoxInput ? comboBoxInput.value : null;
  });
  await page.evaluate(() => {
    const comboBoxInput = document.querySelector('input[aria-haspopup="listbox"]');
    
    // Define el nuevo valor que quieres establecer
    const newValue = 'CARNET DIPLOMATICO';  // Reemplaza 'NuevoValor' con el valor que necesitas

    // Establece el nuevo valor en el input
    comboBoxInput.value = newValue;

    // Crea y despacha el evento 'input' para notificar el cambio
    const inputEvent = new Event('input', { bubbles: true });
    comboBoxInput.dispatchEvent(inputEvent);
  });
  await page.keyboard.press('Enter');

  console.log(comboBoxValue);
  while(true)
  {

    await delay(1000);
  }
  */
  console.log("colocando documento");
  console.log(String(datos.p_numero_documento))
  await page.click("body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div > div > form > div > div:nth-child(2) > input");
  await page.keyboard.type(String(datos.p_numero_documento));
//body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div.row.ng-star-inserted > kendo-scrollview > ul > li:nth-child(2) > div > div > a.circulo_Green.ng-star-inserted
  await page.click("body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div > div > form > div > div.col-md-2.col-xs-2.rowST > button");
  try{
    await page.waitForSelector("body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > app-ventana > kendo-dialog",{timeout: 2000});
    const contenido = await page.$eval('body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > div > p', (element) => element.textContent);
    console.log(contenido)
    if(contenido.includes("Por favor, seleccionar un tipo de documento"))
    {
      console.log("error "+contenido);
    }else{      
      await cargar_prueba(datos);
      finalizar(datos.id,contenido,3, datos);
      await clickButton(page,"body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > kendo-dialog-actions > button");
    }
    await page.reload();
    return;
  }catch(err)
  {
    console.log(err);
  }
  await page.waitForSelector("body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div.row.ng-star-inserted > kendo-scrollview > ul > li:nth-child(2) > div > div > a");
  const clase = await obtenerClasesDeElemento(page,"body > app-root > div > div > app-consultar-actividades-pyp > app-grupo-familiar > div.row.ng-star-inserted > kendo-scrollview > ul > li:nth-child(2) > div > div > a");
  console.log(clase);
  await cargar_prueba(datos);
  if(clase.includes("circulo_Green")){
    console.log("ACTIVO");
    finalizar(datos.id,"ACTIVO",1, datos);
  }else{
    console.log("INACTIVO");
    finalizar(datos.id,"INACTIVO",2, datos);
  }
  await page.reload();
}

async function hacerClickEnElemento(page, selector) 
{
    try {
      await page.evaluate((selector) => {
        const elemento = document.querySelector(selector);
        if (elemento) {
          elemento.click();
        } else {
          console.error('No se pudo encontrar el elemento con el selector:', selector);
        }
      }, selector);
    } catch (error) {
      console.error('Error al hacer clic en el elemento con selector:', selector, error);
    }
}

async function overwriteField(page, selector, value) {
    await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.value = '';
        }
    }, selector);

    await page.type(selector, value);
}

async function obtenerClasesDeElemento(page, selector) 
{
    try{
        return await page.evaluate(selector => {
            const elemento = document.querySelector(selector);
            return Array.from(elemento.classList);
        }, selector);
    }catch(err){

    }
}

async function obtenerTextoElemento(page, selector)
{
  const texto = await page.evaluate((selector) => {
    const elemento = document.querySelector(selector);
    return elemento ? elemento.innerText.trim() : null;
  }, selector);

  return texto;
}

async function waitForAnySelector(page, selectors) {
  const waitForSelectors = selectors.map(selector => 
    page.waitForSelector(selector, { timeout: 10000 }).then(() => selector).catch(() => null)
  );
  
  const result = await Promise.race(waitForSelectors);
  return result;
}

async function obtenerClasesDeElemento(page, selector) 
{
    try{
        return await page.evaluate(selector => {
            const elemento = document.querySelector(selector);
            return Array.from(elemento.classList);
        }, selector);
    }catch(err){

    }
}

async function clickButton(page, selector) 
{
  await page.evaluate((selector) => {
    const buttonSelector = selector;
    const buttonElement = document.querySelector(buttonSelector);
    if (buttonElement) {
      buttonElement.click();
    } else {
      //this.console_log(0,'No se encontró el botón con el selector:'+ buttonSelector);
    }
  }, selector);
}

main();