const pool = require('./dbConnection');
const config = require('/home/devbots/supervisor/.env/config');
const axios = require('axios');

// Use environment variable for token
const LINODE_API_TOKEN = process.env.LINODE_API_TOKEN || '78043c8adbf35e11601506aea6984cb05cd2ab514a4125563a9ed3f541ab9715';

// Configurar los encabezados para autenticación
const headers = {
  Authorization: `Bearer ${LINODE_API_TOKEN}`,
  'Content-Type': 'application/json',
};

// Main function
async function main() {
  const fetch = (await import('node-fetch')).default; // Dynamic import moved inside async function
  const linode_id = config.LINODE_ID;
  console.log(linode_id);
  
  await registrar(linode_id);
  
  if (linode_id === "65444152") {
    console.log("No se puede eliminar");
  } else {
    while (true) {
      await eliminarInstancia(linode_id, fetch); // Pass fetch as a parameter
      await delay(5000); // Wait for 5 seconds before retrying
    }
  }
}

// Function to delay execution
async function delay(tiempo) {
  return new Promise(resolve => setTimeout(resolve, tiempo));
}

// Function to perform SQL registration
async function registrar(linode_id) {
  try {
    const sql = `
      DELETE FROM ec2 
      WHERE linode_id = $1
      AND aws_id IS NULL
    `;

    console.log('Consulta SQL:', sql);
    console.log('Valores:', [linode_id]);

    const result = await pool.query(sql, [linode_id]);
    console.log('Resultado de la consulta:', result);

    return result;
  } catch (error) {
    console.error('Error al actualizar el estado:', error);
    throw error;
  }
}

// Function to delete a Linode instance
async function eliminarInstancia(INSTANCE_ID, fetch) {
  const url = `https://api.linode.com/v4/linode/instances/${INSTANCE_ID}`;
  
  const options = {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${LINODE_API_TOKEN}` // Use the token from the variable
    }
  };

  try {
    const res = await fetch(url, options);
    
    if (!res.ok) {
      const errorResponse = await res.json();
      throw new Error(`Error: ${errorResponse.errors[0].reason}`);
    }

    const json = await res.json();
    console.log(`Instancia con ID ${INSTANCE_ID} eliminada con éxito:`, json);

  } catch (err) {
    console.error(`Error al eliminar la instancia: ${err.message}`);
  }
}

// Run main function
main();
