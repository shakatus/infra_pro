const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

async function extractTextFromPdf(pdfPath) {
    return new Promise((resolve, reject) => {
        // El comando '-layout' conserva el formato y '-' envía la salida a la consola
        const cmd = `pdftotext -layout "${pdfPath}" -`;

        // Ejecutar el comando pdftotext
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(`Error al ejecutar pdftotext: ${stderr}`);
                return;
            }
            resolve(stdout); // stdout contiene el texto extraído
        });
    });
}

async function removeSecondUnderscore(input) {
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



async function leerPDF(pdfFilePath, word, eps, cantidadArch) {
    try {
        // Usamos await para extraer el texto del PDF
        const textoM = await extractTextFromPdf(pdfFilePath);
        console.log("__________________________________DDDDD_____________________________________________________");
        //console.log(pdfFilePath);
        // Aquí puedes buscar la palabra 'word' en el texto extraído
        const text = textoM.toLowerCase();
        if (text.includes("factura electronica")) {
            console.log("FACTURA");
            cantidadArch.factura++;
            const duplicado = cantidadArch.factura > 1 ? "_" + cantidadArch.factura : "";
            if(eps == "SURA")
            { 
                //console.log(word);
                //console.log(duplicado);
                return word+duplicado+".pdf";
            }
            else if(eps == "NuevaEPS"){
                const name = await removeSecondUnderscore(word);
                return "FVS_"+name+duplicado+".pdf";
            }
            else if(eps == "SaludTotal"){
                return word+"_1_"+cantidadArch.factura+".pdf";
            }else{
                //console.log("FACTURA DE VENTA");
            }
        }
        else if(text.includes("formato descripción quirúrgica"))
        {
            console.log("DESCRIPCION");
            cantidadArch.descripcion++;
            const duplicado = cantidadArch.descripcion > 1 ? "_" + cantidadArch.descripcion : "";
            ////console.log("Descripción "+ cantidadArch.descripcion);
            if(eps == "SURA")
            {
                //console.log(duplicado);
                return "DESCRIPCION QUIRUGICA"+duplicado+".pdf";
            }
            else if(eps == "NuevaEPS"){
                const name = await removeSecondUnderscore(word);
                return "RAA_"+name+duplicado+".pdf";
            }
            else if(eps == "SaludTotal"){
                return word+"_8_"+cantidadArch.descripcion+".pdf";
            }else{
                //console.log("DESCRIPCION QUIRUGICA");
            }
            
        }
                              //"**** FIN REPORTE***"
        else if(text.includes("**** fin reporte***"))
        {
            console.log("HC");
            cantidadArch.historiaC++;
            const duplicado = cantidadArch.historiaC > 1 ? "_" + cantidadArch.historiaC : "";
            ////console.log("HC "+ cantidadArch.historiaC);
            if(eps == "SURA")
            {
                //console.log(duplicado);
                return "HISTORIA CLINICA"+duplicado+".pdf";
            }
            else if(eps == "NuevaEPS"){
                const name = await removeSecondUnderscore(word);
                return "RAA_"+name+duplicado+".pdf";
            }
            else if(eps == "SaludTotal"){
                return word+"_5_"+cantidadArch.historiaC+".pdf";
            }else{
                //console.log("HISTORIA CLINICA");
            }
        }else{
            console.log("no encontramos")
        }
    } catch (error) {
        // Manejamos los errores con try/catch
        console.error("Error:", error);
    }
}
//pdf_a_editar, carpeta donde esta, nuevo archivo
async function renombrarPDF(ruta_archivo_a_renombrar, directoryPath, nuevo_nombre) 
{
    let newFullPath = path.join(directoryPath, nuevo_nombre); // Genera la nueva ruta con el nuevo nombre
    if(newFullPath === ruta_archivo_a_renombrar)
    {
        return;
    }
    try {
        // Mientras el archivo con el nuevo nombre ya exista, genera un nombre único para evitar colisiones
        let counter = 1;
        while (true) {
            try {
                // Verifica si el archivo con el nuevo nombre ya existe
                await fs.access(newFullPath);

                // Si el archivo ya existe, generar un nuevo nombre con un número incremental
                const ext = path.extname(nuevo_nombre); // Obtener la extensión (.pdf)
                const baseName = path.basename(nuevo_nombre, ext); // Obtener el nombre sin la extensión

                // Generar un nuevo nombre agregando el contador
                newFullPath = path.join(directoryPath, `${baseName}_${counter}${ext}`);
                counter++;
            } catch (err) {
                if (err.code === 'ENOENT') {
                    // Si el archivo no existe, salir del bucle
                    break;
                }
                throw err;
            }
        }

        // Renombra el archivo original al nuevo nombre generado
        console.log("Archivo renombrado a: " + newFullPath);
        await fs.rename(ruta_archivo_a_renombrar, newFullPath);
    } catch (renameErr) {
        console.log(`Error al renombrar el archivo: ${renameErr}`);
    }
}
    


// Función para recorrer todas las carpetas dentro de un directorio
async function readDirectories(directoryPath, eps) {
    try {
        const files = await fs.readdir(directoryPath);
        for (const file of files) {
            const fullPath = path.join(directoryPath, file);
            const stats = await fs.stat(fullPath);
            
            if (stats.isDirectory()) {
                // Si es un directorio, imprime su nombre
                ////console.log(`Directorio encontrado: ${fullPath}`);
                // Ahora recorre todos los archivos dentro de este directorio

                await readFilesInDirectory(fullPath, eps);
            }
        }
    } catch (err) {
        console.error(`Error leyendo el directorio ${directoryPath}:`, err);
    }
}
let cantidad = 0;
// Función para recorrer todos los archivos dentro de una carpeta
async function readFilesInDirectory(directoryPath, eps) {
    try {
        const files = await fs.readdir(directoryPath);
        const lastFolder = path.basename(directoryPath);
        let cantidadArch = { factura: 0, historiaC: 0, descripcion: 0, url:  lastFolder};
        console.log("entramos a la carpeta "+directoryPath);
        for (const file of files) {
            const fullPath = path.join(directoryPath, file);
            const stats = await fs.stat(fullPath);
            
            if (!stats.isDirectory()) {
                if (path.extname(fullPath).toLowerCase() === '.pdf') {
                    cantidad++;
                    console.log("leemos el pdf "+fullPath)
                    const nombreFile = await leerPDF(fullPath,lastFolder, eps, cantidadArch);
                    if(nombreFile){
                        console.log("el nuevo nombre es "+nombreFile)
                        //console.log("nombre "+nombreFile)                    
                        await renombrarPDF(fullPath, directoryPath,nombreFile);
                    }
                }
            }
        }
        //console.log(cantidadArch);
    } catch (err) {
        console.error(`Error leyendo el directorio ${directoryPath}:`, err);
    }
}

// Exportar la función
module.exports = { readDirectories };
