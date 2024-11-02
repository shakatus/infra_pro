const os = require('os');

async function getID(red, bot, id) {
	const interfaces = os.networkInterfaces();
    let ip;
    let found = false;

    Object.keys(interfaces).forEach((interfaceName) => {
        interfaces[interfaceName].forEach((iface) => {
            // Ignorar direcciones IP de loopback y IPv6        
            if (iface.address.includes("10.20.30")) {
                ip = iface.address;
                found = true;
                return; // Detiene la iteración actual, similar a break
            }
        });
        if (found) return; // Detiene la iteración externa si ya se ha encontrado la dirección IP
    });   
    const ultimoNumero = ip.split('.').pop();
    const identificador = bot + ultimoNumero.padStart(3, '0')+id;
    return identificador;

}

module.exports = getID;
