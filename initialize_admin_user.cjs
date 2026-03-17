/**
 * Script para inicializar el usuario administrador con contraseña hasheada
 *
 * Este script:
 * 1. Se conecta a SQL Server
 * 2. Verifica si existe la tabla users
 * 3. Crea un usuario administrador con contraseña hasheada usando bcrypt
 *
 * Ejecutar este script DESPUÉS de ejecutar create_users_table.sql
 *
 * Uso: node initialize_admin_user.cjs
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const sqlConfig = {
  server: process.env.SQL_SERVER_HOST || 'localhost',
  database: process.env.SQL_SERVER_DATABASE || 'energy_monitor_db',
  user: process.env.SQL_SERVER_USER || 'sa',
  password: process.env.SQL_SERVER_PASSWORD,
  port: parseInt(process.env.SQL_SERVER_PORT) || 1433,
  options: {
    encrypt: process.env.SQL_SERVER_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function initializeAdminUser() {
  let pool = null;

  try {
    console.log('🔄 Conectando a SQL Server...');
    pool = await sql.connect(sqlConfig);
    console.log('✅ Conectado a SQL Server');

    // Check if users table exists
    const tableCheck = await pool.request().query(`
      SELECT COUNT(*) as tableExists
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'users'
    `);

    if (tableCheck.recordset[0].tableExists === 0) {
      console.error('❌ La tabla "users" no existe. Por favor ejecute primero el script create_users_table.sql');
      process.exit(1);
    }

    console.log('✅ Tabla "users" encontrada');

    // Check if admin user already exists
    const adminCheck = await pool.request()
      .input('usuario', sql.NVarChar, 'admin')
      .query('SELECT id FROM users WHERE usuario = @usuario');

    if (adminCheck.recordset.length > 0) {
      console.log('ℹ️  El usuario administrador ya existe. Actualizando contraseña...');

      // Hash password
      const password = 'Admin123!';
      const passwordHash = await bcrypt.hash(password, 10);

      // Update admin user
      await pool.request()
        .input('usuario', sql.NVarChar, 'admin')
        .input('password_hash', sql.NVarChar, passwordHash)
        .input('fecha_modificacion', sql.DateTime, new Date())
        .query(`
          UPDATE users
          SET password_hash = @password_hash, fecha_modificacion = @fecha_modificacion
          WHERE usuario = @usuario
        `);

      console.log('✅ Contraseña del usuario administrador actualizada');
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  CREDENCIALES DEL ADMINISTRADOR');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  Usuario:     admin');
      console.log('  Contraseña:  Admin123!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

    } else {
      console.log('🔄 Creando usuario administrador...');

      // Hash password
      const password = 'Admin123!';
      const passwordHash = await bcrypt.hash(password, 10);

      // Create admin user
      await pool.request()
        .input('id', sql.UniqueIdentifier, sql.newGuid())
        .input('usuario', sql.NVarChar, 'admin')
        .input('password_hash', sql.NVarChar, passwordHash)
        .input('rol', sql.NVarChar, 'Administrador')
        .input('activo', sql.Bit, true)
        .input('fecha_creacion', sql.DateTime, new Date())
        .input('fecha_modificacion', sql.DateTime, new Date())
        .query(`
          INSERT INTO users (id, usuario, password_hash, rol, activo, fecha_creacion, fecha_modificacion)
          VALUES (NEWID(), @usuario, @password_hash, @rol, @activo, @fecha_creacion, @fecha_modificacion)
        `);

      console.log('✅ Usuario administrador creado exitosamente');
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  CREDENCIALES DEL ADMINISTRADOR');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  Usuario:     admin');
      console.log('  Contraseña:  Admin123!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
    }

    // Show all users in database
    const allUsers = await pool.request().query('SELECT usuario, rol, activo, fecha_creacion FROM users');
    console.log('Usuarios en la base de datos:');
    console.table(allUsers.recordset);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Execute
initializeAdminUser();
