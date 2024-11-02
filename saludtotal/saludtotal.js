const puppeteer = require('puppeteer');
const pool = require('./dbConnection');
const fs = require('fs').promises;
const fse = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { parse, subDays, format } = require('date-fns');
const { ms } = require('date-fns/locale');
const { obtenerCredenciales } = require('./credenciales');
const { getSiteId, getDriveId, uploadFileToSharePoint,addItemToList } = require('./sharepointClient');
let browser;
let tabBrowser = {};
const config = require('/home/devbots/supervisor/.env/config');

const inicio = parseInt(process.argv[2]);
const redVPC = "10.20.30.0";
const idBOT = "3"
const getID = require('./iplocal');
let identificador = "";
const listId = "2E3E1C92-6621-4F5C-A3F9-87C164480F58";



const externo = 1;

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




const URL_SALUDTOTAL = "https://saludtotal.com.co/opciones-oficina-virtual/";
const URL_LOGIN = "https://transaccional.saludtotal.com.co/OficinaVirtual";
const ELEMENTO_LOGIN = "body > app-root > div > div > app-login";

let NAMEBOT ="";
const EPS = "SaludTotal";

let cantidadAtenciones = 0;
let id;
let atencion;
let estado;
let ruta = "";
let bucle = true;
let driveId = null;
let siteId = null;


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

async function main() {
    identificador = await getID(redVPC,idBOT,inicio)
    tmpProfilePath = `/tmp/${inicio}`;
    tmpProfilePathChrome = `/tmp/${inicio}/chrome-profile-${process.pid}`;
    NAMEBOT = identificador;
    console.log("inicio "+identificador);
    siteId = await getSiteId();
    driveId = await getDriveId(siteId);
    await credenciales();
    const startTime = Date.now();
    browser = await puppeteer.launch({
        headless: false, // Show the Chrome browser window
        executablePath: '/usr/bin/google-chrome',
        userDataDir: tmpProfilePathChrome,
        args: [
            '--window-size=400,300', // Set Chrome window size to 400x300
            '--no-sandbox'//, // Disable sandbox for compatibility (use with caution)
            //'--display=:0' // Show Chrome on the default X11 display (if using VNC)
        ],
        handleSIGINT: false // Prevent termination on Ctrl+C (if desired)
    });

    tabBrowser.datos = {};
    tabBrowser.page = await browser.newPage();
    console.log("nueva pestaña");
    await tabBrowser.page.goto(URL_SALUDTOTAL, { waitUntil: "networkidle0" });

    tabBrowser.client = await tabBrowser.page.target().createCDPSession();

    await tabBrowser.page.goto(URL_LOGIN, { waitUntil: 'load', timeout: 70000 });
    

    do
    {
        const endTime = Date.now();
        const elapsedTimeInSeconds = (endTime - startTime) / 1000;
        if(elapsedTimeInSeconds >= 50 && 1==2)
        {
            console.log("se acabo el tiempo "+elapsedTimeInSeconds);
            break;
        }
        const respuestaServer = await obtenerDatos();
        if(respuestaServer)
        {
            await login();
            console.log("refrescando");
            await tabBrowser.page.reload();
            await realizarConsulta();         
        }
        cantidadAtenciones++; 
        //console.log("Atenciones realizadas "+cantidadAtenciones);
        //console.log(bucle);
    } while(bucle);
    console.log("fin");
    const title = await tabBrowser.page.title(); 
    await browser.close(); // Cerrar el navegador después de usarlo    
    const response = {
        statusCode: 200,
        body: JSON.stringify({
            title: title,
            cantidad: cantidadAtenciones,
        }),
    };
    return response;
}

  async function credenciales()
  {
    const datos = await obtenerCredenciales(1, idBOT); 
    DOCUMENTO_USUARIO = datos.find(dato => dato.etiqueta === 'DOCUMENTO_USUARIO').valor_descifrado;
    PASSWORD = datos.find(dato => dato.etiqueta === 'PASSWORD').valor_descifrado;
    TIPO_DOCUMENTO_IPS = datos.find(dato => dato.etiqueta === 'TIPO_DOCUMENTO_IPS').valor_descifrado;
    DOCUMENTO_IPS = datos.find(dato => dato.etiqueta === 'DOCUMENTO_IPS').valor_descifrado;
    TIPO_DOCUMENTO_USUARIO = datos.find(dato => dato.etiqueta === 'TIPO_DOCUMENTO_USUARIO').valor_descifrado;
  }


async function obtenerDatos()
{
    try {
        id = null;
        const resultado = await pedirAtencion();       
        console.log(resultado);
        if (resultado && resultado.rows && resultado.rows.length > 0) {

          const validacion = resultado.rows[0].atencion.split("|");

          if (validacion.length !== 4) {
            await actualizarEstado(resultado.rows[0].id, 3, "Atencion Incompleta");
            await guardarListaErrores(
              resultado.rows[0].atencion,
              resultado.rows[0].fecha,
              resultado.rows[0].contrato,
              "",
              "Atencion Incompleta"
            );
            return false;
          }
          
          if(validacion[3].length<1){
            await actualizarEstado(resultado.row[0].id, 3, "Sin fecha");
            await guardarListaErrores(
              resultado.row[0].atencion,
              resultado.row[0].fecha,
              resultado.row[0].contrato,
              "",
              "Atencion Incompleta"
            );
            return false;
          }

          const primerSegmento = validacion[0].split("_");
          if (primerSegmento.length !== 3) {
            await actualizarEstado(resultado.rows[0].id, 3, "Atencion Incompleta 2");
            await guardarListaErrores(
              resultado.rows[0].atencion,
              resultado.rows[0].fecha,
              resultado.rows[0].contrato,
              "",
              "Atencion Incompleta"
            );
            return false;
          }

          tabBrowser.datos.fechaDescarga = resultado.rows[0].fecha;
          tabBrowser.datos.contrato = resultado.rows[0].contrato;
          tabBrowser.datos.sedeAtencion = primerSegmento[1];


          // Desestructuración del objeto resultado
          id = resultado.rows[0].id;
          atencion = resultado.rows[0].atencion;
          estado = resultado.rows[0].estado;
          ruta = resultado.rows[0].ruta;
          await liberarAtenciones(id);
        }else{
            await delay(5000);
            await cambiarEPS();
            console.log('No se encontraron resultados para la consulta.');
            return false;
        }
        console.log(atencion)
        tabBrowser.datos.rutaArchivoErrores = ruta+"/registro_errores.txt";
        tabBrowser.datos.id = id;
        tabBrowser.datos.atencion_text = atencion;
        console.log("el id que obtenemos es "+id);
        const partes = atencion.replace(/\s+/g, '').split('|');
        if (partes.length != 4) {            
            tabBrowser.status = 2;
            await actualizarEstado(tabBrowser.datos.id,3,tabBrowser.datos.atencion_text  + "  Atencion incompleta");
            return false;
        }         
        tabBrowser.datos.serial = partes[1];
        const autorizacion = tabBrowser.datos.serial.split("-");
        if(autorizacion.length == 2)
        {
            tabBrowser.datos.autorizacion = autorizacion;
        }else{
            tabBrowser.status = 2;
            await actualizarEstado(tabBrowser.datos.id,3,tabBrowser.datos.atencion_text  +" Atencion error");
            return false;
        }            
        const documento = partes[2].split("-");
        if(documento.length == 2)
        {
            tabBrowser.datos.cedula = documento[1];
            tabBrowser.datos.tipoDocumento = documento[0];
        }else{
            tabBrowser.status = 2;
            await actualizarEstado(tabBrowser.datos.id,3,tabBrowser.datos.atencion_text  +"  Documento erroneo");
            return false;
        }

        const carpetacontrato = partes[0].split("_");
        if(carpetacontrato.length == 3)
        {
            const sede = await obtenerSede(carpetacontrato[1]);
            if (sede) {
                console.log('Sucursal:', sede.sucursal);
                console.log('Sede:', sede.sede);
                tabBrowser.datos.departamento = sede.sucursal;
                tabBrowser.datos.sede = sede.sede;
            } else {
                tabBrowser.status = 2;
                await actualizarEstado(tabBrowser.datos.id,3,tabBrowser.datos.atencion_text  +"  No se encontro la Sede");
                return false;
                console.log('No se encontró ninguna sede para el contrato dado.');
            }
        }else{
            tabBrowser.status = 2;
            await actualizarEstado(tabBrowser.datos.id,3,tabBrowser.datos.atencion_text  +"  Error contrato carpeta");
            return false;
        }        
        
        tabBrowser.datos.ruta = "/home/devbots/Downloads/"+tabBrowser.datos.id;        
        tabBrowser.datos.rutaSharePoint = ruta+"/"+partes[0];
        tabBrowser.datos.rutaArchivo = ruta+"/"+carpetacontrato[0];
        tabBrowser.datos.nombreArchivo = partes[0]+"_17_1.pdf";
        tabBrowser.datos.fecha = partes[3];
        const [fechaInicial, fechaFinal] = await formatearFechaConDosDigitos(tabBrowser.datos.fecha);
        tabBrowser.datos.fechaInicio = fechaInicial;
        tabBrowser.datos.fechaFin = fechaFinal;
        tabBrowser.datos.estadoDB = estado;
        console.log(tabBrowser.datos);
        cambiarCarpeta();
        return true;            
    } catch (error) {
        console.error('Error al procesar la atención:', error);
        return false;
    }
}

async function cambiarEPS() {
    const client = await pool.connect();
    try {
      // Iniciar transacción
      await client.query("BEGIN");
      
      // Definir la consulta SQL para actualizar la tarea
      const sql = `
        UPDATE ec2 e
        SET bot_id = COALESCE((
            SELECT eps_id
            FROM tareas
            WHERE estado IN (0, 2)
              AND ebot_id = 0
            GROUP BY eps_id
            ORDER BY COUNT(1) DESC
            LIMIT 1
        ), -1)
        WHERE linode_id = $1
        AND linode_id != '65444152'
        AND NOT EXISTS (
            SELECT 1
            FROM tareas t
            WHERE t.linode_id = e.linode_id
              AND t.estado IN (0, 2)
        );
      `;
      
      await client.query(sql, [config.LINODE_ID]);

      // Confirmar transacción
      await client.query("COMMIT");
    } catch (error) {
      // Revertir transacción en caso de error
      await client.query("ROLLBACK");
      console.error("Error al actualizar el archivo:", error);
      throw error;
    } finally {
      // Liberar el cliente
      client.release();
    }
}

async function login() {
    console.log("login");
    const urlActual = await tabBrowser.page.url();
    console.log("url del login");
    console.log(urlActual);
    if (!urlActual.includes("OficinaVirtual")) {
        //await tabBrowser.page.reload();
        return;
    }
    
    while(true){
        try{
            await tabBrowser.page.waitForSelector(ELEMENTO_LOGIN);
            break;
        }catch(err){
            console.log("elemento no aparece");
        }
    }

    try{
        const elemento = await tabBrowser.page.$(ELEMENTO_LOGIN);
        if (elemento) {
            console.log('El selector existe en la página.');
        } else {
            console.log("elemento no exita");
            return
        }
    }catch(err){}
    console.log("seleccionar IPS");
    let selector = null;
    while(true){
        selector = await tabBrowser.page.evaluate(() => {
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
            await hacerClickEnElemento(tabBrowser.page,TAB_IPS);
        }catch(err){}
        const clases = await obtenerClasesDeElemento(tabBrowser.page,TAB_IPS);
        if(clases){
            console.log(clases);
            if(clases.includes(ESTADO_ACTIVO_TAB))
            {
                break;
            }
        }
    }

    await tabBrowser.page.waitForSelector(INPUT_TIPODOCUMENTO_IPS);            
    console.log("colocando tipo documento ips");
    while(true)
    {    
        await delay(500);
        await tabBrowser.page.click(INPUT_TIPODOCUMENTO_IPS);
        await tabBrowser.page.keyboard.type(TIPO_DOCUMENTO_IPS);        
        const inputValue = await tabBrowser.page.$eval(INPUT_TIPODOCUMENTO_IPS, input => input.value);
        console.log(inputValue);
        if(inputValue === TIPO_DOCUMENTO_IPS)
        {
            break;
        }
    }   
    console.log("colocando documento de ips");
    while(true)
    {
        await tabBrowser.page.click(INPUT_DOCUMENTO_IPS);
        await tabBrowser.page.keyboard.type(DOCUMENTO_IPS);
        const inputValue = await tabBrowser.page.$eval(INPUT_DOCUMENTO_IPS, input => input.value);
        console.log(inputValue);
        if(inputValue === DOCUMENTO_IPS)
        {
            break;
        }
    }
    console.log("colocando tipo documento usuario");
    while(true)
    {    
        
        await tabBrowser.page.click(INPUT_TIPODOCUMENTO_USUARIO);
        await tabBrowser.page.keyboard.type(TIPO_DOCUMENTO_USUARIO);
        await delay(500);
        await tabBrowser.page.click(INPUT_TIPODOCUMENTO_USUARIO);
        await tabBrowser.page.keyboard.press('Enter');
        const inputValue = await tabBrowser.page.$eval(INPUT_TIPODOCUMENTO_USUARIO, input => input.value);
        console.log(inputValue);
        if(inputValue === TIPO_DOCUMENTO_USUARIO)
        {
            break;
        }
    }

    console.log("colocando documento usuario");
    while(true)
    {
      await tabBrowser.page.click(INPUT_DOCUMENTO_USUARIO);
      await tabBrowser.page.keyboard.type(DOCUMENTO_USUARIO); 
      const inputValue = await tabBrowser.page.$eval(INPUT_DOCUMENTO_USUARIO, input => input.value);
      console.log(inputValue);
      if(inputValue === DOCUMENTO_USUARIO)
      {
        break;
      }     
    }
    

    console.log("colocar PASSWORD");
    while(true)
    {
        await tabBrowser.page.click(INPUT_PASSWORD);
        await tabBrowser.page.keyboard.type(PASSWORD);
        const inputValue = await tabBrowser.page.$eval(INPUT_PASSWORD, input => input.value);
        console.log(inputValue);
        if(inputValue === PASSWORD)
        {
            break;
        }  
    }

    await tabBrowser.page.click(BUTTON_INGRESAR);
    await tabBrowser.page.waitForSelector('body > app-root > div > div > app-home > div > button:nth-child(10)', { timeout: 0 });    
    console.log("logeado correctamente");
}

async function realizarConsulta()
{
    console.log("inicion funcion realizar consulta");
    
    try{
        await tabBrowser.page.waitForSelector("body > app-root > div > div > app-home > div > button:nth-child(10)");
    }catch(err){
        console.log("direccionamientos")
        console.log(err);
    }
    const textoDireccionamientos = await obtenerTextoElemento(tabBrowser.page,"body > app-root > div > div > app-home > div > button:nth-child(10)");        
    if(textoDireccionamientos)
    {
        if(textoDireccionamientos.includes("DIRECCIONAMIENTOS"))
        {
            console.log("1 direccionamiento");
            await tabBrowser.page.click('body > app-root > div > div > app-home > div > button:nth-child(10)');
            await clickButton(tabBrowser.page,"body > app-root > div > div > app-home > div > button:nth-child(10)");
            await tabBrowser.page.waitForSelector('body > app-root > div > div > app-autorizaciones > div > a:nth-child(1)', { timeout: 0 });
        }
    }


    try{
        await tabBrowser.page.waitForSelector("body > app-root > div > div > app-autorizaciones > div > a:nth-child(1)");
    }catch(err){
        console.log("registrar direccionamientos")
        console.log(err);
    }
    const textoRegistrar = await obtenerTextoElemento(tabBrowser.page,"body > app-root > div > div > app-autorizaciones > div > a:nth-child(1)");        
    if(textoRegistrar)
    {          
        if(textoRegistrar.includes("REGISTRAR DIRECCIONAMIENTO"))
        {            
            console.log("2 registrar direccionamiento");
            await tabBrowser.page.click("body > app-root > div > div > app-autorizaciones > div > a:nth-child(1)");
            await clickButton(tabBrowser.page,"body > app-root > div > div > app-autorizaciones > div > a:nth-child(1)");
            await tabBrowser.page.waitForSelector('kendo-window', { timeout: 0 });
            await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input");
            await seleccionarSede(SELECTOR_SUCURSAL_LOGIN,SELECTOR_SEDE_LOGIN,SELECTOR_ACEPTAR_LOGIN);
            await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > div > form:nth-child(1) > div > div:nth-child(1) > input");
            console.log("ok");
        }
    }
    /*
    try{  
        await tabBrowser.page.waitForSelector("body > app-root > div > app-top-bar > header > div.tool-bar > a.module-name > b:nth-child(2)");
        const textoTituloRegistrar = await obtenerTextoElemento(tabBrowser.page,"body > app-root > div > app-top-bar > header > div.tool-bar > a.module-name > b:nth-child(2)");        
        console.log(textoTituloRegistrar);
    }catch(err){}
    */
    
    await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > div > form:nth-child(1) > div > div:nth-child(1) > input");
    while(true)
    {
        await tabBrowser.page.click("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > div > form:nth-child(1) > div > div:nth-child(1) > input");
        console.log("este dice usted??????");
        await tabBrowser.page.keyboard.down('Shift');
        // Presiona Inicio
        await tabBrowser.page.keyboard.press('Home');
        // Suelta Shift
        await tabBrowser.page.keyboard.up('Shift');
        await tabBrowser.page.keyboard.down('Backspace');
        console.log("documento "+tabBrowser.datos.cedula);
        await tabBrowser.page.keyboard.type(tabBrowser.datos.cedula);
        let inputValue = await tabBrowser.page.$eval('body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > div > form:nth-child(1) > div > div:nth-child(1) > input', el => el.value);
        if(inputValue === tabBrowser.datos.cedula)
        {
            console.log("cedula digitada correctamente "+inputValue);
            break;
        }
    }
    await tabBrowser.page.click("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > div > form:nth-child(1) > div > div.col-md-2.col-sm-12 > button");
    try{
        await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > div > div > kendo-window", {timeout: 2000});
        console.log("panel");
        //body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > div > div > kendo-window > div.k-content.k-window-content.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table
        const filas = await tabBrowser.page.$$('body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > div > div > kendo-window > div.k-content.k-window-content.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody tr');
        // Itera sobre cada fila y muestra el contenido de la séptima columna en la consola
        const encontrado = await recorrerTablaHacerClick(filas, tabBrowser.datos.tipoDocumento,2,1);
        console.log("encontrado:");
        console.log(encontrado);
    }catch(err){
        console.log(err);
    }

    try
    {                                                 
        await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > div > p", {timeout: 2000});            
        await delay(500);
        let loopalert = true;
        while(loopalert)
        {              
          const html = await tabBrowser.page.$eval('body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > div > p', element => element.innerHTML);
          console.log(html);
          if(html)
          {
            if(html.includes("No se encontró el afiliado"))
            {
              console.log("fallo no se encontro el afiliado");
              await falloBusqueda(tabBrowser,"fallo no se encontro el afiliado",3);
              return false;
              loopalert = false;
            }
          }
          while(true)
          {             
            try{   
              await tabBrowser.page.click("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > kendo-dialog-actions > button");
              console.log("Nuevo Alerta Encontrada");
              try{
                await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > div > p", {timeout: 2000});            
              }catch(err)
              {
                console.log(err);
                break;
              }
            }catch(err)
            {
              break;
            }
          }
        }
        if(loopalert == false){
          console.log("fin");
          return false;
        }
    }catch(err){
        console.log("No se encontro nada 1");
    }

    await tabBrowser.page.waitForSelector("#k-tabstrip-tab-1");
    console.log("click registrar autorizacion");
    while(true)
    {
      await tabBrowser.page.click("#k-tabstrip-tab-1");
      const clases = await obtenerClasesDeElemento(tabBrowser.page, "#k-tabstrip-tab-1");            
      if(clases.includes("k-state-active"))
      {
        break;
      }
    }

    try{
        await tabBrowser.page.waitForSelector("#k-tabstrip-tabpanel-1 > form > div:nth-child(2) > div:nth-child(1) > kendo-datepicker > span > kendo-dateinput > span > input",{ timeout: 0 });
    }catch(err){}


    while(true)
    {            
        await tabBrowser.page.focus("#k-tabstrip-tabpanel-1 > form > div:nth-child(2) > div:nth-child(1) > kendo-datepicker > span > kendo-dateinput > span > input");
        await tabBrowser.page.click("#k-tabstrip-tabpanel-1 > form > div:nth-child(2) > div:nth-child(1) > kendo-datepicker > span > kendo-dateinput > span > input");
        await tabBrowser.page.keyboard.press('Backspace');
        await tabBrowser.page.keyboard.press('Backspace');
        await tabBrowser.page.keyboard.press('Backspace');
        await tabBrowser.page.keyboard.type(tabBrowser.datos.fechaInicio);
        const inputValue = await tabBrowser.page.$eval('#k-tabstrip-tabpanel-1 > form > div:nth-child(2) > div:nth-child(1) > kendo-datepicker > span > kendo-dateinput > span > input', el => el.value);
        let date1 = await parseStringToDateNumber(tabBrowser.datos.fechaInicio);
        let date2 = await parseStringToDateWeb(inputValue);

        if(date1.getTime() === date2.getTime())
        {
            console.log("fecha inicial correctamente");
            break;
        }
        await delay(1000);
    }

    while(true)
    {            
        await tabBrowser.page.focus("#k-tabstrip-tabpanel-1 > form > div:nth-child(2) > div:nth-child(2) > kendo-datepicker > span > kendo-dateinput > span > input");
        await tabBrowser.page.click("#k-tabstrip-tabpanel-1 > form > div:nth-child(2) > div:nth-child(2) > kendo-datepicker > span > kendo-dateinput > span > input");
        await tabBrowser.page.keyboard.press('Backspace');
        await tabBrowser.page.keyboard.press('Backspace');
        await tabBrowser.page.keyboard.press('Backspace');
        await tabBrowser.page.keyboard.type(tabBrowser.datos.fechaFin);
        const inputValue = await tabBrowser.page.$eval('#k-tabstrip-tabpanel-1 > form > div:nth-child(2) > div:nth-child(2) > kendo-datepicker > span > kendo-dateinput > span > input', el => el.value);
        let date1 = await parseStringToDateNumber(tabBrowser.datos.fechaFin);
        let date2 = await parseStringToDateWeb(inputValue);
        // Comparar fechas
        if(date1.getTime() === date2.getTime())
        {
            console.log("fecha final correctamente");
            break;
        }
        await delay(1000);
    }

    let sinCoincidencias = false;
    while(true){
      await tabBrowser.page.click("#k-tabstrip-tabpanel-1 > form > div:nth-child(2) > div.col-md-2.col-sm-12 > button");
      try{
        await tabBrowser.page.waitForSelector("#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr > td:nth-child(2)", {timeout: 5000}); 
        break;
      }catch(err){
        console.log(err);
      }
      console.log("esperando");
      try{
         await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > app-ventana > kendo-dialog", {timeout: 1000});               
         console.log("si existe el dialog")
         //sinCoincidencias = true;               
         try{
            const html = await tabBrowser.page.$eval('body > app-root > div > div > app-registrar-autorizacion > app-ventana > kendo-dialog > div:nth-child(2) > div > p', element => element.innerHTML);
            sinCoincidencias = true;
            console.log(html);
            break;
         }catch(err){
          console.log(err);
          break;
         }
      }catch(err){}
    }


    if(sinCoincidencias)
    {
        //while(true){}
        await tabBrowser.page.focus("body > app-root > div > div > app-registrar-autorizacion > app-ventana > kendo-dialog > div:nth-child(2) > kendo-dialog-actions > button");
        await tabBrowser.page.click("body > app-root > div > div > app-registrar-autorizacion > app-ventana > kendo-dialog > div:nth-child(2) > kendo-dialog-actions > button");
        await falloBusqueda(tabBrowser,"No se encontro ", 3);  
        return false;          
    }else{
        return await seleccionarDescargar();
    }    
}

async function seleccionarDescargar() {
    console.log("buscamos los resultados para descargar");
    await delay(500);
    try{
        await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > app-ventana > kendo-dialog", {timeout: 2000}); 
        let loopalert = true;
        while(loopalert)
        {              
            const html = await tabBrowser.page.$eval('body > app-root > div > div > app-registrar-autorizacion > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > div > p', element => element.innerHTML);
            console.log(html);
            if(html)
            {
                if(html.includes("No se encontraron coincidencias en la consulta"))
                {
                    console.log("No se encontraron coincidencias en la consulta");
                    falloBusqueda(tabBrowser, "No se encontraron coincidencias en la consulta", 3);
                    loopalert = false;
                    return false;
                }
            }
            
            while(true)
            {                
                try{
                    await tabBrowser.page.click("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > kendo-dialog-actions > button");
                    console.log("Nuevo Alerta Encontrada");
                    try{
                        await tabBrowser.page.waitForSelector("body > app-root > div > div > app-registrar-autorizacion > div > app-info-afiliado > app-ventana > kendo-dialog > div.k-widget.k-window.k-dialog.ng-trigger.ng-trigger-dialogSlideInAppear > div > p", {timeout: 2000});            
                    }catch(err)
                    {
                        console.log(err);
                        break;
                    }
                }catch(err)
                {
                    console.log(err);
                    break;
                }
            }   
            if(loopalert == false){
                console.log("fin");
                return false;
            }           
        }
    }catch(err)
    {
        console.log(err);
    }
    
    while(true)
    {
        try{
            await tabBrowser.page.waitForSelector("#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr > td:nth-child(1)");
            break;
        }catch(err)
        {
            await delay(500);
        }
    }

    await tabBrowser.page.waitForSelector('table.k-grid-table');

    const columnIndices = await tabBrowser.page.evaluate(() => {
        const headers = document.querySelectorAll('#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > div > div > table > thead > tr:nth-child(1) > th');
        let direccionamientoIndex = -1;
        let estadoIndex = -1;

        headers.forEach((th, index) => {
            const text = th.textContent.trim();
            if (text === 'DIRECCIONAMIENTO') {
                direccionamientoIndex = index;
            } else if (text === 'ESTADO') {
                estadoIndex = index;
            }
        });

        return { direccionamientoIndex, estadoIndex };
    });

    console.log("cabeceras");
    console.log(columnIndices);

    const filas = await tabBrowser.page.$$('#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr');
    let posicionCelda = "";
    let contenidoEstado = "";
    for (let i = 0; i < filas.length; i++) {
            const selectorCelda8Fila = '#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr:nth-child('+ (i+1) +') > td:nth-child('+(columnIndices.direccionamientoIndex + 1)+')';
            const selectorCelda23Fila = '#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr:nth-child('+ (i+1) +') > td:nth-child('+(columnIndices.estadoIndex + 1)+')';

            const contenidoCelda2Fila1 = await tabBrowser.page.evaluate((selector) => {
                const celda = document.querySelector(selector);
                return celda ? celda.innerText.trim() : 'Celda no disponible';
            }, selectorCelda8Fila);
            contenidoEstado = await tabBrowser.page.evaluate((selector) => {
                const celda = document.querySelector(selector);
                return celda ? celda.innerText.trim() : 'Celda no disponible';
            }, selectorCelda23Fila);


            const texto = await filas[i].evaluate(el => el.innerText);
            console.log(contenidoEstado);
            console.log(`Contenido de la celda 2 en la fila 1: ${contenidoCelda2Fila1}`);
            console.log(contenidoCelda2Fila1)
            console.log("igual a")
            console.log(tabBrowser.datos.serial)
            if(contenidoCelda2Fila1.includes(tabBrowser.datos.serial))
            {
              posicionCelda = (i+1);
              break;
            }
    }

    let encontrado = false;
    if (posicionCelda !== "") {
        encontrado = true;
    }
    if(encontrado)
    {
      if(contenidoEstado.includes("Reversada"))
      {
        encontrado = false;
        mensaje = "Reversada: ";
      }else{
        let selectorEncontrado = "#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr:nth-child("+posicionCelda+") > td.text-center.k-touch-action-auto.ng-star-inserted > input";
        while(true)
        {          
          await tabBrowser.page.click(selectorEncontrado);
          const isChecked = await tabBrowser.page.evaluate((selector) => {
              const checkbox = document.querySelector(selector);
              return checkbox ? checkbox.checked : false;
          }, selectorEncontrado);
          if(isChecked)
          {
            break;
          }
          await delay(1000);
        } 
      }
    }
    if(encontrado){
        console.log("Abriendo Menu para imprimir");
        let nombreArchivo = "descarga.pdf"
        const rutaDirectorio = tabBrowser.datos.ruta;
        const downloadPath = path.join(rutaDirectorio, nombreArchivo);


        const waitForDownload = () => {
          return new Promise((resolve, reject) => {
            // Definir el listener
            const responseHandler = async (response) => {
              //console.log(response.url());
              if(response.url().includes(".pdf"))
              {
                resolve(`Descarga detectada: ${response.url()}`);
              }
            };
            // Añadir el listener para detectar la respuesta de red
            tabBrowser.page.on('response', responseHandler);

            // Timeout opcional para rechazar si no se detecta la descarga en un tiempo específico
            setTimeout(() => {
              // Eliminar el listener en caso de timeout
              tabBrowser.page.off('response', responseHandler);
              reject(new Error('No se detectó ninguna descarga en el tiempo esperado.'));
            }, 10000); // 10 segundos de espera máxima
          });
        };

        while(true)
        {
          while(true)
          {
            console.log("abrimos para descargar")
            await tabBrowser.page.click("#k-tabstrip-tabpanel-1 > form > div:nth-child(4) > div > kendo-menu > ul > li:nth-child(2)");
            const ariaExpanded = await tabBrowser.page.evaluate(() => {
              // Selecciona el elemento usando el selector CSS
              const element = document.querySelector('#k-tabstrip-tabpanel-1 > form > div:nth-child(4) > div > kendo-menu > ul > li:nth-child(2)');
              // Retorna el valor del atributo aria-expanded
              return element ? element.getAttribute('aria-expanded') : null;
            });
            await delay(1000);
            if(ariaExpanded === "true")
            {
              console.log("hacemos click")
              await hacerClickEnElemento(tabBrowser.page,"#k-menu1-child1 > li:nth-child(3) > span"); 
              try{
                const mensaje = await waitForDownload();
                console.log(mensaje);
                break;
              }catch(err)
              {
                console.log(err)
              }
              
            }  
          }
          console.log("Esperando Descarga....");

          try{
            await waitForFile(downloadPath);
            break;
          }catch(err)
          {
            console.log(err);
          }
        }
        
        
        //await this.findWordInPdf(downloadPath,"documento : 1087560457");
        if(externo == 1){

            //await savePDFDB(downloadPath, tabBrowser.datos.id);
            await sendPDFtoShare(downloadPath,tabBrowser);
            
        }else{
            await copiarPDF(downloadPath, NOMBRE_ARCHIVO, tabBrowser.datos.rutaArchivo);
        }


        try {
          // Eliminar el archivo original
          await fs.rm(rutaDirectorio, { recursive: true, force: true });
          console.log('Archivo original eliminado '+rutaDirectorio);
        } catch (err) {
          console.log('Error al manejar el archivo:'+ err);        
        }
        return true;
      }else{        
        await falloBusqueda(tabBrowser, "No encontrado...", 3);  
        return false;
      }
}

async function finalizarTareaExitosamente(id) {
  const client = await pool.connect();

  try {
    // Iniciar transacción
    await client.query('BEGIN');

    // Definir la consulta SQL para actualizar la tarea
    const sql = `
      UPDATE tareas 
      SET estado = 1, fecha_fin_ejecucion = CURRENT_TIMESTAMP, externo = 1 
      WHERE id = $1
    `;
    const result = await client.query(sql, [id]);

    // Definir la consulta SQL para actualizar el folder
    const sqlUpdate = `
      UPDATE folder f
      SET estado = 3, fecha_finalizacion=now()
      WHERE estado = 2
      AND NOT EXISTS (
        SELECT 1 
        FROM tareas t 
        WHERE t.folder_id = f.id 
        AND estado IN (0, 2)
        LIMIT 1
      )
    `;
    await client.query(sqlUpdate);

    // Confirmar transacción
    await client.query('COMMIT');

    console.log("\x1b[44m%s\x1b[0m", 'Archivo actualizado con éxito:', result);
    return result;

  } catch (error) {
    // Revertir transacción en caso de error
    await client.query('ROLLBACK');
    console.error('Error al actualizar el archivo:', error);
    throw error;

  } finally {
    // Liberar el cliente
    client.release();
  }
}


async function renameFile(filePath, newFileName) {
    const directory = path.dirname(filePath); // Obtiene la ruta del directorio
    const newPath = path.join(directory, newFileName); // Combina el directorio con el nuevo nombre

    try {
        await fs.rename(filePath, newPath);
        console.log(`Archivo renombrado a: ${newFileName}`);
        return newPath; // Retorna la ruta completa del archivo renombrado
    } catch (err) {
        console.error('Error al renombrar el archivo:', err);
        throw err; // Lanza el error para manejarlo fuera si es necesario
    }
}

async function sendPDFtoShare(pdf, url_sharepoint)
{  
  console.log(tabBrowser.datos);
  const updatedPath = await renameFile(pdf,tabBrowser.datos.nombreArchivo);  
  await uploadFileToSharePoint(driveId, tabBrowser.datos.rutaSharePoint, updatedPath);
  await finalizarTareaExitosamente(tabBrowser.datos.id);
}

async function seleccionarSede(selector_Sucursal, selector_Sede, selector_Aceptar)
{     
    console.log("seleccionar sede");
    await tabBrowser.page.focus(selector_Sucursal);        
    // Escribir en el elemento
    await tabBrowser.page.keyboard.press('Backspace');
    let contadorciclo=0;
    let valueFlecha = "ArrowDown";
    while(true)
    {         
      await tabBrowser.page.keyboard.press(valueFlecha);         
      const selector = selector_Sucursal;
      const value = await tabBrowser.page.$eval(selector, input => input.value);
      console.log(tabBrowser.datos.departamento+'=> Value:'+ value);
      if(value == tabBrowser.datos.departamento)
      {
        await tabBrowser.page.keyboard.press('Enter');
        break;
      }
      contadorciclo++;
      if(contadorciclo > 14)
      {
        contadorciclo = 0;
        if(valueFlecha === "ArrowDown")
        {
          valueFlecha = "ArrowUp";
        }else{
          valueFlecha = "ArrowDown";
        }
      }
      await delay(1000);
    }

    await delay(1000);                                    
    await tabBrowser.page.focus(selector_Sede);
    while(true)
    {          
      await tabBrowser.page.keyboard.press('ArrowDown');         
      const selector = selector_Sede;
      const value = await tabBrowser.page.$eval(selector, input => input.value);
      console.log(tabBrowser.datos.sede+'=> Value:'+ value);
      if(value == tabBrowser.datos.sede)
      {
        await tabBrowser.page.keyboard.press('Enter');
        break;
      }
      await delay(1000);
    }
  
    await delay(500);  
    
    while(true)
    {
        console.log("click en seleccionar sede");
        await tabBrowser.page.focus(selector_Aceptar);
        await tabBrowser.page.click(selector_Aceptar);        
        await delay(500);
        try{
            await tabBrowser.page.waitForSelector(selector_Aceptar);
        }catch(err)
        {
            console.log("salimos del selector de sede");
            break;
        }
    }
}

async function cambiarCarpeta() {
    console.log(tabBrowser.datos.ruta);  // Verifica si la ruta es correcta
    try {
        // Crea la carpeta si no existe
        await fs.mkdir(tabBrowser.datos.ruta, { recursive: true });

        // Cambia la ruta de descarga
        await tabBrowser.client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: tabBrowser.datos.ruta,  // Ruta a tu carpeta personalizada
        });            
    } catch (error) {
        console.error('Error al cambiar la ruta de descarga:', error);
    }
}

async function copiarPDF(origen, nuevoNombre, destino) {
    try {
        // Asegúrate de que el directorio de destino existe
        await fs.mkdir(path.dirname(destino), { recursive: true });

        // Construye la ruta completa del nuevo archivo
        const nuevoArchivo = path.join(path.dirname(destino), nuevoNombre);

        // Copia el archivo
        await fs.copyFile(origen, nuevoArchivo);
        await actualizarEstado(tabBrowser.datos.id,1,"ok");
        console.log(`Archivo copiado y renombrado a: ${nuevoArchivo}`);
    } catch (error) {
        console.error('Error al copiar el archivo PDF:', error);
        throw error; // Relanza el error para manejarlo fuera de la función si es necesario
    }
}

async function encontrarPosicionEncabezado(page, textoBuscar, selectorTabla) {
    try {
        const tabla = await page.$(selectorTabla);  
        if (!tabla) {
            throw new Error(`No se encontró la tabla con el selector: ${selectorTabla}`);
        }  
        const encabezados = await tabla.$$('thead > tr > td');
        let posicion = -1;  
        for (let i = 0; i < encabezados.length; i++) {
            const nombreEncabezado = await (await encabezados[i].getProperty('textContent')).jsonValue();
            if (nombreEncabezado.trim() === textoBuscar) {
                posicion = i;
                break;
            }
        }  
        return posicion;
    } catch (error) {
        return -1; // Devuelve -1 si hay algún error
    }
}

async function colocar2FA() {
    let codigo2FA = null
    while(codigo2FA === null){
        await delay(100);
        codigo2FA = await obtenerCodigo2FA();
    }
    while(true)
    {
        await overwriteField(tabBrowser.page, '#loginForm > input[type=text]:nth-child(4)',codigo2FA);     
        const valueCodigo2FA = await tabBrowser.page.$eval('#loginForm > input[type=text]:nth-child(4)', element => element.value);    
        if(valueCodigo2FA == codigo2FA)
        {
            break;
        }
    }
    try{
        while(true){
            await tabBrowser.page.click('#loginForm > div.trustedDevice > label > span');
            const resultado = await tieneAfter('#loginForm > div.trustedDevice > label > span', tabBrowser);
            if(resultado)
            {
                break;
            }
        }
        await tabBrowser.page.click("#loginForm > div:nth-child(9) > input");
        await tabBrowser.page.waitForNavigation({ waitUntil: 'networkidle0' });
    }catch(err){
    }
}

async function reformatearFecha(fechaOriginal) 
{
  // Separar la fecha por barras
  const partes = fechaOriginal.split('/');
  
  // Reorganizar las partes de la fecha
  const fechaReformateada = partes[2] + '/' + partes[1] + '/' + partes[0];
  
  return fechaReformateada;
}

async function obtenerContenidoCelda(page, selectorTabla, fila, columna) {
    try {
        const tabla = await page.$(selectorTabla);  
        if (!tabla) {
        throw new Error(`No se encontró la tabla con el selector: ${selectorTabla}`);
        }  
        const filaSelector = `tbody > tr:nth-child(${fila})`;
        const columnaSelector = `${filaSelector} > td:nth-child(${columna})`;
        const contenidoCelda = await tabla.$eval(columnaSelector, cell => cell.textContent.trim());
        return contenidoCelda;
    } catch (error) {
        return null; // Devuelve null si hay algún error
    }
}

async function tieneAfter(selector, tabBrowser)
{
  const tieneAfter = await tabBrowser.page.evaluate((selector) => {
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


async function consultarpaginas() {
    const pages = await browser.pages();
    let it = 1;
    for (let page of pages) {
      const url = page.url();
      //console.log(it+" paginas abiertas con url "+url);
      if (url.includes(".pdf.viewer")) {
        return url;
      }
      it++;
    }
    // Si ninguna página contiene ".pdf.viewer", retornar null o alguna indicación de que no se encontró ninguna página adecuada
    return null;
  }

async function actualizarEstado(idAtencion, estado, msg) {
    console.log(idAtencion);
    console.log(estado);
    console.log(msg);

    let actualizarFechaInicio = "";
    if (estado === 2) {
        actualizarFechaInicio = ", ebot_id = 0 ";
    } else {
        actualizarFechaInicio = ", externo = " + externo;
    }

    let client;
    try {
        // Establece la conexión a la base de datos
        client = await pool.connect();

        // Inicia la transacción
        await client.query('BEGIN');

        // Prepara la consulta SQL
        const sql = `
            UPDATE Tareas 
            SET estado = $1, fecha_fin_ejecucion = CURRENT_TIMESTAMP, observaciones = $2 ${actualizarFechaInicio}
            WHERE id = $3
        `;

        // Ejecuta la consulta
        const res = await client.query(sql, [estado, msg, idAtencion]);

        // Actualiza el estado del folder si es necesario
        if (estado === 3) {
            const sqlUpdate = `
              UPDATE folder f
              SET estado = 3, fecha_finalizacion=now()
              WHERE estado = 2
              AND NOT EXISTS (
                SELECT 1 
                FROM tareas t 
                WHERE t.folder_id = f.id 
                AND estado IN (0, 2)
                LIMIT 1
              )
            `;
            await client.query(sqlUpdate);
            console.log("\x1b[41m%s\x1b[0m %s", 'Atencion finalizada fallo:');
        }

        // Confirma la transacción
        await client.query('COMMIT');

        // Verifica si se actualizaron filas
        if (res.rowCount > 0) {
            await limpiarVariables();
            return { success: true, message: "Estado actualizado correctamente." };
        } else {
            return { success: false, message: "No se encontró la tarea para actualizar." };
        }

    } catch (error) {
        if (client) {
            // Revertir la transacción en caso de error
            await client.query('ROLLBACK');
        }
        console.error('Error en actualizarEstado:', error);
        throw error; // Relanza el error para que el llamador lo maneje

    } finally {
        if (client) {
            // Cierra la conexión a la base de datos
            await client.release();
        }
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
          SELECT t.id, t.atencion, t.estado, t.ruta, f.contrato, f.fecha 
          FROM tareas t
          JOIN folder f on t.folder_id=f.id
          WHERE t.eps = $1
            AND t.estado IN (0, 2)
            AND t.ebot_id in (0, $2)
          ORDER BY t.updated_at
          LIMIT 1
          FOR UPDATE;
        `;
        const selectResult = await client.query(sqlSelect, [EPS, NAMEBOT]);

        if (selectResult.rows.length === 0) {
            // No hay filas disponibles, finalizar la transacción
            await client.query('COMMIT');
            return { message: 'No hay tareas disponibles.' };
        }

        const idAtencion = selectResult.rows[0].id;

        // Actualizar la tarea seleccionada
        const sqlUpdate = `
            UPDATE tareas
            SET ebot_id = CASE WHEN id = $2 THEN $1 ELSE 0 END,
                fecha_inicio_ejecucion = CASE WHEN id = $2 THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP,
                linode_id = '${config.LINODE_ID}'
            WHERE id = $2
              AND estado IN (0, 2);
        `;
        await client.query(sqlUpdate, [NAMEBOT, idAtencion]);

        // Confirmar la transacción
        await client.query('COMMIT');

        return selectResult;

    } catch (error) {
        console.error('Error:', error);
        // Intentar hacer rollback en caso de error
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error al hacer rollback:', rollbackError);
        }
        throw error;

    } finally {
        // Liberar la conexión del pool
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                console.error('Error al liberar la conexión:', releaseError);
            }
        }
    }
}


async function liberarAtenciones(id) {
    let client;
    try {
        // Establece la conexión a la base de datos
        client = await pool.connect();

        // Define la consulta y los parámetros
        const sql = `
            UPDATE Tareas 
            SET 
                fecha_inicio_ejecucion = CASE WHEN id = $1 THEN CURRENT_TIMESTAMP ELSE fecha_inicio_ejecucion END, 
                ebot_id = CASE WHEN id = $2 THEN ebot_id ELSE 0 END
            WHERE ebot_id = $3 AND estado IN (0, 2);
        `;
        const params = [id, id, NAMEBOT];

        // Ejecuta la consulta usando el cliente obtenido
        const res = await client.query(sql, params);

        // La consulta se completó correctamente
        console.log("Actualizar fecha:", res);
        return res;
    } catch (err) {
        console.error('Error al actualizar la fecha:', err);
        // Maneja el error según sea necesario
        throw err;
    } finally {
        if (client) {
            // Cierra la conexión a la base de datos
            await client.release();
        }
    }
}
async function obtenerAtencion() {
    console.log("Busco en Base de Datos una Atencion");
    let client;
    try {
        // Obtiene una conexión
        client = await pool.connect();

        // Ejecuta la consulta
        const res = await client.query(`
            SELECT 
                id, atencion, estado, ruta
            FROM tareas 
            WHERE estado IN (0,2) 
            AND ebot_id = $1 
            AND eps = $2
            ORDER BY id DESC 
            LIMIT 1
        `, [NAMEBOT, EPS]);

        // Devuelve los datos recuperados
        return res.rows[0]; // En PostgreSQL, los resultados están en res.rows
    } catch (error) {
        console.error('Error en obtenerAtencion:', error);
        throw error; // Relanza el error para que el llamador lo maneje
    } finally {
        if (client) {
            // Cierra la conexión
            await client.release();
        }
    }
}

async function obtenerSede(contrato) {
    let client;
    try {
        console.log(contrato)
        // Establece la conexión a la base de datos
        client = await pool.connect();

        // Ejecuta la consulta
        const res = await client.query(`
            SELECT s.sucursal, s.sede
            FROM sede_prefijos p 
            JOIN sedes s on s.sede=p.sede
            WHERE p.prefijo= $1
            AND p.eps_id = s.eps_id
            AND s.eps_id=3
            LIMIT 1
        `, [contrato]);

        // Retorna la sede y sucursal si se encuentra, de lo contrario, retorna null
        return res.rows[0] ? res.rows[0] : null;

    } catch (error) {
        console.error('Error en obtenerSede:', error);
        throw error; // Relanza el error para que el llamador lo maneje
    } finally {
        if (client) {
            // Cierra la conexión a la base de datos
            await client.release();
        }
    }
}



async function savePDFDB(filePath, id) {
    console.log("Guardar PDF en el id " + id);
    let client;
    try {
        // Obtener la conexión desde la base de datos
        client = await pool.connect();

        // Leer el archivo PDF
        const data = await fs.readFile(filePath);

        // Ejecutar la consulta
        const sql = `
            UPDATE tareas 
            SET pdf = $1, estado = 1, fecha_fin_ejecucion = CURRENT_TIMESTAMP, externo = 1 
            WHERE id = $2
        `;
        const res = await client.query(sql, [data, id]);

        // Limpia variables o realiza tareas adicionales
        await limpiarVariables();

        console.log('Archivo actualizado con éxito:', res);
        return res;

    } catch (error) {
        console.error('Error al actualizar el archivo:', error);
        throw error;

    } finally {
        // Cierra la conexión
        if (client) await client.release(); // Usa `client.release()` en PostgreSQL
    }
}

async function falloBusqueda(tabBrowser, mensaje, status) {
  const msg = tabBrowser.datos.atencion_text+"  "+mensaje;
  if(tabBrowser.datos.estadoDB == 0)
  {
      await actualizarEstado(tabBrowser.datos.id,2, "");
  }else{
      await actualizarEstado(tabBrowser.datos.id,status, msg);
      await guardarListaErrores(
        tabBrowser.datos.fila,
        tabBrowser.datos.fechaDescarga,
        tabBrowser.datos.contrato,
        tabBrowser.datos.sedeAtencion,
        msg
      );
  }
}

async function convertirFechaDDMMYYYYaISO(fechaOriginal) {
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

async function guardarListaErrores(atencion, fecha, contrato, sede, error) {
  const itemFields = {
    Title: "",
    Atencion: atencion,
    Fecha: await convertirFechaDDMMYYYYaISO(fecha),
    Contrato: contrato,
    Sede: sede,
    Error: error,
  };
  console.log(itemFields);
  try {
    await addItemToList(itemFields, siteId, listId); // Llama a la función para agregar el elemento
    console.log("Elemento agregado a la lista con éxito.");
  } catch (error) {
    console.error("Error al agregar el elemento a la lista:", error);
  }
}

async function limpiarVariables()
{
    id = null;
    atencion = null;
    estado = null;
}

async function getURL(pTipo,pSolicitud,pConsecutivo,pTipide, pNumide,prestador,stLlamadaDesde,stModuloTransLog){
    console.log(pTipo+"|"+pSolicitud+"|"+pConsecutivo+"|"+pTipide+"|"+pNumide+"|"+prestador+"|"+stLlamadaDesde+"|"+stModuloTransLog);
    var res = prestador.split("-");
    var prest = res[0].split(" ");
    let parametros = "";
    if (pTipo == "A"){
  
        var autorizacion = pConsecutivo;
        parametros = "respuestaArchivo=S&consecutivoSolicitud="+pSolicitud+"&"+"consecutivo="+autorizacion+"&"+"tipo="+pTipo+"&tipideAtiende="+prest[0]+"&numideAtiende="+prest[1]+stLlamadaDesde+stModuloTransLog;
        parametros += "&codigoTipoIdentificacion="+pTipide+"&numeroIdePersonaNatural="+pNumide;
        return "https://saludweb-proc.suramericana.com/saludweb-mas/sas/sas-imprimirSolicitudOrdenCobro.do?"+parametros;
      
    }else{
  
        parametros = "consecutivoSolicitud="+pSolicitud+"&"+"consecutivo="+pConsecutivo+"&"+"tipo="+pTipo+"&"+"codigoTipoIdentificacion="+pTipide+"&"+"numeroIdePersonaNatural="+pNumide+"&tipideAtiende="+prest[0]+"&numideAtiende="+prest[1];
        parametros+=stLlamadaDesde+stModuloTransLog;
        return "https://saludweb-proc.suramericana.com/saludweb-mas/sas/sas-imprimirSolicitudOrdenCobro.do?"+parametros;
         
    }
  }

async function delay(tiempo) {
    return new Promise(resolve => setTimeout(resolve, tiempo));
  }

async function closeAllPopups(page) {
    const pages = await browser.pages();
    for (let p of pages) {
        if (p !== page) {
            await p.close();
        }
    }
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
async function recorrerTablaHacerClick(filas, contenido, columna, celda) 
{
  console.log(contenido);
  for (let i = 0; i < filas.length; i++) {
    const contenidoCelda = await filas[i].$eval('td:nth-child(' + columna + ')', td => td.textContent);
    console.log("buscando :"+contenido+" == "+contenidoCelda);        
    if (contenidoCelda === contenido) {
      console.log(contenidoCelda);
      await filas[i].$eval('td:nth-child(' + celda + ') button', button => {
        button.click();
      });
      return true;
    }
  }
  return false;
}
async function parseStringToDateNumber(dateStr)
{
  let day = dateStr.substring(0, 2);
  let month = dateStr.substring(2, 4) - 1; // Restar 1 porque los meses en JS van de 0 a 11
  let year = dateStr.substring(4, 8);

  return new Date(year, month, day);
}

async function parseStringToDateWeb(dateStr)
{
  let parts = dateStr.split('/');
  let day = parts[0];
  let month = parts[1] - 1; // Restar 1 porque los meses en JS van de 0 a 11
  let year = parts[2];
  return new Date(year, month, day);
}

async function waitForFile(filePath, timeout = 10000) { // Timeout en milisegundos (por defecto 10 segundos)
    console.log("Esperando descarga... " + filePath);

    const startTime = Date.now(); // Tiempo en el que se inicia la espera
    
    while (Date.now() - startTime < timeout) { // Continúa mientras no haya pasado el timeout
        try {
            await fs.access(filePath); // Verifica si el archivo existe
            console.log('Archivo encontrado');
            return; // Sale de la función si el archivo se encuentra
        } catch (err) {
            // Si el archivo no existe, espera 1 segundo antes de volver a verificar
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Si el bucle termina y no se ha encontrado el archivo, lanza un error
    //throw new Error(`El archivo no se encontró después de esperar ${timeout / 1000} segundos`);
}

async function agregarErrorArchivo(rutaArchivo, texto) {
    console.log(rutaArchivo);
    
    try {
        // Asegúrate de que el directorio existe, si no, créalo
        const dir = path.dirname(rutaArchivo);
        try {
            await fs.access(dir);
        } catch (err) {
            // El directorio no existe, así que lo creamos
            await fs.mkdir(dir, { recursive: true });
        }

        // Ahora que el directorio existe, intenta añadir o crear el archivo
        try {
            await fs.access(rutaArchivo);
            // El archivo existe, añade el texto
            await fs.appendFile(rutaArchivo, texto + '\n');
            return 'Se ha añadido el texto al archivo correctamente.';
        } catch (err) {
            // El archivo no existe, así que lo creamos y escribimos la línea
            await fs.writeFile(rutaArchivo, texto + '\n', { mode: 0o666 }); // Permisos por defecto
            return 'Se ha creado el archivo y añadido el texto correctamente.';
        }
    } catch (error) {
        console.error('Error al agregar error al archivo:', error);
        throw error; // Relanza el error para que el llamador lo maneje
    }
}
async function formatearFechaConDosDigitos(fechaEntrada) {
   console.log(fechaEntrada);
    
    let fechaDate = parse(fechaEntrada, 'dd/MM/yyyy', new Date());
    console.log(fechaDate);
    
    // Verificar si la fecha de entrada es 29 de febrero
    if (fechaDate.getDate() === 29 && fechaDate.getMonth() === 1) {
        fechaDate.setDate(1);
        fechaDate.setMonth(2); // Marzo es el mes 2 (enero es 0)
    }

    let fechaResultado = subDays(fechaDate, 170);
    console.log(fechaResultado);
    
    // Verificar si la fecha después de restar es 29 de febrero
    if (fechaResultado.getDate() === 29 && fechaResultado.getMonth() === 1) {
        fechaResultado.setDate(1);
        fechaResultado.setMonth(2); // Marzo es el mes 2 (enero es 0)
    }

    const fechaFinalFormateada = format(fechaDate, 'ddMMyyyy');
    const fechaInicialFormateada = format(fechaResultado, 'ddMMyyyy');
    
    console.log(fechaInicialFormateada);
    console.log(fechaFinalFormateada);
    
    return [
        fechaInicialFormateada,
        fechaFinalFormateada
    ];
}



main();
