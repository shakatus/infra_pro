const BotSura = require('./BotSura');
const pool = require('./db');
const os = require('os');
const getID = require('./iplocal');


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

    const redVPC = "10.20.30.0";
    const idBOT = "1";

    const identificador = await getID(redVPC,idBOT,inicio)
    

    manageBots(cantidad, pool, identificador, inicio)
    .then(() => console.log('Todos los bots han terminado.'))
    .catch(err => console.error('Error:', err));

    /*
    //await actualizarBot(1,0,'sura'+inicio+"_"+cantidad+"_"+cantidadPestañas,ip,'SURA', pool)
    const manejadores = [];

    // Crear las instancias y almacenarlas en el array
    for (let i = 0; i < cantidad; i++) {
        manejadores.push(new BotSura(pool, ip));
    }

    // Crear un array de promesas ejecutando el método main para cada instancia
    const promesas = manejadores.map((manejador, index) => {
        console.log(identificador.toString() + (index+inicio));
        manejador.main(identificador.toString() + (index+inicio));
    });

    // Esperar a que todas las promesas se resuelvan concurrentemente
    await Promise.all(promesas);
    */
}
async function manageBots(cantidad, pool, identificador, inicio) {
    let manejadores = [];

    // Crear y ejecutar instancias iniciales
    for (let i = 0; i < cantidad; i++) {
        let bot = new BotSura(pool);
        manejadores.push(bot);
        console.log(identificador.toString());
        await bot.main(identificador.toString(),inicio);
    }

    // Limpiar recursos y recrear objetos
    for (let i = 0; i < cantidad; i++) {
        // Limpiar recursos del objeto actual
        await manejadores[i].cleanup();

        // Crear un nuevo objeto para reemplazar el anterior
        manejadores[i] = new BotSura(pool, ip);
        console.log(identificador.toString() + (i + inicio));
        await manejadores[i].main(identificador.toString() + (i + inicio));
    }
}// Llamar a la función asincrónica para ejecutar el código
ejecutarMainConcurrentemente().catch(error => console.error(error));
