require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3000;

// No exponer valores sensibles en logs (Railway/producción)
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "OK" : "NO DEFINIDO");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "OK" : "NO DEFINIDO");
console.log("Servidor iniciando...");

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

