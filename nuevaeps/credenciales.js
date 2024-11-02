const pool = require('./db');
const config = require('/home/devbots/supervisor/.env/config');

async function obtenerCredenciales(empresaId, botId) {
  try {
    const query = `
      SELECT etiqueta, pgp_sym_decrypt(valor_cifrado, $1) AS valor_descifrado
      FROM datos
      WHERE id_empresa = $2
      AND bot_id IN (0, $3)
    `;

    const values = [config.PASSWORD_CRYPTO, empresaId, botId];

    const res = await pool.query(query, values);
    return res.rows; // Devuelve los resultados de la consulta
  } catch (err) {
    console.error('Error ejecutando la consulta', err);
    throw err;
  }
}

module.exports = { obtenerCredenciales };
