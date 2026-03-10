/*
  # Energy Monitoring System - Complete Database Schema

  1. New Tables
    - `profiles` - User profiles with roles and site assignments
      - `id` (uuid, primary key, references auth.users)
      - `usuario` (text, unique) - Username
      - `rol` (text) - Role: Administrador, Operador, Tecnico, Observador
      - `sitios_asignados` (text[]) - Assigned sites
      - `activo` (boolean) - Active status
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `threshold_configs` - Global threshold settings
      - `id` (uuid, primary key)
      - `threshold_key` (text, unique) - Threshold identifier
      - `value` (numeric) - Threshold value
      - `unit` (text) - Unit of measurement
      - `description` (text) - Description
      - `created_at` / `updated_at` (timestamptz)
    - `rack_threshold_overrides` - Per-rack threshold overrides
      - `id` (uuid, primary key)
      - `rack_id` (text) - Rack identifier
      - `threshold_key` (text) - Threshold identifier
      - `value` (numeric) - Override value
      - `unit` (text) - Unit
      - `description` (text)
      - `created_at` / `updated_at` (timestamptz)
    - `maintenance_entries` - Maintenance records
      - `id` (uuid, primary key)
      - `entry_type` (text) - 'individual_rack' or 'chain'
      - `rack_id` (text) - Rack identifier (nullable)
      - `chain` (text) - Chain identifier (nullable)
      - `site` (text) - Site name
      - `dc` (text) - Data center
      - `reason` (text) - Maintenance reason
      - `started_by` (text) - User who started
      - `started_at` (timestamptz)
      - `created_at` (timestamptz)
    - `maintenance_rack_details` - Individual racks in maintenance
      - `id` (uuid, primary key)
      - `entry_id` (uuid, references maintenance_entries)
      - `rack_id` (text)
      - `name` (text)
      - `country` (text)
      - `site` (text)
      - `dc` (text)
      - `phase` (text)
      - `chain` (text)
      - `node` (text)
      - `gw_name` (text)
      - `gw_ip` (text)

  2. Security
    - RLS enabled on all tables
    - Authenticated users can read all data
    - Only authenticated users can insert/update/delete based on role
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario text UNIQUE NOT NULL,
  rol text NOT NULL DEFAULT 'Observador' CHECK (rol IN ('Administrador', 'Operador', 'Tecnico', 'Observador')),
  sitios_asignados text[] DEFAULT '{}',
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.rol = 'Administrador'
    )
    OR NOT EXISTS (SELECT 1 FROM profiles)
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.rol = 'Administrador'
    )
  );

-- Threshold configs table
CREATE TABLE IF NOT EXISTS threshold_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_key text UNIQUE NOT NULL,
  value numeric(18,4) NOT NULL,
  unit text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE threshold_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read thresholds"
  ON threshold_configs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert thresholds"
  ON threshold_configs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update thresholds"
  ON threshold_configs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Rack threshold overrides
CREATE TABLE IF NOT EXISTS rack_threshold_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id text NOT NULL,
  threshold_key text NOT NULL,
  value numeric(18,4) NOT NULL,
  unit text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rack_id, threshold_key)
);

CREATE INDEX IF NOT EXISTS idx_rack_overrides_rack_id ON rack_threshold_overrides(rack_id);
CREATE INDEX IF NOT EXISTS idx_rack_overrides_key ON rack_threshold_overrides(threshold_key);

ALTER TABLE rack_threshold_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rack overrides"
  ON rack_threshold_overrides FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert rack overrides"
  ON rack_threshold_overrides FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update rack overrides"
  ON rack_threshold_overrides FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete rack overrides"
  ON rack_threshold_overrides FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Maintenance entries
CREATE TABLE IF NOT EXISTS maintenance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL DEFAULT 'individual_rack' CHECK (entry_type IN ('individual_rack', 'chain')),
  rack_id text,
  chain text,
  site text DEFAULT '',
  dc text DEFAULT '',
  reason text DEFAULT 'Mantenimiento programado',
  started_by text DEFAULT '',
  started_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_entries_type ON maintenance_entries(entry_type);

ALTER TABLE maintenance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read maintenance"
  ON maintenance_entries FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert maintenance"
  ON maintenance_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete maintenance"
  ON maintenance_entries FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Maintenance rack details
CREATE TABLE IF NOT EXISTS maintenance_rack_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES maintenance_entries(id) ON DELETE CASCADE,
  rack_id text NOT NULL,
  name text DEFAULT '',
  country text DEFAULT '',
  site text DEFAULT '',
  dc text DEFAULT '',
  phase text DEFAULT '',
  chain text DEFAULT '',
  node text DEFAULT '',
  gw_name text DEFAULT '',
  gw_ip text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_maint_details_entry ON maintenance_rack_details(entry_id);
CREATE INDEX IF NOT EXISTS idx_maint_details_rack ON maintenance_rack_details(rack_id);

ALTER TABLE maintenance_rack_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read maintenance details"
  ON maintenance_rack_details FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert maintenance details"
  ON maintenance_rack_details FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete maintenance details"
  ON maintenance_rack_details FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Insert default thresholds
INSERT INTO threshold_configs (threshold_key, value, unit, description) VALUES
  ('critical_temperature_low', 5.0, 'C', 'Temperatura critica minima'),
  ('critical_temperature_high', 40.0, 'C', 'Temperatura critica maxima'),
  ('warning_temperature_low', 10.0, 'C', 'Temperatura advertencia minima'),
  ('warning_temperature_high', 30.0, 'C', 'Temperatura advertencia maxima'),
  ('critical_humidity_low', 20.0, '%', 'Humedad critica minima'),
  ('critical_humidity_high', 80.0, '%', 'Humedad critica maxima'),
  ('warning_humidity_low', 30.0, '%', 'Humedad advertencia minima'),
  ('warning_humidity_high', 70.0, '%', 'Humedad advertencia maxima'),
  ('critical_amperage_low_single_phase', 1.0, 'A', 'Amperaje critico minimo monofasico'),
  ('critical_amperage_high_single_phase', 25.0, 'A', 'Amperaje critico maximo monofasico'),
  ('warning_amperage_low_single_phase', 2.0, 'A', 'Amperaje advertencia minimo monofasico'),
  ('warning_amperage_high_single_phase', 20.0, 'A', 'Amperaje advertencia maximo monofasico'),
  ('critical_amperage_low_3_phase', 1.0, 'A', 'Amperaje critico minimo trifasico'),
  ('critical_amperage_high_3_phase', 30.0, 'A', 'Amperaje critico maximo trifasico'),
  ('warning_amperage_low_3_phase', 2.0, 'A', 'Amperaje advertencia minimo trifasico'),
  ('warning_amperage_high_3_phase', 25.0, 'A', 'Amperaje advertencia maximo trifasico'),
  ('critical_voltage_low', 0.0, 'V', 'Voltaje critico minimo'),
  ('critical_voltage_high', 250.0, 'V', 'Voltaje critico maximo'),
  ('warning_voltage_low', 0.0, 'V', 'Voltaje advertencia minimo'),
  ('warning_voltage_high', 240.0, 'V', 'Voltaje advertencia maximo'),
  ('critical_power_high', 5000.0, 'W', 'Potencia critica maxima'),
  ('warning_power_high', 4000.0, 'W', 'Potencia advertencia maxima')
ON CONFLICT (threshold_key) DO NOTHING;
