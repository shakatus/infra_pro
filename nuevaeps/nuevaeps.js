const BotNuevaEPS = require('./BotNuevaEPS');
const pool = require('./db');
const os = require('os');
const readline = require('readline');
const getIP = require('./iplocal');


const vpnRed = "10.20.30.0";
console.log(vpnRed)

let manejadores = [];

function leerDesdeConsola() 
{
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        rl.question('', (respuesta) => {
            resolve(respuesta);
        });
    });
}

async function manejarEmit(manejador, mensaje) {
    // Emitir evento 'datos' en la instancia de ManejadorTareas
    manejador.emit('datos', mensaje);
}

async function manejarEntrada(entrada) 
{
    console.log('Recibido:', entrada);
    // Realizar diferentes acciones según la entrada del usuario
    const entradaTrimmed = entrada.trim();
    if (entradaTrimmed === 'salir') {
        manejadores.forEach(manejador => {
            manejador.salir();
        });
        console.log('Realizando acción 1...');
    } else if (entradaTrimmed.startsWith('pausa')) {
        const numero = entradaTrimmed.substring(5); // 'pausa'.length === 5
        if (!isNaN(numero)) {
            // Código si la entrada es 'pausa' seguido de un número válido
            manejadores.forEach(manejador => {
                manejador.pausa(numero);
                console.log(`Envio Pausa en posicion: ${numero}`);
            });
        } else {
            // Código si la entrada comienza con 'pausa' pero no sigue con un número válido
            console.log(`Entrada 'pausa' pero número inválido: ${numero}`);
        }
    } else {
        manejadores.forEach(manejador => {
            manejarEmit(manejador, entradaTrimmed);
        });
        console.log('Entrada no reconocida.');
    }   
}

async function datosUsuario()
{
  while (true) {
      const entrada = await leerDesdeConsola();
      await manejarEntrada(entrada);
  }
}

async function ejecutarMainConcurrentemente() {
    let cantidad = 1;
    let cantidadPestañas = 1;
    let inicio = 0;
    if(process.argv[3])
    {
      cantidad = parseInt(process.argv[2]);
      cantidadPestañas = parseInt(process.argv[3]);      
    }else{
      inicio = parseInt(process.argv[2]);
    } 
    

    const redVPC = "";
    const idBOT = "2";

    const identificador = await getIP(redVPC,idBOT,inicio)
    

    //await actualizarBot(1,1,'nuevaeps_'+inicio+"_"+cantidad+"_"+cantidadPestañas,ip,'NuevaEPS', pool)

    // Crear las instancias y almacenarlas en el array
    for (let i = 0; i < cantidad; i++) {
        manejadores.push(new BotNuevaEPS(pool));
    }

    // Crear un array de promesas ejecutando el método main para cada instancia
    const promesas = manejadores.map((manejador, index) => {        
        manejador.main(identificador, inicio);
    });

    // Esperar a que todas las promesas se resuelvan concurrentemente
    await Promise.all(promesas);

    datosUsuario();
}
async function actualizarBot(estado, comando, nombre, ip, tipo, pool) {     
  try {
      await new Promise((resolve, reject) => {
          pool.getConnection((error, connection) => {
              if (error) {
                  console.error('Error al obtener la conexión:', error);
                  reject(error);
                  return;
              }

              const sql = "INSERT INTO bots (estado, comando, eps, ipaddress, nombre) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE estado = VALUES(estado), comando = VALUES(comando), eps = VALUES(eps), ipaddress = VALUES(ipaddress)";
              const params = [estado, comando, tipo, ip, nombre];

              connection.query(sql, params, (err, result) => {
                  connection.release();
                  if (err) {
                      console.error('Error al ejecutar la consulta:', err);
                      reject(err);
                      return;
                  }

                  console.log(result);
                  resolve(result);
              });
          });
      });         
  } catch (error) {
      console.error('Error al actualizar el estado:', error);
      throw error;
  }
}
// Llamar a la función asincrónica para ejecutar el código
ejecutarMainConcurrentemente().catch(error => console.error(error));
