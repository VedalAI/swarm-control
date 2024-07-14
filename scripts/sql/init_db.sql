USE ebs;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    login VARCHAR(255),
    displayName VARCHAR(255),
    banned BOOLEAN
);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(255) NOT NULL,
    state ENUM('rejected', 'prepurchase', 'cancelled', 'paid', 'failed', 'succeeded'),
    cart JSON,
    receipt VARCHAR(1024),
    result TEXT,
    createdAt BIGINT,
    updatedAt BIGINT
);

CREATE TABLE IF NOT EXISTS logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    userId VARCHAR(255),
    transactionToken VARCHAR(255),
    data TEXT NOT NULL,
    fromBackend BOOLEAN NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DELIMITER $$
DROP PROCEDURE IF EXISTS debug
$$
CREATE PROCEDURE debug()
BEGIN
    SET GLOBAL general_log = 'ON';
    SET GLOBAL log_output = 'TABLE';
    -- Then use:
    -- SELECT * FROM mysql.general_log;
END
$$
DELIMITER ;
