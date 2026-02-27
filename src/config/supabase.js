/**
 * Configuración de Supabase
 * 
 * Este archivo inicializa el cliente de Supabase usando las credenciales
 * desde las variables de entorno.
 */

const { createClient } = require("@supabase/supabase-js");

// Obtener las credenciales desde las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Validar que las variables de entorno estén definidas
if (!supabaseUrl) {
  throw new Error("SUPABASE_URL no está definida en las variables de entorno");
}

if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_KEY no está definida en las variables de entorno");
}

// Crear e inicializar el cliente de Supabase
// Se usa SUPABASE_SERVICE_KEY (service role key) para tener acceso completo
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Exportar el cliente
module.exports = supabase;








