module.exports = {
    CONFIG: {
      PORT: process.env.PORT || 3000,
      NODE_ENV: process.env.NODE_ENV || 'development',
      CLICKHOUSE_URL: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      CLICKHOUSE_USER: process.env.CLICKHOUSE_USER || 'default',
      CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || '',
      CLICKHOUSE_DB: process.env.CLICKHOUSE_DB || 'default'
    }
  };