'use strict';

const Sequelize = require('sequelize');
const { dbConfig } = require('../config/db.config.js');
const { createClient } = require('@clickhouse/client');
const { CONFIG } = require('../config/config.js');
const db = {};

// ClickHouse client setup
const clickhouse = createClient({
  url: CONFIG.CLICKHOUSE_URL,
  username: CONFIG.CLICKHOUSE_USER,
  password: CONFIG.CLICKHOUSE_PASSWORD,
  database: CONFIG.CLICKHOUSE_DB,
  debug: false,
});

// Ping ClickHouse to check the connection
clickhouse.ping()
  .then(() => {
    console.log('ClickHouse connection successful');
  })
  .catch((error) => {
    console.error('Error connecting to ClickHouse:', error);
  });

// Function to sync structure with ClickHouse
const syncStructureWithClickHouse = async (sequelize) => {
  const models = sequelize.models;
  for (const modelName in models) {
    const model = models[modelName];
    const attributes = model.rawAttributes;
    const columns = Object.keys(attributes).map(attr => {
      const attribute = attributes[attr];
      if (!attribute || !attribute.type) {
        console.warn(`Skipping attribute ${attr} for model ${modelName} due to missing type`);
        return null;
      }
      let type;
      switch (attribute.type.key) {
        case 'INTEGER':
          type = 'Int32';
          break;
        case 'FLOAT':
          type = 'Float32';
          break;
        case 'STRING':
          type = 'String';
          break;
        case 'ENUM':
          type = 'String';
          break;
        default:
          type = 'String';
      }
      return `${attr} ${type}`;
    }).filter(column => column !== null).join(', ');

    const dropTableQuery = `DROP TABLE IF EXISTS ${modelName}`;
    console.log('Dropping table if exists:', dropTableQuery);
    await clickhouse.exec({ query: dropTableQuery });
  
    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${modelName} (${columns}) ENGINE = MergeTree() ORDER BY id`;
    console.log('Creating table:', createTableQuery);
    await clickhouse.exec({ query: createTableQuery });
  }
};

// Function to dump data to ClickHouse
const dumpDataToClickHouse = async (sequelize) => {
  const models = sequelize.models;
  for (const modelName in models) {
    const model = models[modelName];
    const data = await model.findAll({ raw: true });
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      const insertQuery = `INSERT INTO ${modelName} (${columns.join(', ')}) VALUES`;
      const values = data.map(row => {
        return `(${columns.map(col => {
          let value = row[col];
          if (typeof value === 'number' && isNaN(value)) {
            value = null; // Replace NaN with null
          }
          if (value === null || value === undefined) {
            return 'NULL';
          }
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "\\'")}'`; // Escape single quotes in strings
          }
          if (value instanceof Date) {
            return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`; // Format date strings
          }
          if (typeof value === 'object') {
            return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`; // Convert objects to JSON strings
          }
          return value;
        }).join(', ')})`;
      }).join(', ');
      const fullQuery = `${insertQuery} ${values}`;
      console.log(`Inserting data for ${modelName}`);
      await clickhouse.exec({ query: fullQuery });
    }
  }
};

// Helper function to handle ClickHouse operations safely
const handleClickHouseOperation = async (operation) => {
  try {
    await operation();
  } catch (error) {
    console.error('ClickHouse Operation Failed:', error.message);
  }
};

// Setup database connection
let dbConnection = new Sequelize(
  dbConfig.database, 
  dbConfig.username, 
  dbConfig.password, 
  dbConfig
);

// Database synchronization function with integrated ClickHouse sync
let syncDB = async () => {
  try {
    // First sync MySQL database
    await dbConnection.sync({ alter: true, force: false });
    console.log('MySQL database successfully synced.');
    
    // Then sync structure with ClickHouse
    await syncStructureWithClickHouse(dbConnection);
    console.log('ClickHouse structure successfully synced.');
    
    // Finally dump data to ClickHouse
    await dumpDataToClickHouse(dbConnection);
    console.log('Data successfully dumped to ClickHouse.');
  } catch (err) {
    console.log('Failed during sync process: ' + err.message);
  }
};

// Initialize DB object
db.Sequelize = Sequelize;
db.dbConnection = dbConnection;
db.syncDB = syncDB;

// Import models
db.users = require('./user.js')(dbConnection, Sequelize);
db.products = require('./product.js')(dbConnection, Sequelize);

// Setup hooks for all models to sync with ClickHouse automatically
Object.keys(dbConnection.models).forEach((modelName) => {
  if (dbConnection.models[modelName].associate) {
    dbConnection.models[modelName].associate(dbConnection.models);
  }

  // Add hooks for real-time ClickHouse synchronization
  dbConnection.models[modelName].addHook('afterCreate', async (instance, options) => {
    console.log(`Processing insert operation for model: ${modelName}`);
    await handleClickHouseOperation(async () => {
      await insertIntoClickHouse(modelName, instance.get({ plain: true }));
    });
  });

  dbConnection.models[modelName].addHook('afterUpdate', async (instance, options) => {
    console.log(`Processing update operation for model: ${modelName}`);
    await handleClickHouseOperation(async () => {
      await updateClickHouse(modelName, instance.get({ plain: true }));
    });
  });

  dbConnection.models[modelName].addHook('afterDestroy', async (instance, options) => {
    console.log(`Processing delete operation for model: ${modelName}`);
    await handleClickHouseOperation(async () => {
      await deleteFromClickHouse(modelName, instance.id);
    });
  });
});

// Define ClickHouse operations
const insertIntoClickHouse = async (modelName, data) => {
  try {
    const columns = Object.keys(data);
    const insertQuery = `INSERT INTO ${modelName} (${columns.join(', ')}) VALUES`;
    
    const values = `(${columns.map(col => {
      let value = data[col];
      if (typeof value === 'number' && isNaN(value)) {
        value = null; // Replace NaN with null
      }
      if (value === null || value === undefined) {
        return 'NULL';
      }
      if (typeof value === 'string') {
        return `'${value.replace(/'/g, "\\'")}'`; // Escape single quotes in strings
      }
      if (value instanceof Date) {
        return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`; // Format date strings
      }
      if (typeof value === 'object') {
        return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`; // Convert objects to JSON strings
      }
      return value;
    }).join(', ')})`;
    
    const fullQuery = `${insertQuery} ${values}`;
    console.log(`Inserting into ClickHouse: ${modelName}`, data.id);
    await clickhouse.exec({ query: fullQuery });
  } catch (error) {
    console.error(`Error inserting into ClickHouse for ${modelName}:`, error);
    throw error;
  }
};

const updateClickHouse = async (modelName, data) => {
  try {
    if (data.id) {
      await deleteFromClickHouse(modelName, data.id);
      await insertIntoClickHouse(modelName, data);
      console.log(`Updated in ClickHouse: ${modelName}`, data.id);
    } else {
      console.error(`Cannot update record in ${modelName} without id`);
    }
  } catch (error) {
    console.error(`Error updating in ClickHouse for ${modelName}:`, error);
    throw error;
  }
};

const deleteFromClickHouse = async (modelName, id) => {
  try {
    const deleteQuery = `ALTER TABLE ${modelName} DELETE WHERE id = ${typeof id === 'string' ? `'${id}'` : id}`;
    console.log(`Deleting from ClickHouse: ${modelName}`, id);
    await clickhouse.exec({ query: deleteQuery });
  } catch (error) {
    console.error(`Error deleting from ClickHouse for ${modelName}:`, error);
    throw error;
  }
};

module.exports = db;