CREATE DATABASE Bento;
USE Bento;

CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    email VARCHAR(100),
    password VARCHAR(100),
    role VARCHAR(30)
);

CREATE TABLE Profiles (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    bio TEXT,
    major VARCHAR(100),
    year INT,
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE Businesses (
    business_id INT PRIMARY KEY AUTO_INCREMENT,
    owner_id INT,
    name VARCHAR(100),
    description TEXT,
    FOREIGN KEY (owner_id) REFERENCES Users(user_id)
);

CREATE TABLE Products (
    product_id INT PRIMARY KEY AUTO_INCREMENT,
    business_id INT,
    name VARCHAR(100),
    type VARCHAR(50),
    price DECIMAL(10,2),
    FOREIGN KEY (business_id) REFERENCES Businesses(business_id)
);

CREATE TABLE Reviews (
    review_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    product_id INT,
    rating INT,
    comment TEXT,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

CREATE TABLE Events (
    event_id INT PRIMARY KEY AUTO_INCREMENT,
    business_id INT,
    name VARCHAR(100),
    date DATE,
    location VARCHAR(100),
    FOREIGN KEY (business_id) REFERENCES Businesses(business_id)
);

CREATE TABLE Clubs (
    club_id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT,
    name VARCHAR(100),
    description TEXT,
    FOREIGN KEY (admin_id) REFERENCES Users(user_id)
);

CREATE TABLE Memberships (
    membership_id INT PRIMARY KEY AUTO_INCREMENT,
    club_id INT,
    user_id INT,
    status VARCHAR(30),
    FOREIGN KEY (club_id) REFERENCES Clubs(club_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE Follows (
    follower_id INT,
    following_id INT,
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES Users(user_id),
    FOREIGN KEY (following_id) REFERENCES Users(user_id)
);

CREATE TABLE Chats (
    chat_id INT PRIMARY KEY AUTO_INCREMENT,
    user1_id INT,
    user2_id INT,
    FOREIGN KEY (user1_id) REFERENCES Users(user_id),
    FOREIGN KEY (user2_id) REFERENCES Users(user_id)
);

CREATE TABLE Messages (
    message_id INT PRIMARY KEY AUTO_INCREMENT,
    chat_id INT,
    sender_id INT,
    message TEXT,
    FOREIGN KEY (chat_id) REFERENCES Chats(chat_id),
    FOREIGN KEY (sender_id) REFERENCES Users(user_id)
);

CREATE TABLE Orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    product_id INT,
    quantity INT,
    total DECIMAL(10,2),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);