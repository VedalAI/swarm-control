USE ebs;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    login VARCHAR(255),
    displayName VARCHAR(255),
    banned BOOLEAN NOT NULL DEFAULT 0,
    credit INT NOT NULL DEFAULT 0
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
