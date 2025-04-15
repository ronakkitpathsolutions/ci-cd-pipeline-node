module.exports = {
    dbConfig: {
      username: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "ips12345",
      database: process.env.DB_NAME || "ci_cd_db",
      host: process.env.DB_HOST || "localhost",
      dialect: "mysql",
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  };