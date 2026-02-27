const express = require("express");

const app = express();

// Middleware para leer JSON
app.use(express.json());

// Importar rutas de autenticación
const authRoutes = require("./routes/auth.routes");
const driverRoutes = require("./routes/driver.routes");
const tripRoutes = require("./routes/trip.routes");
const testRoutes = require("./routes/test.routes");


// Rutas de autenticación con prefijo /auth
app.use("/auth", authRoutes);
app.use("/driver", driverRoutes);
app.use("/trip", tripRoutes);
app.use("/test", testRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({ message: "API Mototaxi funcionando" });
});



module.exports = app;

