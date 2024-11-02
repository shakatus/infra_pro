const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const fs1 = require("fs");
const { exec } = require("child_process");
const {
  getSiteId,
  getDriveId,
  uploadFileToSharePoint,
  addItemToList
} = require("./sharepointClient");
const pdfParse = require("pdf-parse");
const path = require("path");
const { parse, subDays, format } = require("date-fns");
const { obtenerCredenciales } = require("./credenciales");
const fse = require("fs-extra");
const config = require('/home/devbots/supervisor/.env/config');

//constantes
const EPS = "SURA";
const EPS_ID = "1";
const URL_LOGIN =
  "https://login.sura.com/sso/servicelogin.aspx?continueTo=https%3A%2F%2Fsaludweb-proc.suramericana.com%2Fsaludweb-mas%2F&service=salud";

let USER = "";
let PASSWORD = "";

const URL_CONSULTA =
  "https://saludweb-proc.suramericana.com/saludweb-mas/aut/autcx00045-traerPaginaConsultaPrestador.do";
//const URL_CONSULTA = "https://saludweb-proc.suramericana.com/saludweb-mas/aut/autcx00045-consultarOrdenesxPrestador.do";
const ELEMENTO_LOGIN = "#session-enterprise";

const TAB_IPS = "#k-tabstrip-tab-1";
const ESTADO_ACTIVO_TAB = "k-state-active";

const INPUT_TIPODOCUMENTO_IPS =
  "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input";

const INPUT_DOCUMENTO_IPS =
  "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(2) > input";

const INPUT_TIPODOCUMENTO_USUARIO =
  "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(3) > kendo-combobox > span > kendo-searchbar > input";
const TIPO_DOCUMENTO_USUARIO = "CEDULA DE CIUDADANIA";
const INPUT_DOCUMENTO_USUARIO =
  "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(4) > input";

const INPUT_PASSWORD =
  "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div.col-md-12.ng-star-inserted > div:nth-child(5) > input";

const BUTTON_INGRESAR =
  "body > app-root > div > div > app-login > form > div > div.col-md-5.col-sm-12.col-xs-12 > div:nth-child(9) > div > div:nth-child(2) > button";

const RUTASFTP = "/var/sftp";
const RUTAVPS = "/home/devbots/botsura";
const RUTADESCARGAR = "/home/devbots/Downdloads";
const rutaArchivoError = "/registro_errores.txt";

const SELECTOR_SUCURSAL_LOGIN =
  "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input";
const SELECTOR_SEDE_LOGIN =
  "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(2) > kendo-combobox > span > kendo-searchbar > input";
const SELECTOR_ACEPTAR_LOGIN =
  "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > div:nth-child(6) > div > button";

const SELECTOR_SUCURSAL =
  "body > app-root > div > app-top-bar > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input";
const SELECTOR_SEDE =
  "body > app-root > div > app-top-bar > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(2) > kendo-combobox > span > kendo-searchbar > input";
const SELECTOR_ACEPTAR =
  "body > app-root > div > app-top-bar > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > div:nth-child(6) > div > button";

const externo = 1;
const listId = "D209E6DF-339B-4B7D-910C-B8A76A357B5D";
let siteId = null;

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

class BotSura {
  constructor(pool) {
    this.pool = pool;
    this.nameBot = "";
    this.power = true;
    this.reset = false;
    this.driveId = null;
  }

  async credenciales() {
    const datos = await obtenerCredenciales(1, EPS_ID);
    USER = datos.find((dato) => dato.etiqueta === "usuario").valor_descifrado;
    PASSWORD = datos.find(
      (dato) => dato.etiqueta === "password"
    ).valor_descifrado;
  }

  async main(name, inicio) {
    console.log("inicio " + name);
    this.nameBot = name;
    tmpProfilePath = `/tmp/${inicio}`;
    tmpProfilePathChrome = `/tmp/${inicio}/chrome-profile-${process.pid}`;
    //await this.actualizarBot(1,2,"saludtotal_"+name);
    await this.credenciales();
    console.log("fin");
    siteId = await getSiteId();
    this.driveId = await getDriveId(siteId);

    await this.iniciarBrowser();
    await this.iniciarPestaña();
  }

  async iniciarBrowser() {
    await fse.copy(
      "/home/devbots/.config/google-chrome/Profile1",
      tmpProfilePathChrome
    );
    try {
      browser = await puppeteer.launch({
        headless: false, // Show the Chrome browser window
        executablePath: "/usr/bin/google-chrome", // Optional: Specify Chrome path
        userDataDir: tmpProfilePathChrome,
        args: [
          "--window-size=400,300", // Set Chrome window size to 400x300
          "--no-sandbox", //, // Disable sandbox for compatibility (use with caution)
          //'--display=:0' // Show Chrome on the default X11 display (if using VNC)
        ],
        handleSIGINT: false, // Prevent termination on Ctrl+C (if desired)
      });
    } catch (err) {
      console.error("Error launching Puppeteer browser:", err);
    }
  }

  async iniciarPestaña() {
    let tabBrowser = await this.start();
    await this.obtenerDatos(tabBrowser);
  }

  async start() {
    console.log("start");
    //inicia el navegador
    let tabBrowser = {};
    tabBrowser.datos = {};
    tabBrowser.pdf = "";
    tabBrowser.status = 0;
    tabBrowser.cedulaSize = 1;
    //nueva pestaña
    tabBrowser.page = await browser.newPage();
    try {
      await tabBrowser.page.goto("https://www.google.com.co/", {
        waitUntil: "load",
        timeout: 50000,
      });
    } catch (err) {}

    this.closeAllPopups(tabBrowser.page);

    await tabBrowser.page.setRequestInterception(true);

    tabBrowser.page.on("request", async (request) => {
      request.continue();
    });
    tabBrowser.client = await tabBrowser.page.target().createCDPSession();

    try {
      await tabBrowser.page.goto(URL_LOGIN, {
        waitUntil: "load",
        timeout: 50000,
      });
    } catch (err) {}

    tabBrowser.row = null;
    tabBrowser.status = 0;
    return tabBrowser;
  }

  async stop(datos) {
    try {
      datos.page.off("framenavigated", this.handleFrameNavigated);
      await datos.client.detach();
      await datos.page.close();
      await browser.close();
    } catch (err) {}
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

  async obtenerCodigo2FA() {
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
      console.log("Consulta SQL:", query);

      // Ejecutar la consulta
      const result = await this.pool.query(query, [2]);

      // Procesar el resultado
      return result.rows[0] ? result.rows[0].codigo2fa : null;
    } catch (error) {
      console.error("Error en obtenerCodigo2FA:", error);
      throw error; // Re-lanza el error para que pueda ser manejado por el llamador
    }
  }

  async colocarFechaInicio(id) {
    try {
      // Define la consulta SQL con la sintaxis CASE en lugar de IF
      const sql = `
            UPDATE tareas 
            SET 
                fecha_inicio_ejecucion = CASE WHEN id = $1 THEN CURRENT_TIMESTAMP ELSE fecha_inicio_ejecucion END,
                ebot_id = CASE WHEN id = $1 THEN ebot_id ELSE 0 END 
            WHERE ebot_id = $2 AND estado IN (0, 2);
        `;
      console.log("Consulta SQL:", sql);
      console.log("Valores:", [id, this.nameBot]);

      // Ejecutar la consulta usando el pool (sin necesidad de obtener y liberar la conexión manualmente)
      const result = await this.pool.query(sql, [id, this.nameBot]);

      console.log("Fecha actualizada");
      return result;
    } catch (error) {
      console.error("Error al colocar la fecha de inicio:", error);
      throw error; // Re-lanza el error para que pueda ser manejado por el llamador
    }
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
      console.log("Consulta SQL:", sql);
      console.log("Valores:", [this.nameBot, EPS]);

      // Ejecutar la consulta usando el pool (sin necesidad de obtener y liberar manualmente la conexión)
      const result = await this.pool.query(sql, [this.nameBot, EPS]);

      console.log("Resultado de la consulta:", result.rows);
      return result.rows[0]; // Devuelve el primer resultado
    } catch (error) {
      console.error("Error al obtener la atención:", error);
      throw error; // Re-lanza el error para que pueda ser manejado por el llamador
    }
  }

  async savePDFDB(filePath, id) {
    try {
      // Leer el archivo PDF
      const data = await fs.readFile(filePath);

      // Definir la consulta SQL
      const sql = `
      UPDATE tareas 
      SET pdf = $1, estado = 1, fecha_fin_ejecucion = CURRENT_TIMESTAMP, externo = 1 
      WHERE id = $2
    `;

      // Ejecutar la consulta usando el pool (sin necesidad de obtener y liberar la conexión manualmente)
      const result = await this.pool.query(sql, [data, id]);

      console.log(
        "\x1b[44m%s\x1b[0m",
        "Archivo actualizado con éxito:",
        result
      );
      return result;
    } catch (error) {
      console.error("Error al actualizar el archivo:", error);
      throw error;
    }
  }

  async finalizarTarea(oldObject) {
    //await this.moverArchivo(oldObject.pdf);
    //await this.actualizarEstado();
  }

  async handleFrameNavigated(frame) {
    const isMainFrame = frame.parentFrame() === null; // Verifica si el marco actual es el marco principal
    if (isMainFrame) {
      await frame.waitForNavigation({ timeout: 0, waitUntil: "load" });
      const url = frame.url();
      console.log(url);
    }
  }

  async obtenerDatos(tabBrowser) {
    console.log("INICIO");
    console.log(tabBrowser.status);
    tabBrowser.status = 0;
    while (tabBrowser.status == 0) {
      let row = null;
      const resultado = await this.pedirAtencion();
      if (resultado && resultado.rows && resultado.rows.length > 0) {
        row = resultado.rows[0];
      }
      //row = await this.obtenerAtencion();
      if (row != null) {
        await this.colocarFechaInicio(row.id);
        console.log("extraer datos");
        const validacion = row.atencion.split("|");

        if (validacion.length !== 4) {
          console.log(validacion);
          await this.actualizarEstado(row.id, 3, "Atencion Incompleta 1");
          await this.guardarListaErrores(
            row.atencion,
            row.fecha,
            row.contrato,
            "",
            "Atencion Incompleta"
          );
          continue;
        }

        if(validacion[3].length<1){
          await this.actualizarEstado(row.id, 3, "Sin fecha");
          await this.guardarListaErrores(
            row.atencion,
            row.fecha,
            row.contrato,
            "",
            "Atencion Incompleta"
          );
          continue;
        }


        
        const primerSegmento = validacion[0].split("_");
        if (primerSegmento.length !== 3) {
          await this.actualizarEstado(row.id, 3, "Atencion Incompleta 2");
          await this.guardarListaErrores(
            row.atencion,
            row.fecha,
            row.contrato,
            "",
            "Atencion Incompleta"
          );
          continue;
        }
        const segundoSegmento = validacion[1].split("-");
        if (segundoSegmento.length !== 2) {
          await this.actualizarEstado(row.id, 3, "Atencion Incompleta 3");
          await this.guardarListaErrores(
            row.atencion,
            row.fecha,
            row.contrato,
            primerSegmento[1],
            "Atencion Incompleta"
          );
          continue;
        }

        const resultado = await this.procesarFila(row);
        const [fechaInicial, fechaFinal] =
          await this.formatearFechaConDosDigitos(resultado.fecha);
        console.log(fechaInicial);
        console.log(fechaFinal);
        console.log(resultado);
        tabBrowser.datos.sedeAtencion = resultado.primerValor[1];
        tabBrowser.datos.fechaDescarga = row.fecha;
        tabBrowser.datos.contrato = row.contrato;
        //const sede = "PROFAMILIA MANIZALES"
        tabBrowser.datos.fecha = resultado.fecha;
        tabBrowser.datos.estadoDB = row.estado;
        tabBrowser.datos.fila = row.atencion;
        tabBrowser.datos.id = resultado.id;
        tabBrowser.datos.cedula = resultado.documento;
        tabBrowser.datos.tipoDocumento = resultado.tipoDocumento;
        tabBrowser.datos.fechaInicio = fechaInicial;
        tabBrowser.datos.fechaFin = fechaFinal;
        tabBrowser.datos.serial = resultado.segundoValor.replace(/\s/g, "");

        const partes = row.ruta.split("/");
        tabBrowser.datos.codigoContrato = partes[partes.length - 1].replace(
          "Contrato_",
          ""
        );
        tabBrowser.datos.ruta = row.ruta; //.replace(RUTASFTP, RUTAVPS);
        tabBrowser.datos.ruta = tabBrowser.datos.ruta + "/" + resultado.ruta;
        tabBrowser.datos.rutaSharePoint = tabBrowser.datos.ruta;
        tabBrowser.datos.nombreArchivo = "ORDEN DE COBRO.PDF";
        tabBrowser.datos.ruta =
          "/home/devbots/Downloads/" + tabBrowser.datos.id;
        tabBrowser.rutaErrores = row.ruta + rutaArchivoError;
        await this.cambiarCarpeta(tabBrowser);
        tabBrowser.status = 1;
        console.log(tabBrowser.datos);
        const autorizacion = tabBrowser.datos.serial.split("-");
        if (autorizacion.length == 2) {
          tabBrowser.datos.autorizacion = autorizacion;
        } else {
          tabBrowser.status = 0;
          await this.agregarLineaAArchivo(
            tabBrowser.rutaErrores,
            "No se encuentra " + tabBrowser.datos.fila
          );
          await this.actualizarEstado(
            tabBrowser.datos.id,
            3,
            "No se encuentra"
          );
        }
      } else {
        console.log("no hay datos");
        await this.delay(5000);
        await this.cambiarEPS();
        //this.actualizarBot(1,0,"saludtotal_"+this.nameBot);
      }
    }
    console.log("fin extraccion");
    await this.login(tabBrowser);
    const rt_total = await this.realizarConsulta(tabBrowser);
    console.log("resultado final");
    console.log(rt_total);
    await this.obtenerDatos(tabBrowser);
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


  async cambiarCarpeta(tabBrowser) {
    console.log("cambiar carpeta");
    console.log(tabBrowser.datos.ruta);
    try {
      await fs.mkdir(tabBrowser.datos.ruta, { recursive: true });
      await tabBrowser.client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: tabBrowser.datos.ruta, // Ruta a tu carpeta personalizada
      });
    } catch (error) {
      console.error("Error al cambiar la ruta de descarga:", error);
    }
  }

  async procesarFila(row) {
    console.log(row);
    var id = row.id;
    var partes = row.atencion.split("|");
    var primerValor = partes[0].split("_");
    var segundoValor = partes[1];
    var tercerValor = partes[2].split("-");
    var cuartoValor = partes[3];
    return {
      id: id,
      ruta: partes[0],
      primerValor: primerValor,
      segundoValor: segundoValor,
      tipoDocumento: tercerValor[0],
      documento: tercerValor[1],
      fecha: cuartoValor,
    };
  }

  async formatearFechaConDosDigitos(fechaEntrada) {
    console.log(fechaEntrada);
    const fechaDate = parse(fechaEntrada, "dd/MM/yyyy", new Date());
    console.log(fechaDate);
    const fechaResultado = subDays(fechaDate, 170);
    console.log(fechaResultado);
    const fechaFinalFormateada = format(fechaDate, "ddMMyyyy");
    const fechaInicialFormateada = format(fechaResultado, "ddMMyyyy");
    console.log(fechaInicialFormateada);
    console.log(fechaFinalFormateada);
    /*
    const [dia, mes, año] = fechaTexto.split('/');
    // Crear un objeto de fecha con los componentes
    let fechaInicial = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia)); // Restar 1 al mes para que sea 0-indexed
    fechaInicial = subDays(fechaInicial, 170);
    console.log("fecha Inicial "+fechaInicial);
    // Crear una copia de fechaInicial para evitar modificarla directamente
    const fechaFinal = new Date(fechaInicial); // Crear una copia de la fecha inicial
    console.log("fecha Final "+fechaFinal);
    // Agregar dos días a la fecha final
    fechaFinal.setDate(fechaFinal.getDate() + 2);
    // Formatear las fechas como texto sin separadores 
    const fechaInicialFormateada = await this.formatearFechaSinSeparadores(fechaInicial);
    const fechaFinalFormateada = await formatearFechaSinSeparadores(fechaFinal);
    console.log(fechaInicialFormateada);
    console.log(fechaFinalFormateada);    
    // Devolver las dos fechas formateadas como texto sin separadores
    */
    return [fechaInicialFormateada, fechaFinalFormateada];
  }

  async formatearFechaSinSeparadores(fecha) {
    // Obtener los componentes de la fecha
    const dia = fecha.getDate().toString().padStart(2, "0"); // Agregar ceros a la izquierda si es necesario
    const mes = (fecha.getMonth() + 1).toString().padStart(2, "0"); // Agregar ceros a la izquierda si es necesario
    const año = fecha.getFullYear().toString();
    // Combinar los componentes en una cadena sin separadores y devolverla
    return año + mes + dia;
  }

  async formatearFechaSinSeparadores(fecha) {
    const dia = fecha.getDate().toString().padStart(2, "0");
    const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
    const año = fecha.getFullYear().toString();
    return dia + mes + año;
  }

  async login(tabBrowser) {
    console.log("LOGIN");
    const url1 = await tabBrowser.page.url();
    console.log(url1);

    // si no esta en oficina virtual estamos logeados
    if (url1.includes("traerPaginaConsultaPrestador")) {
      //console.log("reload");
      //await tabBrowser.page.reload();
      console.log("salimos del login");
      return;
    }

    try {
      await tabBrowser.page.waitForSelector(ELEMENTO_LOGIN);
    } catch (err) {
      console.log("elemento no aparece");
    }
    try {
      const elemento = await tabBrowser.page.$(ELEMENTO_LOGIN);
      if (elemento) {
        console.log("El selector existe en la página.");
      } else {
        console.log("elemento no exita");
        return;
      }
    } catch (err) {}
    //selecionamos el tab de IPS

    console.log("digitar username");
    while (true) {
      await this.overwriteField(tabBrowser.page, "#suranetName", USER);
      const suraname = await tabBrowser.page.$eval(
        "#suranetName",
        (element) => element.value
      );
      if (suraname == USER) {
        break;
      }
    }
    console.log("digitar PASSWORD");
    while (true) {
      await this.overwriteField(tabBrowser.page, "#suranetPassword", PASSWORD);
      const surapassword = await tabBrowser.page.$eval(
        "#suranetPassword",
        (element) => element.value
      );
      if (surapassword == PASSWORD) {
        break;
      }
    }
    await tabBrowser.page.click("#session-enterprise");
    await tabBrowser.page.waitForNavigation({ waitUntil: "networkidle0" });
    console.log(
      "La página se ha cargado completamente después de hacer clic en el enlace."
    );
    const url_check_login = await tabBrowser.page.url();
    if (url_check_login.includes("mfa/process")) {
      await this.colocar2FA(tabBrowser);
    }
    console.log("logeado correctamente");
    await tabBrowser.page.goto(URL_CONSULTA);
    //while(true){}
    //https://saludweb-proc.suramericana.com/saludweb-mas/aut/autcx00045-traerPaginaConsultaPrestador.do
    //https://saludweb-proc.suramericana.com/saludweb-mas/login-desplegarMenu.do
  }

  async colocar2FA(tabBrowser) {
    let codigo2FA = null;
    while (codigo2FA === null) {
      codigo2FA = await this.obtenerCodigo2FA();
      await this.delay(100);
    }
    console.log(codigo2FA);
    while (true) {
      await this.overwriteField(
        tabBrowser.page,
        "#loginForm > input[type=text]:nth-child(4)",
        codigo2FA
      );
      const valueCodigo2FA = await tabBrowser.page.$eval(
        "#loginForm > input[type=text]:nth-child(4)",
        (element) => element.value
      );
      if (valueCodigo2FA == codigo2FA) {
        break;
      }
    }
    try {
      while (true) {
        await tabBrowser.page.click(
          "#loginForm > div.trustedDevice > label > span"
        );
        const resultado = await this.tieneAfter(
          "#loginForm > div.trustedDevice > label > span",
          tabBrowser
        );
        console.log(resultado);
        if (resultado) {
          break;
        }
      }
      //while(true){};
      await tabBrowser.page.click("#loginForm > div:nth-child(9) > input");
      await tabBrowser.page.waitForNavigation({ waitUntil: "networkidle0" });
      console.log(
        "La página se ha cargado completamente después de hacer clic en el enlace."
      );
    } catch (err) {
      console.log(err);
    }
  }
  async tieneAfter(selector, tabBrowser) {
    const tieneAfter = await tabBrowser.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        const style = window.getComputedStyle(element, "::after");
        return style.content !== "none";
      } else {
        return false;
      }
    }, selector);

    return tieneAfter;
  }

  async overwriteField(page, selector, value) {
    // Limpiar el contenido existente en el campo
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.value = "";
        console.log("cambio");
      } else {
        console.log("error ");
      }
    }, selector);

    // Escribir el nuevo valor en el campo
    await page.type(selector, value);
  }

  async realizarConsulta(tabBrowser) {
    //body > form > table:nth-child(20) > tbody > tr:nth-child(4) > td:nth-child(2) > input[type=text]:nth-child(1)
    //body > form > table:nth-child(20) > tbody > tr:nth-child(4) > td:nth-child(2) > input[type=text]:nth-child(2)
    let verificacion = true;
    console.log(tabBrowser.datos);
    try {
      await tabBrowser.page.waitForSelector(
        "body > form > table:nth-child(20) > tbody > tr:nth-child(4) > td:nth-child(2) > input[type=text]:nth-child(1)"
      );
    } catch (err) {}
    while (true) {
      await this.overwriteField(
        tabBrowser.page,
        "body > form > table:nth-child(20) > tbody > tr:nth-child(4) > td:nth-child(2) > input[type=text]:nth-child(1)",
        tabBrowser.datos.autorizacion[0]
      );
      const auth_1 = await tabBrowser.page.$eval(
        "body > form > table:nth-child(20) > tbody > tr:nth-child(4) > td:nth-child(2) > input[type=text]:nth-child(1)",
        (element) => element.value
      );
      if (auth_1 == tabBrowser.datos.autorizacion[0]) {
        break;
      }
    }
    while (true) {
      await this.overwriteField(
        tabBrowser.page,
        "body > form > table:nth-child(20) > tbody > tr:nth-child(4) > td:nth-child(2) > input[type=text]:nth-child(2)",
        tabBrowser.datos.autorizacion[1]
      );
      const auth_2 = await tabBrowser.page.$eval(
        "body > form > table:nth-child(20) > tbody > tr:nth-child(4) > td:nth-child(2) > input[type=text]:nth-child(2)",
        (element) => element.value
      );
      if (auth_2 == tabBrowser.datos.autorizacion[1]) {
        break;
      }
    }

    /*
    const dialogPromise = new Promise((resolve) => {
      tabBrowser.page.on('dialog', async (dialog) => {
        const mensaje = dialog.message(); // Capturar el mensaje del diálogo
        await dialog.accept(); // Aceptar el diálogo
        resolve(mensaje); // Resolver la promesa con el mensaje del diálogo
      });
    });
*/
    await tabBrowser.page.click("#buscar");
    const mensajeDialogo = await this.esperarDialogoConTimeout(
      tabBrowser.page,
      5000
    );
    if (mensajeDialogo) {
      console.log("Mensaje del diálogo:", mensajeDialogo);
      if (mensajeDialogo.includes("NO SE ENCUENTRA AUTORIZACION NUMERO")) {
        estadofallido = true;
        console.log("NO EXISTE");
        //await agregarLineaAArchivo(rutaErrores,atencion+" Autorizacion no existe");
        //await actualizarEstado(tabBrowser.datos.id,3);
        await this.falloBusqueda(
          tabBrowser,
          tabBrowser.datos.fila + " Autorizacion no existe",
          3
        );
        return false;
      } else if (
        mensajeDialogo.includes("NO EXISTEN ORDENES PARA EL PRESTADOR")
      ) {
        console.log(
          "******************************************\n no existe " +
            mensajeDialogo
        );
        await this.falloBusqueda(
          tabBrowser,
          tabBrowser.datos.fila + " Autorizacion no existe",
          3
        );
        return false;
      }
    }

    /*
    try{
      await tabBrowser.page.waitForNavigation({ waitUntil: 'networkidle0' });
    }catch(err){}
*/
    try {
      await tabBrowser.page.waitForSelector(
        "body > form > table:nth-child(25)"
      );
    } catch (err) {
      console.log(err);
      await this.delay(2000);
    }
    let posicionFechaAtencion = 14;
    posicionFechaAtencion = await this.encontrarPosicionEncabezado(
      tabBrowser.page,
      "Fecha Atención",
      "body > form > table:nth-child(25)"
    );

    const posicionEstado = await this.encontrarPosicionEncabezado(
      tabBrowser.page,
      "Estado",
      "body > form > table:nth-child(25)"
    );
    if (posicionEstado != -1) {
      const estado = await this.obtenerContenidoCelda(
        tabBrowser.page,
        "body > form > table:nth-child(25)",
        1,
        posicionEstado + 1
      );
      console.log(estado);

      if (estado.includes("ANULADA")) {
        await this.falloBusqueda(
          tabBrowser,
          tabBrowser.datos.fila + " Autorizacion Anulada",
          3
        );
        verificacion = false;
      } else if (estado.includes("GENERADA")) {
        const columnIndices = await tabBrowser.page.evaluate(() => {
          // Selecciona las celdas de encabezado de la tabla
          const headers = document.querySelectorAll(
            "body > form > table:nth-child(25) > thead > tr > td"
          );
          console.log(headers);
          let direccionamientoIndex = -1;

          headers.forEach((td, index) => {
            const text = td.textContent.trim();
            console.log(text);
            if (text === "Fecha Atención") {
              direccionamientoIndex = index;
            }
          });

          return { direccionamientoIndex };
        });

        console.log(columnIndices.direccionamientoIndex);
        posicionFechaAtencion = columnIndices.direccionamientoIndex + 1;
        console.log("Colocar fecha ");
        //Fecha Atención
        const fechaAtencion = await this.reformatearFecha(
          tabBrowser.datos.fecha
        );
        console.log(fechaAtencion);
        console.log(posicionFechaAtencion);
        await tabBrowser.page.evaluate(
          (nuevoValor, posicionFechaAtencion) => {
            // Selecciona el campo de entrada de fecha utilizando el selector proporcionado

            const inputFecha = document.querySelector(
              "body > form > table:nth-child(25) > tbody > tr > td:nth-child(" +
                posicionFechaAtencion +
                ") > input[type=text]"
            );
            console.log(inputFecha);
            // Verifica si se encontró el campo de entrada antes de cambiar su valor
            if (inputFecha) {
              // Cambia el valor del campo de entrada
              inputFecha.value = nuevoValor;
            } else {
              console.error("No se encontró el campo de fecha de atención.");
            }
          },
          fechaAtencion,
          posicionFechaAtencion
        );

        try {
          await tabBrowser.page.click(
            "body > form > table:nth-child(25) > tbody > tr > td:nth-child(" +
              posicionFechaAtencion +
              ") > a:nth-child(3) > img"
          );
        } catch (err) {}
      }
    }

    console.log("esperando...");
    try {
      await tabBrowser.page.waitForSelector(
        "body > form > table:nth-child(25) > tbody > tr"
      );
    } catch (err) {
      console.log(err);
    }
    console.log("fin de la carga");

    const titleContent = await tabBrowser.page.evaluate(() => {
      const trElement = document.querySelector(
        "body > form > table:nth-child(25) > tbody > tr"
      );
      return trElement ? trElement.getAttribute("title") : null;
    });
    console.log("title" + titleContent);
    if (titleContent.includes("ERROR: LA ORDEN SE ENCUENTRA VENCIDA")) {
      tabBrowser.datos.estadoDB = 2;
      await this.falloBusqueda(
        tabBrowser,
        tabBrowser.datos.fila + " LA ORDEN SE ENCUENTRA VENCIDA",
        3
      );
      verificacion = false;
    }
    if (titleContent.includes("ORDEN NO ESTA ACTIVA PARA IMPRESION")) {
      tabBrowser.datos.estadoDB = 2;
      await this.falloBusqueda(
        tabBrowser,
        tabBrowser.datos.fila + "ORDEN NO ESTA ACTIVA PARA IMPRESION",
        3
      );
      verificacion = false;
    }
    if (titleContent.includes("ERROR: LA SOLICITUD DE TU MEDICAMENTO")) {
      tabBrowser.datos.estadoDB = 2;
      await this.falloBusqueda(
        tabBrowser,
        tabBrowser.datos.fila + " ERROR: LA SOLICITUD DE",
        3
      );
      verificacion = false;
    }

    if (verificacion) {
      const posicionAutorizacion = await this.encontrarPosicionEncabezado(
        tabBrowser.page,
        "Orden/Evento",
        "body > form > table:nth-child(25)"
      );
      if (posicionAutorizacion != -1) {
        const autorizacion = await this.obtenerContenidoCelda(
          tabBrowser.page,
          "body > form > table:nth-child(25)",
          1,
          posicionAutorizacion + 1
        );
        console.log(autorizacion);
      }
      let posicionImprimir = await this.encontrarPosicionEncabezado(
        tabBrowser.page,
        "Imprimir",
        "body > form > table:nth-child(25)"
      );
      if (posicionImprimir != -1) {
        try {
          await tabBrowser.page.waitForSelector(
            "body > form > table:nth-child(25) > tbody > tr > td:nth-child(" +
              (posicionImprimir + 1) +
              ") > center > a"
          );
        } catch (err) {
          console.log(err);
          posicionImprimir = -1;
        }
      }

      if (posicionImprimir != -1) {
        const selectorImprimir =
          "body > form > table:nth-child(25) > tbody > tr > td:nth-child(" +
          (posicionImprimir + 1) +
          ") > center > a";

        const onclickValue = await tabBrowser.page.evaluate((selector) => {
          // Seleccionar el elemento por su selector
          const element = document.querySelector(selector);
          // Obtener el valor del atributo onclick
          return element ? element.getAttribute("onclick") : null;
        }, selectorImprimir);

        //console.log(onclickValue);
        const paramsMatch = onclickValue.match(
          /imprimirOrden\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\)/
        );

        const [stLlamadaDesde, stModuloTransLog] =
          await tabBrowser.page.evaluate(() => {
            // Asegúrate de que estas variables estén definidas en el contexto global de la página
            return [
              window.stLlamadaDesde || "", // Obtener el valor de stLlamadaDesde
              window.stModuloTransLog || "", // Obtener el valor de stModuloTransLog
            ];
          });
        let errorPopUP = 0;
        console.log(stLlamadaDesde);
        console.log(stModuloTransLog);
        const newPage = await browser.newPage();
        const mensajeDialogo_1 = await this.esperarDialogoConTimeout(
          newPage,
          5000
        );
        if (mensajeDialogo_1) {
          console.log("Mensaje del diálogo:", mensajeDialogo_1);
          if (
            mensajeDialogo_1.includes("ERROR: LA SOLICITUD DE TU MEDICAMENTO")
          ) {
            errorPopUP = 1;
            console.log("error");
          } else if (mensajeDialogo_1.includes("OCURRIO UN ERROR INESPERADO")) {
            errorPopUP = 2;
          }
        }

        if (paramsMatch) {
          const [
            ,
            pTipo,
            pSolicitud,
            pConsecutivo,
            pTipide,
            pNumide,
            prestador,
          ] = paramsMatch;
          console.log("pTipo:", pTipo);
          console.log("pSolicitud:", pSolicitud);
          console.log("pConsecutivo:", pConsecutivo);
          console.log("pTipide:", pTipide);
          console.log("pNumide:", pNumide);
          console.log("prestador:", prestador);
          const nuevaUrl = await this.getURL(
            pTipo,
            pSolicitud,
            pConsecutivo,
            pTipide,
            pNumide,
            prestador,
            stLlamadaDesde,
            stModuloTransLog
          );
          console.log(nuevaUrl);

          newPage.goto(nuevaUrl);
        } else {
          console.log("No se pudieron extraer los parámetros.");
        }

        console.log("click en imprimir 1");

        console.log("click en imprimir 3");

        const newPageUrl = newPage.url();
        console.log(newPageUrl);

        let nuevaUrltmp = null;
        while (nuevaUrltmp == null) {
          if (errorPopUP != 0) {
            break;
          }
          nuevaUrltmp = await this.consultarpaginas();
          await this.delay(200);
        }
        await newPage.close();
        if (errorPopUP == 1) {
          console.log("ocurrio un error INESPERADO " + tabBrowser.datos.id);
          tabBrowser.datos.estadoDB = 2;
          await this.falloBusqueda(
            tabBrowser,
            tabBrowser.datos.fila + " No se puede Imprimir Error: Solicitud",
            3
          );
        } else if (errorPopUP == 2) {
          console.log("ocurrio un error INESPERADO " + tabBrowser.datos.id);
          await this.falloBusqueda(
            tabBrowser,
            tabBrowser.datos.fila + " ocurrio un error INESPERADO",
            3
          );
        } else {
          const nuevaUrl = nuevaUrltmp.replace(".viewer", "");
          console.log("URL de la nueva página:", nuevaUrl);
          const partes = nuevaUrl.split("/");
          const ultimoElemento = partes[partes.length - 1];
          console.log("Último elemento de la URL:", ultimoElemento);

          const newPagina = await browser.newPage();

          console.log("goto a la nueva url");
          try {
            await newPagina.goto(nuevaUrl);
          } catch (err) {
            console.log(err);
          }
          console.log("");

          /*
          await newPagina.close();        
          try{
            let popup;
            do {
              popup = await page.waitForSelector('.popup', { timeout: 3000 }).catch(() => null);
              if (popup) {
                await popup.click('.close-button'); // Cambia '.close-button' al selector del botón de cerrar del popup
              }
            } while (popup);
          }catch(err){}
          */
          //const partes = nuevaUrl.split("/");
          //const  rutaPDF = " /home/devbots/Downloads/"+ultimoElemento;
          const rutaPDF = tabBrowser.datos.ruta + "/" + ultimoElemento;
          const rutaFinalPDF = tabBrowser.datos.ruta + "/Orden_de_Cobro.pdf";
          console.log(rutaFinalPDF);
          console.log("----------------------------->>>>>>>>>>>>>>");
          await this.esperarDescargaYMover(
            rutaPDF,
            "Orden_de_Cobro.pdf",
            tabBrowser,
            newPagina
          );
        }
      } else {
        await this.falloBusqueda(
          tabBrowser,
          tabBrowser.datos.fila + " No se puede Imprimir",
          3
        );
      }
    }
    await tabBrowser.page.goto(URL_CONSULTA);
    await this.obtenerDatos(tabBrowser);
  }

  async esperarDialogoConTimeout(page, timeout = 5000) {
    return new Promise((resolve, reject) => {
      // Establecer un timeout para resolver la promesa si el diálogo no aparece
      const timer = setTimeout(() => {
        console.log(`No se detectó ningún diálogo en ${timeout} ms.`);
        resolve(null); // Resolver con null si no aparece el diálogo
      }, timeout);

      // Definir el manejador de eventos del diálogo
      const dialogHandler = async (dialog) => {
        clearTimeout(timer); // Limpiar el timeout si el diálogo aparece
        const mensaje = dialog.message(); // Capturar el mensaje del diálogo
        await dialog.accept(); // Aceptar el diálogo
        page.off("dialog", dialogHandler); // Eliminar el listener después de manejar el diálogo
        resolve(mensaje); // Resolver la promesa con el mensaje del diálogo
      };

      // Escuchar el evento de diálogo
      page.on("dialog", dialogHandler);
    });
  }

  async getURL(
    pTipo,
    pSolicitud,
    pConsecutivo,
    pTipide,
    pNumide,
    prestador,
    stLlamadaDesde,
    stModuloTransLog
  ) {
    var res = prestador.split("-");
    var prest = res[0].split(" ");
    let parametros = "";
    if (pTipo == "A") {
      var autorizacion = pConsecutivo;
      parametros =
        "respuestaArchivo=S&consecutivoSolicitud=" +
        pSolicitud +
        "&" +
        "consecutivo=" +
        autorizacion +
        "&" +
        "tipo=" +
        pTipo +
        "&tipideAtiende=" +
        prest[0] +
        "&numideAtiende=" +
        prest[1] +
        stLlamadaDesde +
        stModuloTransLog;
      parametros +=
        "&codigoTipoIdentificacion=" +
        pTipide +
        "&numeroIdePersonaNatural=" +
        pNumide;
      return (
        "https://saludweb-proc.suramericana.com/saludweb-mas/sas/sas-imprimirSolicitudOrdenCobro.do?" +
        parametros
      );
    } else {
      parametros =
        "consecutivoSolicitud=" +
        pSolicitud +
        "&" +
        "consecutivo=" +
        pConsecutivo +
        "&" +
        "tipo=" +
        pTipo +
        "&" +
        "codigoTipoIdentificacion=" +
        pTipide +
        "&" +
        "numeroIdePersonaNatural=" +
        pNumide +
        "&tipideAtiende=" +
        prest[0] +
        "&numideAtiende=" +
        prest[1];
      parametros += stLlamadaDesde + stModuloTransLog;
      return (
        "https://saludweb-proc.suramericana.com/saludweb-mas/sas/sas-imprimirSolicitudOrdenCobro.do?" +
        parametros
      );
    }
  }

  async reformatearFecha(fechaOriginal) {
    // Separar la fecha por barras
    const partes = fechaOriginal.split("/");

    // Reorganizar las partes de la fecha
    const fechaReformateada = partes[2] + "/" + partes[1] + "/" + partes[0];

    return fechaReformateada;
  }

  async console_log(estado, message) {
    console.log(message);
  }

  async findWordInPdf(pdfPath, word) {
    this.console_log(0, "lectura PDF " + pdfPath);
    try {
      // Leer el archivo PDF
      const dataBuffer = fs1.readFileSync(pdfPath);

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
      return true;
    } catch (err) {
      this.console_log(0, "Error al procesar el PDF:" + err);
      return false;
    }
  }

  async renameFile(filePath, newFileName) {
    const directory = path.dirname(filePath); // Obtiene la ruta del directorio
    const newPath = path.join(directory, newFileName); // Combina el directorio con el nuevo nombre

    try {
      await fs.rename(filePath, newPath);
      console.log(`Archivo renombrado a: ${newFileName}`);
      return newPath; // Retorna la ruta completa del archivo renombrado
    } catch (err) {
      console.error("Error al renombrar el archivo:", err);
      throw err; // Lanza el error para manejarlo fuera si es necesario
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

  async sendPDFtoShare(pdf, tabBrowser) {
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

  async esperarDescargaYMover(
    rutaDescarga,
    nuevonombre,
    tabBrowser,
    newPagina
  ) {
    let descargaCompleta = false;
    console.log(rutaDescarga);
    while (!descargaCompleta) {
      if (fs1.existsSync(rutaDescarga)) {
        // Verificar si el archivo ha terminado de descargarse
        const stats = fs1.statSync(rutaDescarga);
        if (stats.isFile()) {
          await this.closeAllPopups(tabBrowser.page);
          descargaCompleta = true;
          console.log("Descarga completa");
          const respuestaLecturaPDF = await this.findWordInPdf(
            rutaDescarga,
            "documento : 1087560457"
          );
          if (!respuestaLecturaPDF) {
            await newPagina.reload();
          } else {
            //await this.savePDFDB(rutaDescarga, tabBrowser.datos.id);
            await this.sendPDFtoShare(rutaDescarga, tabBrowser);
            try {
              //await fs.unlink(rutaDescarga);
              this.console_log(
                0,
                "Archivo original eliminado " + tabBrowser.datos.ruta
              );
              //await fs.rm(tabBrowser.datos.ruta, { recursive: true, force: true });
            } catch (err) {
              this.console_log(0, "Error al manejar el archivo:" + err);
              // Manejar error en la copia o eliminación del archivo
              await this.falloBusqueda("error con archivo", 3);
            }
          }
          /*
                // Construir la ruta de destino con el nuevo nombre
                const rutaDestino = path.join(path.dirname(rutaDescarga), nuevonombre);
                fs.renameSync(rutaDescarga, rutaDestino);
                console.log('Archivo renombrado como:', nuevonombre);
                await this.actualizarEstado(tabBrowser.datos.id, 1, "ok");
                */
        }
      } else {
        console.log("Esperando que se complete la descarga...");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Esperar 1 segundo antes de volver a verificar
      }
    }
  }

  async consultarpaginas() {
    //console.log("paginas");
    const pages = await browser.pages();
    for (let page of pages) {
      const url = page.url();
      //console.log(url)
      if (url.includes(".pdf.viewer")) {
        return url;
      }
    }
    // Si ninguna página contiene ".pdf.viewer", retornar null o alguna indicación de que no se encontró ninguna página adecuada
    return null;
  }

  async closeAllPopups(pageToKeepOpen) {
    const pages = await browser.pages();
    console.log("cerrar");
    console.log(pages);
    // Recorre todas las páginas y ciérralas, excepto la que quieres mantener abierta
    for (let page of pages) {
      if (page !== pageToKeepOpen) {
        await page.close();
      }
    }
  }

  async encontrarPosicionEncabezado(page, textoBuscar, selectorTabla) {
    try {
      const tabla = await page.$(selectorTabla);

      if (!tabla) {
        throw new Error(
          `No se encontró la tabla con el selector: ${selectorTabla}`
        );
      }

      const encabezados = await tabla.$$("thead > tr > td");
      let posicion = -1;

      for (let i = 0; i < encabezados.length; i++) {
        const nombreEncabezado = await (
          await encabezados[i].getProperty("textContent")
        ).jsonValue();
        if (nombreEncabezado.trim() === textoBuscar) {
          posicion = i;
          break;
        }
      }

      return posicion;
    } catch (error) {
      console.error("Error:", error);
      return -1; // Devuelve -1 si hay algún error
    }
  }

  async obtenerContenidoCelda(page, selectorTabla, fila, columna) {
    try {
      const tabla = await page.$(selectorTabla);

      if (!tabla) {
        throw new Error(
          `No se encontró la tabla con el selector: ${selectorTabla}`
        );
      }

      const filaSelector = `tbody > tr:nth-child(${fila})`;
      const columnaSelector = `${filaSelector} > td:nth-child(${columna})`;
      const contenidoCelda = await tabla.$eval(columnaSelector, (cell) =>
        cell.textContent.trim()
      );

      return contenidoCelda;
    } catch (error) {
      console.error("Error:", error);
      return null; // Devuelve null si hay algún error
    }
  }

  async falloBusqueda(tabBrowser, msg, status) {
    console.log(
      "fallo busqueda " + status + "estado " + tabBrowser.datos.estadoDB
    );
    if (tabBrowser.datos.estadoDB == 0) {
      console.log("ACA");
      await this.actualizarEstado(tabBrowser.datos.id, 2, "");
    } else {
      console.log("OTRO");
      const resultado = await this.agregarLineaAArchivo(
        tabBrowser.rutaErrores,
        msg + tabBrowser.datos.fila
      );
      console.log(resultado);
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

  async duplicarObjeto(objeto) {
    return JSON.parse(JSON.stringify(objeto)); // Convierte a cadena JSON y luego vuelve a convertir a objeto
  }
  //selectorSucursal = "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(1) > kendo-combobox > span > kendo-searchbar > input"
  //selectoSede = "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > form > div:nth-child(2) > div:nth-child(2) > kendo-combobox > span > kendo-searchbar > input";
  //selectorAceptar = "body > app-root > div > div > app-registrar-autorizacion > app-informacion-sede > kendo-window > div.k-content.k-window-content.ng-star-inserted > div:nth-child(6) > div > button"
  async seleccionarSede(
    tabBrowser,
    selector_Sucursal,
    selector_Sede,
    selector_Aceptar
  ) {
    console.log("seleccionar sede");
    await tabBrowser.page.focus(selector_Sucursal);
    // Escribir en el elemento
    await tabBrowser.page.keyboard.press("Backspace");
    let contadorciclo = 0;
    let valueFlecha = "ArrowDown";
    while (true) {
      await tabBrowser.page.keyboard.press(valueFlecha);
      const selector = selector_Sucursal;
      const value = await tabBrowser.page.$eval(
        selector,
        (input) => input.value
      );
      console.log(tabBrowser.datos.departamento + "=> Value:" + value);
      if (value == tabBrowser.datos.departamento) {
        await tabBrowser.page.keyboard.press("Enter");
        break;
      }
      contadorciclo++;
      if (contadorciclo > 14) {
        contadorciclo = 0;
        if (valueFlecha === "ArrowDown") {
          valueFlecha = "ArrowUp";
        } else {
          valueFlecha = "ArrowDown";
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await tabBrowser.page.focus(selector_Sede);
    while (true) {
      await tabBrowser.page.keyboard.press("ArrowDown");
      const selector = selector_Sede;
      const value = await tabBrowser.page.$eval(
        selector,
        (input) => input.value
      );
      console.log(tabBrowser.datos.sede + "=> Value:" + value);
      if (value == tabBrowser.datos.sede) {
        await tabBrowser.page.keyboard.press("Enter");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    await tabBrowser.page.focus(selector_Aceptar);
    await tabBrowser.page.click(selector_Aceptar);

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  async seleccionarDescargar(tabBrowser) {
    //while(true){}
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("empezar a descargar");
    await tabBrowser.page.waitForSelector(
      "#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr > td:nth-child(2)"
    );
    await tabBrowser.page.focus(
      "#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr > td:nth-child(2)"
    );
    await tabBrowser.page.click(
      "#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr > td:nth-child(2)"
    );

    await tabBrowser.page.waitForSelector("table.k-grid-table");

    // Obtiene todos los tr dentro del tbody de la tabla
    const filas = await tabBrowser.page.$$("table.k-grid-table tbody tr");
    // Itera sobre cada fila y muestra el contenido de la séptima columna en la consola
    const resultadoBusqueda = await this.hacerClicEnElementoPorContenido(
      filas,
      tabBrowser.datos.serial,
      7,
      7
    );
    console.log(resultadoBusqueda);
    let encontrado = false;
    let mensaje = "No Encontrado: ";
    encontrado = resultadoBusqueda.encontrado;
    if (encontrado) {
      if (resultadoBusqueda.estado.includes("Reversada")) {
        encontrado = false;
        mensaje = "Reversada: ";
      }
    }
    /*
        await tabBrowser.page.waitForSelector("#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr");
        while(true)
        {
          await tabBrowser.page.focus("#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr");
          await tabBrowser.page.click("#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr");
          const clases = await this.obtenerClasesDeElemento(tabBrowser.page,"#k-tabstrip-tabpanel-1 > form > div.row.ng-star-inserted > kendo-grid > div > kendo-grid-list > div > div.k-grid-table-wrap > table > tbody > tr");
          console.log(clases);
          if(clases.includes("k-state-selected"))
          {
            console.log("seleccionado");
            break;
          }
        }
*/
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (encontrado) {
      //imprimir
      //await tabBrowser.page.focus("#k-tabstrip-tabpanel-1 > form > div:nth-child(4) > div > kendo-menu > ul > li:nth-child(2)");
      await tabBrowser.page.click(
        "#k-tabstrip-tabpanel-1 > form > div:nth-child(4) > div > kendo-menu > ul > li:nth-child(2)"
      );

      //await tabBrowser.page.waitForSelector('body > kendo-popup > div > ul > li:nth-child(3)');
      //await tabBrowser.page.click('body > kendo-popup > div > ul > li:nth-child(3)');
      console.log("esperando alerta");
      //await this.delay(5000);
      let errorDescargar = false;

      if (!errorDescargar) {
        try {
          await tabBrowser.page.waitForSelector(
            "#k-menu1-child1 > li:nth-child(3)"
          );
          await this.hacerClickEnElemento(
            tabBrowser.page,
            "#k-menu1-child1 > li:nth-child(3) > span"
          );
        } catch (err) {
          console.log(err);
        }
      }
    } else {
      await this.falloBusqueda(tabBrowser, mensaje, 3);
      this.obtenerDatos(tabBrowser);
    }
  }

  async recorrerTablaHacerClick(filas, contenido, columna, celda) {
    console.log(contenido);
    for (let i = 0; i < filas.length; i++) {
      const contenidoCelda = await filas[i].$eval(
        "td:nth-child(" + columna + ")",
        (td) => td.textContent
      );
      console.log(contenidoCelda);
      if (contenidoCelda === contenido) {
        console.log(contenidoCelda);
        await filas[i].$eval("td:nth-child(" + celda + ") button", (button) => {
          button.click();
        });
        return true;
      }
    }
    return false;
  }

  async hacerClicEnElementoPorContenido(filas, contenido, columna, celda) {
    console.log(contenido);
    for (let i = 0; i < filas.length; i++) {
      const contenidoCelda = await filas[i].$eval(
        "td:nth-child(" + columna + ")",
        (td) => td.textContent
      );
      const contenidoCeldaEstado = await filas[i].$eval(
        "td:nth-child(" + 23 + ")",
        (td) => td.textContent
      );
      console.log(contenidoCelda);
      if (contenidoCelda === contenido) {
        console.log(contenidoCelda);
        await filas[i].$eval("td:nth-child(" + celda + ")", (td) => {
          td.click();
        });
        return {
          encontrado: true,
          estado: contenidoCeldaEstado,
          id: contenidoCelda,
        };
      }
    }
    return { encontrado: false };
  }

  async agregarLineaAArchivo(rutaArchivo, texto) {
    /*
  console.log(`Iniciando la función con ruta: ${rutaArchivo} y texto: ${texto}`);

  return new Promise((resolve, reject) => {
    console.log('Verificando si el archivo existe...');
    fs1.access(rutaArchivo, fs1.constants.F_OK, (err) => {
      if (err) {
        console.log('El archivo no existe. Se procederá a crearlo.');
        console.log('Error al verificar la existencia del archivo:', err);

        // El archivo no existe, lo creamos
        fs1.writeFile(rutaArchivo, texto + '\n', { mode: 0o777 }, (err) => {
          if (err) {
            console.error('Error al crear el archivo:', err);
            reject(err);
            return;
          }
          console.log('Archivo creado y texto añadido correctamente.');
          resolve('Se ha creado el archivo y añadido el texto correctamente.');
        });

      } else {
        console.log('El archivo ya existe. Se procederá a añadir el texto.');

        // El archivo existe, añadimos la línea
        fs1.appendFile(rutaArchivo, texto + '\n', (err) => {
          if (err) {
            console.error('Error al añadir texto al archivo:', err);
            reject(err);
            return;
          }
          console.log('Texto añadido correctamente al archivo.');
          resolve('Se ha añadido el texto al archivo correctamente.');
        });
      }
    });
  });
  */
  }

  async handleRequestAsync(request, tabBrowser) {
    const url = request.url();
    if (url.includes(".pdf")) {
      const partes = url.split("\\");
      const ultimoElemento = partes[partes.length - 1];
      console.log(ultimoElemento); // Esto imprimirá el nombre del archivo PDF
      console.log("cambio de nombre");
      const rutaDescarga = path.join(tabBrowser.datos.ruta, ultimoElemento);
      const rutaArchivo = path.join(
        tabBrowser.datos.ruta,
        "Orden de Cobro.pdf"
      );
      console.log(rutaDescarga);
      console.log(rutaArchivo);
      await this.waitForFile(rutaDescarga);
      await this.renameFile(rutaDescarga, rutaArchivo);
    }
    // Continuar con la solicitud
    request.continue();
  }

  async waitForFile(filePath) {
    while (!fs.existsSync(filePath)) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Espera 1 segundo
    }
  }
  /*
    async renameFile(oldPath, newPath) {
        await fs.promises.rename(oldPath, newPath);
    }
*/
  async obtenerTextoElemento(page, selector) {
    const texto = await page.evaluate((selector) => {
      const elemento = document.querySelector(selector);
      return elemento ? elemento.innerText.trim() : null;
    }, selector);

    return texto;
  }

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
  async hacerClickEnElemento(page, selector) {
    try {
      await page.evaluate((selector) => {
        const elemento = document.querySelector(selector);
        if (elemento) {
          elemento.click();
        } else {
          console.error(
            "No se pudo encontrar el elemento con el selector:",
            selector
          );
        }
      }, selector);
      console.log("Click realizado en el elemento con selector:", selector);
    } catch (error) {
      console.error(
        "Error al hacer clic en el elemento con selector:",
        selector,
        error
      );
    }
  }
  async obtenerClasesDeElemento(page, selector) {
    try {
      return await page.evaluate((selector) => {
        const elemento = document.querySelector(selector);
        return Array.from(elemento.classList);
      }, selector);
    } catch (err) {}
  }

  async delay(tiempo) {
    return new Promise((resolve) => setTimeout(resolve, tiempo));
  }
}

module.exports = BotSura;
