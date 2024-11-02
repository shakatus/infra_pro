const puppeteer = require("puppeteer");
const fs = require("fs");
const fs1 = require("fs").promises;
const fse = require("fs-extra");
const pdfParse = require("pdf-parse");
const path = require("path");
const EventEmitter = require("events");
const util = require("util");
const config = require("/home/devbots/supervisor/.env/config");
const { subDays } = require("date-fns");
const { obtenerCredenciales } = require("./credenciales");
const {
  getSiteId,
  getDriveId,
  uploadFileToSharePoint,
  addItemToList
} = require("./sharepointClient");
const { exec } = require("child_process");

let DOC_LOGIN = "";
let PW_LOGIN = "";
const listId = "2696C1E7-745A-47CD-8DE0-53E5E38D66BE"; 
let siteId = null;

const DIAS_RESTADOS = 29;
//constantes
const EPS = "NuevaEPS";
const EPS_ID = "2";
const URL_BUSQUEDA =
  "https://portal.nuevaeps.com.co/Portal/pages/ips/autorizaciones/reporteAutorizacionesAfiliado.jspx";
const URL_SUCURSAL =
  "https://portal.nuevaeps.com.co/Portal/pages/ips/chooseParameter.jspx";
const URL_LOGIN = "https://portal.nuevaeps.com.co/Portal/home.jspx";
const URL_CONTAIN_LOGIN = "Portal/home.jspx";
const URL_CONTAIN_SUCUR = "ips/chooseParameter";

//const TMPIDTEXT = "id";
const TMPIDTEXT = "id";

const rutaArchivoError = "/registro_errores.txt";
const RUTASFTP = "/var/sftp";
const RUTAVPS = "/home/devbots/botsura";
const RUTADESCARGAR = "/home/devbots/Downdloads";

const SELECT_IPS = "#j_id114\\:ips";
const SELECT_SUCURSAL = "#j_id114\\:sucIps";
const BOTON_CAMBIO_SUCURSAL = "#j_id114\\:acceptButton";
const LINK_SERVICIOS_EN_LINEA = "#j_id81";
const LINK_IPS = "#j_id69 > table > tbody > tr:nth-child(2) > td > a";
const LINK_BUSQUEDA =
  "#option1281 > table > tbody > tr:nth-child(1) > td:nth-child(2) > p > a";
const selectoTableDias =
  "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > div.v-date-picker-table.v-date-picker-table--date.theme--light > table > tbody > tr";
const externo = 1;

/////////////////////////////////////////////////////////////////////limpiar/////////////////////////////////////////////////////////////////////////////////
let browser = null;
let tmpProfilePath = "";
let tmpProfilePathChrome = "";
const cleanUp = () => {
  try {
    browser.close();
  } catch (err) {
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
process.on("SIGINT", async () => {
  console.log("sigint");
  await cleanUp();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.log("sigterm");
  await cleanUp();
  process.exit(0);
});
process.on("exit", async () => {
  console.log("exit");
  await cleanUp();
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
class BotNuevaEPS extends EventEmitter {
  constructor(pool) {
    super();
    this.pool = pool;
    this.nameBot = "";
    this.power = true;
    this.reset = false;
    this.point = 0;
    this.driveId = null;
    this.tabBrowser = {};
    console.log(this.tabBrowser);
    this.on("datos", (mensaje) => {
      console.log('Evento "datos" recibido:', mensaje);
      // Aquí puedes agregar más lógica si lo necesitas
    });
  }

  async salir() {
    try {
      browser.close();
    } catch (err) {}
  }

  async credenciales() {
    const datos = await obtenerCredenciales(1, EPS_ID);
    DOC_LOGIN = datos.find(
      (dato) => dato.etiqueta === "usuario"
    ).valor_descifrado;
    PW_LOGIN = datos.find(
      (dato) => dato.etiqueta === "password"
    ).valor_descifrado;
  }

  async pausa(breakpoint) {
    this.point = breakpoint;
  }

  esperarDatos() {
    return new Promise((resolve, reject) => {
      this.once("datos", resolve);
    });
  }

  async main(index, inicio) {
    this.numBw = inicio;
    console.log("main " + index);
    tmpProfilePath = `/tmp/${inicio}`;
    tmpProfilePathChrome = `/tmp/${inicio}/chrome-profile-${process.pid}`;
    console.log(inicio);
    console.log(index);
    console.log(this.tabBrowser);
    this.nameBot = index;
    await this.credenciales();
    await this.logger(1, 0, "Inicio " + this.nameBot);
    //await this.actualizarBot(1,2,"nuevaeps_"+index);
    siteId = await getSiteId();
    this.driveId = await getDriveId(siteId);
    await this.iniciarBrowser();
    console.log(this.tabBrowser);
    console.log("---");
    await this.iniciarPestaña(index, this.tabBrowser);
    await this.proceso(this.tabBrowser);
    await this.logger(2, 0, "Inicio Browser");
  }

  async formatTimeComponent(value) {
    return value.toString().padStart(2, "0");
  }

  async logger(position, id, message) {
    const now = new Date();
    const hours = await this.formatTimeComponent(now.getHours());
    const minutes = await this.formatTimeComponent(now.getMinutes());
    const seconds = await this.formatTimeComponent(now.getSeconds());
    const formattedTime = `${hours}:${minutes}:${seconds}`;

    console.log(formattedTime + " = " + position + " -> " + id + " " + message);
    if (this.point == position) {
      console.log("PAUSADO");
      while (this.point == position) {
        await this.sleep(1000);
      }
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async iniciarBrowser() {
    // Copia el perfil base al directorio temporal basado en el PID
    await fse.copy(
      "/home/devbots/.config/google-chrome/Profile1",
      tmpProfilePathChrome
    );
    console.log(tmpProfilePathChrome);
    try {
      browser = await puppeteer.launch({
        headless: false, // Show the Chrome browser window
        userDataDir: tmpProfilePathChrome,
        executablePath: "/usr/bin/google-chrome", // Optional: Specify Chrome path
        args: [
          //'--user-data-dir=/home/devbots/.config/google-chrome/Profile'+this.numBw+'/',
          //'--incognito'
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-web-security",
          "--disable-blink-features=AutomationControlled",
          "--password-store=basic", // Deshabilita la advertencia de brecha de seguridad
          "--disable-notifications", // Deshabilita notificaciones
          "--disable-features=PasswordManagerOnboarding", // Desactiva la administración de contraseñas
          "--disable-features=PasswordLeakDetection", // Desactiva la detección de fugas de contraseñas
          "--disable-notifications", // Desactiva todas las notificaciones de Chrome
          "--disable-popup-blocking", // Desactiva el bloqueo de pop-ups
          "--disable-web-security", // Desactiva las verificaciones de seguridad
        ],
        ignoreDefaultArgs: ["--disable-notifications"],
        handleSIGINT: true, // Prevent termination on Ctrl+C (if desired)
      });
    } catch (err) {
      console.log("err");
    }
  }

  async iniciarPestaña(idbot, tabBrowser) {
    console.log(tabBrowser);
    console.log("inicio de pestaña");
    //inicia el navegador

    tabBrowser.nameBot = idbot;
    tabBrowser.datos = {};
    tabBrowser.pdf = "";
    tabBrowser.status = 0;
    tabBrowser.cedulaSize = 1;
    //nueva pestaña
    tabBrowser.page = await browser.newPage();

    tabBrowser.page.on("dialog", async (dialog) => {
      console.log(dialog.message());
      await dialog.dismiss();
    });

    try {
      await tabBrowser.page.goto("https://www.google.com.co/", {
        waitUntil: "load",
        timeout: 50000,
      });
    } catch (err) {}

    await tabBrowser.page.setRequestInterception(true);
    tabBrowser.page.on("request", async (request) => {
      const url = request.url();
      //console.log(url);
      request.continue();
    });

    tabBrowser.client = await tabBrowser.page.target().createCDPSession();

    await tabBrowser.client.send("Network.clearBrowserCookies");
    console.log("Cookies limpiadas");

    // Limpiar el caché del navegador
    await tabBrowser.client.send("Network.clearBrowserCache");
    console.log("Caché limpiada");

    tabBrowser.page.on("framenavigated", async (frame) => {
      /*
        if (frame === tabBrowser.page.mainFrame()) {
          console.log('La página principal ha navegado a la URL:', frame.url());
          const url = frame.url();
          switch (true) {
                      case url.includes(URL_CONTAIN_LOGIN):
                        tabBrowser.status = 2;
                        break;
                      case url.includes(URL_CONTAIN_SUCUR):                     
                        tabBrowser.status = 4;
                        break;
                      case url.includes("/AccionesFacturaMasivas.aspx"):
                        
                        break;
                      default:
                        // Manejar caso por defecto si es necesario
                        break;
                    }
        }
        const isMainFrame = frame.parentFrame() === null; // Verifica si el marco actual es el marco principal
        if (isMainFrame) 
        {      
          await frame.waitForNavigation({ timeout: 0, waitUntil: 'load' });  
          const url = frame.url();
          console.log(url);
          //console.log("verde","URL : "+url);
          // Suponiendo que `url` sea una variable que contiene la URL actual
                    switch (true) {
                      case url.includes(URL_CONTAIN_LOGIN):
                        tabBrowser.status = 2;
                        break;
                      case url.includes(URL_CONTAIN_SUCUR):                     
                        tabBrowser.status = 4;
                        break;
                      case url.includes("/AccionesFacturaMasivas.aspx"):
                        
                        break;
                      default:
                        // Manejar caso por defecto si es necesario
                        break;
                    }
                    //console.log(tabBrowser.status);
        }
        */
    });
    try {
      await tabBrowser.page.goto("https://www.google.com.co/", {
        waitUntil: "load",
        timeout: 50000,
      });
    } catch (err) {}

    console.log("google f");
    return tabBrowser;
  }

  async proceso(tabBrowser) {
    await this.obtenerDatos(tabBrowser);
    await this.login(tabBrowser);
    await this.selecionarSucursal(tabBrowser);
    await this.buscarAfiliado(tabBrowser);
    if (tabBrowser.status == 1) {
      await this.proceso(tabBrowser);
    }
  }

  async obtenerDatos(tabBrowser) {
    await this.logger(3, 0, "Obtener Datos desde la DB");
    tabBrowser.status = 0;
    while (tabBrowser.status == 0) {
      let row = null;
      const resultado = await this.pedirAtencion();
      if (resultado && resultado.rows && resultado.rows.length > 0) {
        row = resultado.rows;
      }
      //row = await this.obtenerAtencion();
      console.log(row);
      if (row !== null && Array.isArray(row) && row.length > 0) {

        const validacion = row[0].atencion.split("|");

        if (validacion.length !== 4) {
          await this.actualizarEstado(row[0].id, 3, "Atencion Incompleta");
          await this.guardarListaErrores(
            row[0].atencion,
            row[0].fecha,
            row[0].contrato,
            "",
            "Atencion Incompleta"
          );
          continue;
        }
        
        if(validacion[3].length<1){
          await this.actualizarEstado(row[0].id, 3, "Sin fecha");
          await this.guardarListaErrores(
            row[0].atencion,
            row[0].fecha,
            row[0].contrato,
            "",
            "Atencion Incompleta"
          );
          continue;
        }


        const primerSegmento = validacion[0].split("_");
        if (primerSegmento.length !== 3) {
          await this.actualizarEstado(row[0].id, 3, "Atencion Incompleta 2");
          await this.guardarListaErrores(
            row[0].atencion,
            row[0].fecha,
            row[0].contrato,
            "",
            "Atencion Incompleta"
          );
          continue;
        }


        tabBrowser.datos.fechaDescarga = row[0].fecha;
        tabBrowser.datos.contrato = row[0].contrato;
        tabBrowser.datos.sedeAtencion = primerSegmento[1];


        console.log("entramos");
        await this.logger(4, row[0].id, "Fila Tomada!");
        await this.colocarFechaInicio(row[0].id);
        const resultado = await this.procesarFila(row);
        //const [fechaInicial, fechaFinal] = this.formatearFechaConDosDigitos(resultado.fecha);
        tabBrowser.datos.fila = row[0].atencion;
        tabBrowser.datos.estadoDB = row[0].estado;
        tabBrowser.datos.id = resultado.id;
        tabBrowser.datos.cedula = resultado.documento;
        tabBrowser.datos.tipoDocumento = resultado.tipoDocumento;
        tabBrowser.datos.fecha = resultado.fecha;
        //tabBrowser.datos.departamento = sede.sucursal;
        //tabBrowser.datos.sede = sede.sede;
        tabBrowser.datos.numeroRadicado = resultado.segundoValor;
        const partes = row[0].ruta.split("/");
        tabBrowser.datos.codigoContrato = partes[partes.length - 1].replace(
          /Contrato_/i,
          ""
        );
        tabBrowser.datos.ruta = row[0].ruta + "/" + resultado.ruta;
        tabBrowser.datos.rutaSharePoint = tabBrowser.datos.ruta;
        const name = await this.removeSecondUnderscore(resultado.ruta);
        tabBrowser.datos.nombreArchivo = "OTR_" + name + ".pdf";
        console.log(tabBrowser.datos.rutaSharePoint);
        console.log(tabBrowser.datos.nombreArchivo);

        tabBrowser.datos.ruta =
          "/home/devbots/Downloads/" + tabBrowser.datos.id;
        tabBrowser.rutaErrores = row[0].ruta + rutaArchivoError;
        if (resultado.segundoValor.length < 2) {
          await this.logger(5, row[0].id, "Error con la atencion");
          tabBrowser.status = 0;
          await this.agregarLineaAArchivo(
            tabBrowser.rutaErrores,
            "No se encuenta " + tabBrowser.datos.fila
          );
          await this.actualizarEstado(
            tabBrowser.datos.id,
            3,
            "No se encuentra"
          );
        } else {
          const isContributivo = await this.esContributivo(
            tabBrowser.datos.codigoContrato
          );
          console.log("regimen");
          console.log(isContributivo);
          const sede = await this.obtenerSede(
            resultado.primerValor[1],
            isContributivo.resultado
          );
          console.log(sede);
          if (!sede) {
            tabBrowser.status = 0;
            await this.agregarLineaAArchivo(
              tabBrowser.rutaErrores,
              "No se encuenta SEDE " + tabBrowser.datos.fila
            );
            await this.actualizarEstado(
              tabBrowser.datos.id,
              3,
              "No se encuentra SEDE"
            );
          } else {
            console.log(sede.regimen_id);
            console.log(sede.valor_id_sede);
            tabBrowser.datos.idSedeActual = sede.regimen_id;
            tabBrowser.datos.selectorSede = sede.valor_id_sede;
            await this.cambiarCarpeta(tabBrowser);
            tabBrowser.status = 1;
          }
        }
      } else {
        await this.delay(5000);
        await this.cambiarEPS();
      }
    }
    if (tabBrowser.page.url().includes("google")) {
      try {
        tabBrowser.status = 2;
        await tabBrowser.page.goto(URL_LOGIN, {
          waitUntil: "load",
          timeout: 50000,
        });
        await tabBrowser.page.waitForSelector("#loginForm\\:tipoId");
      } catch (err) {}
    } else if (
      tabBrowser.page.url().includes("reporteAutorizacionesAfiliado")
    ) {
      tabBrowser.status = 4;
    }
  }

  async cambiarEPS() {
    const client = await this.pool.connect();
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
  
  async removeSecondUnderscore(input) {
    let underscoreIndex = -1;
    let count = 0;

    for (let i = 0; i < input.length; i++) {
      if (input[i] === '_') {
        count++;
        if (count === 2) {
          underscoreIndex = i;
          break;
        }
      }
    }

    if (underscoreIndex !== -1) {
      input = input.slice(0, underscoreIndex) + input.slice(underscoreIndex + 1);
    }

    return input;
  }



  async colocarFechaInicio(id) {
    let client;

    try {
      // Obtener una conexión del pool
      client = await this.pool.connect();

      // Definir la consulta SQL con CASE en lugar de IF
      const sql = `
            UPDATE tareas 
            SET 
                fecha_inicio_ejecucion = CASE WHEN id = $1 THEN CURRENT_TIMESTAMP ELSE fecha_inicio_ejecucion END,
                ebot_id = CASE WHEN id = $2 THEN ebot_id ELSE 0 END
            WHERE ebot_id = $3 AND estado IN (0, 2);
        `;

      // Ejecutar la consulta
      const result = await client.query(sql, [id, id, this.nameBot]);

      console.log("Fecha actualizada:", result);
      return result;
    } catch (error) {
      console.error("Error al colocar la fecha de inicio:", error);
      throw error; // Re-lanza el error para que pueda ser manejado por el llamador
    } finally {
      // Asegúrate de liberar la conexión
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error("Error al liberar la conexión:", releaseError);
        }
      }
    }
  }

  async esContributivo(codigoContrato) {
    let client;

    try {
      // Obtener una conexión del pool
      client = await this.pool.connect();

      // Definir la consulta SQL
      const sql = `
            SELECT 
                CASE WHEN descripcion LIKE '%CONTRIBUTIVO%' THEN 1 ELSE 0 END AS resultado 
            FROM 
                Contratos 
            WHERE 
                $1 LIKE codigo_contrato || '%'
        `;
      console.log(sql);
      console.log(codigoContrato);

      // Ejecutar la consulta
      const res = await client.query(sql, [codigoContrato]);

      // Procesar el resultado
      return res.rows[0]; // Devuelve los datos recuperados
    } catch (error) {
      console.error("Error en esContributivo:", error);
      throw error; // Re-lanza el error para que pueda ser manejado por el llamador
    } finally {
      // Asegúrate de liberar la conexión
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error("Error al liberar la conexión:", releaseError);
        }
      }
    }
  }

  async log(msg) {
    const timestamp = new Date().toISOString().slice(0, 10); // Obtiene la fecha actual en formato "YYYY-MM-DD"
    const errorMessage = `[${new Date()}] ${msg}\n`;

    const logFileName = `error_${timestamp}.log`; // Nombre del archivo con la fecha actual

    fs.appendFile(path.join(__dirname, logFileName), errorMessage, (err) => {
      if (err) {
        console.error(
          "Error al escribir en el archivo de registro de errores:",
          err
        );
      }
    });
  }

  async obtenerSede(prefijo, isContributivo) {
    let client;

    try {
      // Obtener una conexión del pool
      client = await this.pool.connect();

      // Definir la consulta SQL
      let sql = "";
      if (isContributivo) {
        sql = `
                SELECT s.valor_id_sede, s.regimen_id
                FROM sede_prefijos p 
                JOIN sedes s on p.contributivo_id = s.regimen_id
                AND s.eps_id=p.eps_id AND s.eps_id=2
                AND p.prefijo= $1;
            `;
      } else {
        sql = `
                SELECT s.valor_id_sede, s.regimen_id
                FROM sede_prefijos p 
                JOIN sedes s on p.subsidiado_id = s.regimen_id
                AND s.eps_id=p.eps_id AND s.eps_id=2
                AND p.prefijo= $1;
            `;
      }
      console.log(sql);
      console.log(prefijo);

      // Ejecutar la consulta
      const res = await client.query(sql, [prefijo]);

      // Procesar los resultados de la consulta
      return res.rows[0] || null; // Devuelve los datos recuperados, o null si no hay resultados
    } catch (error) {
      console.error("Error en obtenerSede:", error);
      throw error; // Re-lanza el error para que pueda ser manejado por el llamador
    } finally {
      // Asegúrate de liberar la conexión
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error("Error al liberar la conexión:", releaseError);
        }
      }
    }
  }

  async procesarFila(row) {
    var partes = row[0].atencion.split("|");

    var primerValor = partes[0].split("_");
    var segundoValor = partes[1];
    var tercerValor = partes[2].split("-");
    var cuartoValor = partes[3];
    return {
      ruta: partes[0],
      primerValor: primerValor,
      segundoValor: segundoValor,
      tipoDocumento: tercerValor[0],
      documento: tercerValor[1],
      fecha: cuartoValor,
      id: row[0].id,
    };
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async savePDFDB(filePath, id) {
    let client;

    try {
      // Obtener la conexión desde el pool
      client = await this.pool.connect();

      // Leer el archivo PDF
      const data = await fs1.readFile(filePath);

      // Ejecutar la consulta
      const sql = `
      UPDATE tareas 
      SET pdf = $1, estado = 1, fecha_fin_ejecucion = CURRENT_TIMESTAMP, externo = 1 
      WHERE id = $2
    `;
      const result = await client.query(sql, [data, id]);

      console.log("Archivo actualizado con éxito:", result);
      return result;
    } catch (error) {
      console.error("Error al actualizar el archivo:", error);
      throw error;
    } finally {
      // Liberar la conexión
      if (client) client.release();
    }
  }

  async findWordInPdf(pdfPath, word) {
    this.console_log(0, "lectura PDF " + pdfPath);
    try {
      // Leer el archivo PDF
      const dataBuffer = fs.readFileSync(pdfPath);

      // Parsear el contenido del PDF
      const data = await pdfParse(dataBuffer);

      // Convertir el contenido a minúsculas para una búsqueda case-insensitive
      const text = data.text.toLowerCase();
      this.console_log(0, text);
      /*
        const searchWord = word.toLowerCase();
        // Buscar la palabra en el texto extraído
        if (text.includes(searchWord)) {
            this.console_log(0,`La palabra "${word}" fue encontrada en el PDF.`);
        } else {
            this.console_log(0,`La palabra "${word}" no se encontró en el PDF.`);
        }
        */
    } catch (err) {
      this.console_log(0, "Error al procesar el PDF:" + err);
    }
  }

  async finalizarProceso(rutaDirectorio, nombreArchivo, id, tabBrowser) {
    await this.logger(22, tabBrowser.datos.id, "Final del proceso");
    const resultado = await this.verificarArchivo(
      rutaDirectorio,
      nombreArchivo
    );
    if (resultado) {
      //await this.actualizarEstado(id,1,"ok");
      const downloadPath = path.join(rutaDirectorio, nombreArchivo);
      await this.findWordInPdf(downloadPath, "documento : 1087560457");
      //await this.savePDFDB(downloadPath, tabBrowser.datos.id);
      await this.sendPDFtoShare(downloadPath, tabBrowser);
      let resultadoFinal = false;
      try {
        /*
                    clic en boton cancelar


                */
        // Eliminar el archivo original
        await fs1.rm(rutaDirectorio, { recursive: true, force: true });
        this.console_log(0, "Archivo original eliminado " + rutaDirectorio);
      } catch (err) {
        this.console_log(0, "Error al manejar el archivo:" + err);
        // Manejar error en la copia o eliminación del archivo
        await this.falloBusqueda("error con archivo", 3);
      }
    } else {
      await this.falloBusqueda(tabBrowser, "No se puede imprimir ", 3);
    }
  }

  async verificarArchivo(rutaDirectorio, nombreArchivo) {
    const rutaArchivo = path.join(rutaDirectorio, nombreArchivo);
    const tiempoMaximoEspera = 60 * 1000;
    const inicioTiempo = Date.now();
    while (!fs.existsSync(rutaArchivo)) {
      await this.delay(500); // Espera 500 milisegundos antes de verificar nuevamente
      if (Date.now() - inicioTiempo > tiempoMaximoEspera) {
        console.log("TIEMPO DE ESPERA AGOTADO para el archivo:", rutaArchivo);
        return false;
      }
    }
    //await this.renombrarArchivo(rutaDirectorio,nombreArchivo,NOMBRE_ARCHIVO);
    return true;
  }

  async renombrarArchivo(rutaDirectorio, nombreArchivo, nuevoNombreArchivo) {
    // Construir las rutas completas del archivo original y del nuevo nombre
    const rutaArchivoOriginal = path.join(rutaDirectorio, nombreArchivo);
    const rutaArchivoNuevo = path.join(rutaDirectorio, nuevoNombreArchivo);

    try {
      // Renombrar el archivo
      await fs.promises.rename(rutaArchivoOriginal, rutaArchivoNuevo);
      console.log("El archivo se ha renombrado correctamente.");
      return true;
    } catch (error) {
      console.error("Error al renombrar el archivo:", error);
      return false;
    }
  }

  async actualizarEstado(idAtencion, estado, msg) {
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
      client = await this.pool.connect();

      // Inicia la transacción
      await client.query("BEGIN");

      // Prepara la consulta SQL
      const sql = `
            UPDATE Tareas 
            SET estado = $1, fecha_fin_ejecucion = CURRENT_TIMESTAMP, observaciones = $2 ${actualizarFechaInicio}
            WHERE id = $3
        `;

      // Ejecuta la consulta
      const res = await client.query(sql, [estado, msg, idAtencion]);
      console.log(sql, estado, idAtencion)
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
        console.log("\x1b[41m%s\x1b[0m %s", "Atencion finalizada fallo:");
      }

      // Confirma la transacción
      await client.query("COMMIT");

      // Verifica si se actualizaron filas
      if (res.rowCount > 0) {
        //await limpiarVariables();
        return { success: true, message: "Estado actualizado correctamente." };
      } else {
        return {
          success: false,
          message: "No se encontró la tarea para actualizar.",
        };
      }
    } catch (error) {
      if (client) {
        // Revertir la transacción en caso de error
        await client.query("ROLLBACK");
      }
      console.error("Error en actualizarEstado:", error);
      throw error; // Relanza el error para que el llamador lo maneje
    } finally {
      if (client) {
        // Cierra la conexión a la base de datos
        await client.release();
      }
    }
  }


  async convertirFechaDDMMYYYYaISO(fechaOriginal) {
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

  async guardarListaErrores(atencion, fecha, contrato, sede, error) {
    const itemFields = {
      Title: "",
      Atencion: atencion,
      Fecha: await this.convertirFechaDDMMYYYYaISO(fecha),
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

  async finalizarTareaExitosamente(id) {
    const client = await this.pool.connect();

    try {
      // Iniciar transacción
      await client.query("BEGIN");

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
      await client.query("COMMIT");

      console.log(
        "\x1b[44m%s\x1b[0m",
        "Archivo actualizado con éxito:",
        result
      );
      return result;
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

  async renameFile(filePath, newFileName) {
    const directory = path.dirname(filePath); // Obtiene la ruta del directorio
    const newPath = path.join(directory, newFileName); // Combina el directorio con el nuevo nombre

    try {
      await fs1.rename(filePath, newPath);
      console.log(`Archivo renombrado a: ${newFileName}`);
      return newPath; // Retorna la ruta completa del archivo renombrado
    } catch (err) {
      console.error("Error al renombrar el archivo:", err);
      throw err; // Lanza el error para manejarlo fuera si es necesario
    }
  }

  async sendPDFtoShare(pdf, tabBrowser) {
    console.log(tabBrowser.datos);
    const updatedPath = await this.renameFile(
      pdf,
      tabBrowser.datos.nombreArchivo
    );
    await uploadFileToSharePoint(
      this.driveId,
      tabBrowser.datos.rutaSharePoint,
      updatedPath
    );
    await this.finalizarTareaExitosamente(tabBrowser.datos.id);
  }

  async verificarMoverArchivo(
    directorioOrigen,
    directorioDestino,
    nombreArchivo,
    id
  ) {
    const rutaArchivo = path.join(directorioOrigen, nombreArchivo);
    const rutaDestino = path.join(directorioDestino, nombreArchivo);

    // Esperar a que el archivo esté presente
    const inicioTiempo = Date.now();

    while (!fs.existsSync(rutaArchivo)) {
      await this.delay(500); // Espera 500 milisegundos antes de verificar nuevamente
      if (Date.now() - inicioTiempo > tiempoMaximoEspera) {
        console.log("TIEMPO DE ESPERA AGOTADO para el archivo:", rutaArchivo);
        return false;
      }
    }

    // Si llegamos aquí, el archivo está presente. Intentar moverlo al directorio de destino.
    try {
      await this.moverArchivo(rutaArchivo, rutaDestino);
      console.log("Archivo movido correctamente:", rutaDestino);
      return true;
    } catch (error) {
      console.error("Error al mover el archivo:", error);
      return false;
    }
  }

  async moverArchivo(rutaOrigen, rutaDestino) {
    return util.promisify(fs.rename)(rutaOrigen, rutaDestino);
  }

  async login(tabBrowser) {
    console.log("login " + tabBrowser.status);
    if (tabBrowser.status == 2) {
      while (true) {
        await this.logger(7, tabBrowser.datos.id, "Inicio del Login");
        while (true) {
          await tabBrowser.page.select("#loginForm\\:tipoId", "3");
          const selectValue = await tabBrowser.page.$eval(
            "#loginForm\\:tipoId",
            (select) => select.value
          );
          if (selectValue === "3") {
            break;
          }
        }
        while (true) {
          await tabBrowser.page.$eval(
            "#loginForm\\:id",
            (input, value) => (input.value = value),
            DOC_LOGIN
          );
          // Verificar que el valor del input sea "10"
          const inputValue = await tabBrowser.page.$eval(
            "#loginForm\\:id",
            (input) => input.value
          );
          if (inputValue === DOC_LOGIN) {
            break;
          }
        }
        while (true) {
          await tabBrowser.page.$eval(
            "#loginForm\\:clave",
            (input, value) => (input.value = value),
            PW_LOGIN
          );
          // Verificar que el valor del input sea "10"
          const inputValue = await tabBrowser.page.$eval(
            "#loginForm\\:clave",
            (input) => input.value
          );
          if (inputValue === PW_LOGIN) {
            break;
          }
        }
        await this.logger(8, tabBrowser.datos.id, "Click Login");
        await tabBrowser.page.click("#loginForm\\:loginButton");

        try {
          await tabBrowser.page.waitForNavigation({
            waitUntil: "networkidle2",
          });
        } catch (err) {
          console.log(err);
        }

        const selectors = {
          selector1: {
            promise: tabBrowser.page
              .waitForSelector(LINK_SERVICIOS_EN_LINEA, { timeout: 50000 })
              .then(() => "selector1"),
            id: "selector1",
          },
          selector2: {
            promise: tabBrowser.page
              .waitForSelector(
                "#publico > table > tbody > tr:nth-child(2) > td > div:nth-child(1) > span",
                { timeout: 50000 }
              )
              .then(() => "selector2"),
            id: "selector2",
          },
        };

        const firstFound = await Promise.race(
          Object.values(selectors).map((selector) => selector.promise)
        );

        // Determine which selector was found first
        const foundSelectorId = Object.keys(selectors).find(
          (key) => selectors[key].id === firstFound
        );

        console.log("El selector encontrado primero es:", foundSelectorId);

        // Realiza acciones específicas basadas en el selector encontrado
        if (foundSelectorId === "selector1") {
          console.log("inicio de session correcto");
          break;
          // Realiza operaciones específicas para selector1
        } else if (foundSelectorId === "selector2") {
          const spanContent = await tabBrowser.page.evaluate(() => {
            return document.querySelector(
              "#publico > table > tbody > tr:nth-child(2) > td > div:nth-child(1) > span"
            ).textContent;
          });
          console.log("error " + spanContent);
          try {
            await tabBrowser.page.goto(URL_LOGIN, {
              waitUntil: "load",
              timeout: 50000,
            });
          } catch (err) {
            console.log(err);
          }
          // Realiza operaciones específicas para selector2
        }
        await this.delay(1000);
      }

      console.log("salimos del login");

      await tabBrowser.page.waitForSelector(LINK_SERVICIOS_EN_LINEA);
      console.log("damos click en servicios");
      await tabBrowser.page.click(LINK_SERVICIOS_EN_LINEA);
      await tabBrowser.page.waitForSelector(LINK_IPS, { timeout: 300000 });
      console.log("damos clic en seleccionar ips");
      await tabBrowser.page.click(LINK_IPS);
      try {
        await tabBrowser.page.waitForSelector(SELECT_IPS);
      } catch (err) {}
      //await tabBrowser.page.goto(URL_SUCURSAL, { waitUntil: 'load', timeout: 50000 });
      tabBrowser.status = 4;
    }
  }

  async selecionarSucursal(tabBrowser) {
    if (tabBrowser.status == 4) {
      const sucursalDiferente = await this.verificarCambioSucursal(tabBrowser);
      if (sucursalDiferente) {
        await this.cambiarSucursal(tabBrowser);
      }
      tabBrowser.status = 5;
    }
  }

  async verificarCambioSucursal(tabBrowser) {
    console.log(tabBrowser.datos.idSedeActual);
    console.log(tabBrowser.datos.idSedeAnterior);
    console.log(
      "-----------------------------------------------------------------"
    );
    if (tabBrowser.datos.idSedeActual != tabBrowser.datos.idSedeAnterior) {
      tabBrowser.datos.idSedeAnterior = tabBrowser.datos.idSedeActual;
      await this.logger(9, tabBrowser.datos.id, "Cambiar de Sede");
      return true;
    } else {
      await this.logger(10, tabBrowser.datos.id, "Mantener misma sede");
      return false;
    }
  }

  async cambiarSucursal(tabBrowser) {
    if (!tabBrowser.page.url().includes("ips/chooseParamete")) {
      console.log("esperando selector " + LINK_IPS);
      await tabBrowser.page.waitForSelector(LINK_IPS, { timeout: 300000 });
      await tabBrowser.page.click(LINK_IPS);
      try {
        await tabBrowser.page.waitForNavigation({ waitUntil: "networkidle0" });
      } catch (err) {}
    }
    try {
      await tabBrowser.page.waitForSelector(SELECT_IPS);
    } catch (err) {
      console.log(err);
      await tabBrowser.page.reload();
      await tabBrowser.page.waitForSelector(SELECT_IPS);
    }

    while (true) {
      await tabBrowser.page.select(SELECT_IPS, "4;860013779;3733"); //acaError
      const selectValue = await tabBrowser.page.$eval(
        SELECT_IPS,
        (select) => select.value
      );
      if (selectValue === "4;860013779;3733") {
        break;
      }
    }

    while (true) {
      console.log(SELECT_SUCURSAL);
      console.log(tabBrowser.datos.selectorSede);
      await tabBrowser.page.select(
        SELECT_SUCURSAL,
        tabBrowser.datos.selectorSede
      );
      const selectValue = await tabBrowser.page.$eval(
        SELECT_SUCURSAL,
        (select) => select.value
      );
      if (selectValue === tabBrowser.datos.selectorSede) {
        break;
      }
    }
    await this.logger(11, tabBrowser.datos.id, "Click Cambio de Sucursal");
    await tabBrowser.page.click(BOTON_CAMBIO_SUCURSAL);
    try {
      await tabBrowser.page.waitForNavigation({ waitUntil: "networkidle0" });
    } catch (err) {}
    //await tabBrowser.page.click(LINK_BUSQUEDA);
    //await this.hacerClicEnEnlace(tabBrowser.page,LINK_BUSQUEDA);
    const link = await tabBrowser.page.$(LINK_BUSQUEDA); // Selecciona el enlace usando un selector CSS
    const url = await tabBrowser.page.evaluate((link) => link.href, link); // Extrae la URL del atributo href del enlace
    console.log("URL del enlace:", url);
    await tabBrowser.page.goto(url, { waitUntil: "load", timeout: 50000 });
    //await tabBrowser.page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    console.log("fin de la carga");
  }

  async pedirAtencion() {
    let client;

    try {
      // Obtener una conexión del pool
      client = await this.pool.connect();

      // Iniciar la transacción
      await client.query("BEGIN");

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
      const selectResult = await client.query(sqlSelect, [EPS, this.nameBot]);

      if (selectResult.rows.length === 0) {
        // No hay filas disponibles, finalizar la transacción
        await client.query("COMMIT");
        return { message: "No hay tareas disponibles." };
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
      await client.query(sqlUpdate, [this.nameBot, idAtencion]);

      // Confirmar la transacción
      await client.query("COMMIT");

      return selectResult;
    } catch (error) {
      console.error("Error:", error);
      // Intentar hacer rollback en caso de error
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Error al hacer rollback:", rollbackError);
      }
      throw error;
    } finally {
      // Liberar la conexión del pool
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error("Error al liberar la conexión:", releaseError);
        }
      }
    }
  }

  async obtenerAtencion() {
    try {
      // Definir la consulta SQL
      const sql = `
            SELECT * 
            FROM tareas 
            WHERE estado IN (0, 2) 
              AND ebot_id = $1 
              AND eps = $2 
            ORDER BY id DESC 
            LIMIT 1
        `;
      // console.log('Consulta SQL:', sql);
      // console.log('Valores:', [this.nameBot, EPS]);

      // Ejecutar la consulta usando el pool (sin necesidad de obtener y liberar manualmente la conexión)
      const result = await this.pool.query(sql, [this.nameBot, EPS]);

      // console.log('Resultado de la consulta:', result.rows);
      return result.rows; // Devuelve el primer resultado
    } catch (error) {
      console.error("Error al obtener la atención:", error);
      throw error; // Re-lanza el error para que pueda ser manejado por el llamador
    }
  }

  async console_log(estado, msg) {
    console.log(msg);
  }

  async buscarAfiliado(tabBrowser) {
    if (tabBrowser.status == 1) {
      return;
    }

    /*
    await this.logger(12, tabBrowser.datos.id, "Esperando IFRAME");
    const iframe = await tabBrowser.page.waitForSelector("iframe#ifAuto", {
      timeout: 300000,
    });
    const iframeContent = await iframe.contentFrame();

    //limpiardatos

    await iframeContent.click("#tipoIdentificacion");

    await this.logger(13, tabBrowser.datos.id, "Seleccion Tipo Identificacion");

    while (true) {
      const isDisabled = await iframeContent.evaluate(() => {
        const input = document.querySelector("#numeroIdAfiliado"); // Selecciona el input que quieres verificar
        return input.disabled; // Retorna true si el input está deshabilitado
      });
      console.log("input disabled " + isDisabled);
      if (isDisabled) {
        this.clickButton(
          iframeContent,
          "#app > div > main > div > div > div > div > div > div > div.v-card__text > div.row.py-2 > div > button:nth-child(2)"
        );
      } else {
        break;
      }
    }

    let valorPrevio = "";
    let direccion = "ArrowDown";
    while (true) {
      await tabBrowser.page.keyboard.press(direccion);
      await tabBrowser.page.keyboard.press("Enter");
      await this.delay(100);
      const valor = await this.obtenerValorInput(
        iframeContent,
        "#tipoIdentificacion"
      );
      console.log(valor + " = " + tabBrowser.datos.tipoDocumento);
      if (valor == tabBrowser.datos.tipoDocumento) {
        break;
      }
      if (valor == valorPrevio) {
        direccion = direccion == "ArrowDown" ? "ArrowUp" : "ArrowDown";
      } else {
        valorPrevio = valor;
      }
      await tabBrowser.page.keyboard.press(direccion);
    }
    await this.logger(14, tabBrowser.datos.id, "Digitar Documento");
    while (true) {
      await iframeContent.click("#numeroIdAfiliado");
      const valorActual = await iframeContent.$eval(
        "#numeroIdAfiliado",
        (el) => el.value
      );
      if (valorActual.length > 0) {
        for (let i = 0; i < valorActual.length; i++) {
          await tabBrowser.page.keyboard.press("Backspace");
        }
      }
      await iframeContent.type("#numeroIdAfiliado", tabBrowser.datos.cedula);
      const valorNumeroIdAfiliado = await iframeContent.$eval(
        "#numeroIdAfiliado",
        (el) => el.value
      );
      if (valorNumeroIdAfiliado == tabBrowser.datos.cedula) {
        break;
      }
    }
*/
    //const { dia, mesAnio } = await this.formatearFecha("22/03/2024");
    let intentos = 0;
    let diasRestados = 0;
    if (tabBrowser.datos.estadoDB == 2) {
      diasRestados = 29;
    }
    while (true) {
      await tabBrowser.page.reload();
      console.log(tabBrowser.datos.fecha + " -- " + diasRestados);
      const { fechaFinal, fechaInicial } = await this.formatearFecha(
        tabBrowser.datos.fecha,
        diasRestados
      );
      await this.delay(500);
      await this.logger(
        15,
        tabBrowser.datos.id,
        "Fecha Inicial " +
          fechaInicial.mes +
          ":" +
          fechaInicial.dia +
          " Fecha Final " +
          fechaFinal.mes +
          ":" +
          fechaFinal.dia
      );

      const iframe = await tabBrowser.page.waitForSelector("iframe#ifAuto", {
        timeout: 300000,
      });
      const iframeContent = await iframe.contentFrame();

      ////////////////////////////////////////////////////////////////////////////COLOCAMOS TIPO DE IDENTIFICACION////////////////////////////////////////////////////////////////////////////////////////
      await iframeContent.click("#tipoIdentificacion");
      const valueToSelect = tabBrowser.datos.tipoDocumento;
      console.log(valueToSelect);
      await iframeContent.evaluate((valueToSelect) => {
        // Encuentra el contenedor del menú desplegable
        const dropdownElement = document.querySelector(
          ".v-menu__content.theme--light.menuable__content__active.v-autocomplete__content"
        );

        // Verifica si el menú desplegable se ha encontrado
        if (dropdownElement) {
          // Encuentra todas las opciones del menú desplegable
          const options = dropdownElement.querySelectorAll(".v-list-item");

          // Itera sobre las opciones y selecciona la que coincide con el valor deseado
          let optionFound = false;
          options.forEach((option) => {
            const optionText = option
              .querySelector(".v-list-item__title")
              .textContent.trim();
            if (optionText === valueToSelect) {
              // Simula un clic en la opción encontrada
              option.click();
              optionFound = true;
              console.log("Valor seleccionado exitosamente:", valueToSelect);
            }
          });

          if (!optionFound) {
            console.error(
              "No se encontró la opción con el valor especificado:",
              valueToSelect
            );
          }
        } else {
          console.error(
            "No se pudo encontrar el menú desplegable del v-select."
          );
        }
      }, valueToSelect);
      ///////////////////////////////////////////////////////////////////////////////FECHA INICIAL//////////////////////////////////////////////////////////////////////////

      const year_inicial = fechaInicial.año;
      const month_inicial = fechaInicial.mesNumero; // Agosto (recordando que el índice es de 0 a 11, entonces 7 es agosto)
      const day_inicial = fechaInicial.dia;

      console.log(year_inicial, month_inicial, day_inicial);
      console.log("vamos a colocar la fecha inicial");

      await iframeContent.click("#fechaInicial");
      await iframeContent.evaluate(
        (year_inicial, month_inicial, day_inicial) => {
          // Selecciona el nuevo elemento del DatePicker
          //#app > div.v-menu__content.theme--light.menuable__content__active > div
          //#app > div.v-menu__content.theme--light.menuable__content__active
          //#app > div:nth-child(2)
          const datePickerElement = document.querySelector(
            "#app > div.v-menu__content.theme--light.menuable__content__active > div"
          );

          // Verifica si se ha encontrado el elemento
          if (datePickerElement) {
            // Obtén la instancia Vue del elemento
            const vueInstance = datePickerElement.__vue__;

            // Verifica si existe la instancia Vue
            if (vueInstance) {
              console.log("Instancia Vue encontrada:", vueInstance);

              // Establecemos el año, mes y día deseados
              vueInstance.inputYear = year_inicial; // Año pasado como parámetro
              vueInstance.inputMonth = month_inicial; // Mes pasado como parámetro (de 0 a 11)
              vueInstance.inputDay = day_inicial; // Día pasado como parámetro

              // Formateamos la fecha para emitir el valor correctamente
              const formattedDate = `${vueInstance.inputYear}-${(
                vueInstance.inputMonth + 1
              )
                .toString()
                .padStart(2, "0")}-${vueInstance.inputDay
                .toString()
                .padStart(2, "0")}`;

              // Emitimos el evento 'input' para actualizar el valor del componente
              vueInstance.$emit("input", formattedDate);

              // Verificamos que el cambio haya sido aplicado
              console.log("Fecha establecida exitosamente:", formattedDate);
            } else {
              console.error(
                "No se pudo acceder a la instancia Vue desde este elemento."
              );
            }
          } else {
            console.error(
              "No se pudo encontrar el elemento DatePicker con el selector proporcionado."
            );
          }
        },
        year_inicial,
        month_inicial,
        day_inicial
      );
      console.log("ok");

      //////////////////////////////////////////////////////////////////////////////////////////////////FECHA FINAL//////////////////////////////////////////////////////////////////
      const year_final = fechaFinal.año;
      const month_final = fechaFinal.mesNumero; // Agosto (recordando que el índice es de 0 a 11, entonces 7 es agosto)
      const day_final = fechaFinal.dia;
      await this.delay(500);
      await iframeContent.click("#fechaFinal");
      await iframeContent.evaluate(
        (year_final, month_final, day_final) => {
          // Selecciona el nuevo elemento del DatePicker
          //#app > div.v-menu__content.theme--light.menuable__content__active > div
          //#app > div.v-menu__content.theme--light.menuable__content__active
          //#app > div:nth-child(2)
          const datePickerElement = document.querySelector(
            "#app > div.v-menu__content.theme--light.menuable__content__active > div"
          );

          // Verifica si se ha encontrado el elemento
          if (datePickerElement) {
            // Obtén la instancia Vue del elemento
            const vueInstance = datePickerElement.__vue__;

            // Verifica si existe la instancia Vue
            if (vueInstance) {
              console.log("Instancia Vue encontrada:", vueInstance);

              // Establecemos el año, mes y día deseados
              vueInstance.inputYear = year_final; // Año pasado como parámetro
              vueInstance.inputMonth = month_final; // Mes pasado como parámetro (de 0 a 11)
              vueInstance.inputDay = day_final; // Día pasado como parámetro

              // Formateamos la fecha para emitir el valor correctamente
              const formattedDate = `${vueInstance.inputYear}-${(
                vueInstance.inputMonth + 1
              )
                .toString()
                .padStart(2, "0")}-${vueInstance.inputDay
                .toString()
                .padStart(2, "0")}`;

              // Emitimos el evento 'input' para actualizar el valor del componente
              vueInstance.$emit("input", formattedDate);

              // Verificamos que el cambio haya sido aplicado
              console.log("Fecha establecida exitosamente:", formattedDate);
            } else {
              console.error(
                "No se pudo acceder a la instancia Vue desde este elemento."
              );
            }
          } else {
            console.error(
              "No se pudo encontrar el elemento DatePicker con el selector proporcionado."
            );
          }
        },
        year_final,
        month_final,
        day_final
      );
      //////////////////////////////////////////////////////////////////////////////////////////PROMESA DE REQUEST////////////////////////////////////////////////////////////////
      const responsePromise = new Promise((resolve, reject) => {
        tabBrowser.page.on("response", async (response) => {
          //console.log(response.url());
          if (
            response
              .url()
              .includes(
                "portal.nuevaeps.com.co/report_portal/v1/api/autorizaciones/consultarAutorizacionXAfiliado"
              )
          ) {
            try {
              const responseBody = await response.json(); // O usa text() si no es JSON
              resolve(responseBody);
            } catch (error) {
              resolve(null);
            }
          }
        });
      });
      //////////////////////////////////////////////////////////////////////////////////////COLOCAR DOCUMENTO////////////////////////////////////////////////////////////////////////
      await this.logger(14, tabBrowser.datos.id, "Digitar Documento");
      //tabBrowser.datos.cedula = "1022962583";
      while (true) {
        console.log("colocando el documento")
        await iframeContent.click("#numeroIdAfiliado");
        const valorActual = await iframeContent.$eval(
          "#numeroIdAfiliado",
          (el) => el.value
        );
        if (valorActual.length > 0) {
          for (let i = 0; i < valorActual.length; i++) {
            await tabBrowser.page.keyboard.press("Backspace");
          }
        }
        await iframeContent.type("#numeroIdAfiliado", tabBrowser.datos.cedula);
        const valorNumeroIdAfiliado = await iframeContent.$eval(
          "#numeroIdAfiliado",
          (el) => el.value
        );
        if (valorNumeroIdAfiliado == tabBrowser.datos.cedula) {
          break;
        }
        await this.delay(100);
      }
      await this.delay(500);

      ///////////////////////////////////////////////////////////////////////////////CLICK EN BUSCAR/////////////////////////////////////////////////////////////////////////////
      const buttonBuscarAtencion =
        "#app > div > main > div > div > div > div > div > div > div.v-card__text > div.row.py-2 > div > button:nth-child(1)";

      await this.clickButton(iframeContent, buttonBuscarAtencion);
      //////////////////////////////////////////////////////////////////////////////RESPUESTA PROMESA DE CONSULTA///////////////////////////////////////////////////////////////
      try {
        const responseData = await responsePromise;
        console.log("Respuesta de la solicitud:", responseData);
      } catch (error) {
        console.error("Error al obtener la respuesta:", error);
      }

      /*
      while (true) {
        await iframeContent.click("#fechaInicial");

        const ulExists = await iframeContent.evaluate((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            return element.querySelector("ul") !== null;
          }
          return false;
        }, "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div");
        if (ulExists) {
          console.log("Calendario en modo año");
          await iframeContent.waitForSelector(
            "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > ul > li:nth-child(1)",
            { visible: true }
          );

          await iframeContent.evaluate(() => {
            const element = document.querySelector(
              "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > ul > li:nth-child(1)"
            );
            element.scrollIntoView();
          });
          await iframeContent.click(
            "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > ul > li:nth-child(1)"
          );
          const mes = await this.getCurrentMonthInitials();
          console.log("mes actual " + mes);
          await this.selectMonth(iframeContent, mes);
        }

        const buttonContent = await this.getInnerHTML(
          iframeContent,
          "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > div.v-date-picker-header.theme--light > div > div > button"
        );
        console.log(buttonContent);
        if (buttonContent) {
          break;
        }
        await this.delay(15000);
      }
      while (true) {
        const buttonContent = await this.getInnerHTML(
          iframeContent,
          "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > div.v-date-picker-header.theme--light > div > div > button"
        );
        console.log(buttonContent);
        if (buttonContent.includes(fechaInicial.mes)) {
          break;
        }

        //console.log("click cambio de mes");
        await this.clickButton(
          iframeContent,
          "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > div.v-date-picker-header.theme--light > button:nth-child(1)"
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const cellSelector = await this.findCellSelectorByContent(
        iframeContent,
        fechaInicial.dia,
        "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > div.v-date-picker-table.v-date-picker-table--date.theme--light > table > tbody > tr"
      );
      await this.clickButton(iframeContent, cellSelector + " > button");

      const selectorMesYear =
        "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > div.v-date-picker-header.theme--light > div > div > button";
      const selectorBtnMesAnterior =
        "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > div.v-date-picker-header.theme--light > button:nth-child(1)";
      const selectoTableDias =
        "#app > div.v-menu__content.theme--light.menuable__content__active > div > div.v-picker__body.theme--light > div > div.v-date-picker-table.v-date-picker-table--date.theme--light > table > tbody > tr";

      while (true) {
        await iframeContent.click("#fechaFinal");
        const buttonContent = await this.getInnerHTML(
          iframeContent,
          selectorMesYear
        );
        if (buttonContent) {
          break;
        }
      }

      while (true) {
        const buttonContent = await this.getInnerHTML(
          iframeContent,
          selectorMesYear
        );

        console.log(buttonContent);
        if (buttonContent.includes(fechaFinal.mes)) {
          break;
        }
        console.log("click cambio de mes");
        await this.clickButton(iframeContent, selectorBtnMesAnterior);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }


      const cellSelector2 = await this.findCellSelectorByContent(
        iframeContent,
        fechaFinal.dia,
        selectoTableDias
      );
      await this.clickButton(iframeContent, cellSelector2 + " > button");

      await this.logger(16, tabBrowser.datos.id, "Click en Buscar");
      const buttonBuscar =
        "#app > div > main > div > div > div > div > div > div > div.v-card__text > div.row.py-2 > div > button:nth-child(1)";
      await this.clickButton(iframeContent, buttonBuscar);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        await page.waitForNavigation({ waitUntil: "networkidle0" });
      } catch (err) {}
      // aca debe esperar mas o algo para el ajax
*/
      //const resultado = "#app > div > main > div > div > div > div > div > div > div.v-card__text > div:nth-child(3) > div.py-0.col-md-12.col-12 > div > div > div > div:nth-child(3) > div:nth-child(1) > table > tbody > tr > td > div > div > span";
      try {
        await iframeContent.waitForSelector(
          "#app > div > main > div > div > div > div > div > div > div.v-card__text > div:nth-child(3) > div.py-0.col-md-12.col-12 > div > div > div > div:nth-child(3) > div:nth-child(1) > table > tbody > tr:nth-child(1)"
        );
      } catch (err) {
        console.log(err);
      }

      let contenido = "";
      try {
        contenido = await iframeContent.$eval(
          "#app > div > main > div > div > div > div > div > div > div.v-card__text > div:nth-child(3) > div.py-0.col-md-12.col-12 > div > div > div > div:nth-child(3) > div:nth-child(1) > table > tbody > tr:nth-child(1)",
          (tr) => tr.textContent
        );
      } catch (err) {
        console.log(err);
      }
      console.log("intentos " + intentos);
      if (contenido.includes("No hay datos")) {
        if (intentos > 3) {
          await this.logger(17, tabBrowser.datos.id, "No se Encontro Nada");
          tabBrowser.datos.estadoDB = 2;
          await this.falloBusqueda(tabBrowser, "No se encontro ", 3);
          break;
        }
        console.log(contenido);
      } else {
        console.log("------------------------------");
        await this.logger(18, tabBrowser.datos.id, "Se encontraron Datos");
        console.log("*************************************");

        const rowsData = await iframeContent.$$eval(
          "#app > div > main > div > div > div > div > div > div > div.v-card__text > div:nth-child(3) > div.py-0.col-md-12.col-12 > div > div > div > div:nth-child(3) > div:nth-child(1) > table > tbody > tr",
          (rows) =>
            rows.map((row) => {
              // Extrae el texto de cada celda dentro de la fila
              const cells = row.querySelectorAll("td");
              return Array.from(cells).map((cell) => cell.textContent.trim());
            })
        );
        const columnaSerie = 6;
        console.log(tabBrowser.datos.numeroRadicado);
        let fila = null; // Variable para almacenar el resultado
        rowsData.forEach((row, index) => {
          console.log("|" + row[columnaSerie] + "|");
          console.log("|" + tabBrowser.datos.numeroRadicado + "|");
          if (tabBrowser.datos.numeroRadicado.includes(row[columnaSerie])) {
            tabBrowser.datos.nombrePDF = row[columnaSerie];
            fila = {
              index: index + 1, // Índice basado en 1
              cssSelector: `tr:nth-child(${index + 1})`,
            };
          }
        });

        let filaEncontrada = -1;
        if (fila) {
          filaEncontrada = fila.index;
        }
        /*
        console.log("*************************************");
        const filaEncontrada     = await iframeContent.$$eval('#app > div > main > div > div > div > div > div > div > div.v-card__text > div:nth-child(3) > div.py-0.col-md-12.col-12 > div > div > div > div:nth-child(3) > div:nth-child(1) > table > tbody > tr', (rows, numeroRadicado) => {
          console.log(rows);
          let filaEncontrada = -1; // Inicializamos la variable con -1 para indicar que no se ha encontrado ninguna fila              
          rows.some((row, index) => {
            const contenidoCelda7 = row.querySelector('td:nth-child(7)').textContent;
            console.log("\n+++++++++++++++++++++++")
            console.log(contenidoCelda7)
            if (contenidoCelda7 === numeroRadicado) {             
              filaEncontrada = index + 1; // Sumamos 1 para obtener el número de fila real
              return true; // Detiene la iteración después de encontrar el selector
            }
            return false; // Continúa iterando si no se ha encontrado el selector
          });
          return filaEncontrada 
        }, tabBrowser.datos.numeroRadicado);
        console.log("------------------------------");
*/
        if (filaEncontrada != -1) {
          await this.logger(
            19,
            tabBrowser.datos.id,
            "Se Encontro Fila con la solicitud"
          );
          await this.clickButton(
            iframeContent,
            "#app > div > main > div > div > div > div > div > div > div.v-card__text > div:nth-child(3) > div.py-0.col-md-12.col-12 > div > div > div > div:nth-child(3) > div:nth-child(1) > table > tbody > tr:nth-child(" +
              filaEncontrada +
              ")"
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log("imprimir");
          console.log(tabBrowser.datos.ruta);
          const isDisabled = await iframeContent.$eval(
            "#Imprimir",
            (button) => {
              return button.disabled;
            }
          );

          if (isDisabled) {
            await this.logger(20, tabBrowser.datos.id, "Boton Deshabilitado");
            await this.agregarLineaAArchivo(
              tabBrowser.rutaErrores,
              "Imprimir Deshabilitado " + tabBrowser.datos.fila
            );
            await this.actualizarEstado(
              tabBrowser.datos.id,
              3,
              "Imprimir Deshabilitado"
            );
          } else {
            await this.logger(21, tabBrowser.datos.id, "Click en Imprimir");
            await this.clickButton(iframeContent, "#Imprimir");

            const nombreArchivo =
              "autorizacion_" + tabBrowser.datos.nombrePDF + ".pdf";
            console.log(nombreArchivo);
            console.log(tabBrowser.datos.ruta), console.log(nombreArchivo);
            console.log(tabBrowser.datos.id);
            //await this.verificarArchivo(tabBrowser.datos.ruta ,nombreArchivo, tabBrowser.datos.id);

            //this.verificarMoverArchivo(RUTADESCARGAR, tabBrowser.datos.ruta, tabBrowser.datos.numeroRadicado, tabBrowser.datos.id)
            await this.finalizarProceso(
              tabBrowser.datos.ruta,
              nombreArchivo,
              tabBrowser.datos.id,
              tabBrowser
            );
            const buttonSalir =
              "#app > div > main > div > div > div > div > div > div > div.v-card__text > div.row.py-2 > div > button:nth-child(2)";
            await this.clickButton(iframeContent, buttonSalir);
          }
          break;
        } else {
          //await this.falloBusqueda(tabBrowser,"No se encontro ",3);
          //await this.agregarLineaAArchivo(tabBrowser.rutaErrores,"No se encontro "+tabBrowser.datos.fila);
          //await this.actualizarEstado(tabBrowser.datos.id,2);
          console.log("Se encontraron registros, pero no el que se busca");
        }
      }
      intentos = intentos + 1;
      diasRestados = diasRestados + DIAS_RESTADOS;

      await this.clickButton(
        iframeContent,
        "#app > div > main > div > div > div > div > div > div > div.v-card__text > div.row.py-2 > div > button:nth-child(2)"
      );
      await iframeContent.click("#fechaInicial");
      await this.delay(1000);
      await iframeContent.click(
        "#app > div > main > div > div > div > div > div > div > div.v-card__text > form > div:nth-child(4) > div.py-0.col.col-9 > div.v-input.v-input--is-label-active.v-input--is-dirty.v-input--is-readonly.v-input--dense.theme--light.v-text-field.v-text-field--is-booted.v-text-field--enclosed.v-text-field--outlined.v-text-field--placeholder > div > div.v-input__slot > div.v-input__append-inner > div > button"
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await this.proceso(tabBrowser);
  }

  async selectMonth(page, month) {
    await page.evaluate((month) => {
      const monthButtons = document.querySelectorAll("button");
      for (let button of monthButtons) {
        if (button.innerText.trim().toLowerCase() === month.toLowerCase()) {
          button.click();
          break;
        }
      }
    }, month);
  }
  async getCurrentMonthInitials() {
    const monthNames = [
      "ene.",
      "feb.",
      "mar.",
      "abr.",
      "may.",
      "jun.",
      "jul.",
      "ago.",
      "sept.",
      "oct.",
      "nov.",
      "dic.",
    ];
    const currentMonthIndex = new Date().getMonth(); // Devuelve el índice del mes actual (0-11)
    return monthNames[currentMonthIndex];
  }
  async falloBusqueda(tabBrowser, msg, status) {
    if (tabBrowser.datos.estadoDB == 0) {
      await this.actualizarEstado(tabBrowser.datos.id, 2, "pendiente");
    } else {
      await this.agregarLineaAArchivo(
        tabBrowser.rutaErrores,
        msg + tabBrowser.datos.fila
      );
      await this.actualizarEstado(tabBrowser.datos.id, status, msg);
      await this.guardarListaErrores(
        tabBrowser.datos.fila,
        tabBrowser.datos.fechaDescarga,
        tabBrowser.datos.contrato,
        tabBrowser.datos.sedeAtencion,
        msg
      );
    }
  }

  async agregarLineaAArchivo(rutaArchivo, texto) {
    /*
    return new Promise((resolve, reject) => {
      fs.access(rutaArchivo, fs.constants.F_OK, (err) => {
        if (err) {
          // El archivo no existe, así que lo creamos y escribimos la línea
          fs.writeFile(rutaArchivo, texto + '\n', { mode: 0o777 }, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve('Se ha creado el archivo y añadido el texto correctamente.');
          });
        } else {
          // El archivo existe, así que solo añadimos la línea
          fs.appendFile(rutaArchivo, texto + '\n', (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve('Se ha añadido el texto al archivo correctamente.');
          });
        }
      });
    });
    */
  }
  async establecerValorInput(page, selector, nuevoValor) {
    // Esperar a que el selector esté listo
    await page.waitForSelector(selector);

    // Establecer el valor del input con el selector dado
    await page.$eval(
      selector,
      (input, value) => (input.value = value),
      nuevoValor
    );
  }

  async obtenerValorInput(page, selector) {
    // Esperar a que el selector esté listo
    await page.waitForSelector(selector);

    // Obtener el valor del input con el selector dado
    const valor = await page.$eval(selector, (input) => input.value);

    return valor;
  }

  async contarFilasDeTabla(page, selectorTabla) {
    const numFilas = await page.evaluate((selector) => {
      const tabla = document.querySelector(selector);
      if (tabla) {
        return tabla.querySelectorAll("tr").length;
      } else {
        return 0;
      }
    }, selectorTabla);

    return numFilas;
  }

  async hacerClicEnEnlace(page, selector) {
    await page.evaluate((selector) => {
      const enlace = document.querySelector(selector);
      if (enlace) {
        enlace.click();
      } else {
        console.log("No se encontró el enlace con el selector proporcionado.");
      }
    }, selector);
  }

  async cambiarCarpeta(tabBrowser) {
    await this.logger(
      6,
      tabBrowser.datos.id,
      "Cambiar Carpeta de Descarga: " + tabBrowser.datos.ruta
    );
    try {
      await fs1.mkdir(tabBrowser.datos.ruta, { recursive: true });
      await tabBrowser.client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: tabBrowser.datos.ruta, // Ruta a tu carpeta personalizada
      });
    } catch (error) {
      console.error("Error al cambiar la ruta de descarga:", error);
    }
  }

  async formatearFecha(fecha, cantidadDias) {
    // Dividir la cadena de fecha en día, mes y año
    const [diaStr, mesStr, añoStr] = fecha.split("/");
    const dia = parseInt(diaStr);
    const mes = parseInt(mesStr) - 1; // Restar 1 al mes para que sea 0-indexed
    const año = parseInt(añoStr);

    // Crear la fecha inicial
    let fechaInicial = new Date(año, mes, dia);
    fechaInicial = subDays(fechaInicial, cantidadDias);
    let fechaNueva = subDays(fechaInicial, DIAS_RESTADOS);

    // Nombres de los meses en español
    const mesesTexto = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];

    const diaInicial = fechaNueva.getDate();
    const diaFinal = fechaInicial.getDate();

    const mesInicialTexto = mesesTexto[fechaNueva.getMonth()];
    const mesFinalTexto = mesesTexto[fechaInicial.getMonth()];

    const mesInicialNumero = fechaNueva.getMonth(); // 0-indexado
    const mesFinalNumero = fechaInicial.getMonth(); // 0-indexado

    const añoInicial = fechaNueva.getFullYear();
    const añoFinal = fechaInicial.getFullYear();

    // Devolver un objeto con los datos formateados
    return {
      fechaFinal: {
        dia: diaFinal,
        mesTexto: mesFinalTexto,
        mesNumero: mesFinalNumero,
        año: añoFinal,
      },
      fechaInicial: {
        dia: diaInicial,
        mesTexto: mesInicialTexto,
        mesNumero: mesInicialNumero,
        año: añoInicial,
      },
    };
  }

  /*
async formatearFecha(fecha) {
  // Dividir la cadena de fecha en día, mes y año
  const [diaStr, mesStr, añoStr] = fecha.split('/');
//fechaInicial = subDays(fechaInicial, 70);
  // Convertir los componentes de la fecha en números
  const dia = parseInt(diaStr, 10);
  const mes = parseInt(mesStr, 10) - 1; // Restar 1 porque los meses en JavaScript van de 0 a 11
  const año = parseInt(añoStr, 10);

  // Crear un objeto Date con la fecha ingresada
  const fechaOriginal = new Date(año, mes, dia);

  // Restar 30 días a la fecha original
  const fechaNueva = new Date(fechaOriginal.getTime() - (30 * 24 * 60 * 60 * 1000));

  // Obtener el día, mes y año de la nueva fecha
  const diaNueva = fechaNueva.getDate();
  const mesNueva = fechaNueva.getMonth() + 1; // Sumar 1 para volver al formato de mes de 1 a 12

  // Nombres de los meses en español
  const mesesTexto = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  // Obtener el nombre del mes en texto
  const mesTextoOriginal = mesesTexto[mes];
  const mesTextoNuevo = mesesTexto[fechaNueva.getMonth()]; // Mes de la fecha nueva

  // Devolver un objeto con los datos formateados
  return {
    fechaFinal: { dia, mes: mesTextoOriginal },
    fechaInicial    : { dia: diaNueva, mes: mesTextoNuevo }
  };
}
*/

  async clickButton(page, selector) {
    await page.evaluate((selector) => {
      const buttonSelector = selector;
      const buttonElement = document.querySelector(buttonSelector);
      if (buttonElement) {
        buttonElement.click();
      } else {
        console.error(
          "No se encontró el botón con el selector:",
          buttonSelector
        );
      }
    }, selector);
  }

  async getInnerHTML(page, selector) {
    const innerHTML = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      return element ? element.innerHTML.trim() : null;
    }, selector);
    return innerHTML;
  }

  async findCellSelectorByContent(page, content, selectorPrefix) {
    const cellSelector = await page.evaluate(
      (content, selectorPrefix) => {
        let selectedSelector = null;
        // Obtener todas las filas de la tbody
        const rows = document.querySelectorAll(`${selectorPrefix}`);

        // Iterar sobre las filas
        rows.forEach((row, rowIndex) => {
          const cells = row.querySelectorAll("td");

          // Iterar sobre las celdas de la fila
          cells.forEach((cell, cellIndex) => {
            // Obtener el contenido de la celda
            const cellContent = cell.innerText;

            // Si el contenido de la celda coincide con el contenido deseado, obtener el selector de la celda
            if (cellContent.trim() === content.toString().trim()) {
              selectedSelector = `${selectorPrefix}:nth-child(${
                rowIndex + 1
              }) > td:nth-child(${cellIndex + 1})`;
            }
          });
        });

        return selectedSelector;
      },
      content,
      selectorPrefix
    );

    return cellSelector;
  }
}
module.exports = BotNuevaEPS;
