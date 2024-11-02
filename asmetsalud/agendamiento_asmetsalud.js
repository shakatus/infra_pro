const puppeteer = require('puppeteer');
const getID = require('./iplocal');
const pool = require('./dbConnection');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const { obtenerCredenciales } = require('./credenciales');
const { exec } = require('child_process');
const { getSiteId, getDriveId, uploadFileToSharePoint, addItemToList } = require('./sharepointClient');
const { time } = require('console');
const { timeout } = require('puppeteer');
const config = require('/home/devbots/supervisor/.env/config');

const redVPC = "10.20.30.0";
const eps_id = "6";
const bot_id = "6"
const eps = "AsmetSalud"
let id_bot = isNaN(parseInt(process.argv[2])) ? 1 : parseInt(process.argv[2]);
let identificador = "";

let browser = null;
let page = null;
let driveId = null;
let siteId = null;
let listId = "";


let NIT_Profamilia = "";
//URL_INDEX
//ELEMENTO_LOGIN
const URL_LOGIN ="https://oficinavirtual.asmetsalud.com/#/ov/prestadores";
const URL_LOGIN2 = "https://oficinavirtual.asmetsalud.com/#/ov/prestadores/consultar-estado-afiliacion";
const ELEMENTO_LOGIN = "#mat-tab-label-0-1 > div > mat-icon";

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
    await iniciarSession();
	while(true)
	//if(1==1)
	{		

		let datos = await obtenerDatos();
		if(datos)
		{
            console.log(datos);
			const [dia, mes, año] = String(datos.fecha_agendamiento).split('/');
			const fechaFormateada = `${año}/${mes}/${dia}`;
			const filePath = `/home/devbots/Downloads/Validacion Derechos/${fechaFormateada}/${datos.p_sede}`;
			const fileName = `${datos.p_tipo_documento}_${String(datos.p_numero_documento)}.png`;
            datos.fileName = fileName;
            datos.rutaSharePoint = `Validacion Derechos/${fechaFormateada}/${datos.p_sede}`
			datos.screenshot = `${filePath}/${fileName}`; 
			datos.filePath= filePath;
			await crearCarpeta(filePath);
			await buscarUsuario(datos);
		}
		await delay(500);
	}
}

async function credenciales()
{
    const datos = await obtenerCredenciales(1, eps_id); 
    NIT_Profamilia = datos.find(dato => dato.etiqueta === 'NIT_PROFAMILIA').valor_descifrado;
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
            //elementoexecutablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		    args: [
		        '--window-size=400,300', // Set Chrome window size to 400x300
		        '--no-sandbox'//, // Disable sandbox for compatibility (use with caution)
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
  console.log("_____________________________________________");
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
            (select descripcion_asmet_salud from datos_profamilia WHERE codigo_identificacion=c.p_tipo_documento limit 1) descripcion_documento,
            (select descripcion from datos_profamilia WHERE codigo_identificacion=c.p_tipo_documento limit 1) p_texto_tipo_documento
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
        const selectResult = await client.query(sqlSelect, [eps_id, identificador]);

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

    
    try{
        
        console.log("aceptar cookie");
        await page.waitForSelector("body > app-root > div > app-cookie-consent > div > div.cookies-actions > div:nth-child(1) > button",
            { timeout: 1000 }
        );
        await page.evaluate(() => {
            document.querySelector("body > app-root > div > app-cookie-consent > div > div.cookies-actions > div:nth-child(1) > button").click();     
        });
        await delay(1000);
    }catch(err){
        console.log(err);
    }
    console.log("login");

    await page.waitForSelector("#mat-tab-label-0-1 > div > mat-icon");
    await page.click("#mat-tab-label-0-1 > div > mat-icon");
/*
    const selector_1 = "#mat-tab-content-0-1 > div > div > div > div > mat-card > mat-grid-list > div > mat-grid-tile:nth-child(3) > figure > mat-card > mat-card-actions > button";
    const selector_2 = "#mat-select-0";
    const selectors = [selector_1, selector_2];
    const presentSelector = await waitForAnySelector(page, selectors);
    console.log("selector");
    console.log(presentSelector);
    */
    //#mat-input-2
  //  if(presentSelector == selector_1)
  //  {

        const selector_button = "#mat-tab-content-0-1 > div > div > div > div > mat-card > mat-grid-list > div > mat-grid-tile:nth-child(3) > figure > mat-card > mat-card-actions > button";
        await page.waitForSelector(selector_button);
        await page.click(selector_button);
        console.log("click");
/*
const inputIds = await page.evaluate(() => {
    const container = document.querySelector('body > app-root > div > div > ng-component > div > ng-component > div > div:nth-child(4) > ng-component > div > div > div > div > mat-card > mat-vertical-stepper > div:nth-child(1)');
    const inputs = container.querySelectorAll('[id^="mat-input-"]');
    return Array.from(inputs).map(input => input.id);
});

// Mostrar los IDs completos encontrados
console.log('IDs encontrados:', inputIds)
*/
        await page.waitForSelector("#mat-input-0");
        await page.type("#mat-input-0", NIT_Profamilia);
        await page.waitForSelector("#cdk-step-content-0-0 > div > form > div > button");
        await page.click("#cdk-step-content-0-0 > div > form > div > button");
   // }
}

async function buscarUsuario(datos) {
    await page.evaluate(() => {
        document.querySelector('#cdk-step-label-0-1').click()
    });


    await page.waitForSelector("#mat-select-0");
    console.log("click para buscar usuario");

    while(true)
    {
        await page.evaluate(() => {
            document.querySelector('#mat-select-0').click();
        });
        const element = await page.$('#mat-select-0-panel');
        if(element)
        {
            const option = `#mat-option-${datos.descripcion_documento} > span`;
            console.log(option)
            await page.click(option);
            break;
        }
    }
    console.log("colocando documento usuario "+datos.p_numero_documento);
    await page.click("#mat-input-1"); // Hacer clic en el campo
    await page.keyboard.down('Control'); // Mantener presionada la tecla Control
    await page.keyboard.press('A'); // Presionar la tecla A para seleccionar todo
    await page.keyboard.up('Control'); // Soltar la tecla Control
    await page.keyboard.press('Backspace'); // Eliminar el texto seleccionado
    
    await page.type("#mat-input-1", String(datos.p_numero_documento));
    await delay(5000);



    
    const responsePromise = waitForResponseBody(page);
    await page.evaluate(() => {
        document.querySelector("#cdk-step-content-0-1 > div > form > mat-card-content > div > button").click();
    });
    try {
        const responseBody = await responsePromise;
        console.log('Cuerpo de la respuesta recibido:', responseBody);
    
        if (responseBody.includes('data":[]')) {
            await cargar_prueba(datos);
            await finalizar(datos.id, "No Encontrado", 3, datos);
            return;
        }    
    } catch (error) {
        console.log('Error o Timeout:', error.message);
    }
    console.log("usuario encontrado");
    //await page.waitForSelector("#cdk-step-label-0-1 > div.mat-step-label.mat-step-label-active > div");
    console.log("usuario encontrado");
    await delay(1000);
    const isVisible = await page.evaluate(() => {
        const button = document.querySelector("#cdk-step-content-0-2 > div > div > button:nth-child(1)");
        return button && button.offsetParent !== null; // Verifica que el botón sea visible
    });
    
    if (isVisible) {
        console.log('El botón es visible');       
        while(true)
        {
            try{
                await page.evaluate(() => {
                    document.querySelector("#cdk-step-content-0-2 > div > div > button:nth-child(1)").click();
                });
                await page.waitForSelector('#cdk-step-content-0-3 > div > div > table > tbody', { timeout: 2000});
                break
            }catch(err)
            {
                
            }
            await delay(500);
        }
            
   
        //await page.click("#cdk-step-content-0-2 > div > div > button:nth-child(1)");
    } else {
    console.log('El botón no es visible');
    }

    await delay(500);

    //#cdk-step-content-0-2 > div > div > button.mat-focus-indicator.mat-flat-button.mat-button-base.mat-accent

    // Obtener el valor correspondiente a "Estado de afiliado"
    const estadoAfiliado = await page.evaluate(() => {
      const rows = document.querySelectorAll('#cdk-step-content-0-3 > div > div > table > tbody > tr');
      for (let row of rows) {
        const title = row.querySelector('td.table_tag')?.innerText.trim();
        if (title === 'Estado de afiliado') {
          return row.querySelectorAll('td')[1].innerText.trim();
        }
      }
      return null; // Retorna null si no encuentra el título
    });
  
    console.log('Estado de afiliado:', estadoAfiliado);
    await cargar_prueba(datos);
    if(estadoAfiliado.includes("ACTIVO"))
    {
        await finalizar(datos.id, estadoAfiliado, 1, datos);
    }else{
        await finalizar(datos.id, estadoAfiliado, 2, datos);
    }


    //await browser.close();
    /*
    await page.evaluate(() => {
        document.querySelector("#cdk-step-content-0-2 > div > div > button.mat-focus-indicator.mat-flat-button.mat-button-base.mat-accent").click();
    });
    await delay(500);
    */
        /*
        await page.waitForSelector("#cdk-step-content-0-2 > div > div > button.mat-focus-indicator.mat-flat-button.mat-button-base.mat-accent");
        await page.click("#cdk-step-content-0-2 > div > div > button.mat-focus-indicator.mat-flat-button.mat-button-base.mat-accent");
        
    await page.waitForSelector("#cdk-step-content-0-3 > div > div > table");
*/

   // await page.waitForSelector(`#mat-option-${datos.descripcion_documento} > span`);
   // console.log("colocamos ")
//#cdk-overlay-5
//body > div.cdk-overlay-container
  
}

function waitForResponseBody(page, timeout = 5000) {
    return new Promise((resolve, reject) => {
        let timeoutId = setTimeout(() => {
        reject(new Error('Timeout: no se recibió respuesta dentro del tiempo especificado.'));
        }, timeout);

        page.on('response', async response => {
        try {
            const body = await response.text();
            clearTimeout(timeoutId); // Si se recibe la respuesta, cancela el timeout
            resolve(body); // Resuelve la promesa con el body de la respuesta
        } catch (error) {
            clearTimeout(timeoutId); // Cancela el timeout en caso de error, pero no rechaza
            //reject(error); // Rechaza en caso de error al obtener el body
        }
        });
    });
}

async function cargar_prueba(datos){
    await delay(4000);
    await page.screenshot({ path: String(datos.screenshot), fullPage: true });
    await uploadFileToSharePoint(driveId, datos.rutaSharePoint, datos.screenshot);
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

async function waitForSnackBar(page, timeout = 10000) {
    return new Promise(async (resolve, reject) => {
        const start = Date.now();

        const checkSnackBar = async () => {
        try {
            // Verificar si ha pasado el tiempo límite (timeout)
            if (Date.now() - start > timeout) {
            return reject(new Error('Timeout: El snack-bar no apareció dentro del tiempo límite.'));
            }

            // Verificar si el snack-bar-container es visible
            const result = await page.evaluate(() => {
            const snackBar = document.querySelector('#cdk-overlay-7 > snack-bar-container');
            if (snackBar && snackBar.offsetParent !== null) {
                const spanText = snackBar.querySelector('simple-snack-bar span')?.innerText || '';
                return { visible: true, text: spanText };
            } else {
                return { visible: false, text: '' };
            }
            });

            // Si el snack-bar es visible, resolver la promesa
            if (result.visible) {
            console.log('El snack-bar es visible. Texto:', result.text);
            resolve(result.text); // Resuelve la promesa con el texto
            } else {
            // Volver a verificar después de un pequeño tiempo
            setTimeout(checkSnackBar, 500); // Verifica cada 500ms
            }

        } catch (err) {
            reject(err); // Manejar cualquier error
        }
        };

        checkSnackBar(); // Iniciar la verificación
    });
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