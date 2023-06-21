const express = require('express');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// Konfiguracja bazy danych SQLite
const db = new sqlite3.Database('./database.db');

// Inicjalizacja tabeli użytkowników
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT)');
});

app.use(express.json());

// Endpoint rejestracji użytkownika
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // Sprawdzenie, czy użytkownik o podanej nazwie nie istnieje już w bazie danych
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (row) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Haszowanie hasła przed zapisem do bazy danych
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      // Zapisanie nowego użytkownika do bazy danych
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.status(201).json({ message: 'User registered successfully' });
      });
    });
  });
});

// Endpoint logowania użytkownika
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Pobranie użytkownika o podanej nazwie z bazy danych
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Porównanie hasła wprowadzonego przez użytkownika z hasłem w bazie danych
    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (!result) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generowanie JWT tokena
      const token = jwt.sign({ username: row.username }, 'secret_key');

      res.status(200).json({ token });
    });
  });
});

// Middleware do weryfikacji JWT tokena
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, 'secret_key', (err, user) => {
    if (err) {
      console.error(err);
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = user;
    next();
  });
};

// Endpoint chroniony JWT tokenem
app.get('/protected', authenticateToken, (req, res) => {
  res.status(200).json({ message: 'Protected endpoint' });
});

// Uruchomienie serwera
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
