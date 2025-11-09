-- CauldronWatch Database Schema
-- Generated from SQLAlchemy models
-- Database: SQLite

-- Cauldrons table
CREATE TABLE IF NOT EXISTS cauldrons (
    id VARCHAR NOT NULL PRIMARY KEY,
    name VARCHAR,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    max_volume FLOAT NOT NULL,
    last_updated DATETIME
);

-- Historical data table
CREATE TABLE IF NOT EXISTS historical_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cauldron_id VARCHAR NOT NULL,
    timestamp DATETIME NOT NULL,
    level FLOAT NOT NULL,
    fill_rate FLOAT,
    created_at DATETIME
);

-- Indexes for historical_data
CREATE INDEX IF NOT EXISTS idx_historical_data_cauldron_id ON historical_data(cauldron_id);
CREATE INDEX IF NOT EXISTS idx_historical_data_timestamp ON historical_data(timestamp);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id VARCHAR NOT NULL PRIMARY KEY,
    cauldron_id VARCHAR NOT NULL,
    date VARCHAR NOT NULL,
    amount_collected FLOAT NOT NULL,
    courier_id VARCHAR NOT NULL,
    last_updated DATETIME
);

-- Indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_cauldron_id ON tickets(cauldron_id);
CREATE INDEX IF NOT EXISTS idx_tickets_date ON tickets(date);

-- Market table
CREATE TABLE IF NOT EXISTS market (
    id VARCHAR NOT NULL PRIMARY KEY,
    name VARCHAR,
    description TEXT,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    last_updated DATETIME
);

-- Couriers table
CREATE TABLE IF NOT EXISTS couriers (
    courier_id VARCHAR NOT NULL PRIMARY KEY,
    name VARCHAR,
    capacity FLOAT,
    speed FLOAT,
    last_updated DATETIME
);

-- Cache metadata table
CREATE TABLE IF NOT EXISTS cache_metadata (
    key VARCHAR NOT NULL PRIMARY KEY,
    value TEXT,
    last_updated DATETIME
);

