// models/product.js
module.exports = (sequelize, Sequelize) => {
    const Product = sequelize.define("product", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      description: {
        type: Sequelize.STRING
      },
      stock: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }
    });
    
    return Product;
  };