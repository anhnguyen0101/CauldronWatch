CREATE TABLE cauldrons (
	id VARCHAR NOT NULL, 
	name VARCHAR, 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	max_volume FLOAT NOT NULL, 
	last_updated DATETIME, 
	PRIMARY KEY (id)
);
CREATE TABLE historical_data (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, 
	cauldron_id VARCHAR NOT NULL, 
	timestamp DATETIME NOT NULL, 
	level FLOAT NOT NULL, 
	fill_rate FLOAT, 
	created_at DATETIME
);
CREATE TABLE sqlite_sequence(name,seq);
CREATE INDEX ix_historical_data_timestamp ON historical_data (timestamp);
CREATE INDEX ix_historical_data_cauldron_id ON historical_data (cauldron_id);
CREATE TABLE tickets (
	ticket_id VARCHAR NOT NULL, 
	cauldron_id VARCHAR NOT NULL, 
	date VARCHAR NOT NULL, 
	amount_collected FLOAT NOT NULL, 
	courier_id VARCHAR NOT NULL, 
	last_updated DATETIME, 
	PRIMARY KEY (ticket_id)
);
CREATE INDEX ix_tickets_date ON tickets (date);
CREATE INDEX ix_tickets_cauldron_id ON tickets (cauldron_id);
CREATE TABLE market (
	id VARCHAR NOT NULL, 
	name VARCHAR, 
	description TEXT, 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	last_updated DATETIME, 
	PRIMARY KEY (id)
);
CREATE TABLE couriers (
	courier_id VARCHAR NOT NULL, 
	name VARCHAR, 
	capacity FLOAT, 
	speed FLOAT, 
	last_updated DATETIME, 
	PRIMARY KEY (courier_id)
);
CREATE TABLE cache_metadata (
	"key" VARCHAR NOT NULL, 
	value TEXT, 
	last_updated DATETIME, 
	PRIMARY KEY ("key")
);
